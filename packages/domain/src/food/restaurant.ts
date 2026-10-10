import { foodId, foodInt, foodObject, foodText } from './food';

/** Ресторан v2 (DATA_MODEL §33, ADR-159): заказы, техкарты, зарплата. Деньги — bigint minor units (ADR-008). */
export const ORDER_STATUSES = ['NEW', 'COOKING', 'READY', 'SERVED', 'CLOSED', 'CANCELLED'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export const ORDER_DELAY_MINUTES = 20;
export function orderNext(status: OrderStatus): OrderStatus[] {
  return (
    {
      NEW: ['COOKING', 'CANCELLED'],
      COOKING: ['READY', 'CANCELLED'],
      READY: ['SERVED', 'CANCELLED'],
      SERVED: ['CLOSED'],
      CLOSED: [],
      CANCELLED: [],
    } as Record<OrderStatus, OrderStatus[]>
  )[status];
}
export function orderDelayed(status: OrderStatus, openedAt: Date, now: Date): boolean {
  return (
    (status === 'NEW' || status === 'COOKING') &&
    now.getTime() - openedAt.getTime() >= ORDER_DELAY_MINUTES * 60000
  );
}

export const INGREDIENT_UNITS = ['г', 'мл', 'шт'] as const;
export type IngredientUnit = (typeof INGREDIENT_UNITS)[number];
export interface IngredientRow {
  normQty: string;
  unit: IngredientUnit | string;
  unitCost: bigint;
}
/** Округление половины вверх на неотрицательных значениях */
const divRound = (a: bigint, b: bigint) => (a + b / 2n) / b;
/** Норма приходит numeric(12,3) строкой; тысячные доли держим целым числом */
function qtyMilli(normQty: string): bigint {
  if (!/^\d{1,9}(\.\d{1,3})?$/.test(normQty)) throw new Error('Некорректная норма');
  const [whole = '0', frac = ''] = normQty.split('.');
  const milli = BigInt(whole) * 1000n + BigInt(frac.padEnd(3, '0'));
  if (milli <= 0n) throw new Error('Некорректная норма');
  return milli;
}
/** Стоимость строки техкарты: г и мл — за кг и л, шт — за штуку (§33.1) */
export function ingredientCost(row: IngredientRow): bigint {
  const milli = qtyMilli(row.normQty);
  return row.unit === 'шт'
    ? divRound(milli * row.unitCost, 1000n)
    : divRound(milli * row.unitCost, 1000000n);
}
export interface TechCardTotals {
  cost: bigint;
  profit: bigint;
  foodCostPct: number | null;
  marginPct: number | null;
}
export function techCardTotals(price: bigint, rows: IngredientRow[]): TechCardTotals {
  const cost = rows.reduce((sum, row) => sum + ingredientCost(row), 0n);
  return {
    cost,
    profit: price - cost,
    foodCostPct: price > 0n ? Number(divRound(cost * 100n, price)) : null,
    marginPct: cost > 0n ? Number(divRound((price - cost) * 100n, cost)) : null,
  };
}

export const PAY_MODELS = ['FIXED', 'PERCENT', 'FIXED_PLUS_PERCENT', 'BONUS_ONLY'] as const;
export type PayModel = (typeof PAY_MODELS)[number];
export interface PaySetting {
  model: PayModel;
  fixedMinor: bigint;
  percent: number;
}
export interface PayrollTotals {
  base: bigint;
  percentPart: bigint;
  bonus: bigint;
  penalty: bigint;
  total: bigint;
}
/** К выплате за месяц: оклад по модели + процент от заказов CLOSED + корректировки (§33.4) */
export function payrollTotals(
  setting: PaySetting,
  closedOrdersTotal: bigint,
  adjustments: bigint[],
): PayrollTotals {
  const base =
    setting.model === 'FIXED' || setting.model === 'FIXED_PLUS_PERCENT' ? setting.fixedMinor : 0n;
  const percentPart =
    setting.model === 'PERCENT' || setting.model === 'FIXED_PLUS_PERCENT'
      ? divRound(closedOrdersTotal * BigInt(setting.percent), 100n)
      : 0n;
  const bonus = adjustments.filter((a) => a > 0n).reduce((s, a) => s + a, 0n);
  const penalty = adjustments.filter((a) => a < 0n).reduce((s, a) => s + a, 0n);
  return { base, percentPart, bonus, penalty, total: base + percentPart + bonus + penalty };
}

function money(v: unknown, min = 0): bigint {
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < min)
    throw new Error('Деньги — целое число minor units');
  return BigInt(v);
}

export interface MenuCategoryInput {
  name?: string;
  sortOrder?: number;
  active?: boolean;
}
export function parseMenuCategoryInput(raw: unknown, partial = false): MenuCategoryInput {
  const b = foodObject(raw, ['name', 'sortOrder', 'active']);
  const out: MenuCategoryInput = {};
  if (!partial || b.name !== undefined) out.name = foodText(b.name, 100);
  if (b.sortOrder !== undefined) out.sortOrder = foodInt(b.sortOrder, -2147483648);
  if (b.active !== undefined) {
    if (typeof b.active !== 'boolean') throw new Error('Нужно логическое значение');
    out.active = b.active;
  }
  return out;
}

