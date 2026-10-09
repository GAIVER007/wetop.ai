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
