import { findOrCreateCustomer } from '../customers/identity';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  ForbiddenException,
} from '@nestjs/common';
import {
  FOOD_STATUSES,
  foodCapacity,
  foodEnd,
  foodFingerprint,
  foodId,
  foodInstant,
  foodInt,
  foodNext,
  foodObject,
  foodText,
  birthdayInDays,
  parseCustomerMarks,
  parseFoodCatalog,
  parseAreaLayout,
  parseBookingRules,
  parseClosedDay,
  bookingRuleViolation,
  DEFAULT_BOOKING_RULES,
  foodLocal,
  parseFoodCreate,
  timeOffWindow,
  type FoodCatalogKind,
  type FoodStatus,
  type Permission,
} from '@pms/domain';
import type { DbTx, Prisma, DiningArea, DiningTable, ServicePeriod } from '@pms/database';
import { currentUserId } from '../auth/request-context';
import { PrismaService } from '../database/prisma.provider';
import { foodMay, foodScope, foodTransaction, foodWritable, waiterSelf, type FoodScope } from './scope';
import { occupancyCommand, occupancyEnabled, reservationOccupancy } from './occupancy';
import { customerSearch, customerSearchWhere } from '../customers/search';

/** Сегодня по часовому поясу филиала, `ГГГГ-ММ-ДД` */
const localToday = (timezone: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());
const active: FoodStatus[] = ['BOOKED', 'CONFIRMED', 'SEATED'];
const include = {
  customer: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      status: true,
      isVip: true,
      birthDate: true,
    },
  },
  servicePeriod: true,
  tableAssignment: { include: { table: { include: { area: true } } } },
  // §33.6: кто принял бронь
  employee: { select: { id: true, name: true } },
} as const;
type Row = Prisma.RestaurantReservationGetPayload<{ include: typeof include }>;
function parsed<T>(fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    throw new BadRequestException(e instanceof Error ? e.message : 'Некорректный запрос');
  }
}
const clock = (s: string) => new Date(`1970-01-01T${s}:00Z`);
const clockText = (d: Date) => d.toISOString().slice(11, 16);
type CatalogRow = DiningArea | DiningTable | ServicePeriod;
function catalogView(row: CatalogRow) {
  return 'timeFrom' in row
    ? { ...row, timeFrom: clockText(row.timeFrom), timeTo: clockText(row.timeTo) }
    : row;
}
function catalogSnapshot(row: CatalogRow): Prisma.InputJsonObject {
  return {
    ...catalogView(row),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
const view = (r: Row) => ({
  id: r.id,
  locationId: r.locationId,
  customerId: r.customerId,
  servicePeriodId: r.servicePeriodId,
  startsAt: r.startsAt,
  endsAt: r.endsAt,
  partySize: r.partySize,
  status: r.status,
  source: r.source,
  notes: r.notes,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
  createdById: r.createdById,
  employee: r.employee,
  customer: {
    ...r.customer,
    // §36: дата рождения строкой; метка «день рождения в день брони» считается на экране по дню филиала
    birthDate: r.customer.birthDate ? r.customer.birthDate.toISOString().slice(0, 10) : null,
    name: [r.customer.firstName, r.customer.lastName].filter(Boolean).join(' '),
  },
  servicePeriod: catalogView(r.servicePeriod),
  table: r.tableAssignment
    ? { ...r.tableAssignment.table, areaName: r.tableAssignment.table.area.name }
    : null,
  nextStatuses: foodNext(r.status),
});

function page(raw: unknown, extra: string[] = []) {
  return parsed(() => {
    const q = foodObject(raw, ['cursor', 'limit', ...extra]);
    const limit =
      q.limit === undefined
        ? 100
        : foodInt(
            typeof q.limit === 'string' && /^\d+$/.test(q.limit) ? Number(q.limit) : q.limit,
            1,
            100,
          );
    return { q, limit, cursor: q.cursor === undefined ? undefined : foodId(q.cursor) };
  });
}
function paged<T extends { id: string }>(rows: T[], limit: number) {
  return {
    items: rows.slice(0, limit),
    nextCursor: rows.length > limit ? rows[limit - 1]!.id : null,
  };
}
@Injectable()
export class FoodService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  private async write<T>(
    permission: Permission,
    fn: (tx: DbTx, s: FoodScope) => Promise<T>,
  ): Promise<T> {
    foodMay(permission);
    await foodWritable(this.prisma.db);
    const s = await foodScope(this.prisma.db);
    return foodTransaction(this.prisma, s, fn);
  }
  private async audit(
    tx: DbTx,
    s: FoodScope,
    id: string,
    action: string,
    after: Prisma.InputJsonObject,
    before?: Prisma.InputJsonObject,
  ) {
    await tx.auditLog.create({
      data: {
        organizationId: s.organizationId,
        userId: currentUserId(),
        entityType: action.startsWith('food.customer.')
          ? 'customer'
          : action.startsWith('food.reservation.') ||
          ['food.table.assigned', 'food.table.reassigned', 'food.table.unassigned'].includes(action)
            ? 'restaurant_reservation'
            : 'food_catalog',
        entityId: id,
        action,
        after,
        ...(before ? { before } : {}),
      },
    });
  }
  async catalog(kind: FoodCatalogKind, query: unknown) {
    foodMay('desk');
    const s = await foodScope(this.prisma.db),
      p = page(query);
    const args = { take: p.limit + 1, orderBy: { id: 'asc' as const } };
    const cursor = p.cursor ? { id: { gt: p.cursor } } : {};
    if (kind === 'area')
      return paged(
        await this.prisma.db.diningArea.findMany({
          ...args,
          where: { ...cursor, locationId: s.locationId },
        }),
        p.limit,
      );
    if (kind === 'table')
      return paged(
        await this.prisma.db.diningTable.findMany({
          ...args,
          where: { ...cursor, area: { locationId: s.locationId } },
        }),
        p.limit,
      );
    return paged(
      (
        await this.prisma.db.servicePeriod.findMany({
          ...args,
          where: { ...cursor, locationId: s.locationId },
        })
      ).map((r) => ({ ...r, timeFrom: clockText(r.timeFrom), timeTo: clockText(r.timeTo) })),
      p.limit,
    );
  }
  async createCatalog(kind: FoodCatalogKind, raw: unknown) {
    return this.write('property', async (tx, s) => {
      const b = parsed(() => parseFoodCatalog(kind, raw));
      let row: CatalogRow;
      if (kind === 'area')
        row = await tx.diningArea.create({
          data: {
            locationId: s.locationId,
            name: b.name!,
            sortOrder: b.sortOrder ?? 0,
            active: b.active ?? true,
          },
        });
      else if (kind === 'table') {
        if (
          !(await tx.diningArea.findFirst({
            where: { id: b.areaId!, locationId: s.locationId, active: true },
          }))
        )
          throw new NotFoundException('Зал недоступен');
        row = await tx.diningTable.create({
          data: {
            areaId: b.areaId!,
            name: b.name!,
            capacity: b.capacity!,
            sortOrder: b.sortOrder ?? 0,
            active: b.active ?? true,
          },
        });
      } else
        row = await tx.servicePeriod.create({
          data: {
            locationId: s.locationId,
            name: b.name!,
            weekday: b.weekday!,
            timeFrom: clock(b.timeFrom!),
            timeTo: clock(b.timeTo!),
            endsNextDay: b.endsNextDay ?? false,
            defaultDurationMinutes: b.defaultDurationMinutes!,
            active: b.active ?? true,
          },
        });
      await this.audit(
        tx,
        s,
        row.id,
        `food.${kind === 'period' ? 'service_period' : kind}.created`,
        catalogSnapshot(row),
      );
      return catalogView(row);
    });
  }
  async updateCatalog(kind: FoodCatalogKind, idRaw: string, raw: unknown) {
    return this.write('property', async (tx, s) => {
      const id = parsed(() => foodId(idRaw)),
        b = parsed(() => parseFoodCatalog(kind, raw, true));
      let row: CatalogRow;
      let before: Prisma.InputJsonObject;
      if (kind === 'area') {
        const old = await tx.diningArea.findFirst({ where: { id, locationId: s.locationId } });
        if (!old) throw new NotFoundException('Зал не найден');
        before = catalogSnapshot(old);
        row = await tx.diningArea.update({
          where: { id },
          data: {
            ...(b.name !== undefined ? { name: b.name } : {}),
            ...(b.sortOrder !== undefined ? { sortOrder: b.sortOrder } : {}),
            ...(b.active !== undefined ? { active: b.active } : {}),
          },
        });
      } else if (kind === 'table') {
        const old = await tx.diningTable.findFirst({
          where: { id, area: { locationId: s.locationId } },
        });
        if (!old) throw new NotFoundException('Стол не найден');
        before = catalogSnapshot(old);
        await tx.$queryRaw`SELECT id FROM dining_tables WHERE id=${id}::uuid FOR UPDATE`;
        if (
          b.capacity !== undefined &&
          (await tx.tableAssignment.count({
            where: {
              tableId: id,
              reservation: { status: { in: active }, partySize: { gt: b.capacity } },
            },
          }))
        )
          throw new ConflictException('Вместимость меньше действующей брони');
        row = await tx.diningTable.update({
          where: { id },
          data: {
            ...(b.name !== undefined ? { name: b.name } : {}),
            ...(b.capacity !== undefined ? { capacity: b.capacity } : {}),
            ...(b.sortOrder !== undefined ? { sortOrder: b.sortOrder } : {}),
            ...(b.active !== undefined ? { active: b.active } : {}),
          },
        });
      } else {
        const old = await tx.servicePeriod.findFirst({ where: { id, locationId: s.locationId } });
        if (!old) throw new NotFoundException('Период не найден');
        before = catalogSnapshot(old);
        const merged = parsed(() =>
          parseFoodCatalog('period', {
            name: old.name,
            weekday: old.weekday,
            timeFrom: clockText(old.timeFrom),
            timeTo: clockText(old.timeTo),
            endsNextDay: old.endsNextDay,
            defaultDurationMinutes: old.defaultDurationMinutes,
            active: old.active,
            ...b,
          }),
        );
        row = await tx.servicePeriod.update({
          where: { id },
          data: { ...merged, timeFrom: clock(merged.timeFrom!), timeTo: clock(merged.timeTo!) },
        });
      }
      await this.audit(
        tx,
        s,
        id,
        `food.${kind === 'period' ? 'service_period' : kind}.updated`,
        catalogSnapshot(row),
        before,
      );
      return catalogView(row);
    });
  }
  /** Правила брони и будущие закрытые дни (§43) */
  async bookingSettings() {
    foodMay('desk');
    const s = await foodScope(this.prisma.db);
    const today = foodLocal(new Date(), s.timezone).date;
    const closedDays = await this.prisma.db.foodClosedDay.findMany({
      where: { locationId: s.locationId, day: { gte: new Date(`${today}T00:00:00Z`) } },
      orderBy: { day: 'asc' },
      take: 400,
    });
    return {
      rules: await this.bookingRules(this.prisma.db, s),
      closedDays: closedDays.map((d) => ({ id: d.id, day: d.day.toISOString().slice(0, 10), reason: d.reason })),
    };
  }
  async setBookingRules(raw: unknown) {
    return this.write('property', async (tx, s) => {
      const rules = parsed(() => parseBookingRules(raw));
      const before = await this.bookingRules(tx, s);
      await tx.foodBookingRules.upsert({
        where: { locationId: s.locationId },
        create: { locationId: s.locationId, ...rules },
        update: rules,
      });
      await this.audit(tx, s, s.locationId, 'food.booking_rules.set', { ...rules }, { ...before });
      return rules;
    });
  }
  async addClosedDay(raw: unknown) {
    return this.write('property', async (tx, s) => {
      const b = parsed(() => parseClosedDay(raw));
      const row = await tx.foodClosedDay.create({
        data: { locationId: s.locationId, day: new Date(`${b.day}T00:00:00Z`), reason: b.reason },
      });
      await this.audit(tx, s, row.id, 'food.closed_day.added', { day: b.day, reason: b.reason });
      return { id: row.id, day: b.day, reason: b.reason };
    });
  }
  async removeClosedDay(idRaw: string) {
    return this.write('property', async (tx, s) => {
      const id = parsed(() => foodId(idRaw));
      const row = await tx.foodClosedDay.findFirst({ where: { id, locationId: s.locationId } });
      if (!row) throw new NotFoundException('Закрытый день не найден');
      await tx.foodClosedDay.delete({ where: { id } });
      await this.audit(tx, s, id, 'food.closed_day.removed', { day: row.day.toISOString().slice(0, 10) });
      return { ok: true };
    });
  }
  /** Схема зала (§42): расстановка зоны одним запросом, каждый стол обязан быть из этой зоны */
  async setLayout(areaIdRaw: string, raw: unknown) {
    return this.write('property', async (tx, s) => {
      const areaId = parsed(() => foodId(areaIdRaw));
      const layout = parsed(() => parseAreaLayout(raw));
      const area = await tx.diningArea.findFirst({ where: { id: areaId, locationId: s.locationId } });
      if (!area) throw new NotFoundException('Зона не найдена');
      const owned = await tx.diningTable.count({ where: { areaId, id: { in: layout.map((t) => t.id) } } });
      if (owned !== layout.length) throw new BadRequestException('Стол не из этой зоны');
      for (const t of layout)
        await tx.diningTable.update({
          where: { id: t.id },
          data: { posX: t.posX, posY: t.posY, shape: t.shape, scale: t.scale, rotation: t.rotation },
        });
      await this.audit(tx, s, areaId, 'food.area.layout.set', { tables: layout.length });
      return { tables: layout };
    });
  }
  async customers(query: unknown) {
    foodMay('desk');
    const p = page(query, ['q']);
    // поиск в шапке ресторана (аудит 22.10.2026 P1-4): сужает тот же список, фильтр организации и бизнеса прежний
    const search = customerSearch(p.q.q);
    const s = await foodScope(this.prisma.db);
    const rows = await this.prisma.db.customer.findMany({
      where: {
        ...(p.cursor ? { id: { gt: p.cursor } } : {}),
        organizationId: s.organizationId,
        status: 'ACTIVE',
        businesses: { some: { businessId: s.businessId } },
        ...(search ? customerSearchWhere(search) : {}),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        status: true,
        isVip: true,
        birthDate: true,
      },
      orderBy: { id: 'asc' },
      take: p.limit + 1,
    });
    // «Постоянный гость» на экране клиентов (ADR-159): визит = посажен или завершён в этом филиале
    const visits = rows.length
      ? await this.prisma.db.restaurantReservation.groupBy({
          by: ['customerId'],
          where: {
            locationId: s.locationId,
            customerId: { in: rows.map((r) => r.id) },
            status: { in: ['SEATED', 'COMPLETED'] },
          },
          _count: { _all: true },
        })
      : [];
    const byCustomer = new Map(visits.map((v) => [v.customerId, v._count._all]));
    const today = localToday(s.timezone);
    return paged(
      rows.map((r) => {
        const birthDate = r.birthDate ? r.birthDate.toISOString().slice(0, 10) : null;
        return {
          ...r,
          birthDate,
          birthdayInDays: birthDate ? birthdayInDays(birthDate, today) : null,
          visits: byCustomer.get(r.id) ?? 0,
        };
      }),
      p.limit,
    );
  }

  /** VIP-метка и дата рождения (§36): клиент виден в этом бизнесе; дата в журнал не пишется */
  async updateCustomer(idRaw: string, raw: unknown) {
    return this.write('desk', async (tx, s) => {
      const id = parsed(() => foodId(idRaw));
      const b = parsed(() => parseCustomerMarks(raw, localToday(s.timezone)));
      const found = await tx.customer.findFirst({
        where: { id, organizationId: s.organizationId, businesses: { some: { businessId: s.businessId } } },
      });
      if (!found) throw new NotFoundException('Клиент не найден');
      const row = await tx.customer.update({
        where: { id },
        data: {
          ...(b.isVip !== undefined ? { isVip: b.isVip } : {}),
          ...(b.birthDate !== undefined
            ? { birthDate: b.birthDate === null ? null : new Date(`${b.birthDate}T00:00:00Z`) }
            : {}),
        },
      });
      await this.audit(
        tx,
        s,
        id,
        'food.customer.marks',
        { isVip: row.isVip, birthDateChanged: b.birthDate !== undefined },
        { isVip: found.isVip },
      );
      return {
        id,
        isVip: row.isVip,
        birthDate: row.birthDate ? row.birthDate.toISOString().slice(0, 10) : null,
      };
    });
  }
  async reservations(query: unknown) {
    foodMay('orders');
    const s = await foodScope(this.prisma.db),
      p = page(query, ['date']);
    // официант видит только брони, которые принял сам (§33.6)
    const me = await waiterSelf(this.prisma.db, s);
    const date = parsed(() => {
      const d = foodText(p.q.date, 10);
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(d) ||
        !Number.isFinite(Date.parse(d)) ||
        new Date(d).toISOString().slice(0, 10) !== d
      )
        throw new Error('Нужна календарная дата');
      return d;
    });
    const window = timeOffWindow({ dateFrom: date, dateTo: date, timezone: s.timezone });
    const rows = await this.prisma.db.restaurantReservation.findMany({
      where: {
        locationId: s.locationId,
        startsAt: { gte: window.fromUtc, lt: window.toUtcExclusive },
        ...(me ? { employeeId: me.id } : {}),
      },
      include,
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      take: p.limit + 1,
      ...(p.cursor ? { cursor: { id: p.cursor }, skip: 1 } : {}),
    });
    return paged(rows.map(view), p.limit);
  }
  private async period(tx: DbTx, s: FoodScope, id: string, startsAt: string) {
    const p = await tx.servicePeriod.findFirst({
      where: { id, locationId: s.locationId, active: true },
    });
    if (!p) throw new NotFoundException('Период обслуживания недоступен');
    const endsAt = parsed(() =>
      foodEnd(
        { ...p, timeFrom: clockText(p.timeFrom), timeTo: clockText(p.timeTo) },
        startsAt,
        s.timezone,
      ),
    );
    return endsAt;
  }
  /** Правила брони филиала (§43); нет строки значит прежнее поведение */
  private async bookingRules(db: Pick<DbTx, 'foodBookingRules'>, s: FoodScope) {
    const row = await db.foodBookingRules.findUnique({ where: { locationId: s.locationId } });
    return row
      ? { bufferMinutes: row.bufferMinutes, horizonDays: row.horizonDays, maxPartySize: row.maxPartySize }
      : DEFAULT_BOOKING_RULES;
  }
  /** Горизонт, закрытые дни и предел гостей (§43) по дате начала в поясе филиала */
  private async checkRules(tx: DbTx, s: FoodScope, startsAt: Date, partySize: number) {
    const day = foodLocal(startsAt, s.timezone).date;
    const closed = await tx.foodClosedDay.findUnique({
      where: { locationId_day: { locationId: s.locationId, day: new Date(`${day}T00:00:00Z`) } },
    });
    const violation = bookingRuleViolation({
      day,
      today: foodLocal(new Date(), s.timezone).date,
      partySize,
      rules: await this.bookingRules(tx, s),
      closed: closed !== null,
    });
    if (violation) throw new ConflictException(violation);
  }
  private async table(
    tx: DbTx,
    s: FoodScope,
    id: string,
    r: { id?: string; startsAt: Date; endsAt: Date; partySize: number },
  ) {
    const table = await tx.diningTable.findFirst({
      where: { id, active: true, area: { locationId: s.locationId, active: true } },
    });
    if (!table) throw new NotFoundException('Стол недоступен');
    await tx.$queryRaw`SELECT id FROM dining_tables WHERE id=${id}::uuid FOR UPDATE`;
    if (!foodCapacity(r.partySize, table.capacity))
      throw new ConflictException('Недостаточная вместимость стола');
    const buffer = (await this.bookingRules(tx, s)).bufferMinutes * 60_000;
    if (
      await tx.tableAssignment.findFirst({
        where: {
          tableId: id,
          reservation: {
            ...(r.id ? { id: { not: r.id } } : {}),
            status: { in: active },
            // буфер между посадками (§43) расширяет занятость стола в обе стороны
            startsAt: { lt: new Date(r.endsAt.getTime() + buffer) },
            endsAt: { gt: new Date(r.startsAt.getTime() - buffer) },
          },
        },
      })
    )
      throw new ConflictException('Стол в это время занят');
  }
  async create(keyRaw: unknown, raw: unknown) {
    return this.write('orders', async (tx, s) => {
      const key = parsed(() => foodText(keyRaw, 200)),
        b = parsed(() => parseFoodCreate(raw));
      // §33.6: официант принимает бронь на себя; у стойки «Принял» выбирают в форме, необязательно
      const me = await waiterSelf(tx, s);
      if (me) {
        if (b.source === 'WALK_IN') throw new ForbiddenException('Посадку без брони делает стойка');
        b.employeeId = me.id;
      } else if (
        b.employeeId &&
        !(await tx.employee.findFirst({ where: { id: b.employeeId, businessId: s.businessId, status: 'ACTIVE' } }))
      )
        throw new NotFoundException('Сотрудник недоступен');
      const fingerprint = foodFingerprint(b);
      const old = await tx.restaurantReservation.findUnique({
        where: { locationId_creationKey: { locationId: s.locationId, creationKey: key } },
        include,
      });
      if (old) {
        if (old.creationFingerprint !== fingerprint)
          throw new ConflictException('Ключ уже использован для другой брони');
        return view(old);
      }
      const startsAt = new Date(b.startsAt),
        endsAt = await this.period(tx, s, b.servicePeriodId, b.startsAt);
      await this.checkRules(tx, s, startsAt, b.partySize);
      if (b.tableId)
        await this.table(tx, s, b.tableId, { startsAt, endsAt, partySize: b.partySize });
      let customerId = b.customerId;
      if (customerId) {
        await tx.$queryRaw`SELECT id FROM customers WHERE id=${customerId}::uuid FOR SHARE`;
        if (
          !(await tx.customer.findFirst({
            where: { id: customerId, organizationId: s.organizationId, status: 'ACTIVE' },
          }))
        )
          throw new NotFoundException('Клиент недоступен');
      } else
        customerId = (await findOrCreateCustomer(tx, s.organizationId, b.customer!)).id;
      await tx.customerBusiness.upsert({
        where: { customerId_businessId: { customerId, businessId: s.businessId } },
        create: { customerId, businessId: s.businessId },
        update: {},
      });
      const r = await tx.restaurantReservation.create({
        data: {
          locationId: s.locationId,
          customerId,
          servicePeriodId: b.servicePeriodId,
          startsAt,
          endsAt,
          partySize: b.partySize,
          status: b.source === 'WALK_IN' ? 'SEATED' : 'BOOKED',
          source: b.source,
          notes: b.notes,
          creationKey: key,
          creationFingerprint: fingerprint,
          createdById: currentUserId(),
          employeeId: b.employeeId ?? null,
        },
      });
      if (b.tableId) {
        await tx.tableAssignment.create({
          data: { reservationId: r.id, tableId: b.tableId, assignedById: currentUserId() },
        });
        await this.audit(tx, s, r.id, 'food.table.assigned', { tableId: b.tableId });
      }
      if (r.status === 'SEATED' && b.tableId) await reservationOccupancy(tx,s.locationId,r.id,b.tableId,'SEAT',`walk-in:${key}`,currentUserId());
      await this.audit(tx, s, r.id, 'food.reservation.created', {
        locationId: s.locationId,
        customerId,
        servicePeriodId: b.servicePeriodId,
        startsAt: b.startsAt,
        endsAt: endsAt.toISOString(),
        partySize: b.partySize,
        status: r.status,
        source: r.source,
        employeeId: r.employeeId,
      });
      return view(
        await tx.restaurantReservation.findUniqueOrThrow({ where: { id: r.id }, include }),
      );
    });
  }
  private async locked(tx: DbTx, s: FoodScope, idRaw: string, b: Record<string, unknown>) {
    const id = parsed(() => foodId(idRaw));
    const expected = parsed(() => {
      if (!FOOD_STATUSES.includes(b.expectedStatus as FoodStatus))
        throw new Error('Нужен ожидаемый статус');
      return { status: b.expectedStatus, at: foodInstant(b.expectedUpdatedAt) };
    });
    await tx.$queryRaw`SELECT id FROM restaurant_reservations WHERE id=${id}::uuid AND location_id=${s.locationId}::uuid FOR UPDATE`;
    const r = await tx.restaurantReservation.findFirst({
      where: { id, locationId: s.locationId },
      include,
    });
    if (!r) throw new NotFoundException('Бронь не найдена');
    if (r.status !== expected.status || r.updatedAt.toISOString() !== expected.at)
      throw new ConflictException('Бронь уже изменена, обновите данные');
    if (!active.includes(r.status))
      throw new ConflictException('Завершённую бронь изменять нельзя');
    return r;
  }
  private changed(r: Row) {
    return new Date(Math.max(Date.now(), r.updatedAt.getTime() + 1));
  }
  async update(id: string, raw: unknown) {
    return this.write('desk', async (tx, s) => {
      const b = parsed(() =>
        foodObject(raw, [
          'expectedStatus',
          'expectedUpdatedAt',
          'startsAt',
          'servicePeriodId',
          'partySize',
          'notes',
        ]),
      );
      const r = await this.locked(tx, s, id, b);
      const change = parsed(() => ({
        startsAt: b.startsAt === undefined ? r.startsAt.toISOString() : foodInstant(b.startsAt),
        servicePeriodId:
          b.servicePeriodId === undefined ? r.servicePeriodId : foodId(b.servicePeriodId),
        partySize: b.partySize === undefined ? r.partySize : foodInt(b.partySize),
        notes: b.notes === undefined ? r.notes : b.notes === null ? null : foodText(b.notes, 4000),
      }));
      const startsAt = new Date(change.startsAt),
        endsAt = await this.period(tx, s, change.servicePeriodId, change.startsAt);
      // правила только для новых времени и числа гостей: правка заметки старой брони им не подчиняется
      if (startsAt.getTime() !== r.startsAt.getTime() || change.partySize !== r.partySize)
        await this.checkRules(tx, s, startsAt, change.partySize);
      if (r.tableAssignment)
        await this.table(tx, s, r.tableAssignment.tableId, {
          id: r.id,
          startsAt,
          endsAt,
          partySize: change.partySize,
        });
      const result = await tx.restaurantReservation.update({
        where: { id: r.id },
        data: { ...change, startsAt, endsAt, updatedAt: this.changed(r) },
        include,
      });
      await this.audit(
        tx,
        s,
        r.id,
        'food.reservation.updated',
        {
          startsAt: change.startsAt,
          endsAt: endsAt.toISOString(),
          partySize: change.partySize,
          servicePeriodId: change.servicePeriodId,
        },
        {
          startsAt: r.startsAt.toISOString(),
          endsAt: r.endsAt.toISOString(),
          partySize: r.partySize,
          servicePeriodId: r.servicePeriodId,
        },
      );
      return view(result);
    });
  }
  private async checkStatus(tx: DbTx, s: FoodScope, r: Row, status: FoodStatus, tableId?: string|null) {
    if (!foodNext(r.status).includes(status)) throw new ConflictException('Переход статуса недоступен');
    if (status==='SEATED') {
      const target=tableId ?? r.tableAssignment?.tableId;
      if(!target) throw new ConflictException('Сначала назначьте стол');
      await this.table(tx,s,target,r);
    }
  }
  async status(id: string, raw: unknown) {
    return this.write('desk', async (tx, s) => {
      const b = parsed(() => foodObject(raw, ['expectedStatus', 'expectedUpdatedAt', 'status']));
      const r = await this.locked(tx, s, id, b);
      await this.checkStatus(tx,s,r,b.status as FoodStatus);
      if (b.status === 'SEATED') await reservationOccupancy(tx,s.locationId,r.id,r.tableAssignment!.tableId,'SEAT',`seat:${r.id}:${r.updatedAt.toISOString()}`,currentUserId());
      if (r.status === 'SEATED' && b.status === 'COMPLETED') await reservationOccupancy(tx,s.locationId,r.id,null,'RELEASE',`release:${r.id}:${r.updatedAt.toISOString()}`,currentUserId());
      const result = await tx.restaurantReservation.update({
        where: { id: r.id },
        data: { status: b.status as FoodStatus, updatedAt: this.changed(r) },
        include,
      });
      await this.audit(
        tx,
        s,
        r.id,
        'food.reservation.status',
        { status: result.status },
        { status: r.status },
      );
      return view(result);
    });
  }
  async assign(id: string, raw: unknown) {
    return this.write('desk', async (tx, s) => {
      const b = parsed(() => foodObject(raw, ['expectedStatus', 'expectedUpdatedAt', 'tableId']));
      const r = await this.locked(tx, s, id, b),
        tableId = parsed(() => foodId(b.tableId));
      await this.table(tx, s, tableId, r);
      if (r.status === 'SEATED') await reservationOccupancy(tx,s.locationId,r.id,tableId,'MOVE',`move:${r.id}:${r.updatedAt.toISOString()}`,currentUserId());
      await tx.tableAssignment.upsert({
        where: { reservationId: r.id },
        create: { reservationId: r.id, tableId, assignedById: currentUserId() },
        update: { tableId, assignedAt: new Date(), assignedById: currentUserId() },
      });
      const result = await tx.restaurantReservation.update({
        where: { id: r.id },
        data: { updatedAt: this.changed(r) },
        include,
      });
      await this.audit(
        tx,
        s,
        r.id,
        r.tableAssignment ? 'food.table.reassigned' : 'food.table.assigned',
        { tableId },
        { tableId: r.tableAssignment?.tableId ?? null },
      );
      return view(result);
    });
  }
  async occupancy(keyRaw: unknown, raw: unknown, action: 'SEAT'|'MOVE'|'RELEASE', id?: string) {
    foodMay('desk');
    if (!occupancyEnabled()) throw new ServiceUnavailableException('История посадки ещё не включена');
    return this.write('desk',async(tx,s)=>{
      const b=parsed(()=>foodObject(raw,['tableId','reservationId','orderId']));
      const key=parsed(()=>foodText(keyRaw,200));
      const tableId=b.tableId==null?null:parsed(()=>foodId(b.tableId));
      if(action!=='RELEASE' && !tableId) throw new ConflictException('Укажите стол');
      const sessionId=id?parsed(()=>foodId(id)):null;
      const reservationId=b.reservationId==null?null:parsed(()=>foodId(b.reservationId));
      const orderId=b.orderId==null?null:parsed(()=>foodId(b.orderId));
      // Replay before business checks: a successful release may now be terminal.
      const replay=await tx.$queryRaw<{result_id:string}[]>`SELECT result_id FROM table_occupancy_commands WHERE location_id=${s.locationId}::uuid AND intent_key=${key}`;
      if(replay.length) return occupancyCommand(tx,s.locationId,key,action,tableId,sessionId,reservationId,orderId,currentUserId());
      const sessions=sessionId ? await tx.$queryRaw<{reservation_id:string|null}[]>`SELECT reservation_id FROM table_occupancy_sessions WHERE id=${sessionId}::uuid AND location_id=${s.locationId}::uuid AND ended_at IS NULL FOR UPDATE` : [];
      const linked=action==='SEAT'?reservationId:sessions[0]?.reservation_id;
      let r: Row | null=null;
      if(linked){
        const existing=await tx.restaurantReservation.findFirst({where:{id:linked,locationId:s.locationId},include});
        if(!existing) throw new NotFoundException('Бронь не найдена');
        r=await this.locked(tx,s,linked,{expectedStatus:existing.status,expectedUpdatedAt:existing.updatedAt.toISOString()});
        if(action==='SEAT' || action==='RELEASE') await this.checkStatus(tx,s,r,action==='SEAT'?'SEATED':'COMPLETED',tableId);
        if(action==='MOVE') {
          if(r.status!=='SEATED') throw new ConflictException('Гости не посажены');
          await this.table(tx,s,tableId!,r);
        }
      }
      const result=await occupancyCommand(tx,s.locationId,key,action,tableId,sessionId,reservationId,orderId,currentUserId());
      if(r){
        if(action!=='RELEASE') await tx.tableAssignment.upsert({where:{reservationId:r.id},create:{reservationId:r.id,tableId:tableId!,assignedById:currentUserId()},update:{tableId:tableId!,assignedAt:new Date(),assignedById:currentUserId()}});
        await tx.restaurantReservation.update({where:{id:r.id},data:{status:action==='RELEASE'?'COMPLETED':'SEATED',updatedAt:this.changed(r)}});
        await this.audit(tx,s,r.id,'food.occupancy.'+action.toLowerCase(),{sessionId:result.id,tableId},{status:r.status,tableId:r.tableAssignment?.tableId??null});
      }
      return result;
    });
  }
  async occupancySessions(q: Record<string,unknown>) {
    foodMay('desk');
    const s=await foodScope(this.prisma.db);
    if(!occupancyEnabled()) return {status:'UNAVAILABLE',reason:'CAPTURE_DISABLED',sessions:[]};
    const from=new Date(parsed(()=>foodInstant(q.from))),to=new Date(parsed(()=>foodInstant(q.to)));
    if(to<=from || to.getTime()-from.getTime()>31*86400000) throw new ConflictException('Период до 31 дня');
    const limit=q.limit===undefined?100:Number(q.limit);
    if(typeof q.limit!=='undefined' && typeof q.limit!=='string' || !Number.isInteger(limit) || limit<1 || limit>500) throw new ConflictException('Размер страницы от 1 до 500');
    let after: string|null=null;
    if(q.cursor!==undefined){
      try {
        if(typeof q.cursor!=='string' || q.cursor.length>1024 || !/^[A-Za-z0-9_-]+$/.test(q.cursor)) throw new Error();
        const c=JSON.parse(Buffer.from(q.cursor,'base64url').toString('utf8'));
        if(c.v!==1 || c.locationId!==s.locationId || c.from!==from.toISOString() || c.to!==to.toISOString()) throw new Error();
        after=foodId(c.after);
      } catch {throw new ConflictException('Недействительный cursor для выбранного периода и филиала');}
    }
    // UUID keyset avoids timestamptz microsecond truncation through JavaScript Date.
    const rows=await this.prisma.db.$queryRaw<{id:string;tableId:string;reservationId:string|null;orderId:string|null;startedAt:Date;endedAt:Date|null}[]>`SELECT id,table_id AS "tableId",reservation_id AS "reservationId",order_id AS "orderId",started_at AS "startedAt",ended_at AS "endedAt" FROM table_occupancy_sessions WHERE location_id=${s.locationId}::uuid AND started_at<${to} AND (ended_at IS NULL OR ended_at>${from}) AND (${after}::uuid IS NULL OR id>${after}::uuid) ORDER BY id LIMIT ${limit+1}`;
    const hasMore=rows.length>limit, sessions=rows.slice(0,limit), last=sessions.at(-1);
    const nextCursor=hasMore&&last?Buffer.from(JSON.stringify({v:1,locationId:s.locationId,from:from.toISOString(),to:to.toISOString(),after:last.id})).toString('base64url'):null;
    return {status:'PARTIAL',reason:'CAPACITY_AND_COVERAGE_NOT_AVAILABLE',coverage:'UNAVAILABLE',sessions,hasMore,nextCursor};
  }
  async unassign(id: string, raw: unknown) {
    return this.write('desk', async (tx, s) => {
      const b = parsed(() => foodObject(raw, ['expectedStatus', 'expectedUpdatedAt']));
      const r = await this.locked(tx, s, id, b);
      if (r.status === 'SEATED')
        throw new ConflictException('Нельзя снять стол у посаженных гостей');
      await tx.tableAssignment.deleteMany({ where: { reservationId: r.id } });
      const result = await tx.restaurantReservation.update({
        where: { id: r.id },
        data: { updatedAt: this.changed(r) },
        include,
      });
      await this.audit(
        tx,
        s,
        r.id,
        'food.table.unassigned',
        { tableId: null },
        { tableId: r.tableAssignment?.tableId ?? null },
      );
      return view(result);
    });
  }
}
