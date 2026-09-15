'use server';
import { redirect } from 'next/navigation';
import { ApiError, authApi } from '../../lib/api';
import { clearSessionCookie, setSessionCookie } from '../../lib/session';

export interface LoginState {
  error: string | null;
}

/**
 * Вход: форма → API → cookie → рабочий день (DATA_MODEL §13.8, ADR-047).
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

export interface ResetRequestState {
  error: string | null;
  sent: boolean;
}

/**
 * «Забыли пароль». Сообщение не говорит, нашлась ли почта: иначе форма рассказывает, кто есть в системе.
 */
export async function requestReset(
  _prev: ResetRequestState,
  form: FormData,
): Promise<ResetRequestState> {
  const email = String(form.get('email') ?? '').trim();
  if (!email) return { error: 'Введите почту', sent: false };
  try {
    await authApi.requestReset({ email });
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message, sent: false };
    throw error;
  }
  return { error: null, sent: true };
}

export interface SetPasswordState {
  error: string | null;
}

/** Пароль по ссылке из письма: человек задаёт его себе сам, ссылка после этого не работает. */
export async function setPassword(
  _prev: SetPasswordState,
  form: FormData,
): Promise<SetPasswordState> {
  const token = String(form.get('token') ?? '');
  const password = String(form.get('password') ?? '');
  const again = String(form.get('again') ?? '');
  if (!token) return { error: 'Ссылка неполная: откройте её из письма целиком' };
  if (password !== again) return { error: 'Пароли не совпадают' };
  try {
    await authApi.confirmReset({ token, password });
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }
  redirect('/login?password=set');
}
