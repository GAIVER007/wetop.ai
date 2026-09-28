import type { RateCalendarDay } from '../../lib/api';

/** Что панель «Изменить цены» говорит о текущей цене выбранных дат для одной вместимости (RT2, ADR-111) */
export type PriceSummary =
  | { kind: 'same'; minor: string }
  | { kind: 'mixed'; min: string; max: string; missing: number }
  | { kind: 'none' };

/** Отрезок от меньшей даты к большей, в какую бы сторону его ни выбрали; без второго края — один день */
export function orderedRange(a: string, b: string | null): { from: string; to: string } {
  const other = b ?? a;
  return a <= other ? { from: a, to: other } : { from: other, to: a };
}

/** Дни календаря между краями отрезка включительно (даты ISO сравниваются как строки) */
export function pricesInRange(days: RateCalendarDay[], from: string, to: string): RateCalendarDay[] {
  return days.filter((d) => d.date >= from && d.date <= to);
}

/** Текущая цена отрезка: одна на всех, «отличаются» (включая дни без цены) или «нет цены» ни у одного дня */
export function summarizePrices(days: RateCalendarDay[], occupancy: number): PriceSummary {
  const present = days
    .map((d) => d.prices[String(occupancy)])
    .filter((v): v is string => v != null)
    .map((v) => BigInt(v));
  if (present.length === 0) return { kind: 'none' };
  const min = present.reduce((a, b) => (b < a ? b : a));
  const max = present.reduce((a, b) => (b > a ? b : a));
  const missing = days.length - present.length;
  if (min === max && missing === 0) return { kind: 'same', minor: min.toString() };
  return { kind: 'mixed', min: min.toString(), max: max.toString(), missing };
}

/**
 * Новая цена из поля: пусто — «не менять» (`null`), иначе основные единицы строкой для `POST /rates/bulk` и
 * тиыны для предпросмотра. Правила те же, что у правки ячейки и API: число, до двух знаков, больше нуля.
 */
export function parseNewPrice(
  input: string,
): null | { price: string; minor: bigint } | { error: string } {
  const value = input.replace(/\s/g, '').replace(',', '.');
  if (!value) return null;
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!m) return { error: 'Введите цену числом' };
  const minor = BigInt(m[1]!) * 100n + BigInt((m[2] ?? '').padEnd(2, '0'));
  if (minor === 0n) return { error: 'Цена не может быть 0' };
  return { price: value, minor };
}
