import { cookies, headers } from 'next/headers';
import type { AuthClientInfo } from './api';
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, cookieSecure } from './session-cookie';

// имена сохранены: их зовут действия входа, спеки и посредник
export { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, cookieSecure };

/**
 * Сессия стойки (DATA_MODEL §13.5, §13.8; ADR-046 и ADR-049 — Q-146 открыт, оба входа живут рядом).
 * Браузер к API напрямую не ходит: вход, проверка кода и выход идут через серверные действия стойки,
 * а ключ сессии живёт в cookie стойки — `HttpOnly`, чужой скрипт на странице его не прочитает. Имя
 * куки то же, что у API (`wetop_session`): на `.wetop.ai` это одна и та же кука, локально — своя у
 * каждого хоста, и это нормально.
 *
 * Пока `APP_AUTH_REQUIRED` не задан, стойка работает и без входа: иначе сквозные тесты, сторож и
 * демонстрационный режим встали бы разом. Охрану снаружи держит Cloudflare Access (ADR-045).
 */

export const authRequired = () => process.env.APP_AUTH_REQUIRED === '1';

/** Адрес посетителя и его браузер — API считает по ним пределы и список «где я вошёл». Вне запроса — пусто. */
export async function clientInfo(): Promise<AuthClientInfo> {
  try {
    const h = await headers();
    return {
      ip: h.get('cf-connecting-ip')?.trim() || null,
      userAgent: h.get('user-agent')?.trim() || null,
    };
  } catch {
    return { ip: null, userAgent: null };
  }
}

/** Токен из cookie. Вне серверного запроса (сборка, клиент) — null, без исключения. */
export async function sessionToken(): Promise<string | null> {
  try {
    const jar = await cookies();
    return jar.get(SESSION_COOKIE)?.value || null;
  } catch {
    return null;
  }
}

/** Сессия по паролю: срок называет API (`expiresAt`), кука живёт ровно столько же. */
export async function setSessionCookie(token: string, expiresAt: string): Promise<void> {
  const jar = await cookies();
  const expires = new Date(expiresAt);
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: cookieSecure(process.env),
    path: '/',
    expires: Number.isNaN(expires.getTime()) ? undefined : expires,
  });
}

// storeSessionToken снят 20.09.2026 вместе со входом по коду (ADR-053): куку ставит setSessionCookie
// по сроку, который приходит от API вместе с ключом.

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/**
 * 401 от API при включённом замке значит «сессия кончилась»: ведём человека на экран входа. Пока
 * `APP_AUTH_REQUIRED` не задан, ничего не делаем — стойка работает без входа, как до 15.09.2026.
 */
export async function redirectToLoginIfRequired(): Promise<void> {
  if (!authRequired()) return;
  const { redirect } = await import('next/navigation');
  redirect('/login');
}
