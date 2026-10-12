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
