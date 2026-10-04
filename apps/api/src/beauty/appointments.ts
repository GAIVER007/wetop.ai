import 'reflect-metadata';
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
  nextStatuses,
  parseAppointmentInput,
  planAppointment,
  statusChange,
  timeOffWindow,
  type AppointmentPlan,
  type AppointmentStatus,
} from '@pms/domain';
import { currentUserId } from '../auth/request-context';
import { Access } from '../auth/access.decorator';
import { PrismaService } from '../database/prisma.provider';
import { beautyScope, mayBeauty, UUID, type BeautyScope } from './scope';

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
const BUSY: AppointmentStatus[] = ['BOOKED', 'CONFIRMED', 'DONE'];

/** Сетка дня, когда график мастеров ничего не подсказал */
const DEFAULT_FROM = 8 * 60;
const DEFAULT_TO = 20 * 60;

@Injectable()
export class BeautyAppointmentsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** День филиала: мастера столбцами, их рабочие часы, записи и услуги для формы */
  async day(rawDate?: string) {
    mayBeauty('desk');
    const scope = await beautyScope(this.prisma);
    if (!scope.locationId || !scope.locationTimezone || !scope.locationCurrency)
      throw new ConflictException('Сначала выберите филиал');
    const locationId = scope.locationId;
    const timezone = scope.locationTimezone;
    const date = parseDate(rawDate) ?? todayIn(timezone);
    const window = timeOffWindow({ dateFrom: date, dateTo: date, timezone });
    const weekday = weekdayOf(date);

    const employees = await this.prisma.db.employee.findMany({
      where: { businessId: scope.businessId, status: 'ACTIVE', locations: { some: { locationId } } },
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
      where: { locationId, startsAt: { gte: window.fromUtc, lt: window.toUtcExclusive } },
      orderBy: { startsAt: 'asc' },
      select: {
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
        customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
    });

    const services = await this.prisma.db.beautyService.findMany({
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
    });

    const columns = employees.map((e) => ({
      id: e.id,
      name: e.name,
      intervals: e.workingHours.map((h) => ({ timeFrom: clockOf(h.timeFrom), timeTo: clockOf(h.timeTo) })),
      timeOff: e.timeOffs.length > 0,
      timeOffReason: e.timeOffs[0]?.reason ?? null,
      serviceIds: e.services.map((s) => s.serviceId),
    }));

    const minutes = columns.flatMap((c) => c.intervals).flatMap((i) => [clockMinutes(i.timeFrom), clockMinutes(i.timeTo)]);
    const placed = rows.map((r) => ({
      id: r.id,
      employeeId: r.employeeId,
      serviceId: r.serviceId,
      serviceName: r.service.name,
      customer: {
        id: r.customer.id,
        name: [r.customer.firstName, r.customer.lastName].filter(Boolean).join(' '),
        phone: r.customer.phone,
      },
      startsAt: r.startsAt.toISOString(),
      endsAt: r.endsAt.toISOString(),
      startMinutes: localMinutes(r.startsAt, timezone, date),
      endMinutes: localMinutes(r.endsAt, timezone, date),
      status: r.status,
      next: nextStatuses(r.status as AppointmentStatus),
      priceMinor: r.price.toString(),
      currency: r.currency,
      notes: r.notes,
    }));
    const spans = placed.flatMap((p) => [p.startMinutes, p.endMinutes]);

    return {
      location: { id: locationId, name: scope.locationName, timezone, currency: scope.locationCurrency },
      date,
      columns,
      appointments: placed,
      services: services.map((s) => {
        const own = s.locations[0] ?? null;
        return {
          id: s.id,
          name: s.name,
          category: s.category,
          sellable: own !== null && own.enabled && (own.priceOverride !== null || s.currency === scope.locationCurrency),
          durationMinutes: own?.durationOverride ?? s.durationMinutes,
          priceMinor: (own?.priceOverride ?? s.price).toString(),
          currency: own?.priceOverride === null || own?.priceOverride === undefined ? s.currency : scope.locationCurrency,
        };
      }),
      bounds: {
        fromMinutes: Math.min(DEFAULT_FROM, ...minutes, ...spans),
        toMinutes: Math.max(DEFAULT_TO, ...minutes, ...spans),
      },
    };
  }

  /** Новая запись. Клиент либо выбран, либо заводится вместе с записью: своего экрана у клиентов ещё нет */
  async create(raw: unknown) {
    mayBeauty('desk');
    const scope = await beautyScope(this.prisma);
    if (!scope.locationId) throw new ConflictException('Сначала выберите филиал');
    const parsed = parseAppointmentInput(raw);
    if (!parsed.ok) throw new BadRequestException(parsed.reason);
    const input = parsed.value;

    const plan = await this.planFor(scope, input.employeeId, input.serviceId, input.startsAt);
    await this.assertFree(input.employeeId, plan.startsAt, plan.endsAt, null);

    const locationId = scope.locationId;
    const id = randomUUID();
    await this.prisma.db.$transaction(async (tx) => {
      let customerId: string;
      if (input.customer.kind === 'existing') {
        if (!UUID.test(input.customer.id)) throw new NotFoundException('Клиент не найден');
        const own = await tx.customer.findFirst({
          where: { id: input.customer.id, organizationId: scope.organizationId },
          select: { id: true },
        });
        if (!own) throw new NotFoundException('Клиент не найден');
        customerId = own.id;
      } else {
        // тот же телефон это тот же клиент: у `customers` уникальный (organization_id, phone), и второй
        // записи тому же человеку иначе не быть вовсе
        const known = input.customer.phone
          ? await tx.customer.findFirst({
              where: { organizationId: scope.organizationId, phone: input.customer.phone },
              select: { id: true },
            })
          : null;
        customerId = known?.id ?? randomUUID();
        if (!known)
          await tx.customer.create({
            data: {
              id: customerId,
              organizationId: scope.organizationId,
              firstName: input.customer.firstName,
              lastName: input.customer.lastName,
              phone: input.customer.phone,
            },
          });
      }
      // клиент становится виден бизнесу при первом обращении в него (§19.1)
      await tx.customerBusiness.createMany({
        data: [{ customerId, businessId: scope.businessId }],
        skipDuplicates: true,
      });

      await tx.appointment.create({
        data: {
          id,
          locationId,
          customerId,
          employeeId: input.employeeId,
          serviceId: input.serviceId,
          startsAt: plan.startsAt,
          endsAt: plan.endsAt,
          price: plan.priceMinor,
          currency: plan.currency,
          notes: input.notes,
          createdById: currentUserId(),
        },
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
            employeeId: input.employeeId,
            serviceId: input.serviceId,
            startsAt: plan.startsAt.toISOString(),
            endsAt: plan.endsAt.toISOString(),
            priceMinor: plan.priceMinor.toString(),
            currency: plan.currency,
          },
        },
      });
    });
    return this.day(localDate(plan.startsAt, scope.locationTimezone ?? 'UTC'));
  }

  /** Перенос записи: другое время, другой мастер или другая услуга. Цена пересчитывается снимком заново */
  async move(id: string, raw: unknown) {
    mayBeauty('desk');
    const { scope, row } = await this.own(id);
    if (!nextStatuses(row.status as AppointmentStatus).length)
      throw new ConflictException('Запись закрыта, переносить её уже нельзя');

    const body = (raw ?? {}) as Record<string, unknown>;
    const employeeId = typeof body['employeeId'] === 'string' ? body['employeeId'] : row.employeeId;
    const serviceId = typeof body['serviceId'] === 'string' ? body['serviceId'] : row.serviceId;
    const startsAt = body['startsAt'] === undefined ? row.startsAt : new Date(String(body['startsAt']));
    if (Number.isNaN(startsAt.getTime())) throw new BadRequestException('Время записи не разобрать');

    const plan = await this.planFor(scope, employeeId, serviceId, startsAt);
    await this.assertFree(employeeId, plan.startsAt, plan.endsAt, row.id);

    await this.prisma.db.$transaction(async (tx) => {
      await tx.appointment.update({
        where: { id: row.id },
        data: {
          employeeId,
          serviceId,
          startsAt: plan.startsAt,
          endsAt: plan.endsAt,
          price: plan.priceMinor,
          currency: plan.currency,
        },
      });
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
            priceMinor: row.price.toString(),
          },
          after: {
            employeeId,
            serviceId,
            startsAt: plan.startsAt.toISOString(),
            priceMinor: plan.priceMinor.toString(),
          },
        },
      });
    });
    return this.day(localDate(plan.startsAt, scope.locationTimezone ?? 'UTC'));
  }

  /** Состояние записи: подтвердили, выполнили, незаезд, отменили */
  async setStatus(id: string, raw: unknown) {
    mayBeauty('desk');
    const { scope, row } = await this.own(id);
    const body = (raw ?? {}) as Record<string, unknown>;
    const to = String(body['status'] ?? '') as AppointmentStatus;
    const change = statusChange(row.status as AppointmentStatus, to);
    if (!change.ok) throw new ConflictException(change.reason);

    await this.prisma.db.$transaction(async (tx) => {
      await tx.appointment.update({ where: { id: row.id }, data: { status: to } });
      await tx.auditLog.create({
        data: {
          organizationId: scope.organizationId,
          userId: currentUserId(),
          entityType: 'appointment',
          entityId: row.id,
          action: 'beauty.appointment.status',
          before: { status: row.status },
          after: { status: to },
        },
      });
    });
    return this.day(localDate(row.startsAt, scope.locationTimezone ?? 'UTC'));
  }

  // ───────────── общее ─────────────

  /** Запись своего филиала. Чужая и несуществующая одинаково не найдены */
  private async own(id: string) {
    if (!UUID.test(id)) throw new NotFoundException('Запись не найдена');
    const scope = await beautyScope(this.prisma);
    if (!scope.locationId) throw new ConflictException('Сначала выберите филиал');
    const row = await this.prisma.db.appointment.findFirst({
      where: { id, locationId: scope.locationId },
      select: {
        id: true,
        employeeId: true,
        serviceId: true,
        startsAt: true,
        status: true,
        price: true,
      },
    });
    if (!row) throw new NotFoundException('Запись не найдена');
    return { scope, row };
  }

  /**
   * Цена, длительность и попадание в график. Мастер и услуга проверяются на свой бизнес и свой филиал
   * здесь же: база это тоже держит триггером, но её сообщение человеку не ответ.
   */
  private async planFor(
    scope: BeautyScope,
    employeeId: string,
    serviceId: string,
    startsAt: Date,
  ): Promise<AppointmentPlan> {
    const locationId = scope.locationId as string;
    if (!UUID.test(employeeId)) throw new NotFoundException('Мастер не найден');
    if (!UUID.test(serviceId)) throw new NotFoundException('Услуга не найдена');

    const employee = await this.prisma.db.employee.findFirst({
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
    if (employee.services.length && !employee.services.some((s) => s.serviceId === serviceId))
      throw new ConflictException('Мастер эту услугу не оказывает');

    const service = await this.prisma.db.beautyService.findFirst({
      where: { id: serviceId, businessId: scope.businessId },
      select: {
        active: true,
        price: true,
        currency: true,
        durationMinutes: true,
        locations: { where: { locationId }, select: { enabled: true, priceOverride: true, durationOverride: true } },
      },
    });
    if (!service) throw new NotFoundException('Услуга не найдена');
    const own = service.locations[0] ?? null;

    const plan = planAppointment({
      startsAt,
      timezone: scope.locationTimezone ?? 'UTC',
      service: {
        active: service.active,
        priceMinor: service.price,
        currency: service.currency,
        durationMinutes: service.durationMinutes,
      },
      locationCurrency: scope.locationCurrency ?? '',
      locationService: own
        ? {
            enabled: own.enabled,
            priceOverrideMinor: own.priceOverride,
            durationOverrideMinutes: own.durationOverride,
          }
        : null,
      workingHours: employee.workingHours.map((h) => ({
        weekday: h.weekday,
        timeFrom: clockOf(h.timeFrom),
        timeTo: clockOf(h.timeTo),
      })),
      timeOffs: employee.timeOffs.map((t) => ({
        dateFrom: t.dateFrom.toISOString().slice(0, 10),
        dateTo: t.dateTo.toISOString().slice(0, 10),
      })),
    });
    if (!plan.ok) throw new ConflictException(plan.reason);
    return plan.value;
  }

  /**
   * Занятость мастера проверяется до вставки: нарушение `EXCLUDE` (23P01) обрывает транзакцию Postgres,
   * и внятно ответить человеку из мёртвой транзакции уже нельзя.
   */
  private async assertFree(employeeId: string, startsAt: Date, endsAt: Date, exceptId: string | null) {
    const busy = await this.prisma.db.appointment.findFirst({
      where: {
        employeeId,
        status: { in: BUSY },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      select: { startsAt: true },
    });
    if (busy) throw new ConflictException('Мастер в это время уже занят');
  }
}

// ───────────── время ─────────────

/** `time` Prisma отдаёт как момент 1970-01-01 */
function clockOf(at: Date): string {
  return at.toISOString().slice(11, 16);
}

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

@Access('desk')
@Controller('beauty')
export class BeautyAppointmentsController {
  constructor(@Inject(BeautyAppointmentsService) private readonly service: BeautyAppointmentsService) {}

  @Get('appointments') day(@Query('date') date?: string) {
    return this.service.day(date);
  }
  @Post('appointments') create(@Body() body: unknown) {
    return this.service.create(body);
  }
  @Patch('appointments/:id') move(@Param('id') id: string, @Body() body: unknown) {
    return this.service.move(id, body);
  }
  @Post('appointments/:id/status') setStatus(@Param('id') id: string, @Body() body: unknown) {
    return this.service.setStatus(id, body);
  }
}