export interface MenuItemInput {
  categoryId?: string;
  name?: string;
  weightGrams?: number | null;
  price?: bigint;
  active?: boolean;
  techNotes?: string | null;
  sortOrder?: number;
}
export function parseMenuItemInput(raw: unknown, partial = false): MenuItemInput {
  const b = foodObject(raw, [
    'categoryId',
    'name',
    'weightGrams',
    'price',
    'active',
    'techNotes',
    'sortOrder',
  ]);
  const out: MenuItemInput = {};
  if (!partial || b.categoryId !== undefined) out.categoryId = foodId(b.categoryId);
  if (!partial || b.name !== undefined) out.name = foodText(b.name, 200);
  if (!partial || b.price !== undefined) out.price = money(b.price);
  if (b.weightGrams !== undefined)
    out.weightGrams = b.weightGrams === null ? null : foodInt(b.weightGrams);
  if (b.techNotes !== undefined)
    out.techNotes = b.techNotes === null ? null : foodText(b.techNotes, 8000);
  if (b.sortOrder !== undefined) out.sortOrder = foodInt(b.sortOrder, -2147483648);
  if (b.active !== undefined) {
    if (typeof b.active !== 'boolean') throw new Error('Нужно логическое значение');
    out.active = b.active;
  }
  return out;
}

export interface IngredientInput {
  name: string;
  normQty: string;
  unit: IngredientUnit;
  unitCost: bigint;
  sortOrder?: number;
}
export function parseIngredientInput(raw: unknown): IngredientInput {
  const b = foodObject(raw, ['name', 'normQty', 'unit', 'unitCost', 'sortOrder']);
  if (!INGREDIENT_UNITS.includes(b.unit as IngredientUnit))
    throw new Error('Единица: г, мл или шт');
  const normQty = typeof b.normQty === 'number' ? String(b.normQty) : foodText(b.normQty, 13);
  qtyMilli(normQty);
  const out: IngredientInput = {
    name: foodText(b.name, 200),
    normQty,
    unit: b.unit as IngredientUnit,
    unitCost: money(b.unitCost),
  };
  if (b.sortOrder !== undefined) out.sortOrder = foodInt(b.sortOrder, -2147483648);
  return out;
}

export interface OrderItemInput {
  menuItemId: string;
  qty: number;
  notes: string | null;
}
export interface OrderCreate {
  tableId: string | null;
  waiterId: string | null;
  guestCount: number;
  notes: string | null;
  items: OrderItemInput[];
}
export function parseOrderItems(raw: unknown): OrderItemInput[] {
  if (!Array.isArray(raw) || raw.length === 0) throw new Error('Добавьте хотя бы одно блюдо');
  if (raw.length > 100) throw new Error('Слишком много строк заказа');
  return raw.map((item) => {
    const b = foodObject(item, ['menuItemId', 'qty', 'notes']);
    return {
      menuItemId: foodId(b.menuItemId),
      qty: foodInt(b.qty, 1, 999),
      notes: b.notes == null ? null : foodText(b.notes, 500),
    };
  });
}
export function parseOrderCreate(raw: unknown): OrderCreate {
  const b = foodObject(raw, ['tableId', 'waiterId', 'guestCount', 'notes', 'items']);
  return {
    tableId: b.tableId == null ? null : foodId(b.tableId),
    waiterId: b.waiterId == null ? null : foodId(b.waiterId),
    guestCount: foodInt(b.guestCount, 1, 1000),
    notes: b.notes == null ? null : foodText(b.notes, 4000),
    items: parseOrderItems(b.items),
  };
}

export interface PaySettingsInput {
  model: PayModel;
  fixedMinor: bigint;
  percent: number;
}
export function parsePaySettings(raw: unknown): PaySettingsInput {
  const b = foodObject(raw, ['model', 'fixedMinor', 'percent']);
  if (!PAY_MODELS.includes(b.model as PayModel)) throw new Error('Неизвестная модель оплаты');
  return {
    model: b.model as PayModel,
    fixedMinor: money(b.fixedMinor),
    percent: foodInt(b.percent, 0, 100),
  };
}

export interface PayAdjustmentInput {
  period: string;
  amountMinor: bigint;
  reason: string;
}
/** Период приходит как `ГГГГ-ММ`, храним первым днём месяца (§33.4) */
export function parsePayAdjustment(raw: unknown): PayAdjustmentInput {
  const b = foodObject(raw, ['period', 'amountMinor', 'reason']);
  const period = foodText(b.period, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error('Период в формате ГГГГ-ММ');
  if (typeof b.amountMinor !== 'number' || !Number.isSafeInteger(b.amountMinor) || !b.amountMinor)
    throw new Error('Сумма — целое число minor units, не ноль');
  return {
    period: `${period}-01`,
    amountMinor: BigInt(b.amountMinor),
    reason: foodText(b.reason, 200),
  };
}
