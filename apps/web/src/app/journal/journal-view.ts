import type { PropertyClock } from '../../lib/property-time';
import { intlLocale, translator, type DeskLocale, type Translate } from '../../i18n';
import { dateFormat } from '../../i18n/dates';

/**
 * Слова журнала действий (21.09.2026). Дата стояла в каждой строке целиком, с годом, и колонка «Когда»
 * была самой широкой на экране. Теперь день — подзаголовок группы, а в строке остаётся время.
 */

/** «21 сентября», «21 October», «21 қазан»: месяц словами на языке человека, по календарному дню без сдвига пояса */
const dayWords = (day: string, locale: DeskLocale) =>
  dateFormat(intlLocale(locale), { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`));

/** Соседний день по календарю (YYYY-MM-DD); переход через месяц и год считает сам `Date` */
const shiftDay = (day: string, by: number): string =>
  new Date(`${day}T00:00:00Z`).getTime() + by * 86_400_000 > 0
    ? new Date(new Date(`${day}T00:00:00Z`).getTime() + by * 86_400_000).toISOString().slice(0, 10)
    : day;

/**
 * Подпись дня: «Сегодня, 21 сентября», «Вчера, 20 сентября», «18 сентября», «3 января 2025».
 *
 * День считается по часам объекта (`clock.date`, С-13): событие в 20:00 UTC — это уже следующий день в Алматы,
 * и без пересчёта строки уезжали бы в чужую группу. Год пишем только у прошлых лет: «3 января» в журнале
 * за этот год читается однозначно, а через границу года — нет.
 */
export function dayTitle(
  iso: string,
  todayAlmaty: string,
  clock: PropertyClock,
  locale: DeskLocale = 'ru',
  t: Translate = translator(locale),
): string {
  const day = clock.date(iso);
  if (!day) return t('Дата неизвестна');
  const year = Number(day.slice(0, 4));
  const words = dayWords(day, locale);
  if (day === todayAlmaty) return t('Сегодня, {date}', { date: words });
  if (day === shiftDay(todayAlmaty, -1)) return t('Вчера, {date}', { date: words });
  return year === Number(todayAlmaty.slice(0, 4)) ? words : `${words} ${year}`;
}
