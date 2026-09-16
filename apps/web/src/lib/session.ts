import { cookies } from 'next/headers';

/**
 * Сессия стойки (DATA_MODEL §13.8, ADR-049). Браузер ходит к Next, а Next — к API на 127.0.0.1,
 * поэтому токен живёт здесь, в cookie, недоступной скриптам страницы.
 *
 * Пока `APP_AUTH_REQUIRED` не задан, стойка работает и без входа: иначе сквозные тесты, сторож и
 * демонстрационный режим встали бы разом. Охрану снаружи держит Cloudflare Access (ADR-045).
 */
export const SESSION_COOKIE = 'wetop_session';

export const authRequired = () => process.env.APP_AUTH_REQUIRED === '1';

/** Токен из cookie. Вне серверного запроса (сборка, клиент) — null, без исключения. */
export async function sessionToken(): Promise<string | null> {
  try {
    const jar = await cookies();
    return jar.get(SESSION_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string, expiresAt: string): Promise<void> {
  const jar = await cookies();
  const expires = new Date(expiresAt);
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    // https обязателен снаружи; на 127.0.0.1 в смене и в тестах cookie должна работать и без него
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: Number.isNaN(expires.getTime()) ? undefined : expires,
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
