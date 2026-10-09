import type { BarStockRow } from '../../lib/api';

/** Статус остатка (макет владельца 09.10.2026): В норме, Заканчивается, Нет в наличии */
export type StockStatus = 'ok' | 'low' | 'out';
export const STATUS_LABEL: Record<StockStatus, string> = { ok: 'В норме', low: 'Заканчивается', out: 'Нет в наличии' };
export const STATUS_TONE: Record<StockStatus, 'ok' | 'warn' | 'danger'> = { ok: 'ok', low: 'warn', out: 'danger' };

export function stockStatusOf(item: Pick<BarStockRow, 'availableUnits' | 'minimumStockUnits'>): StockStatus {
  const units = BigInt(item.availableUnits);
  if (units <= 0n) return 'out';
  return units <= BigInt(item.minimumStockUnits) ? 'low' : 'ok';
}

/** Целое деление с округлением к ближайшему, половина от нуля; знаменатель положительный */
function roundDiv(numerator: bigint, denominator: bigint): bigint {
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  const twice = (remainder < 0n ? -remainder : remainder) * 2n;
  return twice >= denominator ? quotient + (numerator < 0n ? -1n : 1n) : quotient;
}

/** Фактическая наценка в целых процентах: цена продажи к последней закупке (600 к 320 даёт 88) */
export function markupPercent(salePriceMinor: string, unitCostMinor: string | null): number | null {
  if (!unitCostMinor) return null;
  const cost = BigInt(unitCostMinor);
  if (cost <= 0n) return null;
  return Number(roundDiv((BigInt(salePriceMinor) - cost) * 100n, cost));
}

/** Цена по наценке из базисных пунктов: вверх до 10 тенге (Q-BAR-2), как при проведении прихода */
export function recommendedPriceMinor(unitCostMinor: string, markupBasis: bigint): string {
  const exact = (BigInt(unitCostMinor) * (10_000n + markupBasis) + 9_999n) / 10_000n;
  return (((exact + 999n) / 1_000n) * 1_000n).toString();
}

/** Доля в целых процентах: прибыль к выручке для «маржинальности»; без выручки null */
export function sharePercent(part: bigint, whole: bigint): number | null {
  if (whole <= 0n) return null;
  return Number(roundDiv(part * 100n, whole));
}
