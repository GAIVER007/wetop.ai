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
 * Кто вошёл: по cookie стойки, любым из двух входов (Q-146). null означает подтверждённое отсутствие
 * сессии. Временный отказ API не подтверждает выход и передаётся экрану ошибки с повтором.
 */
export async function signedInUser(): Promise<SignedIn | null> {
  const me = await authApi.me().catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 401) return { user: null };
    throw error;
  });
  return me.user ?? null;
}
