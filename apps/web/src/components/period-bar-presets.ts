import type { PeriodPreset } from './period-picker';

const shift = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);

/** Готовые отрезки отчётов: сегодня, вчера, 7 и 30 дней, заканчивающиеся сегодня (по часам филиала). */
export function reportPresets(
  today: string,
  from: string,
  to: string,
  href: (from: string, to: string) => string,
): PeriodPreset[] {
  const ranges: Array<[string, string, string]> = [
    ['Сегодня', today, today],
    ['Вчера', shift(today, -1), shift(today, -1)],
    ['7 дней', shift(today, -6), today],
    ['30 дней', shift(today, -29), today],
  ];
  return ranges.map(([label, f, t]) => ({
    label,
    href: href(f, t),
    selected: f === from && t === to,
  }));
}
