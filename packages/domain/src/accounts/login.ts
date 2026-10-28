import { verifyPassword } from './password';

/**
 * Сколько промахов подряд до запрета и на сколько минут. Умолчание шага 1 (ADR-049).
 * С 27.10.2026 (владелец: «поставить защиту от подбора паролей», главного администратора салона запирали чужие ошибки):
 * 5 промахов запирают пару «почта + адрес устройства» (`LoginGuard` в API), учётка целиком запирается только после
 * `ACCOUNT_LOCK_ATTEMPTS` промахов, то есть при подборе с многих адресов.
 */
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;
export const ACCOUNT_LOCK_ATTEMPTS = 20;

export type UserStatus = 'ACTIVE' | 'BLOCKED';

export interface LoginUser {
  status: UserStatus;
  passwordHash: string;
  failedAttempts: number;
  lockedUntil: Date | null;
}

export type LoginOutcome = 'ok' | 'wrong' | 'locked' | 'blocked';

export interface LoginDecision {
  outcome: LoginOutcome;
  failedAttempts: number;
  lockedUntil: Date | null;
  /**
   * Замок истёк: счёт неудач начинается заново. Без этого после 15 минут первая же ошибка снова запирала на 15 минут,
   * и одного запроса раз в 15 минут хватало, чтобы сотрудник не вошёл никогда (аудит 26.09, С-6).
   */
  resetCounter?: boolean;
}

/**
 * Решение о входе по уже проверенному паролю: проверка пароля дорогая и идёт асинхронно у вызывающего (аудит 26.09,
 * С-5), а правила замка — здесь. `evaluateLogin` ниже — та же логика с проверкой пароля на месте.
 */
export function decideLogin({
  user,
  passwordOk,
  now = new Date(),
}: {
  user: Omit<LoginUser, 'passwordHash'>;
  passwordOk: boolean;
  now?: Date;
}): LoginDecision {
  if (user.status !== 'ACTIVE')
    return { outcome: 'blocked', failedAttempts: user.failedAttempts, lockedUntil: user.lockedUntil };

  const locked = user.lockedUntil !== null && user.lockedUntil.getTime() > now.getTime();
  if (locked)
    return { outcome: 'locked', failedAttempts: user.failedAttempts, lockedUntil: user.lockedUntil };

  if (passwordOk) return { outcome: 'ok', failedAttempts: 0, lockedUntil: null };

  const resetCounter = user.lockedUntil !== null;
  const failedAttempts = (resetCounter ? 0 : user.failedAttempts) + 1;
  return {
    outcome: 'wrong',
    failedAttempts,
    lockedUntil:
      failedAttempts >= ACCOUNT_LOCK_ATTEMPTS ? new Date(now.getTime() + LOCK_MINUTES * 60_000) : null,
    resetCounter,
  };
}

/**
 * Решение о входе — чистая функция: ни базы, ни HTTP. Наружу «неверная почта» и «неверный пароль» выглядят
 * одинаково, иначе форма входа рассказывает, какие почты у нас есть.
 */
export function evaluateLogin({
  user,
  password,
  now = new Date(),
}: {
  user: LoginUser;
  password: string;
  now?: Date;
}): LoginDecision {
  const checkable =
    user.status === 'ACTIVE' && !(user.lockedUntil !== null && user.lockedUntil.getTime() > now.getTime());
  const passwordOk =
    checkable && user.passwordHash !== '' && verifyPassword(password, user.passwordHash);
  return decideLogin({ user, passwordOk, now });
}
