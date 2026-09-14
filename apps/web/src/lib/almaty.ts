const dayInAlmaty = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Almaty',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Момент события (UTC) → день по часам объекта YYYY-MM-DD; не дата — пустая строка */
export function almatyDate(iso: string): string {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? '' : dayInAlmaty.format(t);
}
