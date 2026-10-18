import 'reflect-metadata';
import { personnelKindEnabled, parsePersonnelKindCommand, readPersonnelEmployeeProfiles, writePersonnelKind } from './personnel-kind';
import { canManageStaff, canWrite } from '@pms/domain';
import { writeEmployeeCommon } from '../employee-portal/employee-common';
import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Body,
  Controller,
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
  Get,
  Inject,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import {
  birthdayInDays,
  effectiveService,
  localDate,
  parseCustomerMarks,
  zonedStartOfDay,
  parseBeautyServiceInput,
  parseEmployeeInput,
  parseLocationServiceInput,
  type Permission,
} from '@pms/domain';
import type { DbTx } from '@pms/database';
import {
  creationKey,
  receiptFor,
  assertCreationReceipt,
  assertUnusedCreationKey,
  assertProfileBeforeCreate,
  assertRevision,
  skillsRevision,
  canonicalRevision,
} from './write-contract';
import { currentUserId, currentRole, actorMay } from '../auth/request-context';
import { RequiresBusinessCapability } from '../auth/capability.decorator';
import { Access } from '../auth/access.decorator';
import { PrismaService } from '../database/prisma.provider';
import { BeautyAppointmentsController, BeautyAppointmentsService } from './appointments';
import { BeautyScheduleController, BeautyScheduleService } from './schedule';
import {
  beautyScope,
  beautyTransaction,
  mayBeauty,
  mayBeautyWrite,
  UUID,
  type BeautyScope,
} from './scope';

/**
 * Каталог салона: услуги сети и мастера (DATA_MODEL §19 и §19.1, срез B3, ADR-141).
 *
 * Права по решению Q-253 (те же 13, подписи по вертикали): каталог услуг и его цены это `rates` (в салоне
 * список услуг и есть прайс), мастера это `property` (в гостинице это право закрывает то, что продаётся).
 * Чтение открыто `desk`: расписание и записи без каталога не нарисовать.
 *
 * Чего здесь нет: записей, расписания и денег. Записи это срез B5, деньги B7 (DATA_MODEL §21.5).
 */

