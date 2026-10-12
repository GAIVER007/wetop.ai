import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  foodId,
  foodInt,
  foodObject,
  foodText,
  ingredientCost,
  orderDelayed,
  orderNext,
  orderPayment,
  foodCashBalances,
  payoutCheck,
  parseFoodPayment,
  parseFoodCashOperation,
  parseFoodReconciliation,
  parseFoodPayout,
  parseIngredientInput,
  parseMenuCategoryInput,
  parseMenuItemInput,
  parseOrderCreate,
  parseOrderItems,
  parsePayAdjustment,
  parsePaySettings,
  payrollTotals,
  techCardTotals,
  timeOffWindow,
  foodLocal,
  type OrderStatus,
  type FoodPaymentMethod,
  type Permission,
} from '@pms/domain';
import type { DbTx, Prisma } from '@pms/database';
import { currentUserId } from '../auth/request-context';
import { PrismaService } from '../database/prisma.provider';
import { foodMay, foodScope, foodTransaction, foodWritable, type FoodScope } from './scope';

const OPEN_STATUSES: OrderStatus[] = ['NEW', 'COOKING', 'READY', 'SERVED'];
const orderInclude = {
  table: { include: { area: { select: { name: true } } } },
  waiter: { select: { id: true, name: true } },
  items: { orderBy: { sortOrder: 'asc' as const } },
  payments: { orderBy: { paidAt: 'asc' as const } },
} as const;
type OrderRow = Prisma.RestaurantOrderGetPayload<{ include: typeof orderInclude }>;

function parsed<T>(fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    throw new BadRequestException(e instanceof Error ? e.message : 'Некорректный запрос');
  }
}

/** Сумма действующих платежей заказа (§35.1) */
function orderPaid(r: { payments: Array<{ status: string; amount: bigint }> }): bigint {
  return r.payments.reduce((sum, p) => (p.status === 'COMPLETED' ? sum + p.amount : sum), 0n);
}

