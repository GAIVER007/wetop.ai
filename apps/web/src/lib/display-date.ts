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
