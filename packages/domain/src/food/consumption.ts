import { milliOf } from './stock';

/**
 * Списание склада по заказу (DATA_MODEL §38, ADR-168): расход на продукт = норма строки техкарты × число блюд.
 * Количества в тысячных долях (bigint), как у склада §34; строки техкарты без ссылки на склад не списываются.
 */
export function orderConsumption(
  lines: ReadonlyArray<{
    qty: number;
    ingredients: ReadonlyArray<{ productId: string | null; normQty: string }>;
  }>,
): Map<string, bigint> {
  const need = new Map<string, bigint>();
  for (const line of lines)
    for (const i of line.ingredients) {
      if (!i.productId) continue;
      need.set(i.productId, (need.get(i.productId) ?? 0n) + milliOf(i.normQty) * BigInt(line.qty));
    }
  return need;
}

/** Нехватка (Q-KITCHEN-6 А): списать весь доступный остаток, остальное в недостачу */
export function splitShortage(available: bigint, need: bigint): { take: bigint; shortage: bigint } {
  const take = available < need ? (available > 0n ? available : 0n) : need;
  return { take, shortage: need - take };
}

/**
 * Фудкост за период по ленте склада (§38): себестоимость проданного = расход по заказам минус возвраты при
 * отмене (по партиям); недостача нетто по продукту (недостача минус её возврат). Деньги и тысячные доли bigint.
 */
export function foodCostSummary(
  revenueMinor: bigint,
  movements: ReadonlyArray<{
    kind: string;
    lotId: string | null;
    productId: string;
    qty: string;
    cost: bigint;
  }>,
): {
  costMinor: bigint;
  grossProfitMinor: bigint;
  foodCostPct: number | null;
  shortages: Array<{ productId: string; milli: bigint }>;
} {
  let cost = 0n;
  const short = new Map<string, bigint>();
  for (const m of movements) {
    if (m.lotId && (m.kind === 'CONSUMPTION' || m.kind === 'CONSUMPTION_RETURN')) cost -= m.cost;
    if (!m.lotId && (m.kind === 'SHORTAGE' || m.kind === 'CONSUMPTION_RETURN'))
      short.set(m.productId, (short.get(m.productId) ?? 0n) - milliOf(m.qty));
  }
  return {
    costMinor: cost,
    grossProfitMinor: revenueMinor - cost,
    foodCostPct: revenueMinor > 0n ? Number((cost * 100n + revenueMinor / 2n) / revenueMinor) : null,
    shortages: [...short.entries()]
      .filter(([, milli]) => milli > 0n)
      .map(([productId, milli]) => ({ productId, milli })),
  };
}
