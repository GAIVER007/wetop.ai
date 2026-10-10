import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
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
  parseFoodCatalog,
  parseFoodCreate,
  timeOffWindow,
  type FoodCatalogKind,
  type FoodStatus,
  type Permission,
} from '@pms/domain';
import type { DbTx, Prisma, DiningArea, DiningTable, ServicePeriod } from '@pms/database';
import { currentUserId } from '../auth/request-context';
import { PrismaService } from '../database/prisma.provider';
import { foodMay, foodScope, foodTransaction, foodWritable, type FoodScope } from './scope';
const active: FoodStatus[] = ['BOOKED', 'CONFIRMED', 'SEATED'];
const include = {
  customer: { select: { id: true, firstName: true, lastName: true, phone: true, status: true } },
  servicePeriod: true,
  tableAssignment: { include: { table: { include: { area: true } } } },
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
  customer: {
    ...r.customer,
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
        entityType:
          action.startsWith('food.reservation.') ||
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
  async customers(query: unknown) {
    foodMay('desk');
    const s = await foodScope(this.prisma.db),
      p = page(query);
    const rows = await this.prisma.db.customer.findMany({
      where: {
        ...(p.cursor ? { id: { gt: p.cursor } } : {}),
        organizationId: s.organizationId,
        status: 'ACTIVE',
        businesses: { some: { businessId: s.businessId } },
      },
      select: { id: true, firstName: true, lastName: true, phone: true, status: true },
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
    return paged(
      rows.map((r) => ({ ...r, visits: byCustomer.get(r.id) ?? 0 })),
      p.limit,
    );
  }
  async reservations(query: unknown) {
    foodMay('desk');
    const s = await foodScope(this.prisma.db),
      p = page(query, ['date']);
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
    if (
      await tx.tableAssignment.findFirst({
        where: {
          tableId: id,
          reservation: {
            ...(r.id ? { id: { not: r.id } } : {}),
            status: { in: active },
            startsAt: { lt: r.endsAt },
            endsAt: { gt: r.startsAt },
          },
        },
      })
    )
      throw new ConflictException('Стол в это время занят');
  }
  async create(keyRaw: unknown, raw: unknown) {
    return this.write('desk', async (tx, s) => {
      const key = parsed(() => foodText(keyRaw, 200)),
        b = parsed(() => parseFoodCreate(raw)),
        fingerprint = foodFingerprint(b);
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
        customerId = (
          await tx.customer.create({ data: { organizationId: s.organizationId, ...b.customer! } })
        ).id;
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
        },
      });
      if (b.tableId) {
        await tx.tableAssignment.create({
          data: { reservationId: r.id, tableId: b.tableId, assignedById: currentUserId() },
        });
        await this.audit(tx, s, r.id, 'food.table.assigned', { tableId: b.tableId });
      }
      await this.audit(tx, s, r.id, 'food.reservation.created', {
        locationId: s.locationId,
        customerId,
        servicePeriodId: b.servicePeriodId,
        startsAt: b.startsAt,
        endsAt: endsAt.toISOString(),
        partySize: b.partySize,
        status: r.status,
        source: r.source,
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
  async status(id: string, raw: unknown) {
    return this.write('desk', async (tx, s) => {
      const b = parsed(() => foodObject(raw, ['expectedStatus', 'expectedUpdatedAt', 'status']));
      const r = await this.locked(tx, s, id, b);
      if (!foodNext(r.status).includes(b.status as FoodStatus))
        throw new ConflictException('Переход статуса недоступен');
      if (b.status === 'SEATED') {
        if (!r.tableAssignment) throw new ConflictException('Сначала назначьте стол');
        await this.table(tx, s, r.tableAssignment.tableId, r);
      }
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
