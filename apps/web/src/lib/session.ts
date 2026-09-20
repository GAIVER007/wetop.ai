import { cookies, headers } from 'next/headers';
import type { AuthClientInfo } from './api';

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
export const SESSION_COOKIE = 'wetop_session';
/** Срок сессии по коду на почту — 30 суток, как в API (`SESSION_TTL_MS`); по паролю — смена, 12 часов (`expiresAt`). */
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

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

/**
 * `Secure` только по https: по http кука с этим признаком не доедет (Safari на 127.0.0.1 её отбросит,
 * и вход зациклится). Правило одно на стойку и API (`cookie.ts` в API): адрес берётся из `APP_URL`.
 */
export function cookieSecure(env: Record<string, string | undefined>): boolean {
  return env.APP_URL?.trim().startsWith('https://') ?? false;
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

/** Сессия по коду на почту: срок в ответе API не приходит, берём его же умолчание — 30 суток. */
export async function storeSessionToken(token: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: cookieSecure(process.env),
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

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
