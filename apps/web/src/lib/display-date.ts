const shortDate = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'short',
});
/** §14: основной формат даты — 20.09.2026; «20 сент.» — только в таблицах и на плашках */
const numericDate = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'UTC',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
const fullDate = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'long',
  weekday: 'long',
  year: 'numeric',
});

/** Только представление stay DATE; UTC фиксирован, чтобы день не сдвигался в браузере. */
export function displayDate(value: string, style: 'short' | 'full' | 'numeric' = 'short'): string {
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return value;
  return (style === 'full' ? fullDate : style === 'numeric' ? numericDate : shortDate).format(date);
}

const dd = (value: string) => value.slice(8, 10);
const mm = (value: string) => value.slice(5, 7);
const yyyy = (value: string) => value.slice(0, 4);
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** `14.09.2026` — привычный формат даты документа (DESIGN.md §14). */
export function displayDay(value: string): string {
  return ISO.test(value) ? `${dd(value)}.${mm(value)}.${yyyy(value)}` : value;
}

/**
 * Период по DESIGN.md §14: `14.09 → 17.09.2026`, год один раз, если совпадает; иначе `28.12.2026 → 02.01.2027`.
 * Стрелка читается как «с… по…».
 */
export function displayPeriod(from: string, to: string): string {
  if (!ISO.test(from) || !ISO.test(to)) return `${from} → ${to}`;
  const sameYear = yyyy(from) === yyyy(to);
  return `${dd(from)}.${mm(from)}${sameYear ? '' : `.${yyyy(from)}`} → ${displayDay(to)}`;
}