@Injectable()
export class BeautyCatalogService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private may(permission: Permission): void {
    mayBeauty(permission);
  }

  private scope(): Promise<BeautyScope> {
    return beautyScope(this.prisma);
  }

  /**
   * Organization owns the identity; CustomerBusiness grants visibility in this business.
   * Визиты, последний визит и средний чек считаются по завершённым записям (DONE) этого бизнеса:
   * деньги записи это её снимок цены (Q-252), новых таблиц нет. Средний чек идёт по валюте, в которой
   * у клиента больше всего визитов (валюты не складываются, курсов нет); «всего визитов» по всем валютам.
   */
  async customers() {
    this.may('desk');
    const scope = await this.scope();
    const items = await this.prisma.db.customer.findMany({
      where: {
        organizationId: scope.organizationId,
        businesses: { some: { businessId: scope.businessId } },
      },
      orderBy: [{ firstName: 'asc' }, { id: 'asc' }],
      select: { id: true, firstName: true, lastName: true, phone: true, status: true, isVip: true, birthDate: true },
    });
    // «скоро день рождения» по дате филиала (§36)
    const today = localDate(new Date(), scope.locationTimezone ?? 'UTC');
    const done = await this.prisma.db.appointment.groupBy({
      by: ['customerId', 'currency'],
      where: { status: 'DONE', location: { businessId: scope.businessId } },
      _count: { _all: true },
      _sum: { price: true },
      _max: { startsAt: true },
    });
    // Для даты нужен пояс филиала самого визита, включая визиты в другом филиале сети.
    const latest = await this.prisma.db.appointment.findMany({
      where: { status: 'DONE', location: { businessId: scope.businessId } },
      distinct: ['customerId'],
      orderBy: [{ startsAt: 'desc' }, { id: 'asc' }],
      select: { customerId: true, startsAt: true, location: { select: { timezone: true } } },
    });
    const visitDates = new Map(latest.map((visit) => [
      visit.customerId, localDate(visit.startsAt, visit.location.timezone),
    ]));
    const byCustomer = new Map<
      string,
      { visits: number; lastVisitAt: Date; top: { count: number; sum: bigint; currency: string } }
    >();
    for (const row of done) {
      const count = row._count._all;
      const sum = row._sum.price ?? 0n;
      const last = row._max.startsAt!;
      const seen = byCustomer.get(row.customerId);
      if (!seen) {
        byCustomer.set(row.customerId, {
          visits: count,
          lastVisitAt: last,
          top: { count, sum, currency: row.currency },
        });
        continue;
      }
      seen.visits += count;
      if (last > seen.lastVisitAt) seen.lastVisitAt = last;
      if (count > seen.top.count) seen.top = { count, sum, currency: row.currency };
    }
    return {
      items: items.map((c) => {
        const s = byCustomer.get(c.id);
        const birthDate = c.birthDate ? c.birthDate.toISOString().slice(0, 10) : null;
        return {
          ...c,
          birthDate,
          birthdayInDays: birthDate ? birthdayInDays(birthDate, today) : null,
          visits: s?.visits ?? 0,
          lastVisitAt: s ? s.lastVisitAt.toISOString() : null,
          lastVisitLocalDate: visitDates.get(c.id) ?? null,
          // целочисленное деление в тиынах: остаток отбрасывается, float не появляется (ADR-008)
          avgCheckMinor: s ? (s.top.sum / BigInt(s.top.count)).toString() : null,
          avgCheckCurrency: s ? s.top.currency : null,
        };
      }),
    };
  }

  /** VIP-метка и дата рождения клиента салона (§36, общие с рестораном): клиент виден в бизнесе; дата в журнал не пишется */
  async updateCustomer(id: string, raw: unknown) {
    await mayBeautyWrite(this.prisma, 'desk');
    const scope = await this.scope();
    let input: ReturnType<typeof parseCustomerMarks>;
    try {
      input = parseCustomerMarks(raw, localDate(new Date(), scope.locationTimezone ?? 'UTC'));
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
    return beautyTransaction(this.prisma, scope, async (tx) => {
      const found = await tx.customer.findFirst({
        where: { id, organizationId: scope.organizationId, businesses: { some: { businessId: scope.businessId } } },
      });
      if (!found) throw new NotFoundException('Клиент не найден');
      const row = await tx.customer.update({
        where: { id },
        data: {
          ...(input.isVip !== undefined ? { isVip: input.isVip } : {}),
          ...(input.birthDate !== undefined
            ? { birthDate: input.birthDate === null ? null : new Date(`${input.birthDate}T00:00:00Z`) }
            : {}),
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: scope.organizationId,
          userId: currentUserId(),
          entityType: 'customer',
          entityId: id,
          action: 'beauty.customer.marks',
          before: { isVip: found.isVip },
          after: { isVip: row.isVip, birthDateChanged: input.birthDate !== undefined },
        },
      });
      return { id, isVip: row.isVip, birthDate: row.birthDate ? row.birthDate.toISOString().slice(0, 10) : null };
    });
  }

  /** Услуги каталога с тем, что про них говорит филиал: действующая цена считается домéном */
  async services() {
    this.may('desk');
    const scope = await this.scope();
    const rows = await this.prisma.db.beautyService.findMany({
      where: { businessId: scope.businessId },
      orderBy: [{ active: 'desc' }, { category: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        category: true,
        durationMinutes: true,
        price: true,
        currency: true,
        active: true,
        locations: scope.locationId
          ? {
              where: { locationId: scope.locationId },
              select: { enabled: true, priceOverride: true, durationOverride: true },
            }
          : false,
      },
    });
    let popularity: Map<string, number> | null = null;
    let totalCompletedVisits = 0;
    if (scope.locationId && scope.locationTimezone) {
      const today = localDate(new Date(), scope.locationTimezone);
      const start = new Date(`${today}T12:00:00Z`);
      start.setUTCDate(start.getUTCDate() - 29);
      const end = new Date(`${today}T12:00:00Z`);
      end.setUTCDate(end.getUTCDate() + 1);
      const counts = await this.prisma.db.appointment.groupBy({
        by: ['serviceId'],
        where: {
          locationId: scope.locationId,
          status: 'DONE',
          startsAt: {
            gte: zonedStartOfDay(start.toISOString().slice(0, 10), scope.locationTimezone),
            lt: zonedStartOfDay(end.toISOString().slice(0, 10), scope.locationTimezone),
          },
        },
        _count: { _all: true },
      });
      popularity = new Map(counts.map((row) => [row.serviceId, row._count._all]));
      totalCompletedVisits = counts.reduce((sum, row) => sum + row._count._all, 0);
    }
    return {
      locationId: scope.locationId,
      locationCurrency: scope.locationCurrency,
      items: rows.map((row) => ({
        ...serviceView(row, scope.locationCurrency),
        popularity: popularity ? { completedVisits: popularity.get(row.id) ?? 0, totalCompletedVisits } : null,
      })),
    };
  }

  async createService(raw: unknown) {
    await mayBeautyWrite(this.prisma, 'rates');
    const parsed = parseBeautyServiceInput(raw);
    if (!parsed.ok) throw new BadRequestException(parsed.reason);
    const input = parsed.value as Required<NonNullable<typeof parsed.value>>;
    const scope = await this.scope();
    const key = creationKey(raw);
    const receipt = key ? receiptFor(scope, 'beauty_service', input) : null;
    const created = await beautyTransaction(this.prisma, scope, async (tx) => {
      if (key) {
        const existing = await tx.beautyService.findFirst({
          where: { id: key, businessId: scope.businessId },
        });
        if (existing) {
          await assertCreationReceipt(tx, scope, 'beauty_service', key, receipt!);
          if (!existing.active)
            throw new ConflictException('Услуга в архиве. Проверьте её в каталоге.');
          return existing;
        }
      }
      if (key) await assertUnusedCreationKey(tx, scope, 'beauty_service', key);
      await assertProfileBeforeCreate(tx, scope);
      const row = await tx.beautyService.create({
        data: {
          id: key ?? randomUUID(),
          businessId: scope.businessId,
          name: input.name,
          category: input.category,
          durationMinutes: input.durationMinutes,
          price: input.priceMinor,
          currency: input.currency,
          active: input.active,
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: scope.organizationId,
          userId: currentUserId(),
          entityType: 'beauty_service',
          entityId: row.id,
          action: 'beauty.service.created',
          after: { ...plain(row), ...(receipt ? { creationReceipt: receipt } : {}) },
        },
      });
      return row;
    });
    return serviceView({ ...created, locations: [] }, scope.locationCurrency);
  }

  async updateService(id: string, raw: unknown) {
    await mayBeautyWrite(this.prisma, 'rates');
    if (!UUID.test(id)) throw new NotFoundException('Услуга не найдена');
    const parsed = parseBeautyServiceInput(raw, { partial: true });
    if (!parsed.ok) throw new BadRequestException(parsed.reason);
    const scope = await this.scope();
    const current = await this.prisma.db.beautyService.findFirst({
      where: { id, businessId: scope.businessId },
    });
    if (!current) throw new NotFoundException('Услуга не найдена');
    const p = parsed.value;
    // данные для Prisma: цена здесь bigint, в журнал она уйдёт строкой через plain()
    const data: {
      name?: string;
      category?: string | null;
      durationMinutes?: number;
      price?: bigint;
      currency?: string;
      active?: boolean;
    } = {};
    if (p.name !== undefined && p.name !== current.name) data.name = p.name;
    if (p.category !== undefined && p.category !== current.category) data.category = p.category;
    if (p.durationMinutes !== undefined && p.durationMinutes !== current.durationMinutes)
      data.durationMinutes = p.durationMinutes;
    if (p.priceMinor !== undefined && p.priceMinor !== current.price) data.price = p.priceMinor;
    if (p.currency !== undefined && p.currency !== current.currency) data.currency = p.currency;
    if (p.active !== undefined && p.active !== current.active) data.active = p.active;
    if (Object.keys(data).length === 0)
      return serviceView({ ...current, locations: [] }, scope.locationCurrency);
    const updated = await beautyTransaction(this.prisma, scope, async (tx) => {
      const row = await tx.beautyService.update({ where: { id: current.id }, data });
      await tx.auditLog.create({
        data: {
          organizationId: scope.organizationId,
          userId: currentUserId(),
          entityType: 'beauty_service',
          entityId: row.id,
          action: 'beauty.service.updated',
          before: pick(plain(current), Object.keys(data)),
          after: pick(plain(row), Object.keys(data)),
        },
      });
      return row;
    });
    return serviceView({ ...updated, locations: [] }, scope.locationCurrency);
  }

  /** Что филиал делает с услугой каталога: включает и ставит свои цену и длительность */
  async setLocationService(id: string, raw: unknown) {
    await mayBeautyWrite(this.prisma, 'rates');
    if (!UUID.test(id)) throw new NotFoundException('Услуга не найдена');
    const parsed = parseLocationServiceInput(raw);
    if (!parsed.ok) throw new BadRequestException(parsed.reason);
    const scope = await this.scope();
    if (!scope.locationId)
      throw new BadRequestException('Выберите филиал: цену и доступность услуги задаёт он');
    const service = await this.prisma.db.beautyService.findFirst({
      where: { id, businessId: scope.businessId },
      select: { id: true },
    });
    if (!service) throw new NotFoundException('Услуга не найдена');
    const input = parsed.value;
    await beautyTransaction(this.prisma, scope, async (tx) => {
      await tx.locationService.upsert({
        where: { locationId_serviceId: { locationId: scope.locationId!, serviceId: service.id } },
        create: {
          locationId: scope.locationId!,
          serviceId: service.id,
          enabled: input.enabled,
          priceOverride: input.priceOverrideMinor,
          durationOverride: input.durationOverrideMinutes,
        },
        update: {
          enabled: input.enabled,
          priceOverride: input.priceOverrideMinor,
          durationOverride: input.durationOverrideMinutes,
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: scope.organizationId,
          userId: currentUserId(),
          entityType: 'location_service',
          entityId: service.id,
          action: 'beauty.location_service.set',
          after: {
            locationId: scope.locationId,
            enabled: input.enabled,
            priceOverrideMinor: input.priceOverrideMinor?.toString() ?? null,
            durationOverrideMinutes: input.durationOverrideMinutes,
          },
        },
      });
    });
    return this.services();
  }

  /** Мастера сети: их филиалы и умения */
  async employees() {
    this.may('desk');
    const scope = await this.scope();
    const enabled = personnelKindEnabled();
    const org = enabled ? await this.prisma.db.organization.findUnique({
      where: { id: scope.organizationId }, select: { status: true, trialEndsAt: true },
    }) : null;
    const role = currentRole();
    const canAssignPersonnelKind = !!(enabled && role && canManageStaff(role) && actorMay('property') &&
      org && canWrite(org.status, org.trialEndsAt, new Date()));
    const profiles = enabled
      ? await readPersonnelEmployeeProfiles(this.prisma.db, scope)
      : await employeeProfiles(this.prisma.db, scope.businessId);
    const children = await employeeChildren(this.prisma.db, profiles.map((row) => row.id));
    return {
      locationId: scope.locationId,
      personnelKindEnabled: enabled,
      canAssignPersonnelKind,
      items: profiles.map((profile) => ({
        ...employeeView(profile, children.get(profile.id)),
        ...(enabled ? { personnelKind: 'personnelKind' in profile ? profile.personnelKind : null } : {}),
        profileRevision: profile.profileRevision,
        servicesRevision: canonicalRevision(
          (children.get(profile.id)?.services ?? []).map((row) => [
            row.serviceId,
            row.createdAt.toISOString(),
          ]),
        ),
      })),
    };
  }

  async assignPersonnelKind(id: string, raw: unknown) {
    const input = parsePersonnelKindCommand(raw);
    if (!personnelKindEnabled()) throw new ServiceUnavailableException('Personnel kind unavailable');
    await mayBeautyWrite(this.prisma, 'property');
    const role = currentRole();
    if (!role || !canManageStaff(role)) throw new ForbiddenException('Manager only');
    if (!UUID.test(id)) throw new NotFoundException('Employee not found');
    const scope = await this.scope();
    return beautyTransaction(this.prisma, scope, async (tx) => {
      const { before, after } = await writePersonnelKind(tx, scope, id, input);
      await tx.auditLog.create({ data: {
        organizationId: scope.organizationId, userId: currentUserId(),
        entityType: 'employee', entityId: id, action: 'beauty.employee.personnel_kind',
        before: { personnelKind: before.personnelKind }, after: { personnelKind: after.personnelKind },
      } });
      return after;
    });
  }

  async createEmployee(raw: unknown) {
    await mayBeautyWrite(this.prisma, 'property');
    const parsed = parseEmployeeInput(raw);
    if (!parsed.ok) throw new BadRequestException(parsed.reason);
    const input = parsed.value as Required<NonNullable<typeof parsed.value>>;
    const scope = await this.scope();
    const key = creationKey(raw);
    const receipt = key ? receiptFor(scope, 'employee', input) : null;
    const created = await beautyTransaction(this.prisma, scope, async (tx) => {
      if (key) {
        const existing = await tx.employee.findFirst({
          where: { id: key, businessId: scope.businessId },
        });
        if (existing) {
          await assertCreationReceipt(tx, scope, 'employee', key, receipt!);
          if (existing.status !== 'ACTIVE')
            throw new ConflictException('Мастер в архиве. Проверьте его в списке.');
          return existing;
        }
      }
      if (key) await assertUnusedCreationKey(tx, scope, 'employee', key);
      await assertProfileBeforeCreate(tx, scope);
      const row = await tx.employee.create({
        data: {
          id: key ?? randomUUID(),
          businessId: scope.businessId,
          name: input.name,
          phone: input.phone,
          email: input.email,
          status: input.active ? 'ACTIVE' : 'ARCHIVED',
        },
      });
      // новый мастер сразу работает в выбранном филиале: иначе он нигде не работает и не виден в расписании
      if (scope.locationId)
        await tx.employeeLocation.create({
          data: { employeeId: row.id, locationId: scope.locationId },
        });
      await tx.auditLog.create({
        data: {
          organizationId: scope.organizationId,
          userId: currentUserId(),
          entityType: 'employee',
          entityId: row.id,
          action: 'beauty.employee.created',
          after: {
            name: row.name,
            locationId: scope.locationId,
            ...(receipt ? { creationReceipt: receipt } : {}),
          },
        },
      });
      return row;
    });
    return this.employee(created.id, scope.businessId);
  }

  async updateEmployee(id: string, raw: unknown) {
    await mayBeautyWrite(this.prisma, 'property');
    if (!UUID.test(id)) throw new NotFoundException('Мастер не найден');
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) ||
        Object.keys(raw).some(key => !['name', 'phone', 'email', 'active', 'expectedProfileRevision'].includes(key)))
      throw new BadRequestException('Недопустимые поля профиля');
    const parsed = parseEmployeeInput(raw, { partial: true });
    if (!parsed.ok) throw new BadRequestException(parsed.reason);
    const scope = await this.scope();
    const p = parsed.value;
    const expected = (raw as Record<string, unknown>).expectedProfileRevision;
    return beautyTransaction(this.prisma, scope, async (tx) => {
      const { before: current, after: next, changed } = await writeEmployeeCommon(tx, scope.businessId, id, expected, {
        ...(p.name !== undefined ? { name: p.name } : {}),
        ...(p.phone !== undefined ? { phone: p.phone } : {}),
        ...(p.email !== undefined ? { email: p.email } : {}),
        ...(p.active !== undefined ? { status: p.active ? 'ACTIVE' : 'ARCHIVED' } : {}),
      });
      if (changed.length === 0) return this.employee(current.id, scope.businessId, tx);
      await tx.auditLog.create({
        data: {
          organizationId: scope.organizationId,
          userId: currentUserId(),
          entityType: 'employee',
          entityId: current.id,
          action: 'beauty.employee.updated',
          before: pick(plain(current), changed),
          after: pick(plain(next), changed),
        },
      });
      return this.employee(current.id, scope.businessId, tx);
    });
  }

  /** Что мастер умеет: список услуг каталога целиком, не добавлением по одной */
  async setEmployeeServices(id: string, raw: unknown) {
    await mayBeautyWrite(this.prisma, 'property');
    if (!UUID.test(id)) throw new NotFoundException('Мастер не найден');
    const body = (raw ?? {}) as Record<string, unknown>;
    const ids = Array.isArray(body['serviceIds']) ? body['serviceIds'] : null;
    if (!ids || ids.some((value) => typeof value !== 'string' || !UUID.test(value)))
      throw new BadRequestException('Выберите услуги мастера');
    const wanted = [...new Set(ids as string[])];
    const scope = await this.scope();
    const employee = await this.prisma.db.employee.findFirst({
      where: { id, businessId: scope.businessId },
      select: { id: true },
    });
    if (!employee) throw new NotFoundException('Мастер не найден');
    const own = await this.prisma.db.beautyService.findMany({
      where: { id: { in: wanted }, businessId: scope.businessId },
      select: { id: true },
    });
    if (own.length !== wanted.length)
      throw new BadRequestException('Среди выбранных услуг есть чужая');
    await beautyTransaction(this.prisma, scope, async (tx) => {
      await assertRevision(body, await skillsRevision(tx, employee.id));
      await tx.employeeService.deleteMany({ where: { employeeId: employee.id } });
      if (wanted.length)
        await tx.employeeService.createMany({
          data: wanted.map((serviceId) => ({ employeeId: employee.id, serviceId })),
        });
      await tx.auditLog.create({
        data: {
          organizationId: scope.organizationId,
          userId: currentUserId(),
          entityType: 'employee',
          entityId: employee.id,
          action: 'beauty.employee.services.set',
          after: { serviceIds: wanted },
        },
      });
    });
    return this.employee(employee.id, scope.businessId);
  }

  private async employee(id: string, businessId: string, db: EmployeeDb = this.prisma.db) {
    const profile = await employeeProfile(db, id, businessId);
    if (!profile) throw new NotFoundException('Мастер не найден');
    const children = (await employeeChildren(db, [id])).get(id);
    return {
      ...employeeView(profile, children),
      profileRevision: profile.profileRevision,
      servicesRevision: canonicalRevision(
        (children?.services ?? []).map((row) => [row.serviceId, row.createdAt.toISOString()]),
      ),
    };
  }
}

