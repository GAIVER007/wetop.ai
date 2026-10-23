import { readEmployeeCommon, writeEmployeeCommon, readEmployeeWeekSource, touchEmployeeSourceRevision } from '../employee-portal/employee-common';
import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { parseCreatePersonnelKind, parsePersonnelKindCommand, writePersonnelKind } from '../beauty/personnel-kind';
import {
  foodId,
  foodInt,
  foodObject,
  foodText,
  ingredientCost,
  orderDelayed,
  orderNext,
  itemNext,
  orderStatusFromItems,
  parseItemStatusCommand,
  type ItemStatus,
  type MenuStation,
  orderPayment,
  parseOrderRating,
  parseWorkingHoursWeek,
  resolveWorkingTime,
  weekTemplate,
  hashSessionToken,
  newSessionToken,
  ratingSummary,
  foodCostSummary,
  milliText,
  appointmentPaymentVoidable,
  orderRefund,
  type AppointmentStatus,
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
  techCardTotals,
  timeOffWindow,
  foodLocal,
  type OrderStatus,
  type FoodPaymentMethod,
  type Permission,
  canManageStaff,
  canWrite,
  parsePersonnelKind,
  checkModifierChoice,
  linePrice,
  orderLineKey,
  itemsPaymentAmount,
  type ChosenModifier,
} from '@pms/domain';
import type { DbTx, Prisma } from '@pms/database';
import { actorMay, currentRole, currentUserId, currentVertical } from '../auth/request-context';
import { PrismaService } from '../database/prisma.provider';
import { BRANCH_CASH_VERTICALS, BRANCH_PAYROLL_VERTICALS, foodMay, foodScope, foodTransaction, foodWritable, waiterSelf, type FoodScope, type FoodVertical } from './scope';
import { SITE_ASSET_STORAGE, type SiteAssetStorage } from '../marketing-site/asset-storage';
import { assertWeekRevision, hoursRevision, hoursRowsRevision } from '../beauty/write-contract';
import { StockService } from './stock.service';
import { branchStaffRevenue } from './staff-revenue';
import { monthPayrollRows, type MonthPayrollDb } from './month-payroll';
import { reverseLoyaltyForVoid } from '../beauty/loyalty';

