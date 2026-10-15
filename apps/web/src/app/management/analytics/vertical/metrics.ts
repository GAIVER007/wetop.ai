import { beautyStatus } from '../../../../lib/status/beauty';
import { foodStatus } from '../../../../lib/status/food';
import type { StatusRegistry } from '../../../../lib/status/types';
/** MV9: local date enumeration, status counts and approved DONE price snapshots. */
export const MAX_PERIOD_DAYS = 31;
const DAY = 86400000;
export function periodDates(from: string, to: string): string[] {
  const valid = (s: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    Number.isFinite(Date.parse(s + 'T00:00:00Z')) &&
    new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
  if (!valid(from) || !valid(to) || to < from) throw new Error('Укажите корректный период');
  const count = (Date.parse(to) - Date.parse(from)) / DAY + 1;
  if (count > MAX_PERIOD_DAYS) throw new Error('Выберите период не длиннее 31 дня');
  return Array.from({ length: count }, (_, i) =>
    new Date(Date.parse(from) + i * DAY).toISOString().slice(0, 10),
  );
}
const groups = <K extends string>(registry: StatusRegistry<K>, order: readonly K[]) =>
  Object.fromEntries(order.map((k) => [k, registry[k].groupLabel ?? registry[k].label])) as Record<
    K,
    string
  >;
/** Счётчики аналитики: группы из реестров салона и ресторана (DS1a), порядок колонок прежний */
export const BEAUTY_LABELS = groups(beautyStatus, [
  'BOOKED',
  'CONFIRMED',
  'DONE',
  'NO_SHOW',
  'CANCELLED',
]);
export const FOOD_LABELS = groups(foodStatus, [
  'BOOKED',
  'CONFIRMED',
  'SEATED',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
]);
function counters<T extends string>(
  labels: Record<T, string>,
  rows: Array<{ id: string; status: string }>,
): Record<T, number> {
  const counts = Object.fromEntries(Object.keys(labels).map((s) => [s, 0])) as Record<T, number>;
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row.id || seen.has(row.id) || !Object.hasOwn(labels, row.status))
      throw new Error('Некорректный ответ отчёта');
    seen.add(row.id);
    counts[row.status as T]++;
  }
  return counts;
}
export function beautyPeriod(
  rows: Array<{ id: string; status: string; priceMinor: string; currency: string }>,
) {
  const counts = counters(BEAUTY_LABELS, rows);
  const totals = new Map<string, bigint>();
  for (const r of rows.filter((r) => r.status === 'DONE')) {
    if (!/^\d+$/.test(r.priceMinor) || !/^[A-Z]{3}$/.test(r.currency))
      throw new Error('Некорректная цена записи');
    totals.set(r.currency, (totals.get(r.currency) ?? 0n) + BigInt(r.priceMinor));
  }
  const revenue = Object.fromEntries(
    [...totals].sort(([a], [b]) => a.localeCompare(b)).map(([c, n]) => [c, n.toString()]),
  );
  return { counts, revenue };
}
export function foodPeriod(rows: Array<{ id: string; status: string }>) {
  return counters(FOOD_LABELS, rows);
}
/** Never convert minor-unit strings to Number, even for display. */
export function moneyText(minor: string, currency: string): string {
  const digits =
    new Intl.NumberFormat('ru-RU', { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits ?? 2;
  const divisor = 10n ** BigInt(digits);
  const value = BigInt(minor);
  const absolute = value < 0n ? -value : value;
  const whole = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(
    absolute / divisor,
  );
  const fraction = digits ? ',' + (absolute % divisor).toString().padStart(digits, '0') : '';
  return `${value < 0n ? '-' : ''}${whole}${fraction} ${currency}`;
}