type EmployeeDb = Pick<DbTx, '$queryRaw' | 'employeeLocation' | 'employeeService'>;
type EmployeeProfile = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  status: 'ACTIVE' | 'ARCHIVED';
  profileRevision: string;
};
type EmployeeChildren = {
  locations: Array<{ locationId: string }>;
  services: Array<{ serviceId: string; createdAt: Date }>;
};

async function employeeProfiles(db: EmployeeDb, businessId: string): Promise<EmployeeProfile[]> {
  return db.$queryRaw<EmployeeProfile[]>`
    SELECT id::text,
           name,
           phone,
           email,
           status::text AS status,
           to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "profileRevision"
    FROM employees
    WHERE business_id = ${businessId}::uuid
    ORDER BY status ASC, name ASC, id ASC
  `;
}

async function employeeProfile(
  db: EmployeeDb,
  id: string,
  businessId: string,
): Promise<EmployeeProfile | null> {
  const rows = await db.$queryRaw<EmployeeProfile[]>`
    SELECT id::text,
           name,
           phone,
           email,
           status::text AS status,
           to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "profileRevision"
    FROM employees
    WHERE id = ${id}::uuid AND business_id = ${businessId}::uuid
  `;
  return rows[0] ?? null;
}

async function employeeChildren(
  db: EmployeeDb,
  employeeIds: string[],
): Promise<Map<string, EmployeeChildren>> {
  const grouped = new Map<string, EmployeeChildren>(
    employeeIds.map((id) => [id, { locations: [], services: [] }]),
  );
  if (employeeIds.length === 0) return grouped;
  const [locations, services] = await Promise.all([
    db.employeeLocation.findMany({
      where: { employeeId: { in: employeeIds } },
      select: { employeeId: true, locationId: true },
    }),
    db.employeeService.findMany({
      where: { employeeId: { in: employeeIds } },
      orderBy: [{ employeeId: 'asc' }, { serviceId: 'asc' }],
      select: { employeeId: true, serviceId: true, createdAt: true },
    }),
  ]);
  for (const row of locations)
    grouped.get(row.employeeId)?.locations.push({ locationId: row.locationId });
  for (const row of services)
    grouped
      .get(row.employeeId)
      ?.services.push({ serviceId: row.serviceId, createdAt: row.createdAt });
  return grouped;
}

