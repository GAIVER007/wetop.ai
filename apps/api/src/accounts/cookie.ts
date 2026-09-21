/**
 * Кука сессии (DATA_MODEL §13.5). Разбор и сборка вынесены отдельно, чтобы проверять их без HTTP.
 *
 * `HttpOnly` — чужой скрипт на странице ключ не прочитает. Будь ключ в `localStorage`, любая
 * XSS-дыра уносила бы сессию целиком.
 * `Domain=.wetop.ai` — стойка на `app.wetop.ai` и API на `api.wetop.ai` для браузера один сайт,
 * и куки ходят между ними.
 * `SameSite=Lax` — чужой сайт не сможет дёрнуть наш API от имени вошедшего.
 */

export const SESSION_COOKIE = 'wetop_session';

/** Из заголовка `Cookie` достаём только свою. Чужие куки нас не касаются. */
export function sessionFromCookieHeader(header: string | undefined): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE) {
      const value = rest.join('=').trim();
      return value ? decodeURIComponent(value) : null;
    }
  }
  return null;
}

export interface CookieOptions {
  domain?: string;
  secure: boolean;
  maxAgeSeconds: number;
}

/**
 * Домен берём из `APP_URL`, а не зашиваем: на чужой машине и в тестах его нет, и кука
 * должна работать без него (тогда она привязывается к хосту API).
 * Без TLS кука с `Secure` не доедет, поэтому в разработке по http этот признак снимаем.
 */
export function cookieOptions(env: Record<string, string | undefined>, maxAgeSeconds: number): CookieOptions {
  const appUrl = env.APP_URL?.trim();
  const secure = appUrl?.startsWith('https://') ?? false;
  const domain = secure ? cookieDomain(appUrl) : undefined;
  return domain ? { domain, secure, maxAgeSeconds } : { secure, maxAgeSeconds };
}

/** `https://app.wetop.ai` → `.wetop.ai`. Для одноуровневого хоста домен не ставим вовсе. */
function cookieDomain(appUrl: string | undefined): string | undefined {
  if (!appUrl) return undefined;
  let host: string;
  try {
    host = new URL(appUrl).hostname;
  } catch {
    return undefined;
  }
  const parts = host.split('.');
  return parts.length >= 2 ? `.${parts.slice(-2).join('.')}` : undefined;
}
