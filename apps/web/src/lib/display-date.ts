const shortDate = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'short',
});
const fullDate = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'long',
  weekday: 'long',
  year: 'numeric',
});

/** Только представление stay DATE; UTC фиксирован, чтобы день не сдвигался в браузере. */
export function displayDate(value: string, style: 'short' | 'full' = 'short'): string {
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return value;
  return (style === 'full' ? fullDate : shortDate).format(date);
}