/** Услуга наружу: цена строкой тиынов (деньги не float, ADR-008) и действующая цена филиала словами домена */
function serviceView(
  row: {
    id: string;
    name: string;
    category: string | null;
    durationMinutes: number;
    price: bigint;
    currency: string;
    active: boolean;
    locations?:
      | Array<{ enabled: boolean; priceOverride: bigint | null; durationOverride: number | null }>
      | false;
  },
  locationCurrency: string | null,
) {
  const locationRow = Array.isArray(row.locations) ? (row.locations[0] ?? null) : null;
  const effective = locationCurrency
    ? effectiveService({
        service: {
          active: row.active,
          priceMinor: row.price,
          currency: row.currency,
          durationMinutes: row.durationMinutes,
        },
        locationCurrency,
        locationService: locationRow
          ? {
              enabled: locationRow.enabled,
              priceOverrideMinor: locationRow.priceOverride,
              durationOverrideMinutes: locationRow.durationOverride,
            }
          : null,
      })
    : null;
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    durationMinutes: row.durationMinutes,
    priceMinor: row.price.toString(),
    currency: row.currency,
    active: row.active,
    location: locationRow
      ? {
          enabled: locationRow.enabled,
          priceOverrideMinor: locationRow.priceOverride?.toString() ?? null,
          durationOverrideMinutes: locationRow.durationOverride,
        }
      : null,
    effective:
      effective === null
        ? null
        : effective.sellable
          ? {
              sellable: true as const,
              priceMinor: effective.priceMinor.toString(),
              currency: effective.currency,
              durationMinutes: effective.durationMinutes,
              overridden: effective.overridden,
            }
          : { sellable: false as const, reason: effective.reason },
  };
}

