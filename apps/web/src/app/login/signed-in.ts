import { headers } from 'next/headers';
import { ApiError, authApi, type SignedIn } from '../../lib/api';

/** ADR-055: настройку определяет API. При сбое или старом API регистрация закрыта. */
export async function registrationAvailable(): Promise<boolean> {
  try {
    return (await authApi.options())?.registrationEnabled === true;
  } catch (error) {
    if (error instanceof ApiError || error instanceof SyntaxError) return false;
    throw error;
  }
}

/**
 * Кто вошёл — по cookie стойки, любым из двух входов (Q-146). `null` — куки нет, сессия протухла,
 * отозвана или API отказал: во всех этих случаях человеку показывают форму входа, а не ошибку.
 */
export async function signedInUser(): Promise<SignedIn | null> {
  const me = await authApi.me().catch((error: unknown) => {
    if (error instanceof ApiError) return { user: null };
    throw error;
  });
  return me.user ?? null;
}

/**
 * Почта, под которой пропустил Cloudflare Access (ADR-045). Только для показа и подстановки в поле:
 * права по ней не выдаются — стойка слушает 127.0.0.1, снаружи к ней ведёт лишь туннель, который сам
 * проверяет токен Access.
 */
export async function accessEmail(): Promise<string | null> {
  return (await headers()).get('cf-access-authenticated-user-email')?.trim() || null;
}
