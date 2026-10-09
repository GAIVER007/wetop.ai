/**
 * Умолчания валюты и часового пояса для первого экрана: по домену сайта и поясу браузера. Угадываем только то, в чём
 * уверены (список поясов мастера короткий); иначе `null`, и поля остаются как есть. Человек всё равно правит сам.
 */
export interface Regional {
  currency?: string;
  timezone?: string;
}

const BY_TIMEZONE: Record<string, Regional> = {
  'Asia/Almaty': { currency: 'KZT', timezone: 'Asia/Almaty' }, // tz-allow: справочник поясов мастера
  'Asia/Qostanay': { currency: 'KZT', timezone: 'Asia/Almaty' }, // tz-allow: тот же пояс +5
  'Europe/Moscow': { currency: 'RUB', timezone: 'Europe/Moscow' },
  'Asia/Dubai': { timezone: 'Asia/Dubai' },
  UTC: { timezone: 'UTC' },
};

export function guessRegional(siteUrl: string, browserTimezone: string | undefined): Regional | null {
  let host: string;
  try {
    host = new URL(siteUrl).hostname.toLowerCase();
  } catch {
    host = '';
  }
  if (host.endsWith('.kz')) return BY_TIMEZONE['Asia/Almaty'] ?? null;
  if (host.endsWith('.ru')) return BY_TIMEZONE['Europe/Moscow'] ?? null;
  return (browserTimezone && BY_TIMEZONE[browserTimezone]) || null;
}
