/**
 * Наценка строки прихода склада (аудит салона 22.10.2026 P1: цена продажи терялась). Своя наценка товара или его
 * категории идёт первой. Если её нет, а цена продажи уже задана, строка берёт наценку, при которой проведение
 * прихода оставит эту цену (с округлением вверх), а не затрёт её закупкой.
 */
export interface MarkupProduct {
  markupBasis: number | null;
  salePrice: string;
  category?: { defaultMarkupBasis: number | null } | null | undefined;
}

const parseMinor = (raw: string) => {
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(raw.replace(/\s/g, ''));
  return match ? BigInt(match[1]!) * 100n + BigInt((match[2] ?? '').padEnd(2, '0') || '0') : null;
};

const percent = (basis: bigint) => `${basis / 100n}.${String(basis % 100n).padStart(2, '0')}`;

/** Наценка строки прихода в процентах с двумя знаками: «80.00» */
export function receiptMarkupInput(product: MarkupProduct | undefined, unitCostInput: string): string {
  if (!product) return '0.00';
  const own = product.markupBasis ?? product.category?.defaultMarkupBasis ?? null;
  if (own !== null) return percent(BigInt(own));
  const cost = parseMinor(unitCostInput);
  const price = BigInt(product.salePrice || '0');
  if (cost === null || cost <= 0n || price <= cost) return '0.00';
  const basis = ((price - cost) * 10_000n + cost - 1n) / cost;
  return percent(basis);
}
