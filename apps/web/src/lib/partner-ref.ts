/**
 * Ссылка партнёра WETOP (DATA_MODEL §63.3): `/start?p=P001&ch=instagram` кладёт код и канал в куку `wetop_partner` на
 * 30 дней и ведёт на регистрацию. Регистрация читает куку и шлёт код в API, которое само проверит партнёра. Кука не
 * секрет и не право: неизвестный код API молча игнорирует.
 */
export const PARTNER_COOKIE = 'wetop_partner';
export const PARTNER_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

/** Код `P` и цифры, иначе null */
export function partnerCodeOf(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const v = input.trim().toUpperCase();
  return /^P\d{1,9}$/.test(v) ? v : null;
}

/** Канал: латиница, цифры, `-`, `_`, до 30 символов, иначе null */
export function partnerChannelOf(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const v = input.trim().toLowerCase();
  return /^[a-z0-9_-]{1,30}$/.test(v) ? v : null;
}

/** Значение куки `P001` или `P001:instagram` */
export function partnerCookieValue(code: string, channel: string | null): string {
  return channel ? `${code}:${channel}` : code;
}

/** Из значения куки: код и канал, иначе null */
export function readPartnerCookie(value: string | undefined | null): { partnerCode: string; partnerChannel?: string } | null {
  if (!value) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }
  const [rawCode, rawChannel] = decoded.split(':');
  const code = partnerCodeOf(rawCode);
  if (!code) return null;
  const channel = partnerChannelOf(rawChannel);
  return channel ? { partnerCode: code, partnerChannel: channel } : { partnerCode: code };
}
