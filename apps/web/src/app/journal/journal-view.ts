import type { PropertyClock } from '../../lib/property-time';

/**
 * Слова журнала действий (21.09.2026). Дата стояла в каждой строке целиком, с годом, и колонка «Когда»
 * была самой широкой на экране. Теперь день — подзаголовок группы, а в строке остаётся время.
 */

const MONTHS = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
] as const;

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
export function dayTitle(iso: string, todayAlmaty: string, clock: PropertyClock): string {
  const day = clock.date(iso);
  if (!day) return 'Дата неизвестна';
  const [year, month, date] = day.split('-').map(Number) as [number, number, number];
  const words = `${date} ${MONTHS[month - 1]}`;
  if (day === todayAlmaty) return `Сегодня, ${words}`;
  if (day === shiftDay(todayAlmaty, -1)) return `Вчера, ${words}`;
  return year === Number(todayAlmaty.slice(0, 4)) ? words : `${words} ${year}`;
}
