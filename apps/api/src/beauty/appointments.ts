import 'reflect-metadata';
import { assertBranchMethodsOpen } from '../food-service/branch-payment-methods';
import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Inject,
  Injectable,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  beautyPermissionScope,
  appointmentPayment,
  appointmentRefund,
  appointmentStatusAllowed,
  allocateStock,
  customerPhoneKey,
  foodCashBalances,
  nextStatuses,
  milliOf,
  milliText,
  parseAppointmentInput,
  parseAppointmentPayment,
  parseFoodPayment,
  isLoyaltyMethod,
  planAppointment,
  statusChange,
  timeOffWindow,
  type AppointmentPlan,
  type AppointmentItemInput,
  type AppointmentStatus,
  type AppointmentPaymentMethod,
} from '@pms/domain';
import { currentUserId, currentBeautyOperation } from '../auth/request-context';
import { currentBeautyPositionAccess } from './access';
import { lockBeautyCustomerPhone } from './customer-identity';
import { findOrCreateCustomer } from '../customers/identity';
import { RequiresBusinessCapability } from '../auth/capability.decorator';
import { Access } from '../auth/access.decorator';
import { BeautyAccess } from './access.decorator';
import { Prisma, type DbTx } from '@pms/database';
import { PrismaService } from '../database/prisma.provider';
import { beautyScope, beautyTransaction, mayBeauty, mayBeautyWrite, UUID, type BeautyScope } from './scope';
import { fitsSalonHours, intersectLocationHours, salonHours } from './location-hours-policy';
import { appointmentLineHistorySnapshot } from './appointment-history-snapshot';
import { syncAppointmentReminders } from './reminders';
import { checkLoyaltyRefund, prepareLoyaltyPayment, recordLoyaltyPayment, recordLoyaltyRefund } from './loyalty';

/**
 * Журнал записей салона (DATA_MODEL §19.1, срез B5): день филиала столбцами по мастерам.
 *
 * Это аналог шахматки по роли на экране, но **своя таблица и свой экран**: общей таблицы броней и общего
 * «ресурса» у вертикалей нет (ADR-104, `ARCHITECTURE.md` §19).
 *
 * Пересечение записей одного мастера держит база (`EXCLUDE USING gist`). Нарушение 23P01 обрывает всю
 * транзакцию Postgres, поэтому занятость проверяется **до** вставки, как у размещений в гостинице
 * (`reservations.repository.ts`), а перехват нарушения оставлен только на гонку двух запросов.
 *
 * Права по Q-253: журнал это работа смены, то есть `desk`, как создание брони в гостинице.
 */

/** Записи этих состояний место мастера занимают */
export const BUSY: AppointmentStatus[] = ['BOOKED', 'CONFIRMED', 'IN_PROGRESS', 'DONE'];

/** Сетка дня, когда график мастеров ничего не подсказал */
const DEFAULT_FROM = 8 * 60;
const DEFAULT_TO = 20 * 60;

/** Границы сетки: режим работы салона в этот день недели, иначе 08-20; всё видимое расширяет сетку */
function boundsOf(dayHours: Array<{ timeFrom: string; timeTo: string }>, visible: number[]) {
  const base = dayHours.length
    ? {
        from: Math.min(...dayHours.map((interval) => clockMinutes(interval.timeFrom))),
        to: Math.max(...dayHours.map((interval) => clockMinutes(interval.timeTo))),
      }
    : { from: DEFAULT_FROM, to: DEFAULT_TO };
  return {
    fromMinutes: Math.min(base.from, ...visible),
    toMinutes: Math.max(base.to, ...visible),
  };
}
const MAX_PERIOD_DAYS = 366;

const customerFullName = (customer: { firstName: string; lastName: string | null }) =>
  [customer.firstName, customer.lastName]
    .filter((part): part is string => Boolean(part))
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ');

const APPOINTMENT_VIEW_SELECT = {
  id: true,
  employeeId: true,
  serviceId: true,
  startsAt: true,
  endsAt: true,
  status: true,
  price: true,
  currency: true,
  notes: true,
  service: { select: { name: true } },
  employee: { select: { name: true } },
  lines: {
    orderBy: { position: 'asc' },
    select: {
      id: true,
      position: true,
      employeeId: true,
      serviceId: true,
      startsAt: true,
      endsAt: true,
      basePriceMinor: true,
      discountMinor: true,
      surchargeMinor: true,
      priceMinor: true,
      currency: true,
      discountPercent: true,
      employee: { select: { name: true } },
      service: { select: { name: true } },
    },
  },
  customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
  payments: {
    where: { status: 'COMPLETED' },
    orderBy: { occurredAt: 'asc' },
    select: { id: true, kind: true, amount: true, method: true, occurredAt: true },
  },
  // C2 (паритет с zapis.kz): автор и источник уже хранятся, реестр показывает их словами
  source: true,
  createdBy: { select: { name: true, email: true } },
} satisfies Prisma.AppointmentSelect;

type AppointmentViewRow = Prisma.AppointmentGetPayload<{ select: typeof APPOINTMENT_VIEW_SELECT }>;

function appointmentView(row: AppointmentViewRow, timezone: string, anchorDate: string) {
  return {
    id: row.id,
    employeeId: row.employeeId,
    serviceId: row.serviceId,
    serviceName: row.service.name,
    customer: {
      id: row.customer.id,
      name: [row.customer.firstName, row.customer.lastName].filter(Boolean).join(' '),
      phone: row.customer.phone,
    },
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    startMinutes: localMinutes(row.startsAt, timezone, anchorDate),
    endMinutes: localMinutes(row.endsAt, timezone, anchorDate),
    status: row.status,
    next: nextStatuses(row.status as AppointmentStatus, { startsAt: row.startsAt, now: new Date() }),
    priceMinor: row.price.toString(),
    paidMinor: row.payments.reduce((sum, payment) => payment.kind === 'INCOME' ? sum + payment.amount : sum, 0n).toString(),
    paidCashMinor: row.payments.reduce((sum, payment) => payment.kind === 'INCOME' && payment.method === 'CASH' ? sum + payment.amount : sum, 0n).toString(),
    // безнал это живые деньги не наличными; бонусы и сертификат отдельно (решение 21.10.2026)
    paidNonCashMinor: row.payments.reduce((sum, payment) => payment.kind === 'INCOME' && payment.method !== 'CASH' && !isLoyaltyMethod(payment.method) ? sum + payment.amount : sum, 0n).toString(),
    paidLoyaltyMinor: row.payments.reduce((sum, payment) => payment.kind === 'INCOME' && isLoyaltyMethod(payment.method) ? sum + payment.amount : sum, 0n).toString(),
    refundedMinor: row.payments.reduce((sum, payment) => payment.kind === 'EXPENSE' ? sum + payment.amount : sum, 0n).toString(),
    currency: row.currency,
    notes: row.notes,
    source: row.source,
    createdByName: row.createdBy ? (row.createdBy.name ?? row.createdBy.email) : null,
    // A4 (паритет с zapis.kz): платежи записи списком в карточке, а не только суммой
    payments: row.payments.map((payment) => ({
      id: payment.id,
      kind: payment.kind,
      method: payment.method,
      amountMinor: payment.amount.toString(),
      at: payment.occurredAt.toISOString(),
    })),
    items: row.lines.map((line) => ({
      id: line.id,
      position: line.position,
      employeeId: line.employeeId,
      employeeName: line.employee.name,
      serviceId: line.serviceId,
      serviceName: line.service.name,
      startsAt: line.startsAt.toISOString(),
      endsAt: line.endsAt.toISOString(),
      startMinutes: localMinutes(line.startsAt, timezone, anchorDate),
      endMinutes: localMinutes(line.endsAt, timezone, anchorDate),
      durationMinutes: Math.round((line.endsAt.getTime() - line.startsAt.getTime()) / 60_000),
      basePriceMinor: line.basePriceMinor.toString(),
      discountMinor: line.discountMinor.toString(),
      surchargeMinor: line.surchargeMinor.toString(),
      priceMinor: line.priceMinor.toString(),
      currency: line.currency,
      discountPercent: line.discountPercent,
    })),
  };
}

