import { verifyPassword } from './password';

/** Сколько промахов подряд до запрета и на сколько минут. Умолчание шага 1 (ADR-047). */
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;

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
  if (user.status !== 'ACTIVE')
    return { outcome: 'blocked', failedAttempts: user.failedAttempts, lockedUntil: user.lockedUntil };

  const locked = user.lockedUntil !== null && user.lockedUntil.getTime() > now.getTime();
  if (locked)
    return { outcome: 'locked', failedAttempts: user.failedAttempts, lockedUntil: user.lockedUntil };

  if (user.passwordHash !== '' && verifyPassword(password, user.passwordHash))
    return { outcome: 'ok', failedAttempts: 0, lockedUntil: null };

  const failedAttempts = user.failedAttempts + 1;
  return {
    outcome: 'wrong',
    failedAttempts,
    lockedUntil:
      failedAttempts >= MAX_FAILED_ATTEMPTS ? new Date(now.getTime() + LOCK_MINUTES * 60_000) : null,
  };
}