function orderView(r: OrderRow, now = new Date()) {
  return {
    id: r.id,
    number: r.number,
    status: r.status,
    tableId: r.tableId,
    table: r.table ? { id: r.table.id, name: r.table.name, areaName: r.table.area.name } : null,
    waiter: r.waiter,
    guestCount: r.guestCount,
    notes: r.notes,
    totalMinor: r.total.toString(),
    paidMinor: orderPaid(r).toString(),
    currency: r.currency,
    openedAt: r.openedAt,
    cookingAt: r.cookingAt,
    readyAt: r.readyAt,
    servedAt: r.servedAt,
    closedAt: r.closedAt,
    updatedAt: r.updatedAt,
    delayed: orderDelayed(r.status, r.openedAt, now),
    nextStatuses: orderNext(r.status),
    items: r.items.map((i) => ({
      id: i.id,
      menuItemId: i.menuItemId,
      name: i.name,
      priceMinor: i.price.toString(),
      qty: i.qty,
      notes: i.notes,
    })),
    payments: r.payments.map((p) => ({
      id: p.id,
      method: p.method,
      amountMinor: p.amount.toString(),
      status: p.status,
      paidAt: p.paidAt,
      voidReason: p.voidReason,
    })),
  };
}

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
  return { items: rows.slice(0, limit), nextCursor: rows.length > limit ? rows[limit - 1]!.id : null };
}
function dayParam(v: unknown): string {
  return parsed(() => {
    const d = foodText(v, 10);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(d) ||
      !Number.isFinite(Date.parse(d)) ||
      new Date(d).toISOString().slice(0, 10) !== d
    )
      throw new Error('Нужна календарная дата');
    return d;
  });
}
function monthParam(v: unknown): { from: string; to: string; month: string } {
  return parsed(() => {
    const m = foodText(v, 7);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(m)) throw new Error('Месяц в формате ГГГГ-ММ');
    const [y, mm] = m.split('-').map(Number);
    const last = new Date(Date.UTC(y!, mm!, 0)).getUTCDate();
    return { from: `${m}-01`, to: `${m}-${String(last).padStart(2, '0')}`, month: m };
  });
}
function previousDay(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
const clockText = (d: Date) => d.toISOString().slice(11, 16);

@Injectable()
export class RestaurantService {
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
    entityType: string,
    id: string,
    action: string,
    after: Prisma.InputJsonObject,
    before?: Prisma.InputJsonObject,
  ) {
    await tx.auditLog.create({
      data: {
        organizationId: s.organizationId,
        userId: currentUserId(),
        entityType,
        entityId: id,
        action,
        after,
        ...(before ? { before } : {}),
      },
    });
  }

  // ─── Меню и техкарты (§33.1) ───

  async categories(query: unknown) {
    foodMay('desk');
    const s = await foodScope(this.prisma.db),
      p = page(query);
    return paged(
      await this.prisma.db.menuCategory.findMany({
        where: { ...(p.cursor ? { id: { gt: p.cursor } } : {}), businessId: s.businessId },
        orderBy: { id: 'asc' },
        take: p.limit + 1,
      }),
      p.limit,
    );
  }

  async createCategory(raw: unknown) {
    return this.write('property', async (tx, s) => {
      const b = parsed(() => parseMenuCategoryInput(raw));
      const row = await tx.menuCategory.create({
        data: {
          businessId: s.businessId,
          name: b.name!,
          sortOrder: b.sortOrder ?? 0,
          active: b.active ?? true,
        },
      });
      await this.audit(tx, s, 'menu_category', row.id, 'food.menu_category.created', {
        name: row.name,
      });
      return row;
    });
  }

  async updateCategory(idRaw: string, raw: unknown) {
    return this.write('property', async (tx, s) => {
      const id = parsed(() => foodId(idRaw)),
        b = parsed(() => parseMenuCategoryInput(raw, true));
      const old = await tx.menuCategory.findFirst({ where: { id, businessId: s.businessId } });
      if (!old) throw new NotFoundException('Категория не найдена');
      const row = await tx.menuCategory.update({
        where: { id },
        data: {
          ...(b.name !== undefined ? { name: b.name } : {}),
          ...(b.sortOrder !== undefined ? { sortOrder: b.sortOrder } : {}),
          ...(b.active !== undefined ? { active: b.active } : {}),
        },
      });
      await this.audit(
        tx,
        s,
        'menu_category',
        id,
        'food.menu_category.updated',
        { name: row.name, sortOrder: row.sortOrder, active: row.active },
        { name: old.name, sortOrder: old.sortOrder, active: old.active },
      );
      return row;
    });
  }

  private menuItemView(
    row: Prisma.MenuItemGetPayload<{ include: { ingredients: true } }> | Prisma.MenuItemGetPayload<object>,
  ) {
    const ingredients =
      'ingredients' in row
        ? (row as Prisma.MenuItemGetPayload<{ include: { ingredients: true } }>).ingredients
        : null;
    const totals = ingredients
      ? techCardTotals(
          row.price,
          ingredients.map((i) => ({ normQty: i.normQty.toString(), unit: i.unit, unitCost: i.unitCost })),
        )
      : null;
    return {
      id: row.id,
      categoryId: row.categoryId,
      name: row.name,
      weightGrams: row.weightGrams,
      priceMinor: row.price.toString(),
      currency: row.currency,
      active: row.active,
      techNotes: row.techNotes,
      sortOrder: row.sortOrder,
      updatedAt: row.updatedAt,
      ...(ingredients
        ? {
            ingredients: ingredients.map((i) => ({
              id: i.id,
              name: i.name,
              normQty: i.normQty.toString(),
              unit: i.unit,
              unitCostMinor: i.unitCost.toString(),
              costMinor: ingredientCost({
                normQty: i.normQty.toString(),
                unit: i.unit,
                unitCost: i.unitCost,
              }).toString(),
            })),
            totals: totals
              ? {
                  costMinor: totals.cost.toString(),
                  profitMinor: totals.profit.toString(),
                  foodCostPct: totals.foodCostPct,
                  marginPct: totals.marginPct,
                }
              : null,
          }
        : {}),
    };
  }

  async menuItems(query: unknown) {
    foodMay('desk');
    const s = await foodScope(this.prisma.db),
      p = page(query);
    return paged(
      (
        await this.prisma.db.menuItem.findMany({
          where: { ...(p.cursor ? { id: { gt: p.cursor } } : {}), businessId: s.businessId },
          include: { ingredients: true },
          orderBy: { id: 'asc' },
          take: p.limit + 1,
        })
      ).map((r) => this.menuItemView(r)),
      p.limit,
    );
  }

  async menuItem(idRaw: string) {
    foodMay('desk');
    const s = await foodScope(this.prisma.db),
      id = parsed(() => foodId(idRaw));
    const row = await this.prisma.db.menuItem.findFirst({
      where: { id, businessId: s.businessId },
      include: { ingredients: true },
    });
    if (!row) throw new NotFoundException('Блюдо не найдено');
    return this.menuItemView(row);
  }

  async createMenuItem(raw: unknown) {
    return this.write('property', async (tx, s) => {
      const b = parsed(() => parseMenuItemInput(raw));
      if (
        !(await tx.menuCategory.findFirst({
          where: { id: b.categoryId!, businessId: s.businessId, active: true },
        }))
      )
        throw new NotFoundException('Категория недоступна');
      const row = await tx.menuItem.create({
        data: {
          businessId: s.businessId,
          categoryId: b.categoryId!,
          name: b.name!,
          weightGrams: b.weightGrams ?? null,
          price: b.price!,
          currency: s.currency,
          active: b.active ?? true,
          techNotes: b.techNotes ?? null,
          sortOrder: b.sortOrder ?? 0,
        },
        include: { ingredients: true },
      });
      await this.audit(tx, s, 'menu_item', row.id, 'food.menu_item.created', {
        name: row.name,
        priceMinor: row.price.toString(),
        categoryId: row.categoryId,
      });
      return this.menuItemView(row);
    });
  }

  async updateMenuItem(idRaw: string, raw: unknown) {
    return this.write('property', async (tx, s) => {
      const id = parsed(() => foodId(idRaw)),
        b = parsed(() => parseMenuItemInput(raw, true));
      const old = await tx.menuItem.findFirst({ where: { id, businessId: s.businessId } });
      if (!old) throw new NotFoundException('Блюдо не найдено');
      if (
        b.categoryId !== undefined &&
        !(await tx.menuCategory.findFirst({
          where: { id: b.categoryId, businessId: s.businessId, active: true },
        }))
      )
        throw new NotFoundException('Категория недоступна');
      const row = await tx.menuItem.update({
        where: { id },
        data: {
          ...(b.categoryId !== undefined ? { categoryId: b.categoryId } : {}),
          ...(b.name !== undefined ? { name: b.name } : {}),
          ...(b.weightGrams !== undefined ? { weightGrams: b.weightGrams } : {}),
          ...(b.price !== undefined ? { price: b.price } : {}),
          ...(b.active !== undefined ? { active: b.active } : {}),
          ...(b.techNotes !== undefined ? { techNotes: b.techNotes } : {}),
          ...(b.sortOrder !== undefined ? { sortOrder: b.sortOrder } : {}),
        },
        include: { ingredients: true },
      });
      await this.audit(
        tx,
        s,
        'menu_item',
        id,
        'food.menu_item.updated',
        { name: row.name, priceMinor: row.price.toString(), active: row.active },
        { name: old.name, priceMinor: old.price.toString(), active: old.active },
      );
      return this.menuItemView(row);
    });
  }

  /** Техкарта сохраняется целиком: состав заменяется одним запросом (§33.1) */
  async replaceIngredients(idRaw: string, raw: unknown) {
    return this.write('property', async (tx, s) => {
      const id = parsed(() => foodId(idRaw));
      const body = parsed(() => foodObject(raw, ['ingredients']));
      if (!Array.isArray(body.ingredients) || body.ingredients.length > 100)
        throw new BadRequestException('Пришлите строки техкарты списком до 100 строк');
      const rows = body.ingredients.map((r) => parsed(() => parseIngredientInput(r)));
      const old = await tx.menuItem.findFirst({
        where: { id, businessId: s.businessId },
        include: { ingredients: true },
      });
      if (!old) throw new NotFoundException('Блюдо не найдено');
      await tx.menuItemIngredient.deleteMany({ where: { menuItemId: id } });
      for (const [index, r] of rows.entries())
        await tx.menuItemIngredient.create({
          data: {
            menuItemId: id,
            name: r.name,
            normQty: r.normQty,
            unit: r.unit,
            unitCost: r.unitCost,
            sortOrder: r.sortOrder ?? index,
          },
        });
      await this.audit(
        tx,
        s,
        'menu_item',
        id,
        'food.tech_card.replaced',
        { rows: rows.map((r) => ({ name: r.name, normQty: r.normQty, unit: r.unit })) },
        { rows: old.ingredients.map((r) => ({ name: r.name, normQty: r.normQty.toString(), unit: r.unit })) },
      );
      const fresh = await tx.menuItem.findUniqueOrThrow({
        where: { id },
        include: { ingredients: true },
      });
      return this.menuItemView(fresh);
    });
  }

  // ─── Заказы и кухня (§33.2) ───

  async orders(query: unknown) {
    foodMay('desk');
    const s = await foodScope(this.prisma.db),
      p = page(query, ['date', 'open']);
    const where: Prisma.RestaurantOrderWhereInput = { locationId: s.locationId };
    if (p.q.open === '1') where.status = { in: OPEN_STATUSES };
    else {
      const date = dayParam(p.q.date);
      const w = timeOffWindow({ dateFrom: date, dateTo: date, timezone: s.timezone });
      where.openedAt = { gte: w.fromUtc, lt: w.toUtcExclusive };
    }
    const rows = await this.prisma.db.restaurantOrder.findMany({
      where,
      include: orderInclude,
      orderBy: [{ openedAt: 'desc' }, { id: 'asc' }],
      take: p.limit + 1,
      ...(p.cursor ? { cursor: { id: p.cursor }, skip: 1 } : {}),
    });
    const now = new Date();
    return paged(rows.map((r) => orderView(r, now)), p.limit);
  }

  private async orderItemsData(tx: DbTx, s: FoodScope, items: ReturnType<typeof parseOrderItems>) {
    const ids = [...new Set(items.map((i) => i.menuItemId))];
    const dishes = await tx.menuItem.findMany({
      where: { id: { in: ids }, businessId: s.businessId, active: true },
    });
    const byId = new Map(dishes.map((d) => [d.id, d]));
    for (const id of ids) if (!byId.has(id)) throw new NotFoundException('Блюдо недоступно');
    let total = 0n;
    const data = items.map((i, index) => {
      const dish = byId.get(i.menuItemId)!;
      total += dish.price * BigInt(i.qty);
      return {
        menuItemId: dish.id,
        name: dish.name,
        price: dish.price,
        qty: i.qty,
        notes: i.notes,
        sortOrder: index,
      };
    });
    return { data, total };
  }

  private async checkTableAndWaiter(
    tx: DbTx,
    s: FoodScope,
    tableId: string | null,
    waiterId: string | null,
  ) {
    if (
      tableId &&
      !(await tx.diningTable.findFirst({
        where: { id: tableId, active: true, area: { locationId: s.locationId, active: true } },
      }))
    )
      throw new NotFoundException('Стол недоступен');
    if (
      waiterId &&
      !(await tx.employee.findFirst({
        where: { id: waiterId, businessId: s.businessId, status: 'ACTIVE' },
      }))
    )
      throw new NotFoundException('Сотрудник недоступен');
  }

  async createOrder(raw: unknown) {
    return this.write('desk', async (tx, s) => {
      const b = parsed(() => parseOrderCreate(raw));
      await this.checkTableAndWaiter(tx, s, b.tableId, b.waiterId);
      const { data, total } = await this.orderItemsData(tx, s, b.items);
      const last = await tx.restaurantOrder.aggregate({
        where: { locationId: s.locationId },
        _max: { number: true },
      });
      const row = await tx.restaurantOrder.create({
        data: {
          locationId: s.locationId,
          number: (last._max.number ?? 0) + 1,
          tableId: b.tableId,
          waiterId: b.waiterId,
          guestCount: b.guestCount,
          notes: b.notes,
          total,
          currency: s.currency,
          createdById: currentUserId(),
          items: { create: data },
        },
        include: orderInclude,
      });
      await this.audit(tx, s, 'restaurant_order', row.id, 'food.order.created', {
        number: row.number,
        tableId: row.tableId,
        waiterId: row.waiterId,
        guestCount: row.guestCount,
        totalMinor: row.total.toString(),
        items: data.map((i) => ({ name: i.name, qty: i.qty })),
      });
      return orderView(row);
    });
  }

  private async lockedOrder(tx: DbTx, s: FoodScope, idRaw: string, b: Record<string, unknown>) {
    const id = parsed(() => foodId(idRaw));
    const expected = parsed(() => {
      if (typeof b.expectedStatus !== 'string') throw new Error('Нужен ожидаемый статус');
      if (typeof b.expectedUpdatedAt !== 'string') throw new Error('Нужна отметка изменения');
      return { status: b.expectedStatus, at: b.expectedUpdatedAt };
    });
    await tx.$queryRaw`SELECT id FROM restaurant_orders WHERE id=${id}::uuid AND location_id=${s.locationId}::uuid FOR UPDATE`;
    const r = await tx.restaurantOrder.findFirst({
      where: { id, locationId: s.locationId },
      include: orderInclude,
    });
    if (!r) throw new NotFoundException('Заказ не найден');
    if (r.status !== expected.status || r.updatedAt.toISOString() !== expected.at)
      throw new ConflictException('Заказ уже изменён, обновите данные');
    return r;
  }

  private bumped(r: { updatedAt: Date }) {
    return new Date(Math.max(Date.now(), r.updatedAt.getTime() + 1));
  }

  async updateOrder(idRaw: string, raw: unknown) {
    return this.write('desk', async (tx, s) => {
      const b = parsed(() =>
        foodObject(raw, [
          'expectedStatus',
          'expectedUpdatedAt',
          'tableId',
          'waiterId',
          'guestCount',
          'notes',
          'items',
        ]),
      );
      const r = await this.lockedOrder(tx, s, idRaw, b);
      if (r.status === 'CLOSED' || r.status === 'CANCELLED')
        throw new ConflictException('Завершённый заказ изменять нельзя');
      if (b.items !== undefined && r.status !== 'NEW' && r.status !== 'COOKING')
        throw new ConflictException('Состав заморожен после готовности');
      const tableId = b.tableId === undefined ? r.tableId : b.tableId === null ? null : parsed(() => foodId(b.tableId));
      const waiterId = b.waiterId === undefined ? r.waiterId : b.waiterId === null ? null : parsed(() => foodId(b.waiterId));
      await this.checkTableAndWaiter(
        tx,
        s,
        tableId === r.tableId ? null : tableId,
        waiterId === r.waiterId ? null : waiterId,
      );
      let total = r.total;
      if (b.items !== undefined) {
        const items = parsed(() => parseOrderItems(b.items));
        const next = await this.orderItemsData(tx, s, items);
        await tx.restaurantOrderItem.deleteMany({ where: { orderId: r.id } });
        for (const data of next.data)
          await tx.restaurantOrderItem.create({ data: { ...data, orderId: r.id } });
        total = next.total;
        if (total < orderPaid(r))
          throw new ConflictException('Состав нельзя уменьшить ниже оплаченной суммы');
      }
      const row = await tx.restaurantOrder.update({
        where: { id: r.id },
        data: {
          tableId,
          waiterId,
          guestCount:
            b.guestCount === undefined ? r.guestCount : parsed(() => foodInt(b.guestCount, 1, 1000)),
          notes:
            b.notes === undefined ? r.notes : b.notes === null ? null : parsed(() => foodText(b.notes, 4000)),
          total,
          updatedAt: this.bumped(r),
        },
        include: orderInclude,
      });
      await this.audit(
        tx,
        s,
        'restaurant_order',
        r.id,
        'food.order.updated',
        { tableId: row.tableId, waiterId: row.waiterId, guestCount: row.guestCount, totalMinor: row.total.toString() },
        { tableId: r.tableId, waiterId: r.waiterId, guestCount: r.guestCount, totalMinor: r.total.toString() },
      );
      return orderView(row);
    });
  }

  async orderStatus(idRaw: string, raw: unknown) {
    return this.write('desk', async (tx, s) => {
      const b = parsed(() => foodObject(raw, ['expectedStatus', 'expectedUpdatedAt', 'status']));
      const r = await this.lockedOrder(tx, s, idRaw, b);
      const status = b.status as OrderStatus;
      if (!orderNext(r.status).includes(status))
        throw new ConflictException('Переход статуса недоступен');
      if (status === 'CLOSED' && orderPaid(r) !== r.total)
        throw new ConflictException('Заказ не оплачен полностью');
      if (status === 'CANCELLED' && orderPaid(r) > 0n)
        throw new ConflictException('Сначала аннулируйте оплаты заказа');
      const stampField = (
        { COOKING: 'cookingAt', READY: 'readyAt', SERVED: 'servedAt', CLOSED: 'closedAt' } as const
      )[status as 'COOKING' | 'READY' | 'SERVED' | 'CLOSED'];
      const row = await tx.restaurantOrder.update({
        where: { id: r.id },
        data: {
          status,
          ...(stampField ? { [stampField]: new Date() } : {}),
          updatedAt: this.bumped(r),
        },
        include: orderInclude,
      });
      await this.audit(
        tx,
        s,
        'restaurant_order',
        r.id,
        'food.order.status',
        { status: row.status },
        { status: r.status },
      );
      return orderView(row);
    });
  }

  /** Статус «Уборка» на плане зала (§33.3) */
  async tableCleaning(idRaw: string, raw: unknown) {
    return this.write('desk', async (tx, s) => {
      const id = parsed(() => foodId(idRaw));
      const b = parsed(() => foodObject(raw, ['needsCleaning']));
      if (typeof b.needsCleaning !== 'boolean')
        throw new BadRequestException('Нужно логическое значение');
      const old = await tx.diningTable.findFirst({
        where: { id, area: { locationId: s.locationId } },
      });
      if (!old) throw new NotFoundException('Стол не найден');
      const row = await tx.diningTable.update({
        where: { id },
        data: { needsCleaning: b.needsCleaning },
      });
      await this.audit(
        tx,
        s,
        'food_catalog',
        id,
        'food.table.cleaning',
        { needsCleaning: row.needsCleaning },
        { needsCleaning: old.needsCleaning },
      );
      return row;
    });
  }

  // ─── Отчёт дня: плитки, почасовая выручка, последние заказы (макет «Главная») ───

  async report(query: unknown) {
    foodMay('desk');
    const s = await foodScope(this.prisma.db);
    const q = parsed(() => foodObject(query, ['date']));
    const date = dayParam(q.date);
    const w = timeOffWindow({ dateFrom: date, dateTo: date, timezone: s.timezone });
    const yesterday = previousDay(date);
    const wy = timeOffWindow({ dateFrom: yesterday, dateTo: yesterday, timezone: s.timezone });
    const db = this.prisma.db;
    const [todayOrders, yesterdayOrders, openOrders, tables, seated, hours] = await Promise.all([
      db.restaurantOrder.findMany({
        where: { locationId: s.locationId, openedAt: { gte: w.fromUtc, lt: w.toUtcExclusive } },
        include: orderInclude,
        orderBy: [{ openedAt: 'desc' }, { id: 'asc' }],
      }),
      db.restaurantOrder.findMany({
        where: { locationId: s.locationId, openedAt: { gte: wy.fromUtc, lt: wy.toUtcExclusive } },
        select: { status: true, total: true, closedAt: true },
      }),
      db.restaurantOrder.findMany({
        where: { locationId: s.locationId, status: { in: OPEN_STATUSES } },
        select: { tableId: true, status: true, openedAt: true },
      }),
      db.diningTable.findMany({
        where: { area: { locationId: s.locationId, active: true }, active: true },
        select: { id: true },
      }),
      db.tableAssignment.findMany({
        where: { reservation: { locationId: s.locationId, status: 'SEATED' } },
        select: { tableId: true },
      }),
      db.workingHours.findMany({
        where: { locationId: s.locationId, weekday: new Date(`${date}T12:00:00Z`).getUTCDay() },
        select: { employeeId: true, timeFrom: true, timeTo: true },
      }),
    ]);
    const now = new Date();
    const closedToday = todayOrders.filter((o) => o.status === 'CLOSED');
    const closedYesterday = yesterdayOrders.filter((o) => o.status === 'CLOSED');
    const sum = (rows: { total: bigint }[]) => rows.reduce((acc, o) => acc + o.total, 0n);
    const revenue = sum(closedToday);
    const revenueYesterday = sum(closedYesterday);
    const countToday = todayOrders.filter((o) => o.status !== 'CANCELLED').length;
    const countYesterday = yesterdayOrders.filter((o) => o.status !== 'CANCELLED').length;
    const pct = (today: number | bigint, prev: number | bigint) =>
      Number(prev) > 0 ? Math.round(((Number(today) - Number(prev)) / Number(prev)) * 100) : null;
    const occupied = new Set([
      ...openOrders.filter((o) => o.tableId).map((o) => o.tableId!),
      ...seated.map((a) => a.tableId),
    ]);
    const queue = openOrders.filter((o) => o.status === 'NEW' || o.status === 'COOKING');
    const avgWait = queue.length
      ? Math.round(queue.reduce((acc, o) => acc + (now.getTime() - o.openedAt.getTime()), 0) / queue.length / 60000)
      : null;
    const local = foodLocal(now, s.timezone);
    const minutes = (t: Date) => Number(clockText(t).slice(0, 2)) * 60 + Number(clockText(t).slice(3, 5));
    const nowMinutes = new Date(local.stamp).getUTCHours() * 60 + new Date(local.stamp).getUTCMinutes();
    const staffIds = new Set(hours.map((h) => h.employeeId));
    const onShift = new Set(
      hours
        .filter((h) => nowMinutes >= minutes(h.timeFrom) && nowMinutes < minutes(h.timeTo))
        .map((h) => h.employeeId),
    );
    const hourly = Array.from({ length: 24 }, () => 0n);
    for (const o of closedToday) {
      if (!o.closedAt) continue;
      const hour = new Date(foodLocal(o.closedAt, s.timezone).stamp).getUTCHours();
      hourly[hour] = hourly[hour]! + o.total;
    }
    return {
      date,
      currency: s.currency,
      tiles: {
        tablesOccupied: [...occupied].filter((id) => tables.some((t) => t.id === id)).length,
        tablesTotal: tables.length,
        ordersCount: countToday,
        ordersDeltaPct: pct(countToday, countYesterday),
        revenueMinor: revenue.toString(),
        revenueDeltaPct: pct(revenue, revenueYesterday),
        kitchenQueue: queue.length,
        kitchenAvgWaitMinutes: avgWait,
        staffOnShift: onShift.size,
        staffTotal: staffIds.size,
      },
      hourlyRevenueMinor: hourly.map((v) => v.toString()),
      latestOrders: todayOrders.slice(0, 8).map((r) => orderView(r, now)),
    };
  }

  // ─── Сотрудники и смены (ТЗ §5) ───

  async employees(query: unknown) {
    foodMay('desk');
    const s = await foodScope(this.prisma.db),
      p = page(query);
    const local = foodLocal(new Date(), s.timezone);
    const w = timeOffWindow({ dateFrom: local.date, dateTo: local.date, timezone: s.timezone });
    const weekday = new Date(`${local.date}T12:00:00Z`).getUTCDay();
    const rows = await this.prisma.db.employee.findMany({
      where: { ...(p.cursor ? { id: { gt: p.cursor } } : {}), businessId: s.businessId },
      include: {
        workingHours: { where: { locationId: s.locationId, weekday } },
        restaurantOrders: {
          where: {
            locationId: s.locationId,
            status: { not: 'CANCELLED' },
            openedAt: { gte: w.fromUtc, lt: w.toUtcExclusive },
          },
          select: { total: true },
        },
      },
      orderBy: { id: 'asc' },
      take: p.limit + 1,
    });
    const nowMinutes =
      new Date(local.stamp).getUTCHours() * 60 + new Date(local.stamp).getUTCMinutes();
    const minutes = (t: Date) => Number(clockText(t).slice(0, 2)) * 60 + Number(clockText(t).slice(3, 5));
    return paged(
      rows.map((r) => {
        const shift = r.workingHours[0] ?? null;
        return {
          id: r.id,
          name: r.name,
          phone: r.phone,
          email: r.email,
          status: r.status,
          shift: shift ? `${clockText(shift.timeFrom)}–${clockText(shift.timeTo)}` : null,
          onShift: shift
            ? nowMinutes >= minutes(shift.timeFrom) && nowMinutes < minutes(shift.timeTo)
            : false,
          salesTodayMinor: r.restaurantOrders.reduce((acc, o) => acc + o.total, 0n).toString(),
        };
      }),
      p.limit,
    );
  }

  async createEmployee(raw: unknown) {
    return this.write('staff', async (tx, s) => {
      const b = parsed(() => foodObject(raw, ['name', 'phone', 'email']));
      const row = await tx.employee.create({
        data: {
          businessId: s.businessId,
          name: parsed(() => foodText(b.name, 200)),
          phone: b.phone == null ? null : parsed(() => foodText(b.phone, 32)),
          email: b.email == null ? null : parsed(() => foodText(b.email, 320)),
        },
      });
      await tx.employeeLocation.create({ data: { employeeId: row.id, locationId: s.locationId } });
      await this.audit(tx, s, 'employee', row.id, 'food.employee.created', { name: row.name });
      return row;
    });
  }

  async updateEmployee(idRaw: string, raw: unknown) {
    return this.write('staff', async (tx, s) => {
      const id = parsed(() => foodId(idRaw));
      const b = parsed(() => foodObject(raw, ['name', 'phone', 'email', 'status']));
      const old = await tx.employee.findFirst({ where: { id, businessId: s.businessId } });
      if (!old) throw new NotFoundException('Сотрудник не найден');
      if (b.status !== undefined && b.status !== 'ACTIVE' && b.status !== 'ARCHIVED')
        throw new BadRequestException('Статус: ACTIVE или ARCHIVED');
      const row = await tx.employee.update({
        where: { id },
        data: {
          ...(b.name !== undefined ? { name: parsed(() => foodText(b.name, 200)) } : {}),
          ...(b.phone !== undefined
            ? { phone: b.phone === null ? null : parsed(() => foodText(b.phone, 32)) }
            : {}),
          ...(b.email !== undefined
            ? { email: b.email === null ? null : parsed(() => foodText(b.email, 320)) }
            : {}),
          ...(b.status !== undefined ? { status: b.status as 'ACTIVE' | 'ARCHIVED' } : {}),
        },
      });
      await this.audit(
        tx,
        s,
        'employee',
        id,
        'food.employee.updated',
        { name: row.name, status: row.status },
        { name: old.name, status: old.status },
      );
      return row;
    });
  }

  // ─── Оплата заказа и касса филиала (§35) ───

  /** Остатки кассы филиала по способам; внутри транзакции филиал уже заперт `foodTransaction` */
  private async balances(db: Pick<DbTx, 'restaurantPayment' | 'restaurantCashOperation'>, s: FoodScope) {
    const [payments, ops] = await Promise.all([
      db.restaurantPayment.groupBy({
        by: ['method'],
        where: { locationId: s.locationId, status: 'COMPLETED' },
        _sum: { amount: true },
      }),
      db.restaurantCashOperation.groupBy({
        by: ['kind', 'method', 'methodTo'],
        where: { locationId: s.locationId, status: 'COMPLETED' },
        _sum: { amount: true },
      }),
    ]);
    return foodCashBalances(
      payments.map((p) => ({ method: p.method, amount: p._sum.amount ?? 0n, status: 'COMPLETED' })),
      ops.map((o) => ({
        kind: o.kind,
        method: o.method,
        methodTo: o.methodTo,
        amount: o._sum.amount ?? 0n,
        status: 'COMPLETED',
      })),
    );
  }

  private async spendable(tx: DbTx, s: FoodScope, method: FoodPaymentMethod, amount: bigint) {
    if (amount > (await this.balances(tx, s))[method]) throw new ConflictException('В кассе по этому способу меньше этой суммы');
  }

  /** Платёж по заказу частями; полная оплата поданного заказа закрывает его (§35.1) */
  async payOrder(idRaw: string, raw: unknown) {
    return this.write('desk', async (tx, s) => {
      const id = parsed(() => foodId(idRaw));
      const b = parsed(() => parseFoodPayment(raw));
      const repeat = await tx.restaurantPayment.findUnique({
        where: { locationId_idempotencyKey: { locationId: s.locationId, idempotencyKey: b.idempotencyKey } },
      });
      if (repeat) {
        if (repeat.orderId !== id) throw new ConflictException('Ключ повтора уже использован');
        const row = await tx.restaurantOrder.findUniqueOrThrow({ where: { id }, include: orderInclude });
        return orderView(row);
      }
      await tx.$queryRaw`SELECT id FROM restaurant_orders WHERE id=${id}::uuid AND location_id=${s.locationId}::uuid FOR UPDATE`;
      const r = await tx.restaurantOrder.findFirst({ where: { id, locationId: s.locationId }, include: orderInclude });
      if (!r) throw new NotFoundException('Заказ не найден');
      const result = (() => {
        try {
          return orderPayment(r.status, r.total, orderPaid(r), b.amount);
        } catch (e) {
          throw new ConflictException(e instanceof Error ? e.message : 'Оплата недоступна');
        }
      })();
      const payment = await tx.restaurantPayment.create({
        data: {
          locationId: s.locationId,
          orderId: r.id,
          method: b.method,
          amount: b.amount,
          currency: r.currency,
          idempotencyKey: b.idempotencyKey,
          createdById: currentUserId(),
        },
      });
      const row = await tx.restaurantOrder.update({
        where: { id: r.id },
        data: {
          ...(result.close ? { status: 'CLOSED' as const, closedAt: new Date() } : {}),
          updatedAt: this.bumped(r),
        },
        include: orderInclude,
      });
      await this.audit(tx, s, 'restaurant_order', r.id, 'food.order.paid', {
        paymentId: payment.id,
        method: payment.method,
        amountMinor: payment.amount.toString(),
        paidMinor: result.paidAfter.toString(),
        closed: result.close,
      });
      return orderView(row);
    });
  }

  /** Аннулировать платёж, пока заказ не закрыт (право `refunds`) */
  async voidPayment(idRaw: string, raw: unknown) {
    return this.write('refunds', async (tx, s) => {
      const id = parsed(() => foodId(idRaw));
      const reason = parsed(() => foodText(foodObject(raw, ['reason']).reason, 200));
      const p = await tx.restaurantPayment.findFirst({ where: { id, locationId: s.locationId } });
      if (!p) throw new NotFoundException('Платёж не найден');
      await tx.$queryRaw`SELECT id FROM restaurant_orders WHERE id=${p.orderId}::uuid FOR UPDATE`;
      const r = await tx.restaurantOrder.findUniqueOrThrow({ where: { id: p.orderId }, include: orderInclude });
      if (r.status === 'CLOSED') throw new ConflictException('Заказ закрыт: платёж аннулировать нельзя');
      if (p.status !== 'COMPLETED') throw new ConflictException('Платёж уже аннулирован');
      await tx.restaurantPayment.update({
        where: { id: p.id },
        data: { status: 'VOIDED', voidedAt: new Date(), voidedById: currentUserId(), voidReason: reason },
      });
      const row = await tx.restaurantOrder.update({
        where: { id: r.id },
        data: { updatedAt: this.bumped(r) },
        include: orderInclude,
      });
      await this.audit(tx, s, 'restaurant_order', r.id, 'food.payment.voided', {
        paymentId: p.id,
        amountMinor: p.amount.toString(),
        reason,
      });
      return orderView(row);
    });
  }

  /** Касса филиала: остатки по способам, последние операции и сверки (§35.2) */
  async cash() {
    foodMay('desk');
    const s = await foodScope(this.prisma.db);
    const db = this.prisma.db;
    const [balances, operations, payments, checks] = await Promise.all([
      this.balances(db, s),
      db.restaurantCashOperation.findMany({
        where: { locationId: s.locationId },
        include: { employee: { select: { name: true } } },
        orderBy: { occurredAt: 'desc' },
        take: 100,
      }),
      db.restaurantPayment.findMany({
        where: { locationId: s.locationId },
        include: { order: { select: { number: true } } },
        orderBy: { paidAt: 'desc' },
        take: 100,
      }),
      db.restaurantCashReconciliation.findMany({
        where: { locationId: s.locationId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);
    return {
      currency: s.currency,
      balances: Object.entries(balances).map(([method, v]) => ({ method, balanceMinor: v.toString() })),
      operations: operations.map((o) => ({
        id: o.id,
        kind: o.kind,
        method: o.method,
        methodTo: o.methodTo,
        amountMinor: o.amount.toString(),
        note: o.note,
        employee: o.employee?.name ?? null,
        period: o.period ? o.period.toISOString().slice(0, 7) : null,
        status: o.status,
        occurredAt: o.occurredAt,
      })),
      payments: payments.map((p) => ({
        id: p.id,
        orderNumber: p.order.number,
        method: p.method,
        amountMinor: p.amount.toString(),
        status: p.status,
        paidAt: p.paidAt,
      })),
      reconciliations: checks.map((c) => ({
        id: c.id,
        method: c.method,
        expectedMinor: c.expected.toString(),
        countedMinor: c.counted.toString(),
        note: c.note,
        createdAt: c.createdAt,
      })),
    };
  }

  /** Приход, расход или перевод; расход и перевод не уводят способ в минус */
  async cashOperation(raw: unknown) {
    return this.write('desk', async (tx, s) => {
      const b = parsed(() => parseFoodCashOperation(raw));
      if (b.kind !== 'INCOME') await this.spendable(tx, s, b.method, b.amount);
      const row = await tx.restaurantCashOperation.create({
        data: {
          locationId: s.locationId,
          kind: b.kind,
          method: b.method,
          methodTo: b.methodTo,
          amount: b.amount,
          currency: s.currency,
          note: b.note,
          createdById: currentUserId(),
        },
      });
      await this.audit(tx, s, 'restaurant_cash', row.id, 'food.cash.operation', {
        kind: row.kind,
        method: row.method,
        methodTo: row.methodTo,
        amountMinor: row.amount.toString(),
      });
      return { id: row.id };
    });
  }

  async voidCashOperation(idRaw: string) {
    return this.write('refunds', async (tx, s) => {
      const id = parsed(() => foodId(idRaw));
      const op = await tx.restaurantCashOperation.findFirst({ where: { id, locationId: s.locationId } });
      if (!op) throw new NotFoundException('Операция не найдена');
      if (op.status !== 'COMPLETED') throw new ConflictException('Операция уже аннулирована');
      await tx.restaurantCashOperation.update({
        where: { id },
        data: { status: 'VOIDED', voidedAt: new Date(), voidedById: currentUserId() },
      });
      await this.audit(tx, s, 'restaurant_cash', id, 'food.cash.voided', { amountMinor: op.amount.toString() });
      return { id };
    });
  }

  /** Сверка: остаток по системе фиксируется в момент пересчёта */
  async cashReconciliation(raw: unknown) {
    return this.write('desk', async (tx, s) => {
      const b = parsed(() => parseFoodReconciliation(raw));
      const expected = (await this.balances(tx, s))[b.method];
      const row = await tx.restaurantCashReconciliation.create({
        data: {
          locationId: s.locationId,
          method: b.method,
          expected,
          counted: b.counted,
          note: b.note,
          createdById: currentUserId(),
        },
      });
      await this.audit(tx, s, 'restaurant_cash', row.id, 'food.cash.reconciled', {
        method: row.method,
        expectedMinor: row.expected.toString(),
        countedMinor: row.counted.toString(),
      });
      return { id: row.id, expectedMinor: row.expected.toString(), countedMinor: row.counted.toString() };
    });
  }

  /** Выплата зарплаты из кассы: не больше «осталось» за месяц (§35.3) */
  async payout(idRaw: string, raw: unknown) {
    return this.write('staff', async (tx, s) => {
      const id = parsed(() => foodId(idRaw));
      const b = parsed(() => parseFoodPayout(raw));
      const employee = await tx.employee.findFirst({ where: { id, businessId: s.businessId } });
      if (!employee) throw new NotFoundException('Сотрудник не найден');
      const { rows } = await this.monthPayroll(tx, s, b.period.slice(0, 7));
      const mine = rows.find((r) => r.e.id === id)!;
      try {
        payoutCheck(mine.t.total, mine.paid, b.amount);
      } catch (e) {
        throw new ConflictException(e instanceof Error ? e.message : 'Выплата недоступна');
      }
      await this.spendable(tx, s, b.method, b.amount);
      const row = await tx.restaurantCashOperation.create({
        data: {
          locationId: s.locationId,
          kind: 'EXPENSE',
          method: b.method,
          amount: b.amount,
          currency: s.currency,
          note: 'Зарплата',
          employeeId: id,
          period: new Date(`${b.period}T00:00:00Z`),
          createdById: currentUserId(),
        },
      });
      await this.audit(tx, s, 'employee_pay', id, 'food.payout.created', {
        operationId: row.id,
        period: b.period,
        method: row.method,
        amountMinor: row.amount.toString(),
      });
      return { id: row.id, remainingMinor: (mine.t.total - mine.paid - b.amount).toString() };
    });
  }

  // ─── Отчёт ресторана за период (Аналитика) ───

  /** Деньги и продажи за период по поясу филиала: закрытые заказы, оплаты по способам, блюда, официанты */
  async periodReport(query: unknown) {
    foodMay('reports');
    const s = await foodScope(this.prisma.db);
    const q = parsed(() => foodObject(query, ['from', 'to']));
    const from = dayParam(q.from),
      to = dayParam(q.to);
    if (from > to) throw new BadRequestException('Начало периода позже конца');
    if ((Date.parse(to) - Date.parse(from)) / 86_400_000 > 92)
      throw new BadRequestException('Период не длиннее 93 дней');
    const w = timeOffWindow({ dateFrom: from, dateTo: to, timezone: s.timezone });
    const db = this.prisma.db;
    const closedWhere = {
      locationId: s.locationId,
      status: 'CLOSED' as const,
      closedAt: { gte: w.fromUtc, lt: w.toUtcExclusive },
    };
    const [orders, payments, items, waiters] = await Promise.all([
      db.restaurantOrder.aggregate({ where: closedWhere, _count: { _all: true }, _sum: { total: true } }),
      db.restaurantPayment.groupBy({
        by: ['method'],
        where: { locationId: s.locationId, status: 'COMPLETED', paidAt: { gte: w.fromUtc, lt: w.toUtcExclusive } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      db.restaurantOrderItem.findMany({
        where: { order: closedWhere },
        select: { name: true, price: true, qty: true },
      }),
      db.restaurantOrder.groupBy({
        by: ['waiterId'],
        where: { ...closedWhere, waiterId: { not: null } },
        _sum: { total: true },
        _count: { _all: true },
      }),
    ]);
    const count = orders._count._all;
    const revenue = orders._sum.total ?? 0n;
    const dishes = new Map<string, { qty: number; revenue: bigint }>();
    for (const i of items) {
      const d = dishes.get(i.name) ?? { qty: 0, revenue: 0n };
      d.qty += i.qty;
      d.revenue += i.price * BigInt(i.qty);
      dishes.set(i.name, d);
    }
    const names = new Map(
      (
        await db.employee.findMany({
          where: { id: { in: waiters.map((x) => x.waiterId!) } },
          select: { id: true, name: true },
        })
      ).map((e) => [e.id, e.name]),
    );
    return {
      from,
      to,
      currency: s.currency,
      ordersCount: count,
      revenueMinor: revenue.toString(),
      averageCheckMinor: count ? ((revenue + BigInt(count) / 2n) / BigInt(count)).toString() : null,
      payments: payments
        .map((p) => ({ method: p.method, amountMinor: (p._sum.amount ?? 0n).toString(), count: p._count._all }))
        .sort((a, b) => Number(BigInt(b.amountMinor) - BigInt(a.amountMinor))),
      topDishes: [...dishes.entries()]
        .map(([name, d]) => ({ name, qty: d.qty, revenueMinor: d.revenue.toString() }))
        .sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name, 'ru'))
        .slice(0, 10),
      waiters: waiters
        .map((x) => ({
          name: names.get(x.waiterId!) ?? '—',
          orders: x._count._all,
          revenueMinor: (x._sum.total ?? 0n).toString(),
        }))
        .sort((a, b) => Number(BigInt(b.revenueMinor) - BigInt(a.revenueMinor))),
    };
  }

  // ─── Зарплата (§33.4) ───

  /** К выплате за месяц по сотрудникам бизнеса (§33.4) и выплачено из кассы филиала (§35.3) */
  private async monthPayroll(
    db: Pick<DbTx, 'employee' | 'restaurantOrder' | 'employeePayAdjustment' | 'restaurantCashOperation'>,
    s: FoodScope,
    month: unknown,
  ) {
    const m = monthParam(month);
    const w = timeOffWindow({ dateFrom: m.from, dateTo: m.to, timezone: s.timezone });
    const period = new Date(`${m.from}T00:00:00Z`);
    const [employees, orders, adjustments, payouts] = await Promise.all([
      db.employee.findMany({
        where: { businessId: s.businessId },
        include: { paySetting: true },
        orderBy: { id: 'asc' },
      }),
      db.restaurantOrder.groupBy({
        by: ['waiterId'],
        where: {
          locationId: s.locationId,
          status: 'CLOSED',
          waiterId: { not: null },
          closedAt: { gte: w.fromUtc, lt: w.toUtcExclusive },
        },
        _sum: { total: true },
      }),
      db.employeePayAdjustment.findMany({
        where: { employee: { businessId: s.businessId }, period },
        orderBy: { createdAt: 'asc' },
      }),
      db.restaurantCashOperation.groupBy({
        by: ['employeeId'],
        where: { locationId: s.locationId, period, status: 'COMPLETED', employeeId: { not: null } },
        _sum: { amount: true },
      }),
    ]);
    const salesByWaiter = new Map(orders.map((o) => [o.waiterId!, o._sum.total ?? 0n]));
    const paidByEmployee = new Map(payouts.map((p) => [p.employeeId!, p._sum.amount ?? 0n]));
    const rows = employees.map((e) => {
      const setting = e.paySetting
        ? { model: e.paySetting.model, fixedMinor: e.paySetting.fixedMinor, percent: e.paySetting.percent }
        : { model: 'FIXED' as const, fixedMinor: 0n, percent: 0 };
      const sales = salesByWaiter.get(e.id) ?? 0n;
      const adj = adjustments.filter((a) => a.employeeId === e.id).map((a) => a.amountMinor);
      return { e, setting, sales, t: payrollTotals(setting, sales, adj), paid: paidByEmployee.get(e.id) ?? 0n };
    });
    return { m, period, rows, adjustments };
  }

  async payroll(query: unknown) {
    foodMay('staff');
    const s = await foodScope(this.prisma.db);
    const q = parsed(() => foodObject(query, ['month']));
    const { m, rows, adjustments } = await this.monthPayroll(this.prisma.db, s, q.month);
    let fund = 0n,
      bonus = 0n,
      penalty = 0n,
      payout = 0n,
      paidTotal = 0n;
    const out = rows.map(({ e, setting, sales, t, paid }) => {
        fund += t.base + t.percentPart;
        bonus += t.bonus;
        penalty += t.penalty;
        payout += t.total;
        paidTotal += paid;
        return {
          employeeId: e.id,
          name: e.name,
          status: e.status,
          model: setting.model,
          fixedMinor: setting.fixedMinor.toString(),
          percent: setting.percent,
          salesMinor: sales.toString(),
          baseMinor: t.base.toString(),
          percentMinor: t.percentPart.toString(),
          bonusMinor: t.bonus.toString(),
          penaltyMinor: t.penalty.toString(),
          totalMinor: t.total.toString(),
          paidMinor: paid.toString(),
          remainingMinor: (t.total - paid).toString(),
        };
    });
    return {
      month: m.month,
      currency: s.currency,
      totals: {
        fundMinor: fund.toString(),
        bonusMinor: bonus.toString(),
        penaltyMinor: penalty.toString(),
        payoutMinor: payout.toString(),
        paidMinor: paidTotal.toString(),
      },
      rows: out,
      adjustments: adjustments.map((a) => ({
        id: a.id,
        employeeId: a.employeeId,
        amountMinor: a.amountMinor.toString(),
        reason: a.reason,
        createdAt: a.createdAt,
      })),
    };
  }

  async setPaySettings(idRaw: string, raw: unknown) {
    return this.write('staff', async (tx, s) => {
      const id = parsed(() => foodId(idRaw));
      const b = parsed(() => parsePaySettings(raw));
      const employee = await tx.employee.findFirst({ where: { id, businessId: s.businessId } });
      if (!employee) throw new NotFoundException('Сотрудник не найден');
      const old = await tx.employeePaySetting.findUnique({ where: { employeeId: id } });
      const row = await tx.employeePaySetting.upsert({
        where: { employeeId: id },
        create: {
          employeeId: id,
          model: b.model,
          fixedMinor: b.fixedMinor,
          percent: b.percent,
          currency: s.currency,
          updatedById: currentUserId(),
        },
        update: {
          model: b.model,
          fixedMinor: b.fixedMinor,
          percent: b.percent,
          updatedById: currentUserId(),
        },
      });
      await this.audit(
        tx,
        s,
        'employee_pay',
        id,
        'food.pay_settings.saved',
        { model: row.model, fixedMinor: row.fixedMinor.toString(), percent: row.percent },
        old
          ? { model: old.model, fixedMinor: old.fixedMinor.toString(), percent: old.percent }
          : undefined,
      );
      return { ...row, fixedMinor: row.fixedMinor.toString() };
    });
  }

  async addPayAdjustment(idRaw: string, raw: unknown) {
    return this.write('staff', async (tx, s) => {
      const id = parsed(() => foodId(idRaw));
      const b = parsed(() => parsePayAdjustment(raw));
      const employee = await tx.employee.findFirst({ where: { id, businessId: s.businessId } });
      if (!employee) throw new NotFoundException('Сотрудник не найден');
      const row = await tx.employeePayAdjustment.create({
        data: {
          employeeId: id,
          period: new Date(`${b.period}T00:00:00Z`),
          amountMinor: b.amountMinor,
          reason: b.reason,
          createdById: currentUserId(),
        },
      });
      await this.audit(tx, s, 'employee_pay', id, 'food.pay_adjustment.created', {
        period: b.period,
        amountMinor: b.amountMinor.toString(),
        reason: b.reason,
      });
      return { ...row, amountMinor: row.amountMinor.toString() };
    });
  }
}