/** Срок ссылки на оценку с телефона гостя (§40) */
const RATING_LINK_TTL_MS = 72 * 3_600_000;
/** §33.7: группы модификаторов блюда с модификаторами, по порядку блюда */
const itemGroupsInclude = {
  modifierGroups: {
    orderBy: { sortOrder: 'asc' as const },
    include: { group: { include: { modifiers: { orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] as Prisma.MenuModifierOrderByWithRelationInput[] } } } },
  },
} as const;
const OPEN_STATUSES: OrderStatus[] = ['NEW', 'COOKING', 'READY', 'SERVED'];
/** Строка заказа из запроса после проверки (§33.6, §33.7) */
interface OrderLineData {
  key: string;
  menuItemId: string;
  name: string;
  price: bigint;
  qty: number;
  notes: string | null;
  sortOrder: number;
  station: MenuStation;
  modifiers: ChosenModifier[];
}
const orderInclude = {
  table: { include: { area: { select: { name: true } } } },
  waiter: { select: { id: true, name: true } },
  // §33.7: снимок модификаторов строки и её действующая оплата по позициям
  items: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      modifiers: { orderBy: { sortOrder: 'asc' as const } },
      paymentItems: { where: { releasedAt: null }, select: { paymentId: true } },
    },
  },
  payments: { orderBy: { paidAt: 'asc' as const }, include: { items: { select: { orderItemId: true } } } },
  // возвраты после закрытия (§56)
  refunds: { orderBy: { occurredAt: 'asc' as const }, select: { id: true, method: true, amount: true, status: true, note: true, occurredAt: true } },
  rating: true,
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
/** Сумма действующих возвратов по закрытому заказу (§56) */
function orderRefunded(r: { refunds: Array<{ status: string; amount: bigint }> }): bigint {
  return r.refunds.reduce((sum, p) => (p.status === 'COMPLETED' ? sum + p.amount : sum), 0n);
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
    refundedMinor: orderRefunded(r).toString(),
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
      // §33.6: станция и статус строки
      station: i.station,
      status: i.status,
      readyAt: i.readyAt,
      // §33.7: выбранные модификаторы (снимок) и оплачена ли строка по позициям
      modifiers: i.modifiers.map((m) => ({
        modifierId: m.modifierId,
        groupName: m.groupName,
        name: m.name,
        priceDeltaMinor: m.priceDelta.toString(),
      })),
      paid: i.paymentItems.length > 0,
    })),
    // §39: оценка гостя после оплаты
    rating: r.rating
      ? { stars: r.rating.stars, comment: r.rating.comment, createdAt: r.rating.createdAt }
      : null,
    payments: r.payments.map((p) => ({
      id: p.id,
      method: p.method,
      amountMinor: p.amount.toString(),
      status: p.status,
      paidAt: p.paidAt,
      voidReason: p.voidReason,
      // §33.7: позиции, оплаченные этим платежом (пусто у оплаты суммой)
      itemIds: p.items.map((x) => x.orderItemId),
    })),
    refunds: r.refunds.map((p) => ({
      id: p.id,
      method: p.method,
      amountMinor: p.amount.toString(),
      status: p.status,
      note: p.note,
      occurredAt: p.occurredAt,
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
  return shiftDay(date, -1);
}
function shiftDay(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
const clockText = (d: Date) => d.toISOString().slice(11, 16);

@Injectable()
export class RestaurantService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SITE_ASSET_STORAGE) private readonly storage: SiteAssetStorage | null,
    @Inject(StockService) private readonly stock: StockService,
  ) {}

  /** Вид блюда с подписанным адресом фото (§37); без хранилища фото нет */
  private async menuItemOut(row: Parameters<RestaurantService['menuItemView']>[0] & { photo?: { storageRef: string } | null }) {
    return {
      ...this.menuItemView(row),
      photoUrl: row.photo && this.storage ? await this.storage.signedGet(row.photo.storageRef, 3600) : null,
    };
  }

  private async write<T>(
    permission: Permission,
    fn: (tx: DbTx, s: FoodScope) => Promise<T>,
    verticals?: readonly FoodVertical[],
  ): Promise<T> {
    foodMay(permission);
    await foodWritable(this.prisma.db);
    const s = await foodScope(this.prisma.db, verticals);
    return foodTransaction(this.prisma, s, fn, verticals);
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
    // меню на чтение нужно и официанту (§33.6)
    foodMay('orders');
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
          station: b.station ?? 'KITCHEN',
        },
      });
      await this.audit(tx, s, 'menu_category', row.id, 'food.menu_category.created', {
        name: row.name,
        station: row.station,
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
          ...(b.station !== undefined ? { station: b.station } : {}),
        },
      });
      await this.audit(
        tx,
        s,
        'menu_category',
        id,
        'food.menu_category.updated',
        { name: row.name, sortOrder: row.sortOrder, active: row.active, station: row.station },
        { name: old.name, sortOrder: old.sortOrder, active: old.active, station: old.station },
      );
      return row;
    });
  }

  private menuItemView(
    row: (Prisma.MenuItemGetPayload<{ include: { ingredients: true, photo: true } }> | Prisma.MenuItemGetPayload<object>) & {
      modifierGroups?: Prisma.MenuItemModifierGroupGetPayload<{ include: typeof itemGroupsInclude.modifierGroups.include }>[];
    },
  ) {
    const ingredients =
      'ingredients' in row
        ? (row as Prisma.MenuItemGetPayload<{ include: { ingredients: true, photo: true } }>).ingredients
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
      // §33.7: группы модификаторов блюда по порядку; для выбора только активные группы и модификаторы
      modifierGroupIds: (row.modifierGroups ?? []).map((l) => l.groupId),
      modifierGroups: (row.modifierGroups ?? [])
        .filter((l) => l.group.active)
        .map((l) => ({
          id: l.group.id,
          name: l.group.name,
          minSelect: l.group.minSelect,
          maxSelect: l.group.maxSelect,
          required: l.group.minSelect >= 1,
          modifiers: l.group.modifiers
            .filter((m) => m.active)
            .map((m) => ({ id: m.id, name: m.name, priceDeltaMinor: m.priceDelta.toString() })),
        })),
      ...(ingredients
        ? {
            ingredients: ingredients.map((i) => ({
              id: i.id,
              productId: i.productId,
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
    foodMay('orders');
    const s = await foodScope(this.prisma.db),
      p = page(query);
    // официанту (без `desk`) техкарта и себестоимость не нужны (§33.6)
    const desk = actorMay('desk');
    const rows = await this.prisma.db.menuItem.findMany({
      where: { ...(p.cursor ? { id: { gt: p.cursor } } : {}), businessId: s.businessId, ...(desk ? {} : { active: true }) },
      include: { ingredients: desk, photo: true, ...itemGroupsInclude },
      orderBy: { id: 'asc' },
      take: p.limit + 1,
    });
    return paged(await Promise.all(rows.map((r) => this.menuItemOut(r))), p.limit);
  }

  async menuItem(idRaw: string) {
    foodMay('desk');
    const s = await foodScope(this.prisma.db),
      id = parsed(() => foodId(idRaw));
    const row = await this.prisma.db.menuItem.findFirst({
      where: { id, businessId: s.businessId },
      include: { ingredients: true, photo: true, ...itemGroupsInclude },
    });
    if (!row) throw new NotFoundException('Блюдо не найдено');
    return this.menuItemOut(row);
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
        include: { ingredients: true, photo: true, ...itemGroupsInclude },
      });
      await this.audit(tx, s, 'menu_item', row.id, 'food.menu_item.created', {
        name: row.name,
        priceMinor: row.price.toString(),
        categoryId: row.categoryId,
      });
      return this.menuItemOut(row);
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
        include: { ingredients: true, photo: true, ...itemGroupsInclude },
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
      return this.menuItemOut(row);
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
        include: { ingredients: true, photo: true, ...itemGroupsInclude },
      });
      if (!old) throw new NotFoundException('Блюдо не найдено');
      // §38: ингредиент склада своего бизнеса и той же единицы, иначе слова, а не ошибка триггера
      const productIds = [...new Set(rows.map((r) => r.productId).filter((p): p is string => !!p))];
      const products = new Map(
        (
          await tx.kitchenProduct.findMany({
            where: { id: { in: productIds }, businessId: s.businessId },
            select: { id: true, unit: true },
          })
        ).map((p) => [p.id, p.unit]),
      );
      for (const r of rows)
        if (r.productId && products.get(r.productId) !== r.unit)
          throw new BadRequestException(
            products.has(r.productId)
              ? `Строка «${r.name}»: единица ингредиента склада другая`
              : `Строка «${r.name}»: ингредиент склада не найден`,
          );
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
            productId: r.productId ?? null,
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
        include: { ingredients: true, photo: true, ...itemGroupsInclude },
      });
      return this.menuItemOut(fresh);
    });
  }

  // ─── Заказы и кухня (§33.2) ───

  async orders(query: unknown) {
    foodMay('orders');
    const s = await foodScope(this.prisma.db),
      p = page(query, ['date', 'open']);
    const me = await waiterSelf(this.prisma.db, s);
    // официант видит только свои заказы (§33.6)
    const where: Prisma.RestaurantOrderWhereInput = { locationId: s.locationId, ...(me ? { waiterId: me.id } : {}) };
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

  /** Столы зала для экрана официанта (§33.6): занят открытым заказом или посаженной бронью; «мой» = мой заказ */
  async waiterTables() {
    foodMay('orders');
    const s = await foodScope(this.prisma.db);
    const userId = currentUserId();
    const me = actorMay('desk')
      ? userId
        ? await this.prisma.db.employee.findFirst({
            where: { userId, businessId: s.businessId, status: 'ACTIVE' },
            select: { id: true, name: true },
          })
        : null
      : await waiterSelf(this.prisma.db, s);
    const [tables, open, seated] = await Promise.all([
      this.prisma.db.diningTable.findMany({
        where: { active: true, area: { locationId: s.locationId, active: true } },
        include: { area: { select: { id: true, name: true, sortOrder: true } } },
        orderBy: [{ area: { sortOrder: 'asc' } }, { sortOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.db.restaurantOrder.findMany({
        where: { locationId: s.locationId, status: { in: OPEN_STATUSES }, tableId: { not: null } },
        select: { tableId: true, waiterId: true },
      }),
      this.prisma.db.tableAssignment.findMany({
        where: { reservation: { locationId: s.locationId, status: 'SEATED' } },
        select: { tableId: true },
      }),
    ]);
    const busy = new Set([...open.map((o) => o.tableId), ...seated.map((a) => a.tableId)]);
    const mine = new Set(open.filter((o) => me && o.waiterId === me.id).map((o) => o.tableId));
    return {
      me: me ?? null,
      tables: tables.map((t) => ({
        id: t.id,
        name: t.name,
        capacity: t.capacity,
        areaId: t.area.id,
        areaName: t.area.name,
        busy: busy.has(t.id),
        mine: mine.has(t.id),
        needsCleaning: t.needsCleaning,
      })),
    };
  }

  /**
   * Строки заказа из запроса (§33.6, §33.7): блюдо своего бизнеса, станция категории, проверка модификаторов по группам
   * блюда, цена строки = цена блюда + прибавки (замораживается). Ключ строки = блюдо + модификаторы + комментарий.
   */
  private async orderItemsData(tx: DbTx, s: FoodScope, items: ReturnType<typeof parseOrderItems>) {
    const ids = [...new Set(items.map((i) => i.menuItemId))];
    const dishes = await tx.menuItem.findMany({
      where: { id: { in: ids }, businessId: s.businessId, active: true },
      include: { category: { select: { station: true } }, ...itemGroupsInclude },
    });
    const byId = new Map(dishes.map((d) => [d.id, d]));
    for (const id of ids) if (!byId.has(id)) throw new NotFoundException('Блюдо недоступно');
    let total = 0n;
    const data = items.map((i, index) => {
      const dish = byId.get(i.menuItemId)!;
      const groups = dish.modifierGroups
        .filter((l) => l.group.active)
        .map((l) => ({ ...l.group, modifiers: l.group.modifiers }));
      let chosen: ChosenModifier[];
      let price: bigint;
      try {
        chosen = checkModifierChoice(groups, i.modifierIds);
        price = linePrice(dish.price, chosen.map((m) => m.priceDelta));
      } catch (e) {
        throw new BadRequestException(`${dish.name}: ${e instanceof Error ? e.message : 'выбор недоступен'}`);
      }
      total += price * BigInt(i.qty);
      return {
        key: orderLineKey(dish.id, chosen.map((m) => m.modifierId), i.notes),
        menuItemId: dish.id,
        name: dish.name,
        price,
        qty: i.qty,
        notes: i.notes,
        sortOrder: index,
        // §33.6: снимок станции категории
        station: dish.category.station as MenuStation,
        modifiers: chosen,
      };
    });
    return { data, total };
  }

  /** Данные строки для Prisma: без ключа, с вложенным снимком модификаторов */
  private lineCreate(d: OrderLineData, qty = d.qty, sortOrder = d.sortOrder) {
    return {
      menuItemId: d.menuItemId,
      name: d.name,
      price: d.price,
      qty,
      notes: d.notes,
      sortOrder,
      station: d.station,
      ...(d.modifiers.length ? { modifiers: { create: d.modifiers } } : {}),
    };
  }

  /**
   * Статус заказа и отметки переходов из строк (§33.6). Вызывается после любой смены строк в той же транзакции;
   * заказ CLOSED и CANCELLED строками не двигается.
   */
  private derived(r: { status: OrderStatus; cookingAt: Date | null; readyAt: Date | null; servedAt: Date | null }, statuses: ItemStatus[]) {
    const status = orderStatusFromItems(statuses);
    const now = new Date();
    return {
      status,
      ...(status !== 'NEW' && !r.cookingAt ? { cookingAt: now } : {}),
      ...((status === 'READY' || status === 'SERVED') && !r.readyAt ? { readyAt: now } : {}),
      ...(status === 'SERVED' && !r.servedAt ? { servedAt: now } : {}),
    };
  }

  /** «Готово» строк (§33.6, §38): склад списывается по техкарте только этих строк, у каждой ровно один раз */
  private async readyItems(
    tx: DbTx,
    s: FoodScope,
    r: { id: string; number: number },
    items: Array<{ id: string; menuItemId: string | null; qty: number }>,
  ) {
    if (!items.length) return;
    await this.stock.consumeForOrder(tx, s, { id: r.id, number: r.number, items });
    await tx.restaurantOrderItem.updateMany({
      where: { id: { in: items.map((i) => i.id) }, orderId: r.id, status: { in: ['NEW', 'COOKING'] } },
      data: { status: 'READY', readyAt: new Date() },
    });
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
    return this.write('orders', async (tx, s) => {
      const b = parsed(() => parseOrderCreate(raw));
      // официант принимает заказ только на себя (§33.6)
      const me = await waiterSelf(tx, s);
      if (me) b.waiterId = me.id;
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
          items: { create: data.map((d) => this.lineCreate(d)) },
        },
        include: orderInclude,
      });
      await this.audit(tx, s, 'restaurant_order', row.id, 'food.order.created', {
        number: row.number,
        tableId: row.tableId,
        waiterId: row.waiterId,
        guestCount: row.guestCount,
        totalMinor: row.total.toString(),
        items: data.map((i) => ({ name: i.name, qty: i.qty, modifiers: i.modifiers.map((m) => m.name) })),
      });
      return orderView(row);
    });
  }

  private async lockedOrder(tx: DbTx, s: FoodScope, idRaw: string, b: Record<string, unknown>, waiterId?: string) {
    const id = parsed(() => foodId(idRaw));
    const expected = parsed(() => {
      if (typeof b.expectedStatus !== 'string') throw new Error('Нужен ожидаемый статус');
      if (typeof b.expectedUpdatedAt !== 'string') throw new Error('Нужна отметка изменения');
      return { status: b.expectedStatus, at: b.expectedUpdatedAt };
    });
    await tx.$queryRaw`SELECT id FROM restaurant_orders WHERE id=${id}::uuid AND location_id=${s.locationId}::uuid FOR UPDATE`;
    const r = await tx.restaurantOrder.findFirst({
      where: { id, locationId: s.locationId, ...(waiterId ? { waiterId } : {}) },
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
    return this.write('orders', async (tx, s) => {
      const me = await waiterSelf(tx, s);
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
      const r = await this.lockedOrder(tx, s, idRaw, b, me?.id);
      if (r.status === 'CLOSED' || r.status === 'CANCELLED')
        throw new ConflictException('Завершённый заказ изменять нельзя');
      if (me && b.waiterId !== undefined) b.waiterId = me.id;

      const tableId = b.tableId === undefined ? r.tableId : b.tableId === null ? null : parsed(() => foodId(b.tableId));
      const waiterId = b.waiterId === undefined ? r.waiterId : b.waiterId === null ? null : parsed(() => foodId(b.waiterId));
      await this.checkTableAndWaiter(
        tx,
        s,
        tableId === r.tableId ? null : tableId,
        waiterId === r.waiterId ? null : waiterId,
      );
      let total = r.total;
      let derived: ReturnType<RestaurantService['derived']> | Record<string, never> = {};
      if (b.items !== undefined) {
        const items = parsed(() => parseOrderItems(b.items));
        const next = await this.orderItemsData(tx, s, items);
        total = await this.replaceItems(tx, r, next.data);
        if (total < orderPaid(r))
          throw new ConflictException('Состав нельзя уменьшить ниже оплаченной суммы');
        const fresh = await tx.restaurantOrderItem.findMany({ where: { orderId: r.id }, select: { status: true } });
        derived = this.derived(r, fresh.map((i) => i.status));
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
          ...derived,
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

  /**
   * Новый состав заказа (§33.6): готовые и поданные строки остаются как есть (приготовлены, склад списан), строки в
   * работе остаются, пока их количество покрыто новым составом; остальное количество уходит новыми строками на свою
   * станцию. Возвращает сумму заказа.
   */
  private async replaceItems(tx: DbTx, r: OrderRow, data: OrderLineData[]): Promise<bigint> {
    // §33.7: строка узнаётся по блюду, выбранным модификаторам и комментарию
    const keyOf = (i: OrderRow['items'][number]) =>
      i.menuItemId ? orderLineKey(i.menuItemId, i.modifiers.map((m) => m.modifierId ?? m.name), i.notes) : null;
    const want = new Map<string, number>();
    for (const d of data) want.set(d.key, (want.get(d.key) ?? 0) + d.qty);
    const keep: OrderRow['items'] = [];
    // оплаченные по позициям строки остаются как есть (§33.7), готовые и поданные тоже (§33.6)
    const frozen = r.items.filter((i) => i.paymentItems.length > 0 || i.status === 'READY' || i.status === 'SERVED');
    for (const i of frozen) {
      const key = keyOf(i);
      const left = key ? (want.get(key) ?? 0) : 0;
      if (key && left < i.qty)
        throw new ConflictException(i.paymentItems.length > 0 ? 'Оплаченные позиции убрать нельзя' : 'Готовые позиции убрать нельзя');
      if (key) want.set(key, left - i.qty);
      keep.push(i);
    }
    for (const i of r.items.filter((x) => x.status === 'COOKING' && !keep.includes(x))) {
      const key = keyOf(i);
      const left = key ? (want.get(key) ?? 0) : 0;
      if (key && left >= i.qty) {
        want.set(key, left - i.qty);
        keep.push(i);
      }
    }
    const kept = new Set(keep.map((i) => i.id));
    await tx.restaurantOrderItem.deleteMany({ where: { orderId: r.id, id: { notIn: [...kept] } } });
    let sortOrder = keep.reduce((m, i) => Math.max(m, i.sortOrder), -1) + 1;
    let total = keep.reduce((sum, i) => sum + i.price * BigInt(i.qty), 0n);
    for (const d of data) {
      const qty = Math.min(d.qty, want.get(d.key) ?? 0);
      if (qty <= 0) continue;
      want.set(d.key, (want.get(d.key) ?? 0) - qty);
      await tx.restaurantOrderItem.create({ data: { ...this.lineCreate(d, qty, sortOrder++), orderId: r.id } });
      total += d.price * BigInt(qty);
    }
    return total;
  }

  /** Кухня и бар двигают свою строку (§33.6); статус заказа выводится из строк, «Готово» списывает склад строки */
  async orderItemStatus(idRaw: string, itemIdRaw: string, raw: unknown) {
    return this.write('orders', async (tx, s) => {
      const id = parsed(() => foodId(idRaw)),
        itemId = parsed(() => foodId(itemIdRaw)),
        b = parsed(() => parseItemStatusCommand(raw));
      // официант только подаёт свои позиции; «Принять» и «Готово» у кухни и бара (стойка, §33.6)
      const me = await waiterSelf(tx, s);
      if (me && b.status !== 'SERVED') throw new ForbiddenException('Готовность отмечают кухня и бар');
      await tx.$queryRaw`SELECT id FROM restaurant_orders WHERE id=${id}::uuid AND location_id=${s.locationId}::uuid FOR UPDATE`;
      const r = await tx.restaurantOrder.findFirst({
        where: { id, locationId: s.locationId, ...(me ? { waiterId: me.id } : {}) },
        include: orderInclude,
      });
      if (!r) throw new NotFoundException('Заказ не найден');
      if (r.updatedAt.toISOString() !== b.expectedUpdatedAt)
        throw new ConflictException('Заказ уже изменён, обновите данные');
      if (r.status === 'CLOSED' || r.status === 'CANCELLED')
        throw new ConflictException('Завершённый заказ изменять нельзя');
      const line = r.items.find((i) => i.id === itemId);
      if (!line) throw new NotFoundException('Позиция не найдена');
      if (!itemNext(line.status).includes(b.status))
        throw new ConflictException('Переход позиции недоступен');
      if (b.status === 'READY') await this.readyItems(tx, s, r, [line]);
      else
        await tx.restaurantOrderItem.update({ where: { id: line.id }, data: { status: b.status } });
      const statuses = r.items.map((i) => (i.id === line.id ? b.status : i.status));
      const row = await tx.restaurantOrder.update({
        where: { id: r.id },
        data: { ...this.derived(r, statuses), updatedAt: this.bumped(r) },
        include: orderInclude,
      });
      await this.audit(
        tx,
        s,
        'restaurant_order',
        r.id,
        'food.order.item_status',
        { itemId: line.id, station: line.station, status: b.status, orderStatus: row.status },
        { status: line.status, orderStatus: r.status },
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
      // §38, §33.6: «Готово» целиком готовит и списывает только ещё не готовые строки; отмена возвращает списанное
      if (status === 'READY')
        await this.readyItems(tx, s, r, r.items.filter((i) => i.status === 'NEW' || i.status === 'COOKING'));
      if (status === 'COOKING')
        await tx.restaurantOrderItem.updateMany({ where: { orderId: r.id, status: 'NEW' }, data: { status: 'COOKING' } });
      if (status === 'SERVED')
        await tx.restaurantOrderItem.updateMany({ where: { orderId: r.id, status: { not: 'SERVED' } }, data: { status: 'SERVED' } });
      if (status === 'CANCELLED') await this.stock.returnForOrder(tx, s, r);
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
    const [todayOrders, yesterdayOrders, closedToday, closedYesterday, openOrders, tables, seated, hours] = await Promise.all([
      db.restaurantOrder.findMany({
        where: { locationId: s.locationId, openedAt: { gte: w.fromUtc, lt: w.toUtcExclusive } },
        include: orderInclude,
        orderBy: [{ openedAt: 'desc' }, { id: 'asc' }],
      }),
      db.restaurantOrder.findMany({
        where: { locationId: s.locationId, openedAt: { gte: wy.fromUtc, lt: wy.toUtcExclusive } },
        select: { status: true },
      }),
      // канон выручки (ADR-181): закрытые заказы по дате закрытия, как в period-report
      db.restaurantOrder.findMany({
        where: { locationId: s.locationId, status: 'CLOSED', closedAt: { gte: w.fromUtc, lt: w.toUtcExclusive } },
        select: { total: true, closedAt: true },
      }),
      db.restaurantOrder.findMany({
        where: { locationId: s.locationId, status: 'CLOSED', closedAt: { gte: wy.fromUtc, lt: wy.toUtcExclusive } },
        select: { total: true },
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
    const rows = await this.prisma.db.employee.findMany({
      where: { ...(p.cursor ? { id: { gt: p.cursor } } : {}), businessId: s.businessId },
      include: {
        workingHours: { where: { locationId: s.locationId } },
        timeOffs: true,
        locations: { select: { locationId: true } },
        restaurantOrders: {
          where: {
            locationId: s.locationId,
            status: { not: 'CANCELLED' },
            openedAt: { gte: w.fromUtc, lt: w.toUtcExclusive },
          },
          select: { total: true },
        },
        guestRatings: { select: { stars: true } },
      },
      orderBy: { id: 'asc' },
      take: p.limit + 1,
    });
    const profiles = new Map((await readEmployeeCommon(this.prisma.db, s.businessId)).map(row => [row.id, row]));
    // назначение «специалист / другой сотрудник / оба» (решение владельца 20.10.2026): право считает сервер
    const role = currentRole();
    const org = role && canManageStaff(role) && actorMay('staff')
      ? await this.prisma.db.organization.findUnique({ where: { id: s.organizationId }, select: { status: true, trialEndsAt: true } })
      : null;
    const canAssignPersonnelKind = Boolean(org && canWrite(org.status, org.trialEndsAt, new Date()));
    const result = paged(
      rows.map((r) => {
        const todayHours = r.workingHours.filter(h => h.weekday === new Date(`${local.date}T12:00:00Z`).getUTCDay()).sort((a,b) => a.timeFrom.getTime()-b.timeFrom.getTime());
        const fit = resolveWorkingTime({ startsAt: new Date(), timezone: s.timezone, supported: true, employeeActive: r.status === 'ACTIVE', worksHere: r.locations.some(l => l.locationId === s.locationId), workingHours: r.workingHours.map(h => ({ weekday: h.weekday, timeFrom: clockText(h.timeFrom), timeTo: clockText(h.timeTo) })), timeOffs: r.timeOffs.map(t => ({ dateFrom: t.dateFrom.toISOString().slice(0,10), dateTo: t.dateTo.toISOString().slice(0,10) })) });
        return {
          ...profiles.get(r.id)!,
          personnelKind: r.personnelKind === null ? null : parsePersonnelKind(r.personnelKind),
          shift: todayHours.map(h => `${clockText(h.timeFrom)}–${clockText(h.timeTo)}`).join(', ') || null,
          onShift: fit.ok,
          workingTimeStatus: fit.ok ? 'WORKING' : fit.reason,
          salesTodayMinor: r.restaurantOrders.reduce((acc, o) => acc + o.total, 0n).toString(),
          // §39: рейтинг по оценкам гостей за всё время
          rating: ratingSummary(r.guestRatings.map((g) => g.stars)),
        };
      }),
      p.limit,
    );
    return { ...result, canAssignPersonnelKind };
  }

  /** Назначение сотрудника ресторана: те же правила и версия профиля, что у салона (beauty/personnel-kind.ts) */
  async assignPersonnelKind(idRaw: string, raw: unknown) {
    const input = parsePersonnelKindCommand(raw);
    return this.write('staff', async (tx, s) => {
      const role = currentRole();
      if (!role || !canManageStaff(role)) throw new ForbiddenException('Назначение меняет только руководитель');
      const id = parsed(() => foodId(idRaw));
      const { before, after } = await writePersonnelKind(tx, s, id, input);
      await this.audit(tx, s, 'employee', id, 'food.employee.personnel_kind',
        { personnelKind: after.personnelKind }, { personnelKind: before.personnelKind });
      return { id, personnelKind: after.personnelKind, profileRevision: after.profileRevision };
    });
  }

  // ─── График смен (Q-REST-11): недельный шаблон в `working_hours`, как у мастеров салона (§19.1) ───

  /** Неделя каждого действующего сотрудника этого филиала */
  /** График смен; гостиница зовёт тот же расчёт со своим направлением (hotel-staff, 22.10.2026) */
  async shifts(verticals: readonly FoodVertical[] = ['FOOD_SERVICE']) {
    foodMay('desk');
    const s = await foodScope(this.prisma.db, verticals);
    const rows = await this.prisma.db.employee.findMany({
      where: { businessId: s.businessId, status: 'ACTIVE', locations: { some: { locationId: s.locationId } } },
      include: {
        workingHours: {
          where: { locationId: s.locationId },
          orderBy: [{ weekday: 'asc' }, { timeFrom: 'asc' }],
          select: { id: true, weekday: true, timeFrom: true, timeTo: true },
        },
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    const snapshots = new Map(await Promise.all(rows.map(async r => [r.id, await readEmployeeWeekSource(this.prisma.db, r.id, s.locationId)] as const)));
    return {
      employees: rows.map((r) => ({
        id: r.id,
        name: r.name,
        weekRevision: hoursRowsRevision(snapshots.get(r.id)!.rows, snapshots.get(r.id)!.sourceRevision),
        week: weekTemplate(
          snapshots.get(r.id)!.rows.map((h) => ({ weekday: h.weekday, timeFrom: clockText(h.timeFrom), timeTo: clockText(h.timeTo) })),
        ),
      })),
    };
  }

  /** Неделя целиком: список заменяет прежний график сотрудника в этом филиале */
  async setShifts(idRaw: string, raw: unknown, verticals?: readonly FoodVertical[]) {
    return this.write('staff', async (tx, s) => {
      const id = parsed(() => foodId(idRaw));
      const week = parseWorkingHoursWeek(raw);
      if (!week.ok) throw new BadRequestException(week.reason);
      const employee = await tx.employee.findFirst({
        where: { id, businessId: s.businessId, locations: { some: { locationId: s.locationId } } },
        select: { id: true },
      });
      if (!employee) throw new NotFoundException('Сотрудник не найден');
      await tx.$queryRaw`SELECT id FROM employees WHERE id=${id}::uuid FOR UPDATE`;
      assertWeekRevision(raw, await hoursRevision(tx, id, s.locationId));
      await tx.workingHours.deleteMany({ where: { employeeId: id, locationId: s.locationId } });
      if (week.value.length)
        await tx.workingHours.createMany({
          data: week.value.map((i) => ({
            employeeId: id,
            locationId: s.locationId,
            weekday: i.weekday,
            timeFrom: new Date(`1970-01-01T${i.timeFrom}:00Z`),
            timeTo: new Date(`1970-01-01T${i.timeTo}:00Z`),
          })),
        });
      await this.audit(tx, s, 'employee', id, 'food.employee.working_hours.set', {
        intervals: week.value.map((i) => `${i.weekday} ${i.timeFrom}-${i.timeTo}`),
      });
      await touchEmployeeSourceRevision(tx, id);
      return { week: weekTemplate(week.value), weekRevision: await hoursRevision(tx, id, s.locationId) };
    }, verticals);
  }

  /** Новый сотрудник филиала; гостиница зовёт со своим направлением (hotel-staff, 22.10.2026) */
  async createEmployee(raw: unknown, verticals?: readonly FoodVertical[]) {
    return this.write('staff', async (tx, s) => {
      const b = parsed(() => foodObject(raw, ['name', 'phone', 'email', 'personnelKind']));
      const personnelKind = parseCreatePersonnelKind(b);
      const row = await tx.employee.create({
        data: {
          businessId: s.businessId,
          personnelKind,
          name: parsed(() => foodText(b.name, 200)),
          phone: b.phone == null ? null : parsed(() => foodText(b.phone, 32)),
          email: b.email == null ? null : parsed(() => foodText(b.email, 320)),
        },
      });
      await tx.employeeLocation.create({ data: { employeeId: row.id, locationId: s.locationId } });
      await this.audit(tx, s, 'employee', row.id, 'food.employee.created', { name: row.name });
      return row;
    }, verticals);
  }

  async updateEmployee(idRaw: string, raw: unknown) {
    return this.write('staff', async (tx, s) => {
      const id = parsed(() => foodId(idRaw));
      const b = parsed(() => foodObject(raw, ['name', 'phone', 'email', 'status', 'expectedProfileRevision']));
      if (b.status !== undefined && b.status !== 'ACTIVE' && b.status !== 'ARCHIVED')
        throw new BadRequestException('Статус: ACTIVE или ARCHIVED');
      const { before: old, after: row } = await writeEmployeeCommon(tx, s.businessId, id, b.expectedProfileRevision, {
          ...(b.name !== undefined ? { name: parsed(() => foodText(b.name, 200)) } : {}),
          ...(b.phone !== undefined
            ? { phone: b.phone === null ? null : parsed(() => foodText(b.phone, 32)) }
            : {}),
          ...(b.email !== undefined
            ? { email: b.email === null ? null : parsed(() => foodText(b.email, 320)) }
            : {}),
          ...(b.status !== undefined ? { status: b.status as 'ACTIVE' | 'ARCHIVED' } : {}),
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

  /** Оценка гостя после оплаты (§39): одна на закрытый заказ, официант из заказа, без правки */
  async rateOrder(idRaw: string, raw: unknown) {
    return this.write('desk', async (tx, s) => {
      const id = parsed(() => foodId(idRaw));
      const b = parsed(() => parseOrderRating(raw));
      await tx.$queryRaw`SELECT id FROM restaurant_orders WHERE id=${id}::uuid AND location_id=${s.locationId}::uuid FOR UPDATE`;
      const r = await tx.restaurantOrder.findFirst({ where: { id, locationId: s.locationId }, include: orderInclude });
      if (!r) throw new NotFoundException('Заказ не найден');
      if (r.status !== 'CLOSED') throw new ConflictException('Оценку гость ставит после оплаты заказа');
      if (r.rating) throw new ConflictException('Заказ уже оценён');
      await tx.restaurantOrderRating.create({
        data: { orderId: r.id, waiterId: r.waiterId, stars: b.stars, comment: b.comment, createdById: currentUserId() },
      });
      await this.audit(tx, s, 'restaurant_order', r.id, 'food.order.rated', {
        stars: b.stars,
        waiterId: r.waiterId,
        withComment: b.comment !== null,
      });
      const row = await tx.restaurantOrder.findUniqueOrThrow({ where: { id: r.id }, include: orderInclude });
      return orderView(row);
    });
  }

  /**
   * Ссылка на оценку с телефона гостя (§40, ADR-170): ключ 256 бит уходит только в ответ и QR-код, в базе его SHA-256;
   * живёт 72 часа, повторная выдача заменяет прежнюю
   */
  async ratingLink(idRaw: string) {
    return this.write('desk', async (tx, s) => {
      const id = parsed(() => foodId(idRaw));
      await tx.$queryRaw`SELECT id FROM restaurant_orders WHERE id=${id}::uuid AND location_id=${s.locationId}::uuid FOR UPDATE`;
      const r = await tx.restaurantOrder.findFirst({ where: { id, locationId: s.locationId }, include: { rating: true } });
      if (!r) throw new NotFoundException('Заказ не найден');
      if (r.status !== 'CLOSED') throw new ConflictException('Оценку гость ставит после оплаты заказа');
      if (r.rating) throw new ConflictException('Заказ уже оценён');
      const token = newSessionToken();
      const expiresAt = new Date(Date.now() + RATING_LINK_TTL_MS);
      await tx.restaurantOrder.update({
        where: { id: r.id },
        data: { ratingTokenHash: hashSessionToken(token), ratingTokenExpiresAt: expiresAt },
      });
      await this.audit(tx, s, 'restaurant_order', r.id, 'food.order.rating_link', { expiresAt: expiresAt.toISOString() });
      return { token, expiresAt: expiresAt.toISOString() };
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
          // §33.7: оплата по позициям: сумма равна отмеченным неоплаченным строкам этого заказа
          if (b.itemIds) {
            const due = itemsPaymentAmount(
              r.items.map((i) => ({ id: i.id, price: i.price, qty: i.qty, paid: i.paymentItems.length > 0 })),
              b.itemIds,
            );
            if (due !== b.amount) throw new Error('Сумма не совпадает с отмеченными позициями');
          }
          return orderPayment(r.status, r.total, orderPaid(r), b.amount);
        } catch (e) {
          throw new ConflictException(e instanceof Error ? e.message : 'Оплата недоступна');
        }
      })();
      const lines = new Map(r.items.map((i) => [i.id, i]));
      const payment = await tx.restaurantPayment.create({
        data: {
          locationId: s.locationId,
          orderId: r.id,
          method: b.method,
          amount: b.amount,
          currency: r.currency,
          idempotencyKey: b.idempotencyKey,
          createdById: currentUserId(),
          ...(b.itemIds
            ? {
                items: {
                  create: b.itemIds.map((orderItemId) => ({
                    orderItemId,
                    amount: lines.get(orderItemId)!.price * BigInt(lines.get(orderItemId)!.qty),
                  })),
                },
              }
            : {}),
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
        ...(b.itemIds ? { itemIds: b.itemIds } : {}),
      });
      return orderView(row);
    });
  }

  /** Возврат по закрытому заказу расходом кассы филиала (§56): причина, не больше чистой оплаты и остатка способа */
  async refundOrder(idRaw: string, raw: unknown) {
    return this.write('refunds', async (tx, s) => {
      const id = parsed(() => foodId(idRaw));
      const { reason: rawReason, ...rest } = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
      const b = parsed(() => parseFoodPayment(rest));
      const reason = parsed(() => foodText(rawReason, 300));
      const repeat = await tx.restaurantCashOperation.findFirst({ where: { locationId: s.locationId, idempotencyKey: b.idempotencyKey } });
      if (repeat) {
        if (repeat.orderId !== id) throw new ConflictException('Ключ повтора уже использован');
        return orderView(await tx.restaurantOrder.findUniqueOrThrow({ where: { id }, include: orderInclude }));
      }
      await tx.$queryRaw`SELECT id FROM restaurant_orders WHERE id=${id}::uuid AND location_id=${s.locationId}::uuid FOR UPDATE`;
      const r = await tx.restaurantOrder.findFirst({ where: { id, locationId: s.locationId }, include: orderInclude });
      if (!r) throw new NotFoundException('Заказ не найден');
      try {
        orderRefund(r.status, orderPaid(r) - orderRefunded(r), b.amount);
      } catch (e) {
        throw new ConflictException(e instanceof Error ? e.message : 'Возврат недоступен');
      }
      await this.spendable(tx, s, b.method, b.amount);
      const op = await tx.restaurantCashOperation.create({
        data: {
          locationId: s.locationId,
          kind: 'EXPENSE',
          method: b.method,
          amount: b.amount,
          currency: r.currency,
          note: `Возврат по заказу №${r.number}. Причина: ${reason}`.slice(0, 500),
          orderId: r.id,
          idempotencyKey: b.idempotencyKey,
          createdById: currentUserId(),
        },
      });
      const row = await tx.restaurantOrder.update({ where: { id: r.id }, data: { updatedAt: this.bumped(r) }, include: orderInclude });
      await this.audit(tx, s, 'restaurant_order', r.id, 'food.order.refunded', {
        cashOperationId: op.id,
        method: op.method,
        amountMinor: op.amount.toString(),
        reason,
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
  async cash(query: unknown = {}) {
    foodMay('desk');
    const s = await foodScope(this.prisma.db, BRANCH_CASH_VERTICALS);
    const db = this.prisma.db;
    // период считает сервер (ADR-181): фильтр последних 100 строк в браузере занижал итоги
    const q = parsed(() => foodObject(query, ['from', 'to']));
    if ((q.from === undefined) !== (q.to === undefined))
      throw new BadRequestException('Нужны обе даты периода');
    let period: { gte: Date; lt: Date } | null = null;
    if (q.from !== undefined) {
      const from = dayParam(q.from),
        to = dayParam(q.to);
      if (from > to) throw new BadRequestException('Начало периода позже конца');
      if ((Date.parse(to) - Date.parse(from)) / 86_400_000 > 92)
        throw new BadRequestException('Период не длиннее 93 дней');
      const w = timeOffWindow({ dateFrom: from, dateTo: to, timezone: s.timezone });
      period = { gte: w.fromUtc, lt: w.toUtcExclusive };
    }
    const [balances, operations, payments, checks] = await Promise.all([
      this.balances(db, s),
      db.restaurantCashOperation.findMany({
        where: { locationId: s.locationId, ...(period ? { occurredAt: period } : {}) },
        include: {
          employee: { select: { name: true } },
          // H1 (паритет с zapis.kz): операция оплаты или возврата записи ссылается на неё
          appointment: { select: { startsAt: true } },
        },
        orderBy: { occurredAt: 'desc' },
        ...(period ? {} : { take: 100 }),
      }),
      db.restaurantPayment.findMany({
        where: { locationId: s.locationId, ...(period ? { paidAt: period } : {}) },
        include: { order: { select: { number: true } } },
        orderBy: { paidAt: 'desc' },
        ...(period ? {} : { take: 100 }),
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
        // возврат гостю (§54, §56): расход со ссылкой на запись или заказ, в «Финансах» своей строкой (как ADR-176)
        refund: o.kind === 'EXPENSE' && (o.orderId !== null || o.appointmentId !== null),
        status: o.status,
        occurredAt: o.occurredAt,
        appointmentId: o.appointmentId,
        appointmentStartsAt: o.appointment?.startsAt.toISOString() ?? null,
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
      const request = parsed(() => foodObject(raw, ['kind', 'method', 'methodTo', 'amount', 'note', 'idempotencyKey']));
      const b = parsed(() => parseFoodCashOperation({kind:request.kind,method:request.method,methodTo:request.methodTo,amount:request.amount,note:request.note}));
      const enabled = process.env.EXPENSE_LINKS_ENABLED === '1';
      const key = request.idempotencyKey;
      if (enabled && (typeof key !== 'string' || !/^[\x21-\x7e]{1,200}$/.test(key))) throw new BadRequestException('Нужен ключ намерения оплаты');
      const hash = createHash('sha256').update(JSON.stringify(['BRANCH_CASH',s.organizationId,s.businessId,s.locationId,b.kind,b.method,b.methodTo,b.amount.toString(),s.currency,b.note])).digest('hex');
      // foodTransaction holds the location lock before checking the shared intent namespace.
      if (enabled) {
        const old = await tx.$queryRaw<Array<{action:string;normalized_payload_hash:string;result_id:string}>>`SELECT action,normalized_payload_hash,result_id FROM payment_write_intents WHERE location_id=${s.locationId}::uuid AND intent_key=${key as string}`;
        if (old[0]) {
          if (old[0].action !== 'BRANCH_CASH' || old[0].normalized_payload_hash !== hash) throw new ConflictException('Payment intent payload conflict');
          return {id:old[0].result_id};
        }
      }
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
      if (enabled) await tx.$executeRaw`INSERT INTO payment_write_intents(id,location_id,intent_key,action,normalized_payload_hash,result_id,created_by_id) VALUES(${randomUUID()}::uuid,${s.locationId}::uuid,${key as string},'BRANCH_CASH',${hash},${row.id}::uuid,${currentUserId()}::uuid)`;
      await this.audit(tx, s, 'restaurant_cash', row.id, 'food.cash.operation', {
        kind: row.kind,
        method: row.method,
        methodTo: row.methodTo,
        amountMinor: row.amount.toString(),
      });
      return { id: row.id };
    }, BRANCH_CASH_VERTICALS);
  }

  async voidCashOperation(idRaw: string) {
    return this.write('refunds', async (tx, s) => {
      const id = parsed(() => foodId(idRaw));
      const op = await tx.restaurantCashOperation.findFirst({ where: { id, locationId: s.locationId } });
      if (!op) throw new NotFoundException('Операция не найдена');
      if (op.appointmentId && op.kind === 'INCOME') {
        // оплата записи салона (§49): после «Выполнено» не аннулируется, для этого возврат (§54); ошибочный возврат аннулировать можно
        await tx.$queryRaw`SELECT id FROM appointments WHERE id = ${op.appointmentId}::uuid FOR UPDATE`;
        const a = await tx.appointment.findUniqueOrThrow({ where: { id: op.appointmentId }, select: { status: true } });
        const refused = appointmentPaymentVoidable(a.status as AppointmentStatus);
        if (refused) throw new ConflictException(refused);
      }
      if (op.status !== 'COMPLETED') throw new ConflictException('Операция уже аннулирована');
      await tx.restaurantCashOperation.update({
        where: { id },
        data: { status: 'VOIDED', voidedAt: new Date(), voidedById: currentUserId() },
      });
      // салон: бонусы и сертификат по этой операции возвращаются в той же транзакции (решение 21.10.2026)
      await reverseLoyaltyForVoid(tx, op);
      await this.audit(tx, s, 'restaurant_cash', id, 'food.cash.voided', { amountMinor: op.amount.toString() });
      return { id };
    }, BRANCH_CASH_VERTICALS);
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
    }, BRANCH_CASH_VERTICALS);
  }

  /** Выплата зарплаты из кассы: не больше «осталось» за месяц (§35.3) */
  async payout(idRaw: string, raw: unknown) {
    // гостиница: начисления без выплаты из кассы филиала (касса объекта §21 другая; решение 22.10.2026)
    if (currentVertical() === 'HOSPITALITY') {
      foodMay('staff');
      throw new ConflictException('Выплата из кассы у гостиницы пока не подключена: начисления видны, выплату проведите в кассе объекта');
    }
    return this.write('staff', async (tx, s) => {
      const id = parsed(() => foodId(idRaw));
      const request = parsed(() => foodObject(raw, ['period', 'method', 'amount', 'idempotencyKey']));
      const b = parsed(() => parseFoodPayout({period:request.period,method:request.method,amount:request.amount}));
      const enabled = process.env.EXPENSE_LINKS_ENABLED === '1';
      const key = request.idempotencyKey;
      if (enabled && (typeof key !== 'string' || !/^[\x21-\x7e]{1,200}$/.test(key))) throw new BadRequestException('Нужен ключ намерения оплаты');
      const hash = createHash('sha256').update(JSON.stringify(['PAYROLL_PAYMENT',id,b.period,b.method,b.amount.toString(),s.currency])).digest('hex');
      // Shared location serialization is acquired by write()/foodTransaction before any effect.
      if (enabled) {
        const old = await tx.$queryRaw<Array<{action:string;normalized_payload_hash:string;result_id:string}>>`SELECT action,normalized_payload_hash,result_id FROM payment_write_intents WHERE location_id=${s.locationId}::uuid AND intent_key=${key as string}`;
        if (old[0]) {
          if (old[0].action !== 'PAYROLL_PAYMENT' || old[0].normalized_payload_hash !== hash) throw new ConflictException('Payment intent payload conflict');
          const audit = await tx.auditLog.findFirst({where:{entityId:id,action:'food.payout.created',after:{path:['operationId'],equals:old[0].result_id}}});
          const saved = audit?.after as {remainingMinor?:string} | null;
          if (typeof saved?.remainingMinor !== 'string') throw new ConflictException('Payment intent result unavailable');
          return {id:old[0].result_id,remainingMinor:saved.remainingMinor};
        }
      }
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
      const remainingMinor = (mine.t.total - mine.paid - b.amount).toString();
      if (enabled) {
        // Explicit structural payroll category, never inferred from the free-text note.
        const category = await tx.$queryRaw<Array<{id:string}>>`INSERT INTO expense_categories(id,location_id,code,name) VALUES(${randomUUID()}::uuid,${s.locationId}::uuid,'PAYROLL','Оплата труда') ON CONFLICT(location_id,code) DO UPDATE SET code=EXCLUDED.code RETURNING id`;
        const documentId = randomUUID();
        await tx.$executeRaw`INSERT INTO expense_documents(id,location_id,category_id,title,document_date,amount_minor,currency,state,created_by_id) VALUES(${documentId}::uuid,${s.locationId}::uuid,${category[0]!.id}::uuid,'Оплата труда',${b.period}::date,${b.amount}::bigint,${s.currency},'ACTIVE',${currentUserId()}::uuid)`;
        // Link the existing canonical payout, not a second financial expense.
        await tx.$executeRaw`INSERT INTO expense_settlements(id,location_id,expense_document_id,restaurant_cash_operation_id,created_by_id) VALUES(${randomUUID()}::uuid,${s.locationId}::uuid,${documentId}::uuid,${row.id}::uuid,${currentUserId()}::uuid)`;
        await tx.$executeRaw`INSERT INTO payment_write_intents(id,location_id,intent_key,action,normalized_payload_hash,result_id,created_by_id) VALUES(${randomUUID()}::uuid,${s.locationId}::uuid,${key as string},'PAYROLL_PAYMENT',${hash},${row.id}::uuid,${currentUserId()}::uuid)`;
      }
      await this.audit(tx, s, 'employee_pay', id, 'food.payout.created', {
        operationId: row.id,
        remainingMinor,
        period: b.period,
        method: row.method,
        amountMinor: row.amount.toString(),
      });
      return { id: row.id, remainingMinor: (mine.t.total - mine.paid - b.amount).toString() };
    }, BRANCH_CASH_VERTICALS);
  }

  // ─── Отчёт ресторана за период (Аналитика) ───

  /**
   * «Сколько принёс сотрудник» салона и ресторана (docs/decisions/2026-10-20-personnel-revenue.md):
   * оплачено минус возвраты за день, неделю или месяц по часам филиала
   */
  async staffRevenue(query: unknown, now = new Date()) {
    foodMay('reports');
    const s = await foodScope(this.prisma.db, BRANCH_CASH_VERTICALS);
    const q = parsed(() => foodObject(query, ['period']));
    const vertical = currentVertical() === 'BEAUTY' ? 'BEAUTY' : 'FOOD_SERVICE';
    try {
      return await branchStaffRevenue(this.prisma.db, { ...s, vertical }, q.period, now);
    } catch (e) {
      if (e instanceof RangeError) throw new BadRequestException(e.message);
      throw e;
    }
  }

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
    const [orders, payments, items, waiters, closedDays, barSales] = await Promise.all([
      db.restaurantOrder.aggregate({
        where: closedWhere,
        _count: { _all: true },
        _sum: { total: true, guestCount: true },
      }),
      db.restaurantPayment.groupBy({
        by: ['method'],
        where: { locationId: s.locationId, status: 'COMPLETED', paidAt: { gte: w.fromUtc, lt: w.toUtcExclusive } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      db.restaurantOrderItem.findMany({
        where: { order: closedWhere },
        select: {
          name: true,
          price: true,
          qty: true,
          menuItem: { select: { category: { select: { name: true } } } },
        },
      }),
      db.restaurantOrder.groupBy({
        by: ['waiterId'],
        where: { ...closedWhere, waiterId: { not: null } },
        _sum: { total: true },
        _count: { _all: true },
      }),
      db.restaurantOrder.findMany({ where: closedWhere, select: { closedAt: true, total: true } }),
      // выручка бара каноном самого бара (ADR-182, §45): POSTED по дате продажи, сторно исключает
      db.barSale.aggregate({
        where: { locationId: s.locationId, status: 'POSTED', createdAt: { gte: w.fromUtc, lt: w.toUtcExclusive } },
        _sum: { totalRevenue: true },
      }),
    ]);
    const count = orders._count._all;
    // выручка по дням периода (по поясу филиала): каждый день периода есть в ответе, пустой с нулём
    const byDay = new Map<string, { revenue: bigint; orders: number }>();
    for (let d = from; d <= to; d = shiftDay(d, 1)) byDay.set(d, { revenue: 0n, orders: 0 });
    for (const o of closedDays) {
      const day = byDay.get(foodLocal(o.closedAt!, s.timezone).date);
      if (!day) continue;
      day.revenue += o.total;
      day.orders += 1;
    }
    // продажи по категориям меню из строк закрытых заказов; блюдо без карточки уходит в «Без категории»
    const categories = new Map<string, bigint>();
    for (const i of items) {
      const name = i.menuItem?.category.name ?? 'Без категории';
      categories.set(name, (categories.get(name) ?? 0n) + i.price * BigInt(i.qty));
    }
    const revenue = orders._sum.total ?? 0n;
    const dishes = new Map<string, { qty: number; revenue: bigint }>();
    for (const i of items) {
      const d = dishes.get(i.name) ?? { qty: 0, revenue: 0n };
      d.qty += i.qty;
      d.revenue += i.price * BigInt(i.qty);
      dishes.set(i.name, d);
    }
    // §38: себестоимость проданного и недостачи из ленты склада за тот же период
    const moves = await db.kitchenStockMovement.findMany({
      where: {
        locationId: s.locationId,
        createdAt: { gte: w.fromUtc, lt: w.toUtcExclusive },
        kind: { in: ['CONSUMPTION', 'SHORTAGE', 'CONSUMPTION_RETURN'] },
      },
      select: { kind: true, lotId: true, productId: true, qty: true, cost: true },
    });
    const food = foodCostSummary(
      revenue,
      moves.map((m) => ({ ...m, qty: m.qty.toString() })),
    );
    const shortProducts = new Map(
      (
        await db.kitchenProduct.findMany({
          where: { id: { in: food.shortages.map((x) => x.productId) } },
          select: { id: true, name: true, unit: true },
        })
      ).map((p) => [p.id, p]),
    );
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
      costMinor: food.costMinor.toString(),
      grossProfitMinor: food.grossProfitMinor.toString(),
      foodCostPct: food.foodCostPct,
      shortages: food.shortages.map((x) => ({
        name: shortProducts.get(x.productId)?.name ?? '—',
        unit: shortProducts.get(x.productId)?.unit ?? '',
        qty: milliText(x.milli),
      })),
      ordersCount: count,
      // гости закрытых заказов периода (макет «Аналитика», плитка «Гостей»)
      guestsCount: orders._sum.guestCount ?? 0,
      revenueMinor: revenue.toString(),
      // отдельным полем, не внутри revenueMinor: канон выручки заказов (ADR-181) не меняется
      barRevenueMinor: (barSales._sum.totalRevenue ?? 0n).toString(),
      averageCheckMinor: count ? ((revenue + BigInt(count) / 2n) / BigInt(count)).toString() : null,
      payments: payments
        .map((p) => ({ method: p.method, amountMinor: (p._sum.amount ?? 0n).toString(), count: p._count._all }))
        .sort((a, b) => Number(BigInt(b.amountMinor) - BigInt(a.amountMinor))),
      topDishes: [...dishes.entries()]
        .map(([name, d]) => ({ name, qty: d.qty, revenueMinor: d.revenue.toString() }))
        .sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name, 'ru'))
        .slice(0, 10),
      revenueByDay: [...byDay.entries()].map(([date, d]) => ({
        date,
        revenueMinor: d.revenue.toString(),
        orders: d.orders,
      })),
      categories: [...categories.entries()]
        .map(([name, v]) => ({ name, revenueMinor: v.toString() }))
        .sort((a, b) => Number(BigInt(b.revenueMinor) - BigInt(a.revenueMinor)) || a.name.localeCompare(b.name, 'ru')),
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
  private async monthPayroll(db: MonthPayrollDb, s: FoodScope, month: unknown) {
    const m = monthParam(month);
    const { period, rows, adjustments } = await monthPayrollRows(db, s, m);
    return { m, period, rows, adjustments };
  }

  async payroll(query: unknown) {
    foodMay('staff');
    const s = await foodScope(this.prisma.db, BRANCH_PAYROLL_VERTICALS);
    const q = parsed(() => foodObject(query, ['month']));
    const { m, rows, adjustments } = await this.monthPayroll(this.prisma.db, s, q.month);
    let fund = 0n,
      bonus = 0n,
      penalty = 0n,
      payout = 0n,
      paidTotal = 0n;
    const out = rows.map(({ e, setting, perCleaningMinor, sales, cleanings, t, paid }) => {
        fund += t.base + t.percentPart + t.piece;
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
          perCleaningMinor: perCleaningMinor.toString(),
          cleanings,
          pieceMinor: t.piece.toString(),
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
      vertical: s.vertical,
      /** выплата из кассы филиала есть у салона и ресторана; у гостиницы только начисления */
      payouts: s.vertical !== 'HOSPITALITY',
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
          perCleaningMinor: b.perCleaningMinor ?? 0n,
          currency: s.currency,
          updatedById: currentUserId(),
        },
        update: {
          model: b.model,
          fixedMinor: b.fixedMinor,
          percent: b.percent,
          ...(b.perCleaningMinor === undefined ? {} : { perCleaningMinor: b.perCleaningMinor }),
          updatedById: currentUserId(),
        },
      });
      await this.audit(
        tx,
        s,
        'employee_pay',
        id,
        'food.pay_settings.saved',
        { model: row.model, fixedMinor: row.fixedMinor.toString(), percent: row.percent, perCleaningMinor: row.perCleaningMinor.toString() },
        old
          ? { model: old.model, fixedMinor: old.fixedMinor.toString(), percent: old.percent, perCleaningMinor: old.perCleaningMinor.toString() }
          : undefined,
      );
      return { ...row, fixedMinor: row.fixedMinor.toString(), perCleaningMinor: row.perCleaningMinor.toString() };
    }, BRANCH_PAYROLL_VERTICALS);
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
    }, BRANCH_PAYROLL_VERTICALS);
  }
}
