'use server';
import { redirect } from 'next/navigation';
import { ApiError, authApi } from '../../lib/api';
import { clearSessionCookie, setSessionCookie } from '../../lib/session';

export interface LoginState {
  error: string | null;
}

/**
 * Вход: форма → API → cookie → рабочий день (DATA_MODEL §13 шаг 1, ADR-046).
 * Текст ошибки берём от API как есть: он один и тот же для неверной почты и неверного пароля.
 */
export async function signIn(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');
  if (!email || !password) return { error: 'Введите почту и пароль' };

  try {
    const result = await authApi.login({ email, password });
    await setSessionCookie(result.token, result.expiresAt);
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }
  redirect('/today');
}

/** «Выйти»: сессия отзывается в базе, cookie удаляется. Access — отдельный замок, он остаётся. */
export async function signOut(): Promise<void> {
  await authApi.logout().catch(() => undefined);
  await clearSessionCookie();
  redirect('/login');
}
