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
 * Кто вошёл, по cookie стойки, любым из двух входов (Q-146). `null`: куки нет, сессия протухла,
 * отозвана. Временный отказ API остаётся ошибкой и не превращается в выход из сессии.
 */
export async function signedInUser(): Promise<SignedIn | null> {
  const me = await authApi.me().catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 401) return { user: null };
    throw error;
  });
  return me.user ?? null;
}