function employeeView(
  row: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    status: string;
  },
  children: EmployeeChildren | undefined,
) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    active: row.status === 'ACTIVE',
    locationIds: (children?.locations ?? []).map((location) => location.locationId),
    serviceIds: (children?.services ?? []).map((service) => service.serviceId),
  };
}

/** Строка в журнал: деньги строкой, даты и прочее без объектов Prisma (поле Json принимает только простое) */
type LogRow = Record<string, string | number | boolean | null>;

function plain(row: Record<string, unknown>): LogRow {
  return Object.fromEntries(
    Object.entries(row)
      .filter(([, v]) => typeof v !== 'object' || v === null)
      .map(([k, v]) => [
        k,
        typeof v === 'bigint' ? v.toString() : (v as string | number | boolean | null),
      ]),
  );
}

function pick(row: LogRow, keys: string[]): LogRow {
  const map: Record<string, string> = { priceMinor: 'price', durationMinutes: 'durationMinutes' };
  return Object.fromEntries(keys.map((k) => [k, row[map[k] ?? k] ?? null]));
}

@RequiresBusinessCapability('beauty.services')
@Access('desk')
@Controller('beauty')
export class BeautyCatalogController {
  constructor(@Inject(BeautyCatalogService) private readonly service: BeautyCatalogService) {}

