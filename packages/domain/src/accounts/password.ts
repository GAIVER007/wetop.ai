import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Пароли сотрудников (DATA_MODEL §13, шаг 1, ADR-046). Считаем `scrypt` из стандартной библиотеки Node:
 * ни одной новой зависимости, одинаково работает на Mac владельца и на сервере, куда PMS переедет.
 * Формат строки в базе: `scrypt$N$r$p$соль$хеш`, соль своя у каждого пользователя.
 *
 * Сам пароль нигде не остаётся: ни в журнале (`audit_logs`), ни в отчётах, ни в `details` неисправностей.
 *
 * Байты здесь не ходят через глобальный `Buffer` намеренно: как только он появляется в пакете домена,
 * TypeScript подтягивает к нему типы Node и ломает DOM-типы в сквозных тестах Playwright (проверено
 * 15.09.2026: пять ошибок в `tests/e2e` и `tests/ui`, которых до того не было). Соль — строка, она же
 * годная соль для scrypt; сравнение идёт по байтам строк, за одинаковое время.
 */
const N = 16_384;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const SALT_BYTES = 16;
const bytes = new TextEncoder();

/** Минимальная длина пароля. Умолчание шага 1: правил сложности владелец не задавал (Q-135). */
export const MIN_PASSWORD_LENGTH = 10;

export type PasswordCheck = { ok: true } | { ok: false; reason: string };

/** Пароль годится к использованию? Проверяется при выдаче и смене, а не при входе. */
export function checkPassword(raw: string): PasswordCheck {
  const value = raw.trim();
  if (value.length < MIN_PASSWORD_LENGTH)
    return { ok: false, reason: `пароль короче ${MIN_PASSWORD_LENGTH} символов` };
  if (/^\d+$/.test(value)) return { ok: false, reason: 'пароль из одних цифр' };
  return { ok: true };
}

const derive = (raw: string, salt: string, cost: { N: number; r: number; p: number }): string =>
  scryptSync(raw.normalize('NFKC'), salt, KEY_LENGTH, cost).toString('base64url');

export function hashPassword(raw: string): string {
  const salt = randomBytes(SALT_BYTES).toString('base64url');
  return `scrypt$${N}$${R}$${P}$${salt}$${derive(raw, salt, { N, r: R, p: P })}`;
}

/** Проверка пароля. Испорченная или чужая строка хеша — это «не пустить», а не исключение. */
export function verifyPassword(raw: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, salt, expected] = parts as [string, string, string, string, string, string];
  const cost = { N: Number(n), r: Number(r), p: Number(p) };
  if (!Number.isInteger(cost.N) || !Number.isInteger(cost.r) || !Number.isInteger(cost.p)) return false;
  if (cost.N < 1024 || cost.r < 1 || cost.p < 1 || salt === '' || expected === '') return false;
  try {
    const actual = derive(raw, salt, cost);
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(bytes.encode(actual), bytes.encode(expected));
  } catch {
    return false;
  }
}

/** Токен сессии: у человека в cookie — сам токен, в базе только его хеш (утечка базы не даёт войти). */
export function newSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
