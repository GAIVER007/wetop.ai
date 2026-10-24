import { foodId, foodObject, foodText } from './food';
import { INGREDIENT_UNITS, ingredientCost, type IngredientUnit } from './restaurant';

/**
 * Склад кухни FS2 (DATA_MODEL §34, ADR-KITCHEN-FS). Количество numeric(14,3) держим целыми тысячными долями (bigint),
 * цена партии как у техкарты §33.1: за кг, л или штуку в minor units. Стоимость количества считает `ingredientCost`,
 * поэтому склад и техкарта сходятся до тиына.
 */

/** Количество из формы или JSON: число или строка, не больше трёх знаков после запятой, строго больше нуля */
export function stockQty(v: unknown, allowZero = false): bigint {
  const raw = typeof v === 'number' ? String(v) : typeof v === 'string' ? v.trim().replace(',', '.') : '';
  // до 9 целых знаков: тот же предел, что у нормы техкарты (ingredientCost)
  if (!/^\d{1,9}(\.\d{1,3})?$/.test(raw)) throw new Error('Количество: число, не больше трёх знаков после запятой');
  const [whole = '0', frac = ''] = raw.split('.');
  const milli = BigInt(whole) * 1000n + BigInt(frac.padEnd(3, '0'));
  if (milli === 0n && !allowZero) throw new Error('Количество должно быть больше нуля');
  return milli;
}

/** Тысячные доли → строка для numeric и для экрана: 2500 → «2.5», 3000 → «3», −1250 → «-1.25» */
export function milliText(milli: bigint): string {
  const neg = milli < 0n;
  const abs = neg ? -milli : milli;
  const frac = (abs % 1000n).toString().padStart(3, '0').replace(/0+$/, '');
  return `${neg ? '-' : ''}${abs / 1000n}${frac ? `.${frac}` : ''}`;
}

/** Decimal из базы (Prisma Decimal или строка) → тысячные доли */
export function milliOf(v: { toString(): string } | string): bigint {
  const s = typeof v === 'string' ? v : v.toString();
  const neg = s.startsWith('-');
  const milli = stockQty(neg ? s.slice(1) : s, true);
  return neg ? -milli : milli;
}

/** Стоимость количества по цене партии: та же формула, что строка техкарты (§33.1) */
export function stockCost(milli: bigint, unit: IngredientUnit | string, unitCost: bigint): bigint {
  if (milli === 0n) return 0n;
  return ingredientCost({ normQty: milliText(milli), unit, unitCost });
}

export interface StockLot {
  id: string;
  /** Порядок FIFO: раньше принятая партия списывается первой */
  receivedOn: string;
  createdAt: Date;
  remaining: bigint;
  unitCost: bigint;
}
export interface StockAllocation {
  lotId: string;
  milli: bigint;
  cost: bigint;
}

/** Раскладывает списание по партиям FIFO; ниже нуля нельзя (инвариант 3 §34) */
export function allocateStock(
  lots: readonly StockLot[],
  milli: bigint,
  unit: IngredientUnit | string,
): { allocations: StockAllocation[]; cost: bigint } {
  if (milli <= 0n) throw new Error('Количество должно быть больше нуля');
  const available = lots.reduce((sum, lot) => sum + (lot.remaining > 0n ? lot.remaining : 0n), 0n);
  if (available < milli)
    throw new Error(
      `Недостаточно на складе: есть ${milliText(available)} ${unit}, нужно ${milliText(milli)} ${unit}`,
    );
  const ordered = [...lots].sort(
    (a, b) =>
      a.receivedOn.localeCompare(b.receivedOn) ||
      a.createdAt.getTime() - b.createdAt.getTime() ||
      a.id.localeCompare(b.id),
  );
  let left = milli;
  const allocations: StockAllocation[] = [];
  for (const lot of ordered) {
    if (left === 0n) break;
    if (lot.remaining <= 0n) continue;
    const take = lot.remaining < left ? lot.remaining : left;
    allocations.push({ lotId: lot.id, milli: take, cost: stockCost(take, unit, lot.unitCost) });
    left -= take;
  }
  return { allocations, cost: allocations.reduce((sum, a) => sum + a.cost, 0n) };
}

/** Инвентаризация: недостача списывается, излишек приходуется (Q-KITCHEN-9, ADR-175) */
/**
 * Цена единицы излишка (Q-KITCHEN-9, ADR-175): средняя по остатку партий, взвешенная количеством, не меньше 1.
 * Остатка нет: `null`, цену называет человек.
 */
export function surplusUnitCost(lots: ReadonlyArray<{ remaining: bigint; unitCost: bigint }>): bigint | null {
  // Keep the accumulator dynamic for Next NFT: it otherwise folds the guarded average with qty = 0n.
  let qty = BigInt(0),
    sum = 0n;
  for (const l of lots) {
    qty += l.remaining;
    sum += l.remaining * l.unitCost;
  }
  if (qty <= 0n) return null;
  const avg = (sum + qty / 2n) / qty;
  return avg > 0n ? avg : 1n;
}

export function inventoryDelta(
  onHand: bigint,
  actual: bigint,
): { kind: 'equal' } | { kind: 'shortage'; milli: bigint } | { kind: 'surplus'; milli: bigint } {
  if (actual === onHand) return { kind: 'equal' };
  return actual < onHand
    ? { kind: 'shortage', milli: onHand - actual }
    : { kind: 'surplus', milli: actual - onHand };
}

