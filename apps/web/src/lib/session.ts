import { cookies, headers } from 'next/headers';
import { ApiError, authApi, type AuthClientInfo, type AuthSession } from './api';

/**
 * Сессия вошедшего на стороне стойки (срез 13, DATA_MODEL §13.5).
 *
 * Браузер к API напрямую не ходит: вход, проверка кода и выход идут через серверные действия
 * стойки, а ключ сессии живёт в куке стойки — `HttpOnly`, чужой скрипт на странице его не
 * прочитает. Имя куки то же, что у API (`wetop_session`): на `.wetop.ai` это одна и та же кука,
 * локально — своя у каждого хоста, и это нормально.
 */
export const SESSION_COOKIE = 'wetop_session';
/** 30 суток — как срок сессии в API (`SESSION_TTL_MS`). */
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/** Адрес посетителя и его браузер — API считает по ним пределы и список «где я вошёл». */
export async function clientInfo(): Promise<AuthClientInfo> {
  const h = await headers();
  return {
    ip: h.get('cf-connecting-ip')?.trim() || null,
    userAgent: h.get('user-agent')?.trim() || null,
  };
}

export async function sessionToken(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE)?.value || null;
}

/**
 * Кто вошёл. `null` — куки нет, сессия протухла, отозвана или API недоступен: во всех этих
 * случаях человеку показывают форму входа, а не ошибку.
 */
export async function currentSession(): Promise<AuthSession | null> {
  const token = await sessionToken();
  if (!token) return null;
  try {
    return await authApi.me(token, await clientInfo());
  } catch (e) {
    if (e instanceof ApiError) return null;
    throw e;
  }
}

/** `Secure` только по https: по http кука с этим признаком не доедет (см. `cookie.ts` в API). */
export function cookieSecure(env: Record<string, string | undefined>): boolean {
  return env.APP_URL?.trim().startsWith('https://') ?? false;
}

export async function storeSessionToken(token: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: cookieSecure(process.env),
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function forgetSessionToken(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
