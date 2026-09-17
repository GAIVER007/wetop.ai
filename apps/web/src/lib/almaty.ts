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

const momentInAlmaty = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Asia/Almaty',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * Момент события (UTC) → «17.09 10:12» по часам объекта (DESIGN.md §14).
 *
 * Сырой ISO из базы — это UTC: стойка читает «05:12» как своё время и ошибается на пять часов.
 */
export function almatyMoment(iso: string | null | undefined): string {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isNaN(t) ? '—' : momentInAlmaty.format(t).replace(',', '');
}