function stockUnit(v: unknown): IngredientUnit {
  if (typeof v !== 'string' || !INGREDIENT_UNITS.some((u) => u === v))
    throw new Error('Единица: г, мл или шт');
  return v as IngredientUnit;
}
export function stockDate(v: unknown): string {
  const d = foodText(v, 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(d) ||
    !Number.isFinite(Date.parse(d)) ||
    new Date(d).toISOString().slice(0, 10) !== d
  )
    throw new Error('Нужна календарная дата');
  return d;
}
/** Цена партии в minor units за кг, л или штуку: целое, больше нуля */
function stockPrice(v: unknown): bigint {
  const raw = typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : NaN;
  if (!Number.isSafeInteger(raw) || raw <= 0) throw new Error('Цена: целое число тиынов больше нуля');
  return BigInt(raw);
}

export interface KitchenProductInput {
  name?: string;
  unit?: IngredientUnit;
  minQty?: bigint;
  active?: boolean;
}
export function parseKitchenProduct(raw: unknown, partial = false): KitchenProductInput {
  const b = foodObject(raw, ['name', 'unit', 'minQty', 'active']);
  const out: KitchenProductInput = {};
  if (!partial || b.name !== undefined) out.name = foodText(b.name, 200);
  if (!partial || b.unit !== undefined) out.unit = stockUnit(b.unit);
  if (b.minQty !== undefined) out.minQty = stockQty(b.minQty, true);
  if (b.active !== undefined) {
    if (typeof b.active !== 'boolean') throw new Error('Нужно логическое значение');
    out.active = b.active;
  }
  return out;
}

export interface ReceiptLineInput {
  productId: string;
  qty: bigint;
  unitCost: bigint;
  expiresOn: string | null;
}
export interface KitchenReceiptInput {
  supplier: string | null;
  document: string | null;
  receivedOn: string | null;
  lines: ReceiptLineInput[];
}
export function parseKitchenReceipt(raw: unknown): KitchenReceiptInput {
  const b = foodObject(raw, ['supplier', 'document', 'receivedOn', 'lines']);
  if (!Array.isArray(b.lines) || b.lines.length === 0 || b.lines.length > 50)
    throw new Error('В приходе от 1 до 50 строк');
  return {
    supplier: b.supplier == null || b.supplier === '' ? null : foodText(b.supplier, 200),
    document: b.document == null || b.document === '' ? null : foodText(b.document, 100),
    receivedOn: b.receivedOn == null || b.receivedOn === '' ? null : stockDate(b.receivedOn),
    lines: b.lines.map((line) => {
      const l = foodObject(line, ['productId', 'qty', 'unitCost', 'expiresOn']);
      return {
        productId: foodId(l.productId),
        qty: stockQty(l.qty),
        unitCost: stockPrice(l.unitCost),
        expiresOn: l.expiresOn == null || l.expiresOn === '' ? null : stockDate(l.expiresOn),
      };
    }),
  };
}

export interface WriteOffInput {
  productId: string;
  qty: bigint;
  reason: string;
}
export function parseWriteOff(raw: unknown): WriteOffInput {
  const b = foodObject(raw, ['productId', 'qty', 'reason']);
  return { productId: foodId(b.productId), qty: stockQty(b.qty), reason: foodText(b.reason, 500) };
}

export interface InventoryInput {
  productId: string;
  actualQty: bigint;
  reason: string | null;
  unitCost: bigint | null;
}
export function parseInventory(raw: unknown): InventoryInput {
  const b = foodObject(raw, ['productId', 'actualQty', 'reason', 'unitCost']);
  return {
    productId: foodId(b.productId),
    actualQty: stockQty(b.actualQty, true),
    reason: b.reason == null || b.reason === '' ? null : foodText(b.reason, 500),
    // цена излишка вручную, когда остатка нет (Q-KITCHEN-9); в тех же единицах, что у прихода
    unitCost: b.unitCost == null ? null : stockPrice(b.unitCost),
  };
}

/**
 * Сколько целых порций блюда хватит из остатков склада (ADR-STOCK-ALL). `onHand` в тысячных долях единицы техкарты
 * (г, мл, шт), как `milliOf`. Строки без связи со складом (`productId` пуст) ничего не списывают и не ограничивают;
 * без единой связанной строки порции неизвестны (`null`). Продукта нет в остатках, значит ноль порций.
 */
export function dishPortions(
  rows: ReadonlyArray<{ productId?: string | null; name: string; normQty: string }>,
  onHand: ReadonlyMap<string, bigint>,
): { portions: number | null; limiting: string | null } {
  let best: { portions: bigint; name: string } | null = null;
  for (const row of rows) {
    if (!row.productId) continue;
    const norm = stockQty(row.normQty, true);
    if (norm === 0n) continue;
    const have = onHand.get(row.productId) ?? 0n;
    const portions = have <= 0n ? 0n : have / norm;
    if (!best || portions < best.portions) best = { portions, name: row.name };
  }
  return best ? { portions: Number(best.portions), limiting: best.name } : { portions: null, limiting: null };
}