  @RequiresBusinessCapability('beauty.customers')
  @Get('customers')
  customers() {
    return this.service.customers();
  }
  // VIP и день рождения (§36): ставит смена, как у ресторана
  @RequiresBusinessCapability('beauty.customers')
  @Patch('customers/:id')
  updateCustomer(@Param('id') id: string, @Body() body: unknown) {
    return this.service.updateCustomer(id, body);
  }

  @Get('services') services() {
    return this.service.services();
  }
  // Каталог услуг это прайс салона: цены по решению Q-253 меняет право `rates`
  @Access('rates') @Post('services') createService(@Body() body: unknown) {
    return this.service.createService(body);
  }
  @Access('rates') @Patch('services/:id') updateService(
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.service.updateService(id, body);
  }
  @Access('rates') @Put('services/:id/location') setLocationService(
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.service.setLocationService(id, body);
  }

  @RequiresBusinessCapability('beauty.employees')
  @Get('employees')
  employees() {
    return this.service.employees();
  }
  // Мастера это то, чем салон работает: право `property`, как номерной фонд в гостинице (Q-253)
  @RequiresBusinessCapability('beauty.employees')
  @Access('property')
  @Patch('employees/:id/personnel-kind')
  assignPersonnelKind(@Param('id') id: string, @Body() body: unknown) {
    return this.service.assignPersonnelKind(id, body);
  }
  @RequiresBusinessCapability('beauty.employees')
  @Access('property')
  @Post('employees')
  createEmployee(@Body() body: unknown) {
    return this.service.createEmployee(body);
  }
  @RequiresBusinessCapability('beauty.employees')
  @Access('property')
  @Patch('employees/:id')
  updateEmployee(@Param('id') id: string, @Body() body: unknown) {
    return this.service.updateEmployee(id, body);
  }
  @RequiresBusinessCapability('beauty.employees')
  @Access('property')
  @Put('employees/:id/services')
  setEmployeeServices(@Param('id') id: string, @Body() body: unknown) {
    return this.service.setEmployeeServices(id, body);
  }
}

@Module({
  controllers: [BeautyCatalogController, BeautyScheduleController, BeautyAppointmentsController],
  providers: [
    BeautyCatalogService,
    BeautyScheduleService,
    BeautyAppointmentsService,
    PrismaService,
  ],
})
export class BeautyModule {}
