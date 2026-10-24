import { foodId, foodObject } from './food';
import type { IngredientUnit } from './restaurant';
import { stockDate, stockQty } from './stock';

/**
 * Заготовки (DATA_MODEL §62, срез K1; план `plans/2026-10-24-kitchen-for-all-verticals.md`, утверждён 24.10.2026).
 * Заготовка это продукт склада кухни вида PREP со своей техкартой: норма каждого ингредиента на выход `yieldQty`.
 * «Приготовили партию» списывает ингредиенты FIFO и заводит партию заготовки по себестоимости списанного.
 * Количества тысячными долями bigint, деньги целыми тиынами, float нет.
 */

const half = (a: bigint, b: bigint) => (a + b / 2n) / b;

/** Расход ингредиентов на партию `batch` при техкарте на выход `yieldQty`; округление половиной вверх, нули выпадают */
export function prepNeed(
  lines: ReadonlyArray<{ ingredientId: string; normQty: bigint }>,
  yieldQty: bigint,
  batch: bigint,
): Map<string, bigint> {
  if (yieldQty <= 0n || batch <= 0n) throw new Error('Выход и партия должны быть больше нуля');
  const need = new Map<string, bigint>();
  for (const line of lines) need.set(line.ingredientId, (need.get(line.ingredientId) ?? 0n) + line.normQty);
  for (const [id, norm] of need) {
    const milli = half(norm * batch, yieldQty);
    if (milli > 0n) need.set(id, milli);
    else need.delete(id);
  }
  return need;
}

/**
 * Цена единицы партии заготовки (за кг, л или штуку, как у прихода) из себестоимости партии `costMinor` и её
 * количества; не меньше 1 (у партии склада цена строго больше нуля, `kitchen_stock_lots_values`).
 */
export function prepUnitCost(costMinor: bigint, milli: bigint, unit: IngredientUnit | string): bigint {
  if (milli <= 0n) throw new Error('Количество партии должно быть больше нуля');
  const unitCost = half(costMinor * (unit === 'шт' ? 1000n : 1_000_000n), milli);
  return unitCost > 0n ? unitCost : 1n;
}

/** Будет ли цикл, если у заготовки `prepId` станут ингредиенты `next` (граф: заготовка → её ингредиенты) */
export function prepCycle(graph: ReadonlyMap<string, readonly string[]>, prepId: string, next: readonly string[]): boolean {
  const seen = new Set<string>();
  const stack = [...next];
  while (stack.length) {
    const id = stack.pop()!;
    if (id === prepId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...((id === prepId ? next : graph.get(id)) ?? []));
  }
  return false;
}

export interface PrepRecipeInput {
  yieldQty: bigint;
  lines: Array<{ ingredientId: string; normQty: bigint }>;
}
export function parsePrepRecipe(raw: unknown): PrepRecipeInput {
  const b = foodObject(raw, ['yieldQty', 'lines']);
  if (!Array.isArray(b.lines) || b.lines.length === 0 || b.lines.length > 50)
    throw new Error('В техкарте заготовки от 1 до 50 строк');
  const lines = b.lines.map((line) => {
    const l = foodObject(line, ['ingredientId', 'normQty']);
    return { ingredientId: foodId(l.ingredientId), normQty: stockQty(l.normQty) };
  });
  if (new Set(lines.map((l) => l.ingredientId)).size !== lines.length)
    throw new Error('Каждый ингредиент указывается один раз');
  return { yieldQty: stockQty(b.yieldQty), lines };
}

export interface ProductionInput {
  productId: string;
  qty: bigint;
  expiresOn: string | null;
}
export function parseProduction(raw: unknown): ProductionInput {
  const b = foodObject(raw, ['productId', 'qty', 'expiresOn']);
  return {
    productId: foodId(b.productId),
    qty: stockQty(b.qty),
    expiresOn: b.expiresOn == null || b.expiresOn === '' ? null : stockDate(b.expiresOn),
  };
}