@Injectable()
export class BeautyAppointmentsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** День филиала: мастера столбцами, их рабочие часы, записи и услуги для формы */
  async day(rawDate?: string) {
    const operation = currentBeautyOperation();
    if (!operation || operation.action === 'view') mayBeauty('desk');
    const scope = await beautyScope(this.prisma, true);
    if (!scope.locationId || !scope.locationTimezone || !scope.locationCurrency)
      throw new ConflictException('Сначала выберите филиал');
    const locationId = scope.locationId;
    const timezone = scope.locationTimezone;
    const date = parseDate(rawDate) ?? todayIn(timezone);
    const window = timeOffWindow({ dateFrom: date, dateTo: date, timezone });
    const weekday = weekdayOf(date);
    // Mutation permission does not grant access to the full journal returned by legacy commands.
    if (operation && operation.action !== 'view') {
      const access = await currentBeautyPositionAccess(this.prisma.db);
      if (access.mode === 'ASSIGNED' && beautyPermissionScope(access.permissions, 'journal', 'view') !== 'BUSINESS') {
        const visibleRows = beautyPermissionScope(access.permissions, 'appointments', 'view') === 'BUSINESS'
          ? await this.prisma.db.appointment.findMany({
              where: { locationId, lines: { some: { startsAt: { lt: window.toUtcExclusive }, endsAt: { gt: window.fromUtc } } } },
              orderBy: { startsAt: 'asc' }, select: APPOINTMENT_VIEW_SELECT,
            }) : [];
        return {
          location: { id: locationId, name: scope.locationName, timezone, currency: scope.locationCurrency },
          date, columns: [], services: [],
          appointments: visibleRows.map(row => appointmentView(row, timezone, date)),
          bounds: { fromMinutes: DEFAULT_FROM, toMinutes: DEFAULT_TO },
        };
      }
    }

    const employees = await this.prisma.db.employee.findMany({
      where: {
        businessId: scope.businessId,
        status: 'ACTIVE',
        locations: { some: { locationId } },
        // «другой сотрудник» (администратор, кассир) клиентов не принимает: колонкой журнала не идёт.
        // Его старые записи журнал всё равно покажет колонкой «(не принимает)» (calendarColumns на стойке).
        OR: [{ personnelKind: null }, { personnelKind: { not: 'OTHER_EMPLOYEE' } }],
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        workingHours: {
          where: { locationId, weekday },
          orderBy: { timeFrom: 'asc' },
          select: { timeFrom: true, timeTo: true },
        },
        timeOffs: {
          where: { dateFrom: { lte: asDate(date) }, dateTo: { gte: asDate(date) } },
          select: { reason: true },
        },
        services: { select: { serviceId: true } },
      },
    });

    const rows = await this.prisma.db.appointment.findMany({
      where: {
        locationId,
        lines: { some: { startsAt: { lt: window.toUtcExclusive }, endsAt: { gt: window.fromUtc } } },
      },
      orderBy: { startsAt: 'asc' },
      select: APPOINTMENT_VIEW_SELECT,
    });

    const [services, masterPrices] = await Promise.all([this.prisma.db.beautyService.findMany({
      where: { businessId: scope.businessId, active: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        category: true,
        durationMinutes: true,
        price: true,
        currency: true,
        locations: { where: { locationId }, select: { enabled: true, priceOverride: true, durationOverride: true } },
      },
    }), this.prisma.db.employeeServicePrice.findMany({
      where: { locationId },
      orderBy: [{ serviceId: 'asc' }, { employeeId: 'asc' }],
    })]);

    const opening = await this.prisma.db.beautyLocationHours.findUnique({ where: { locationId } });
    const openHours = opening ? salonHours(opening.intervals) : null;

    const columns = employees.map((e) => ({
      id: e.id,
      name: e.name,
      intervals: intersectLocationHours(e.workingHours.map((h) => ({ timeFrom: clockOf(h.timeFrom), timeTo: clockOf(h.timeTo) })), openHours, weekday),
      timeOff: e.timeOffs.length > 0,
      timeOffReason: e.timeOffs[0]?.reason ?? null,
      serviceIds: e.services.map((s) => s.serviceId),
    }));

    const minutes = columns.flatMap((c) => c.intervals).flatMap((i) => [clockMinutes(i.timeFrom), clockMinutes(i.timeTo)]);
    const placed = rows.map((row) => appointmentView(row, timezone, date));
    const spans = placed.flatMap((p) => [p.startMinutes, p.endMinutes]);

    return {
      location: { id: locationId, name: scope.locationName, timezone, currency: scope.locationCurrency },
      date,
      columns,
      appointments: placed,
      services: services.map((s) => {
        const own = s.locations[0] ?? null;
        const inheritedPrice = own?.priceOverride ?? (s.currency === scope.locationCurrency ? s.price : null);
        const inheritedDuration = own?.durationOverride ?? s.durationMinutes;
        return {
          id: s.id,
          name: s.name,
          category: s.category,
          sellable: own !== null && own.enabled && (
            inheritedPrice !== null || masterPrices.some((price) => price.serviceId === s.id)
          ),
          durationMinutes: own?.durationOverride ?? s.durationMinutes,
          priceMinor: (own?.priceOverride ?? s.price).toString(),
          currency: own?.priceOverride === null || own?.priceOverride === undefined ? s.currency : scope.locationCurrency,
          masterPrices: columns
            .filter((column) => column.serviceIds.includes(s.id))
            .map((column) => {
              const price = masterPrices.find((row) => row.employeeId === column.id && row.serviceId === s.id);
              return price
                ? {
                    employeeId: column.id,
                    priceType: price.priceType,
                    priceMinMinor: price.priceMinMinor?.toString() ?? null,
                    priceMaxMinor: price.priceMaxMinor?.toString() ?? null,
                    durationMinutes: price.durationMinutes ?? inheritedDuration,
                    currency: price.currency,
                    source: 'MASTER' as const,
                    revision: price.revision,
                  }
                : {
                    employeeId: column.id,
                    priceType: 'FIXED' as const,
                    priceMinMinor: inheritedPrice?.toString() ?? null,
                    priceMaxMinor: inheritedPrice?.toString() ?? null,
                    durationMinutes: inheritedDuration,
                    currency: scope.locationCurrency,
                    source: own?.priceOverride !== null && own?.priceOverride !== undefined ? 'LOCATION' as const : 'CATALOG' as const,
                    revision: null,
                  };
            }),
        };
      }),
      bounds: boundsOf(
        // B4 (паритет с zapis.kz): сетка идёт по режиму работы салона (137); записи вне режима её расширяют
        openHours?.filter((interval) => interval.weekday === weekday) ?? [],
        [...minutes, ...spans],
      ),
    };
  }

  /** Журнал записей за период филиала, без календарных колонок и справочников формы */
  async period(rawFrom?: string, rawTo?: string) {
    mayBeauty('desk');
    const scope = await beautyScope(this.prisma, true);
    if (!scope.locationId || !scope.locationTimezone || !scope.locationCurrency)
      throw new ConflictException('Сначала выберите филиал');
    const defaultDate = rawFrom === undefined && rawTo === undefined ? todayIn(scope.locationTimezone) : undefined;
    const period = checkedPeriod(rawFrom ?? defaultDate, rawTo ?? defaultDate);
    const window = timeOffWindow({ dateFrom: period.from, dateTo: period.to, timezone: scope.locationTimezone });
    const rows = await this.prisma.db.appointment.findMany({
      where: {
        locationId: scope.locationId,
        lines: { some: {
          startsAt: { lt: window.toUtcExclusive },
          endsAt: { gt: window.fromUtc },
        } },
      },
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      select: APPOINTMENT_VIEW_SELECT,
    });
    return {
      location: {
        id: scope.locationId,
        name: scope.locationName,
        timezone: scope.locationTimezone,
        currency: scope.locationCurrency,
      },
      period,
      appointments: rows.map((row) => {
        const date = localDate(row.startsAt, scope.locationTimezone!);
        return { ...appointmentView(row, scope.locationTimezone!, date), localDate: date };
      }),
    };
  }

  /** Новая запись. Клиент либо выбран, либо заводится вместе с записью: своего экрана у клиентов ещё нет */
  async create(raw: unknown) {
    await mayBeautyWrite(this.prisma, 'desk');
    const scope = await beautyScope(this.prisma, true);
    if (!scope.locationId) throw new ConflictException('Сначала выберите филиал');
    const parsed = parseAppointmentInput(raw);
    if (!parsed.ok) throw new BadRequestException(parsed.reason);
    const input = parsed.value;
    this.assertRatePermission(input.items);
    const preflight = await this.planLines(this.prisma.db, scope, input.items, input.startsAt);
    for (const line of preflight)
      await this.assertFree(this.prisma.db, line.employeeId, line.startsAt, line.endsAt, null);

    const locationId = scope.locationId;
    const id = randomUUID();
    const savedStartsAt = await beautyTransaction(this.prisma, scope, async (tx) => {
      const lines = await this.planLines(tx, scope, input.items, input.startsAt);
      for (const line of lines)
        await this.assertFree(tx, line.employeeId, line.startsAt, line.endsAt, null);
      const first = lines[0]!;
      const last = lines.at(-1)!;
      const total = lines.reduce((sum, line) => sum + line.priceMinor, 0n);
      let customerId: string;
      if (input.customer.kind === 'existing') {
        if (!UUID.test(input.customer.id)) throw new NotFoundException('Клиент не найден');
        const own = await tx.customer.findFirst({
          where: { id: input.customer.id, organizationId: scope.organizationId, status: 'ACTIVE' },
          select: { id: true },
        });
        if (!own) throw new NotFoundException('Клиент не найден');
        customerId = own.id;
      } else {
        const normalizedPhone = customerPhoneKey(input.customer.phone);
        if (normalizedPhone) {
          await lockBeautyCustomerPhone(tx, scope.organizationId, normalizedPhone);
          const known = await tx.customer.findFirst({
            where: { organizationId: scope.organizationId, phoneNormalized: normalizedPhone },
            select: { id: true, status: true, firstName: true, lastName: true },
          });
          if (known && known.status !== 'ACTIVE') throw new ConflictException('Клиент в архиве');
          if (known && customerFullName(known) !== customerFullName(input.customer))
            throw new ConflictException(
              'Клиент с этим телефоном сохранён под другим именем. Выберите существующего клиента из списка.',
            );
          customerId = known?.id
            ?? (await findOrCreateCustomer(tx, scope.organizationId, input.customer)).id;
        } else {
          customerId = (await findOrCreateCustomer(tx, scope.organizationId, input.customer)).id;
        }
      }
      // клиент становится виден бизнесу при первом обращении в него (§19.1)
      await tx.customerBusiness.createMany({
        data: [{ customerId, businessId: scope.businessId }],
        skipDuplicates: true,
      });

      await tx.$queryRaw`SELECT set_config('wetop.appointment_lines_write','on',true)`;
      await tx.appointment.create({
        data: {
          id,
          locationId,
          customerId,
          employeeId: first.employeeId,
          serviceId: first.serviceId,
          startsAt: first.startsAt,
          endsAt: last.endsAt,
          price: total,
          currency: first.currency,
          notes: input.notes,
          createdById: currentUserId(),
        },
      });
      await tx.appointmentLine.deleteMany({ where: { appointmentId: id } });
      await tx.appointmentLine.createMany({
        data: lines.map((line, position) => ({
          id: randomUUID(), appointmentId: id, position,
          employeeId: line.employeeId, serviceId: line.serviceId,
          startsAt: line.startsAt, endsAt: line.endsAt,
          basePriceMinor: line.basePriceMinor, discountMinor: line.discountMinor,
          surchargeMinor: line.surchargeMinor, priceMinor: line.priceMinor,
          currency: line.currency, discountPercent: line.discountPercent,
        })),
      });
      await tx.auditLog.create({
        data: {
          organizationId: scope.organizationId,
          userId: currentUserId(),
          entityType: 'appointment',
          entityId: id,
          action: 'beauty.appointment.created',
          after: {
            locationId,
            employeeId: first.employeeId,
            serviceId: first.serviceId,
            startsAt: first.startsAt.toISOString(),
            endsAt: last.endsAt.toISOString(),
            priceMinor: total.toString(),
            currency: first.currency,
            items: lines.map((line, position) => appointmentLineHistorySnapshot(line, position)),
          },
        },
      });
      // напоминания клиенту в той же транзакции (решение 21.10.2026 §1)
      await syncAppointmentReminders(tx, id);
      return first.startsAt;
    });
    return this.day(localDate(savedStartsAt, scope.locationTimezone ?? 'UTC'));
  }

  /** Перенос записи: другое время, другой мастер или другая услуга. Цена пересчитывается снимком заново */
  async move(id: string, raw: unknown) {
    await mayBeautyWrite(this.prisma, 'desk');
    const { scope, row } = await this.own(id);
    if (!nextStatuses(row.status as AppointmentStatus).length)
      throw new ConflictException('Запись закрыта, переносить её уже нельзя');
    if (row.currency !== scope.locationCurrency)
      throw new ConflictException('Валюта записи не совпадает с валютой филиала');

    const body = (raw ?? {}) as Record<string, unknown>;
    const startsAt = body['startsAt'] === undefined ? row.startsAt : new Date(String(body['startsAt']));
    if (Number.isNaN(startsAt.getTime())) throw new BadRequestException('Время записи не разобрать');
    let itemInputs: AppointmentItemInput[];
    let manualEdit = false;
    if (body['items'] !== undefined) {
      const parsed = parseAppointmentInput({ ...body, startsAt: startsAt.toISOString(), customerId: 'existing' });
      if (!parsed.ok) throw new BadRequestException(parsed.reason);
      itemInputs = parsed.value.items;
      manualEdit = true;
    } else if (body['employeeId'] !== undefined || body['serviceId'] !== undefined) {
      itemInputs = row.lines.map((line, position) => ({
        employeeId: position === 0 && typeof body['employeeId'] === 'string'
          ? body['employeeId']
          : line.employeeId,
        serviceId: position === 0 && typeof body['serviceId'] === 'string'
          ? body['serviceId']
          : line.serviceId,
        durationMinutes: position === 0 && typeof body['serviceId'] === 'string'
          ? null
          : Math.round((line.endsAt.getTime() - line.startsAt.getTime()) / 60_000),
        basePriceMinor: position === 0 && typeof body['serviceId'] === 'string'
          ? null
          : line.basePriceMinor,
        discountMinor: line.discountMinor,
        discountPercent: line.discountPercent,
        surchargeMinor: line.surchargeMinor,
      }));
    } else {
      itemInputs = row.lines.map((line) => ({
        employeeId: line.employeeId,
        serviceId: line.serviceId,
        durationMinutes: Math.round((line.endsAt.getTime() - line.startsAt.getTime()) / 60_000),
        basePriceMinor: line.basePriceMinor,
        discountMinor: line.discountMinor,
        discountPercent: line.discountPercent,
        surchargeMinor: line.surchargeMinor,
      }));
    }
    if (manualEdit) this.assertRatePermission(itemInputs);
    const preserveSnapshots = itemInputs.map((_, position) =>
      !manualEdit && !(position === 0 && typeof body['serviceId'] === 'string'));
    const preflight = await this.planLines(this.prisma.db, scope, itemInputs, startsAt, preserveSnapshots);
    for (const line of preflight)
      await this.assertFree(this.prisma.db, line.employeeId, line.startsAt, line.endsAt, row.id);

    const savedStartsAt = await beautyTransaction(this.prisma, scope, async (tx) => {
      const lines = await this.planLines(tx, scope, itemInputs, startsAt, preserveSnapshots);
      if (manualEdit) this.assertMoveRatePermission(row.lines, lines);
      for (const line of lines)
        await this.assertFree(tx, line.employeeId, line.startsAt, line.endsAt, row.id);
      const first = lines[0]!;
      const last = lines.at(-1)!;
      const total = lines.reduce((sum, line) => sum + line.priceMinor, 0n);
      if (total < (await this.paidLocked(tx, row.id)))
        throw new ConflictException('Цена услуги меньше уже оплаченного: сначала аннулируйте оплату в кассе');
      await tx.$queryRaw`SELECT set_config('wetop.appointment_lines_write','on',true)`;
      await tx.appointmentLine.deleteMany({ where: { appointmentId: row.id } });
      await tx.appointmentLine.createMany({
        data: lines.map((line, position) => ({
          id: randomUUID(), appointmentId: row.id, position,
          employeeId: line.employeeId, serviceId: line.serviceId,
          startsAt: line.startsAt, endsAt: line.endsAt,
          basePriceMinor: line.basePriceMinor, discountMinor: line.discountMinor,
          surchargeMinor: line.surchargeMinor, priceMinor: line.priceMinor,
          currency: line.currency, discountPercent: line.discountPercent,
        })),
      });
      const changed = await tx.appointment.updateMany({
        where: { id: row.id, status: row.status, updatedAt: row.updatedAt },
        data: {
          employeeId: first.employeeId,
          serviceId: first.serviceId,
          startsAt: first.startsAt,
          endsAt: last.endsAt,
          price: total,
          currency: first.currency,
          ...(body['notes'] !== undefined ? { notes: String(body['notes'] ?? '').trim() || null } : {}),
        },
      });
      if (changed.count !== 1) throw new ConflictException('Запись уже изменена, обновите данные');
      await tx.auditLog.create({
        data: {
          organizationId: scope.organizationId,
          userId: currentUserId(),
          entityType: 'appointment',
          entityId: row.id,
          action: 'beauty.appointment.moved',
          before: {
            employeeId: row.employeeId,
            serviceId: row.serviceId,
            startsAt: row.startsAt.toISOString(),
            endsAt: row.endsAt.toISOString(),
            priceMinor: row.price.toString(),
            currency: row.currency,
            items: row.lines.map((line) => appointmentLineHistorySnapshot(line, line.position)),
          },
          after: {
            employeeId: first.employeeId,
            serviceId: first.serviceId,
            startsAt: first.startsAt.toISOString(),
            endsAt: last.endsAt.toISOString(),
            priceMinor: total.toString(),
            currency: first.currency,
            items: lines.map((line, position) => appointmentLineHistorySnapshot(line, position)),
          },
        },
      });
      await syncAppointmentReminders(tx, row.id);
      return first.startsAt;
    });
    return this.day(localDate(savedStartsAt, scope.locationTimezone ?? 'UTC'));
  }

  /** Состояние записи: подтвердили, выполнили, незаезд, отменили */
  async setStatus(id: string, raw: unknown) {
    await mayBeautyWrite(this.prisma, 'desk');
    const { scope, row } = await this.own(id);
    const body = (raw ?? {}) as Record<string, unknown>;
    const to = String(body['status'] ?? '') as AppointmentStatus;
    const change = statusChange(row.status as AppointmentStatus, to, { startsAt: row.startsAt, now: new Date() });
    if (!change.ok) throw new ConflictException(change.reason);

    await beautyTransaction(this.prisma, scope, async (tx) => {
      const refused = appointmentStatusAllowed(to, await this.paidLocked(tx, row.id));
      if (refused) throw new ConflictException(refused);
      const materials = to === 'DONE' ? await this.consumeMaterials(tx, scope, row.id) : null;
      await tx.$queryRaw`SELECT set_config('wetop.appointment_lines_write','on',true)`;
      const changed = await tx.appointment.updateMany({ where: { id: row.id, status: row.status, updatedAt: row.updatedAt }, data: { status: to } });
      if (changed.count !== 1) throw new ConflictException('Запись уже изменена, обновите данные');
      await tx.auditLog.create({
        data: {
          organizationId: scope.organizationId,
          userId: currentUserId(),
          entityType: 'appointment',
          entityId: row.id,
          action: 'beauty.appointment.status',
          before: { status: row.status },
          after: materials ? { status: to, materials } : { status: to },
        },
      });
      // отмена, незаезд и «Выполнено» снимают ждущие напоминания; подтверждение их сохраняет
      await syncAppointmentReminders(tx, row.id);
    });
    return this.day(localDate(row.startsAt, scope.locationTimezone ?? 'UTC'));
  }

  /** Оплата записи приходом кассы филиала (§49): частями, не больше цены, повтор по ключу без второго прихода */
  async pay(id: string, raw: unknown) {
    await mayBeautyWrite(this.prisma, 'desk');
    const { scope, row } = await this.own(id);
    const locationId = scope.locationId as string;
    const parsed = parseAppointmentPayment(raw);
    if (!parsed.ok) throw new BadRequestException(parsed.reason);
    const input = parsed.value;
    await beautyTransaction(this.prisma, scope, async (tx) => {
      const replay = await tx.restaurantCashOperation.findFirst({ where: { locationId, idempotencyKey: input.idempotencyKey } });
      if (replay) {
        if (replay.appointmentId !== row.id) throw new ConflictException('Этот ключ оплаты уже использован');
        return;
      }
      // §21.7: выключенный в филиале способ не принимает оплату записи; бонусы и сертификат не деньги кассы
      await assertBranchMethodsOpen(tx, locationId, input.method);
      const paid = await this.paidLocked(tx, row.id);
      const a = await tx.appointment.findUniqueOrThrow({
        where: { id: row.id },
        select: { status: true, price: true, currency: true, customerId: true, customer: { select: { firstName: true, lastName: true } } },
      });
      if (a.currency !== scope.locationCurrency) throw new ConflictException('Валюта записи не совпадает с валютой филиала');
      try {
        appointmentPayment(a.status as AppointmentStatus, a.price, paid, input.amount);
      } catch (error) {
        throw new ConflictException((error as Error).message);
      }
      // бонусы: баланс и доля чека; сертификат: код, срок, свой бизнес, остаток под замком строки (частично)
      const loyalty = await prepareLoyaltyPayment(tx, scope, input, { id: row.id, customerId: a.customerId, price: a.price, currency: a.currency });
      const amount = loyalty.amount;
      const name = [a.customer.firstName, a.customer.lastName].filter(Boolean).join(' ');
      const op = await tx.restaurantCashOperation.create({
        data: {
          locationId,
          kind: 'INCOME',
          method: input.method,
          amount,
          currency: a.currency,
          note: `Оплата записи: ${name}`.slice(0, 500),
          appointmentId: row.id,
          idempotencyKey: input.idempotencyKey,
          createdById: currentUserId() ?? null,
        },
      });
      const { accruedMinor } = await recordLoyaltyPayment(
        tx, scope,
        { id: op.id, kind: 'INCOME', method: op.method, amount: op.amount, currency: op.currency, appointmentId: row.id },
        { id: row.id, customerId: a.customerId }, loyalty.certificateId,
      );
      await tx.auditLog.create({
        data: {
          organizationId: scope.organizationId,
          userId: currentUserId(),
          entityType: 'appointment',
          entityId: row.id,
          action: 'beauty.appointment.paid',
          after: {
            cashOperationId: op.id, method: input.method, amountMinor: amount.toString(), paidMinor: (paid + amount).toString(),
            ...(accruedMinor > 0n ? { bonusAccruedMinor: accruedMinor.toString() } : {}),
            ...(loyalty.certificateId ? { giftCertificateId: loyalty.certificateId } : {}),
          },
        },
      });
    });
    return this.day(localDate(row.startsAt, scope.locationTimezone ?? 'UTC'));
  }

  /** Возврат по выполненной записи расходом кассы филиала (§54): причина, не больше чистой оплаты и остатка способа */
  async refund(id: string, raw: unknown) {
    await mayBeautyWrite(this.prisma, 'refunds');
    const { scope, row } = await this.own(id);
    const locationId = scope.locationId as string;
    const { reason: rawReason, ...rest } = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    let input: { method: string; amount: bigint; idempotencyKey: string };
    let reason: string;
    try {
      // возврат бонусами или на сертификат: тот же разбор, способ лояльности без кода
      const method = (rest as Record<string, unknown>)['method'];
      input = typeof method === 'string' && isLoyaltyMethod(method)
        ? { ...parseFoodPayment({ ...rest, method: 'CASH' }), method }
        : parseFoodPayment(rest);
      reason = String(rawReason ?? '').trim();
      if (!reason || reason.length > 300) throw new Error('Укажите причину возврата, до 300 знаков');
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
    await beautyTransaction(this.prisma, scope, async (tx) => {
      const replay = await tx.restaurantCashOperation.findFirst({ where: { locationId, idempotencyKey: input.idempotencyKey } });
      if (replay) {
        if (replay.appointmentId !== row.id || replay.kind !== 'EXPENSE') throw new ConflictException('Этот ключ возврата уже использован');
        return;
      }
      const paidNet = await this.paidLocked(tx, row.id);
      const a = await tx.appointment.findUniqueOrThrow({
        where: { id: row.id },
        select: { status: true, currency: true, customerId: true, customer: { select: { firstName: true, lastName: true } } },
      });
      try {
        appointmentRefund(a.status as AppointmentStatus, paidNet, input.amount);
      } catch (error) {
        throw new ConflictException((error as Error).message);
      }
      await checkLoyaltyRefund(tx, row.id, input.method, input.amount);
      const moneyIncome = (await tx.restaurantCashOperation.aggregate({
        where: { appointmentId: row.id, kind: 'INCOME', status: 'COMPLETED', method: { notIn: ['BONUS', 'GIFT_CERTIFICATE'] } },
        _sum: { amount: true },
      }))._sum.amount ?? 0n;
      // расход кассы не уводит способ в минус (§35.2): тот же расчёт остатков, что у самой кассы
      const [payments, ops] = await Promise.all([
        tx.restaurantPayment.groupBy({ by: ['method', 'status'], where: { locationId }, _sum: { amount: true } }),
        tx.restaurantCashOperation.groupBy({ by: ['kind', 'method', 'methodTo', 'status'], where: { locationId }, _sum: { amount: true } }),
      ]);
      const balances = foodCashBalances(
        payments.map((p) => ({ method: p.method, amount: p._sum.amount ?? 0n, status: p.status })),
        ops.map((o) => ({ kind: o.kind, method: o.method, methodTo: o.methodTo, amount: o._sum.amount ?? 0n, status: o.status })),
      );
      if (!isLoyaltyMethod(input.method) && input.amount > (balances[input.method as keyof typeof balances] ?? 0n))
        throw new ConflictException('В кассе по этому способу меньше этой суммы');
      const name = [a.customer.firstName, a.customer.lastName].filter(Boolean).join(' ');
      const op = await tx.restaurantCashOperation.create({
        data: {
          locationId,
          kind: 'EXPENSE',
          method: input.method as AppointmentPaymentMethod,
          amount: input.amount,
          currency: a.currency,
          note: `Возврат по записи: ${name}. Причина: ${reason}`.slice(0, 500),
          appointmentId: row.id,
          idempotencyKey: input.idempotencyKey,
          createdById: currentUserId() ?? null,
        },
      });
      // бонусы назад, остаток на сертификат, начисленное с денег снимается пропорционально
      await recordLoyaltyRefund(
        tx, scope,
        { id: op.id, kind: 'EXPENSE', method: op.method, amount: op.amount, currency: op.currency, appointmentId: row.id },
        { id: row.id, customerId: a.customerId }, moneyIncome,
      );
      await tx.auditLog.create({
        data: {
          organizationId: scope.organizationId,
          userId: currentUserId(),
          entityType: 'appointment',
          entityId: row.id,
          action: 'beauty.appointment.refunded',
          after: { cashOperationId: op.id, method: input.method, amountMinor: input.amount.toString(), reason },
        },
      });
    });
    return this.day(localDate(row.startsAt, scope.locationTimezone ?? 'UTC'));
  }

  /**
   * Списание по техкарте при первом DONE. Возвращает снимок использованных техкарт для журнала:
   * id строки, услуга, точная revision и нормы, без названий, партий и себестоимости.
   * null: повторный DONE, списание уже было и нового снимка нет.
   */
  private async consumeMaterials(tx: DbTx, scope: BeautyScope, appointmentId: string): Promise<Array<{
    appointmentLineId: string; serviceId: string; recipeRevision: number;
    items: Array<{ productId: string; normQty: string; unit: string }>;
  }> | null> {
    const completed = await tx.auditLog.findFirst({
      where: {
        entityType: 'appointment', entityId: appointmentId, action: 'beauty.appointment.status',
        after: { path: ['status'], equals: 'DONE' },
      },
      select: { id: true },
    });
    if (completed) return null;
    // Сначала FOR SHARE на услугах записи: состав техкарты и её revision читаются под одним замком
    const lineServices = await tx.appointmentLine.findMany({ where: { appointmentId }, select: { serviceId: true } });
    const serviceIds = [...new Set(lineServices.map((line) => line.serviceId))].sort();
    if (serviceIds.length)
      await tx.$queryRaw`SELECT id FROM beauty_services WHERE id IN (${Prisma.join(serviceIds.map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR SHARE`;
    const lines = await tx.appointmentLine.findMany({
      where: { appointmentId },
      orderBy: { position: 'asc' },
      select: {
        id: true,
        serviceId: true,
        service: { select: { name: true, materials: {
          orderBy: { productId: 'asc' },
          select: { productId: true, normQty: true, unit: true, product: { select: { name: true } } },
        } } },
      },
    });
    const revisions = new Map((serviceIds.length ? await tx.beautyServiceMaterialRevision.findMany({
      where: { serviceId: { in: serviceIds } }, select: { serviceId: true, revision: true },
    }) : []).map((row) => [row.serviceId, row.revision]));
    const provenance = lines.map((line) => ({
      appointmentLineId: line.id,
      serviceId: line.serviceId,
      recipeRevision: revisions.get(line.serviceId) ?? 0,
      items: line.service.materials.map((material) => ({
        productId: material.productId, normQty: milliText(milliOf(material.normQty)), unit: material.unit,
      })),
    }));
    const productIds = [...new Set(lines.flatMap((line) => line.service.materials.map((material) => material.productId)))].sort();
    if (!productIds.length) return provenance;
    await tx.$queryRaw`SELECT id FROM kitchen_products WHERE id IN (${Prisma.join(productIds.map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR SHARE`;
    await tx.$queryRaw`SELECT id FROM kitchen_stock_lots
      WHERE location_id = ${scope.locationId!}::uuid AND product_id IN (${Prisma.join(productIds.map((id) => Prisma.sql`${id}::uuid`))})
        AND reversed_at IS NULL AND remaining_qty > 0
      ORDER BY product_id, received_on, created_at, id FOR UPDATE`;
    const lots = await tx.kitchenStockLot.findMany({
      where: { locationId: scope.locationId!, productId: { in: productIds }, reversedAt: null, remainingQty: { gt: 0 } },
      orderBy: [{ productId: 'asc' }, { receivedOn: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });
    const required = new Map<string, { milli: bigint; name: string; unit: string }>();
    for (const line of lines) for (const material of line.service.materials) {
      const seen = required.get(material.productId);
      const milli = milliOf(material.normQty);
      required.set(material.productId, { milli: (seen?.milli ?? 0n) + milli, name: material.product.name, unit: material.unit });
    }
    const missing = [...required].filter(([productId, need]) =>
      lots.filter((lot) => lot.productId === productId).reduce((sum, lot) => sum + milliOf(lot.remainingQty), 0n) < need.milli,
    );
    if (missing.length) throw new ConflictException(`Недостаточно материалов на складе: ${missing.map(([, item]) => item.name).join(', ')}`);
    const remaining = new Map(lots.map((lot) => [lot.id, milliOf(lot.remainingQty)]));
    for (const line of lines) for (const material of line.service.materials) {
      const productLots = lots.filter((lot) => lot.productId === material.productId);
      const plan = allocateStock(productLots.map((lot) => ({
        id: lot.id, receivedOn: lot.receivedOn.toISOString().slice(0, 10), createdAt: lot.createdAt,
        remaining: remaining.get(lot.id) ?? 0n, unitCost: lot.unitCost,
      })), milliOf(material.normQty), material.unit);
      for (const allocation of plan.allocations) {
        remaining.set(allocation.lotId, (remaining.get(allocation.lotId) ?? 0n) - allocation.milli);
        await tx.kitchenStockLot.update({ where: { id: allocation.lotId }, data: { remainingQty: milliText(remaining.get(allocation.lotId)!) } });
        await tx.kitchenStockMovement.create({ data: {
          locationId: scope.locationId!, productId: material.productId, lotId: allocation.lotId,
          appointmentLineId: line.id, kind: 'CONSUMPTION', qty: milliText(-allocation.milli),
          cost: -allocation.cost, reason: `Услуга: ${line.service.name}`, createdById: currentUserId() ?? null,
        } });
      }
    }
    return provenance;
  }

  /** Чистая оплата записи под замком записи (§49, §54): оплаты минус возвраты; оплата, возврат, отмена и перенос по очереди */
  private async paidLocked(tx: DbTx, appointmentId: string): Promise<bigint> {
    await tx.$queryRaw`SELECT id FROM appointments WHERE id = ${appointmentId}::uuid FOR UPDATE`;
    const sums = await tx.restaurantCashOperation.groupBy({ by: ['kind'], where: { appointmentId, status: 'COMPLETED' }, _sum: { amount: true } });
    return sums.reduce((net, s) => (s.kind === 'INCOME' ? net + (s._sum.amount ?? 0n) : net - (s._sum.amount ?? 0n)), 0n);
  }

  // ───────────── общее ─────────────

  /** Запись своего филиала. Чужая и несуществующая одинаково не найдены */
  private async own(id: string) {
    if (!UUID.test(id)) throw new NotFoundException('Запись не найдена');
    const scope = await beautyScope(this.prisma, true);
    if (!scope.locationId) throw new ConflictException('Сначала выберите филиал');
    const row = await this.prisma.db.appointment.findFirst({
      where: { id, locationId: scope.locationId },
      select: {
        id: true,
        employeeId: true,
        serviceId: true,
        startsAt: true,
        endsAt: true,
        status: true,
        updatedAt: true,
        price: true,
        currency: true,
        lines: {
          orderBy: { position: 'asc' },
          select: {
            position: true, employeeId: true, serviceId: true, startsAt: true, endsAt: true,
            basePriceMinor: true, discountMinor: true, surchargeMinor: true,
            discountPercent: true, priceMinor: true, currency: true,
          },
        },
      },
    });
    if (!row) throw new NotFoundException('Запись не найдена');
    return { scope, row };
  }

  private assertRatePermission(items: readonly AppointmentItemInput[]) {
    if (items.some((item) =>
      item.durationMinutes !== null || item.basePriceMinor !== null || item.discountMinor !== 0n
      || item.discountPercent !== null || item.surchargeMinor !== 0n)) mayBeauty('rates');
  }

  private assertMoveRatePermission(
    previous: ReadonlyArray<{
      employeeId: string;
      serviceId: string;
      startsAt: Date;
      endsAt: Date;
      basePriceMinor: bigint;
      discountMinor: bigint;
      surchargeMinor: bigint;
      discountPercent: number | null;
    }>,
    next: readonly PlannedAppointmentLine[],
  ) {
    const protectedChange = previous.some((line, position) => {
      const planned = next[position];
      if (!planned) return false;
      const sameOffering = line.employeeId === planned.employeeId && line.serviceId === planned.serviceId;
      const durationMinutes = Math.round((line.endsAt.getTime() - line.startsAt.getTime()) / 60_000);
      return line.discountMinor !== planned.discountMinor
        || line.discountPercent !== planned.discountPercent
        || line.surchargeMinor !== planned.surchargeMinor
        || (sameOffering && line.basePriceMinor !== planned.basePriceMinor)
        || (sameOffering && durationMinutes !== planned.durationMinutes);
    });
    if (protectedChange) mayBeauty('rates');
  }

  private async planLines(
    db: BeautyDb,
    scope: BeautyScope,
    items: readonly AppointmentItemInput[],
    startsAt: Date,
    preserveSnapshots: boolean | readonly boolean[] = false,
  ): Promise<PlannedAppointmentLine[]> {
    const lines: PlannedAppointmentLine[] = [];
    let cursor = startsAt;
    for (const [position, item] of items.entries()) {
      const plan = await planBeautyAppointment(db, scope, item.employeeId, item.serviceId, cursor, item);
      const durationMinutes = item.durationMinutes ?? plan.durationMinutes;
      const endsAt = new Date(cursor.getTime() + durationMinutes * 60_000);
      const preserveSnapshot = typeof preserveSnapshots === 'boolean'
        ? preserveSnapshots
        : preserveSnapshots[position] === true;
      const basePriceMinor = preserveSnapshot && item.basePriceMinor !== null ? item.basePriceMinor : plan.basePriceMinor;
      const discountMinor = preserveSnapshot
        ? item.discountMinor
        : item.discountPercent !== null
        ? (basePriceMinor * BigInt(item.discountPercent)) / 100n
        : item.discountMinor;
      if (discountMinor > basePriceMinor) throw new BadRequestException('Скидка больше цены услуги');
      const priceMinor = basePriceMinor - discountMinor + item.surchargeMinor;
      lines.push({
        employeeId: item.employeeId, serviceId: item.serviceId,
        startsAt: cursor, endsAt, durationMinutes,
        basePriceMinor, discountMinor, discountPercent: item.discountPercent,
        surchargeMinor: item.surchargeMinor, priceMinor, currency: plan.currency,
      });
      cursor = endsAt;
    }
    return lines;
  }

  private async assertFree(
    db: Pick<DbTx, 'appointmentLine'>,
    employeeId: string,
    startsAt: Date,
    endsAt: Date,
    exceptId: string | null,
  ) {
    if (await employeeBusy(db, employeeId, startsAt, endsAt, exceptId))
      throw new ConflictException('Мастер в это время уже занят');
  }
}

type PlannedAppointmentLine = AppointmentPlan & {
  employeeId: string;
  serviceId: string;
  basePriceMinor: bigint;
  discountMinor: bigint;
  surchargeMinor: bigint;
  discountPercent: number | null;
};


// ───────────── общее со записью с сайта (SITE-4) ─────────────

type BeautyDb = Pick<DbTx, 'employee' | 'beautyService' | 'employeeServicePrice' | 'appointmentLine' | 'beautyLocationHours'>;
type PlanScope = Pick<BeautyScope, 'businessId' | 'locationId' | 'locationTimezone' | 'locationCurrency'>;

/**
 * Цена, длительность и попадание в график. Мастер и услуга проверяются на свой бизнес и свой филиал
 * здесь же: база это тоже держит триггером, но её сообщение человеку не ответ. Один расчёт у стойки и у формы сайта.
 */
export async function planBeautyAppointment(
  db: BeautyDb,
  scope: PlanScope,
  employeeId: string,
  serviceId: string,
  startsAt: Date,
  requested?: AppointmentItemInput,
): Promise<AppointmentPlan & { basePriceMinor: bigint }> {
  const locationId = scope.locationId as string;
  if (!UUID.test(employeeId)) throw new NotFoundException('Мастер не найден');
  if (!UUID.test(serviceId)) throw new NotFoundException('Услуга не найдена');

  const employee = await db.employee.findFirst({
    where: { id: employeeId, businessId: scope.businessId, locations: { some: { locationId } } },
    select: {
      id: true,
      status: true,
      workingHours: { where: { locationId }, select: { weekday: true, timeFrom: true, timeTo: true } },
      timeOffs: { select: { dateFrom: true, dateTo: true } },
      services: { select: { serviceId: true } },
    },
  });
  if (!employee) throw new NotFoundException('Мастер в этом филиале не работает');
  if (employee.status !== 'ACTIVE') throw new ConflictException('Мастер в архиве');
  if (!employee.services.some((s) => s.serviceId === serviceId))
    throw new ConflictException('Мастер эту услугу не оказывает');

  const [service, masterPrice] = await Promise.all([db.beautyService.findFirst({
    where: { id: serviceId, businessId: scope.businessId },
    select: {
      active: true,
      price: true,
      currency: true,
      durationMinutes: true,
      locations: { where: { locationId }, select: { enabled: true, priceOverride: true, durationOverride: true } },
    },
  }), db.employeeServicePrice.findUnique({
    where: { employeeId_serviceId_locationId: { employeeId, serviceId, locationId } },
  })]);
  if (!service) throw new NotFoundException('Услуга не найдена');
  const own = service.locations[0] ?? null;

  let resolvedPrice = own?.priceOverride ?? (service.currency === scope.locationCurrency ? service.price : null);
  let resolvedDuration = own?.durationOverride ?? service.durationMinutes;
  if (masterPrice) {
    if (masterPrice.currency !== scope.locationCurrency)
      throw new ConflictException('Валюта цены мастера не совпадает с валютой филиала');
    resolvedDuration = masterPrice.durationMinutes ?? resolvedDuration;
    if (masterPrice.priceType === 'FREE') resolvedPrice = 0n;
    else if (masterPrice.priceType === 'FIXED') resolvedPrice = masterPrice.priceMinMinor;
    else if (requested?.basePriceMinor !== null && requested?.basePriceMinor !== undefined) {
      resolvedPrice = requested.basePriceMinor;
      if (masterPrice.priceType === 'RANGE' &&
          (resolvedPrice < (masterPrice.priceMinMinor ?? 0n) || resolvedPrice > (masterPrice.priceMaxMinor ?? resolvedPrice)))
        throw new BadRequestException('Цена услуги вне диапазона мастера');
    } else throw new ConflictException('Укажите конечную цену услуги мастера');
  }
  if (requested?.basePriceMinor !== null && requested?.basePriceMinor !== undefined)
    resolvedPrice = requested.basePriceMinor;
  if (resolvedPrice === null) throw new ConflictException('У услуги нет цены в валюте филиала');
  if (requested?.durationMinutes) resolvedDuration = requested.durationMinutes;

  const opening = await db.beautyLocationHours.findUnique({ where: { locationId } });
  const openHours = opening ? salonHours(opening.intervals) : null;
  const workingHours = employee.workingHours.map((shift) => ({
    weekday: shift.weekday, timeFrom: clockOf(shift.timeFrom), timeTo: clockOf(shift.timeTo),
  }));
  const plan = planAppointment({
    startsAt,
    timezone: scope.locationTimezone ?? 'UTC',
    service: {
      active: service.active,
      priceMinor: resolvedPrice,
      currency: scope.locationCurrency ?? service.currency,
      durationMinutes: resolvedDuration,
    },
    locationCurrency: scope.locationCurrency ?? '',
    locationService: own
      ? {
          enabled: own.enabled,
          priceOverrideMinor: resolvedPrice,
          durationOverrideMinutes: resolvedDuration,
        }
      : null,
    workingHours,
    timeOffs: employee.timeOffs.map((t) => ({
      dateFrom: t.dateFrom.toISOString().slice(0, 10),
      dateTo: t.dateTo.toISOString().slice(0, 10),
    })),
  });
  if (!plan.ok) throw new ConflictException(plan.reason);
  if (!fitsSalonHours(startsAt, plan.value.endsAt, scope.locationTimezone ?? 'UTC', openHours))
    throw new ConflictException('Время записи находится вне режима работы салона');
  return { ...plan.value, basePriceMinor: resolvedPrice };
}

/**
 * Занятость мастера проверяется до вставки: нарушение `EXCLUDE` (23P01) обрывает транзакцию Postgres,
 * и внятно ответить человеку из мёртвой транзакции уже нельзя.
 */
export async function employeeBusy(
  db: Pick<DbTx, 'appointmentLine'>,
  employeeId: string,
  startsAt: Date,
  endsAt: Date,
  exceptId: string | null,
): Promise<boolean> {
  const busy = await db.appointmentLine.findFirst({
    where: {
      employeeId,
      appointment: { status: { in: BUSY }, ...(exceptId ? { id: { not: exceptId } } : {}) },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
    select: { startsAt: true },
  });
  return busy !== null;
}

/** `time` Prisma отдаёт как момент 1970-01-01 */
export function clockOf(at: Date): string {
  return at.toISOString().slice(11, 16);
}

// ───────────── время ─────────────

function clockMinutes(clock: string): number {
  const [hh, mm] = clock.split(':');
  return Number(hh) * 60 + Number(mm);
}

function asDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

function parseDate(raw?: string): string | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return null;
  const text = raw.trim();
  const at = new Date(`${text}T00:00:00Z`);
  return Number.isNaN(at.getTime()) || at.toISOString().slice(0, 10) !== text ? null : text;
}

function checkedPeriod(rawFrom?: string, rawTo?: string): { from: string; to: string } {
  const from = parseDate(rawFrom);
  const to = parseDate(rawTo);
  if (!from || !to) throw new BadRequestException('from и to должны быть датами YYYY-MM-DD');
  if (to < from) throw new BadRequestException('to не может быть раньше from');
  const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000 + 1;
  if (days > MAX_PERIOD_DAYS)
    throw new BadRequestException(`Период до ${MAX_PERIOD_DAYS} дней включительно`);
  return { from, to };
}

function todayIn(timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function localDate(at: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

/** Минуты от начала суток `date` в поясе филиала; запись, уходящая за полночь, даёт больше 1440 */
function localMinutes(at: Date, timezone: string, date: string): number {
  const parts = new Map(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  const own = `${parts.get('year')}-${parts.get('month')}-${parts.get('day')}`;
  const days = Math.round((Date.parse(`${own}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86_400_000);
  return Number(parts.get('hour')) * 60 + Number(parts.get('minute')) + days * 1440;
}

/** 0 воскресенье, как `Date.getDay()` и как `weekday` в `working_hours` */
function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** Finance keeps the money snapshot and display names, without unrelated private profile details. */
function financialAppointment<T extends { notes: string | null; customer: { phone: string | null } }>(row: T) {
  return { ...row, notes: null, customer: { ...row.customer, phone: null } };
}

@RequiresBusinessCapability('beauty.appointments')
@Access('desk')
@Controller('beauty')
export class BeautyAppointmentsController {
  constructor(@Inject(BeautyAppointmentsService) private readonly service: BeautyAppointmentsService) {}

  @BeautyAccess('journal', 'view')
  @Get('appointments') day(@Query('date') date?: string) {
    return this.service.day(date);
  }
  @Get('finance/day') @BeautyAccess('finance', 'view') async financeDay(@Query('date') date?: string) {
    const day = await this.service.day(date);
    return {
      ...day,
      services: [],
      columns: day.columns.map(column => ({ ...column, intervals: [], timeOff: false, timeOffReason: null, serviceIds: [] })),
      appointments: day.appointments.map(financialAppointment),
    };
  }
  @Get('finance/appointments') @BeautyAccess('finance', 'view') async financePeriod(@Query('from') from?: string, @Query('to') to?: string) {
    const period = await this.service.period(from, to);
    return { ...period, appointments: period.appointments.map(financialAppointment) };
  }
  @BeautyAccess('appointments', 'view')
  @Get('appointments/period') period(@Query('from') from?: string, @Query('to') to?: string) {
    return this.service.period(from, to);
  }
  @BeautyAccess('appointments', 'create')
  @Post('appointments') create(@Body() body: unknown) {
    return this.service.create(body);
  }
  @BeautyAccess('appointments', 'update')
  @Patch('appointments/:id') move(@Param('id') id: string, @Body() body: unknown) {
    return this.service.move(id, body);
  }
  @BeautyAccess('appointments', 'update')
  @Post('appointments/:id/status') setStatus(@Param('id') id: string, @Body() body: unknown) {
    return this.service.setStatus(id, body);
  }
  /** Оплата записи в кассу филиала салона (§49) */
  @BeautyAccess('finance', 'create')
  @Post('appointments/:id/payments') pay(@Param('id') id: string, @Body() body: unknown) {
    return this.service.pay(id, body);
  }
  /** Возврат по выполненной записи (§54): право возвратов, как аннулирование в кассе */
  @BeautyAccess('finance', 'refund')
  @Post('appointments/:id/refunds') @Access('refunds') refund(@Param('id') id: string, @Body() body: unknown) {
    return this.service.refund(id, body);
  }
}
