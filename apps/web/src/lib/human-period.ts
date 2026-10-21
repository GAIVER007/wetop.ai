/**
 * Период и часовой пояс словами для экранов «Финансы», «Обзор продаж», «История действий», «Настройки»
 * (аудит живого сайта 21.10.2026): «15-21 окт.», «15 окт. - 2 нояб.», «Алматы, UTC+5» вместо «Asia/Almaty».
 * Даты здесь дни (DATE), поэтому формат идёт по UTC и не сдвигается в браузере.
 */
const dayFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', timeZone: 'UTC' });
const dayMonthFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const at = (iso: string) => new Date(`${iso}T12:00:00Z`);
const dayMonth = (iso: string) => dayMonthFmt.format(at(iso));

export function shortPeriod(from: string, to: string): string {
  if (from === to) return dayMonth(from);
  if (from.slice(0, 4) !== to.slice(0, 4)) return `${dayMonth(from)} ${from.slice(0, 4)} - ${dayMonth(to)} ${to.slice(0, 4)}`;
  if (from.slice(0, 7) === to.slice(0, 7)) return `${dayFmt.format(at(from))}-${dayMonth(to)}`;
  return `${dayMonth(from)} - ${dayMonth(to)}`;
}

/** Города поясов, где работают клиенты WETOP; остальные берутся из кода пояса */
const CITY: Record<string, string> = {
  'Asia/Almaty': 'Алматы', // tz-allow: подпись города в словаре, не вычисление времени
  'Asia/Qostanay': 'Костанай',
  'Asia/Aqtobe': 'Актобе',
  'Asia/Aqtau': 'Актау',
  'Asia/Atyrau': 'Атырау',
  'Asia/Oral': 'Уральск',
  'Asia/Qyzylorda': 'Кызылорда',
  'Asia/Tashkent': 'Ташкент',
  'Asia/Bishkek': 'Бишкек',
  'Asia/Dubai': 'Дубай',
  'Asia/Qatar': 'Доха',
  'Asia/Tbilisi': 'Тбилиси',
  'Asia/Yerevan': 'Ереван',
  'Asia/Baku': 'Баку',
  'Europe/Moscow': 'Москва',
  'Europe/Istanbul': 'Стамбул',
  'Europe/Minsk': 'Минск',
};

function offset(timeZone: string): string | null {
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' })
      .formatToParts(new Date())
      .find((p) => p.type === 'timeZoneName')?.value;
    if (!part) return null;
    return part === 'GMT' ? 'UTC' : part.replace('GMT', 'UTC');
  } catch {
    return null;
  }
}

export function zoneLabel(timeZone: string): string {
  if (timeZone === 'UTC' || timeZone === 'Etc/UTC') return 'UTC';
  const city = CITY[timeZone] ?? (timeZone.split('/').at(-1) ?? timeZone).replace(/_/g, ' ');
  const shift = offset(timeZone);
  return shift ? `${city}, ${shift}` : city;
}
