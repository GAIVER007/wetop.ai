import { ingredientCost } from './restaurant';

/**
 * Себестоимость и маржа позиции меню (DATA_MODEL §62.4, срез K4). Строка техкарты, связанная с продуктом склада
 * кухни, считается по текущей цене склада (средняя по остатку партий, у заготовки это цена её партий из списанных
 * продуктов, §62); без связи или без партий по цене, записанной в техкарте; нет и её: строка без цены (`missing`).
 * Добавки (§62.2) считаются отдельно: продукты на порцию и прибыль прибавки. Всё в minor units.
 */
export interface CostingPrice {
  unit: string;
  /** цена за кг, л или шт в minor units, как `unit_cost` партии */
  unitCost: bigint;
}
export interface CostingIngredient {
  productId: string | null;
  name: string;
  normQty: string;
  unit: string;
  unitCost: bigint;
}
export interface CostingModifier {
  id: string;
  name: string;
  priceDelta: bigint;
  ingredients: ReadonlyArray<{ productId: string; name: string; normQty: string }>;
}
export type CostingSource = 'STOCK' | 'CARD' | 'NONE';
export interface CostingLine {
  name: string;
  normQty: string;
  unit: string;
  costMinor: bigint;
  source: CostingSource;
}
export interface MenuCosting {
  costMinor: bigint;
  profitMinor: bigint;
  /** доля продуктов в цене, % */
  foodCostPct: number | null;
  /** наценка на себестоимость, % (как у техкарты §33.1) */
  marginPct: number | null;
  lines: CostingLine[];
  modifiers: Array<{ id: string; name: string; priceDeltaMinor: bigint; costMinor: bigint; profitMinor: bigint }>;
  /** строки без цены: ни склада, ни цены в техкарте */
  missing: string[];
}

const divRound = (a: bigint, b: bigint) => (a + b / 2n) / b;
const pct = (a: bigint, b: bigint) => (b > 0n ? Number(divRound(a * 100n, b)) : null);

/** Цена единицы склада: средняя по остатку партий; остатка нет, цена последней партии; партий нет, `null` */
export function stockUnitPrice(lots: ReadonlyArray<{ remaining: bigint; unitCost: bigint; receivedOn: string }>): bigint | null {
  if (!lots.length) return null;
  let qty = BigInt(0),
    sum = 0n;
  for (const l of lots) if (l.remaining > 0n) {
    qty += l.remaining;
    sum += l.remaining * l.unitCost;
  }
  if (qty > 0n) return divRound(sum, qty);
  return [...lots].sort((a, b) => a.receivedOn.localeCompare(b.receivedOn)).at(-1)!.unitCost;
}

function lineCost(
  row: { productId: string | null; name: string; normQty: string; unit?: string; unitCost?: bigint },
  prices: ReadonlyMap<string, CostingPrice>,
): CostingLine {
  const stock = row.productId ? prices.get(row.productId) : undefined;
  if (stock && stock.unitCost > 0n)
    return { name: row.name, normQty: row.normQty, unit: stock.unit, costMinor: ingredientCost({ normQty: row.normQty, unit: stock.unit, unitCost: stock.unitCost }), source: 'STOCK' };
  if (row.unit && row.unitCost && row.unitCost > 0n)
    return { name: row.name, normQty: row.normQty, unit: row.unit, costMinor: ingredientCost({ normQty: row.normQty, unit: row.unit, unitCost: row.unitCost }), source: 'CARD' };
  return { name: row.name, normQty: row.normQty, unit: row.unit ?? stock?.unit ?? '', costMinor: 0n, source: 'NONE' };
}

export function menuCosting(
  item: { price: bigint; ingredients: readonly CostingIngredient[]; modifiers: readonly CostingModifier[] },
  prices: ReadonlyMap<string, CostingPrice>,
): MenuCosting {
  const missing: string[] = [];
  const lines = item.ingredients.map((r) => lineCost(r, prices));
  for (const l of lines) if (l.source === 'NONE') missing.push(l.name);
  const cost = lines.reduce((s, l) => s + l.costMinor, 0n);
  const modifiers = item.modifiers.map((m) => {
    const parts = m.ingredients.map((r) => lineCost(r, prices));
    for (const p of parts) if (p.source === 'NONE' && !missing.includes(p.name)) missing.push(p.name);
    const c = parts.reduce((s, l) => s + l.costMinor, 0n);
    return { id: m.id, name: m.name, priceDeltaMinor: m.priceDelta, costMinor: c, profitMinor: m.priceDelta - c };
  });
  return {
    costMinor: cost,
    profitMinor: item.price - cost,
    foodCostPct: pct(cost, item.price),
    marginPct: cost > 0n ? pct(item.price - cost, cost) : null,
    lines,
    modifiers,
    missing,
  };
}
