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

const stampInAlmaty = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Almaty',
  dateStyle: 'short',
  timeStyle: 'short',
});

/**
 * Момент события (UTC) → «2026-09-17 13:30» по часам объекта: для журналов, где важен и год.
 *
 * Пояс берётся из базы часовых поясов, а не сдвигом на пять часов руками: сдвиг верен сегодня,
 * но переживёт перенос сервера и смену правил только случайно.
 */
export function almatyStamp(iso: string): string {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? '—' : stampInAlmaty.format(t);
}

/**
 * Момент события → «20.09 в 16:50» по часам объекта: время внутри фразы, а не столбиком в колонке.
 *
 * Без `Date.now()`: строка одинакова на сервере и в браузере, иначе гидрация расходится под полночь.
 */
export function almatyWhen(iso: string | null | undefined): string {
  const moment = almatyMoment(iso);
  return moment === '—' ? moment : moment.replace(' ', ' в ');
}

const clockInAlmaty = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Asia/Almaty',
  hour: '2-digit',
  minute: '2-digit',
});

/** Момент события → «13:30» по часам объекта: день называет подзаголовок группы, а не каждая строка */
export function almatyClock(iso: string): string {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? '—' : clockInAlmaty.format(t);
}
