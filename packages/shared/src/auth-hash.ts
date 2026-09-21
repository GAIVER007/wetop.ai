/**
 * Хэши для входа (срез 13, ADR-046, DATA_MODEL §13): одноразовые коды и ключи сессий хранятся
 * только отпечатком. Утечка базы не должна давать возможности войти.
 *
 * Не простой SHA-256, а HMAC с секретом `SESSION_SECRET`. Причина в длине кода: шестизначных
 * кодов всего миллион, и по голому SHA-256 таблица подбирается за секунды на любом ноутбуке.
 * С HMAC подбор невозможен, пока секрет не утёк вместе с базой, а он живёт в окружении,
 * а не в ней.
 *
 * Это не замена bcrypt для паролей: у нас паролей нет вовсе, а код живёт десять минут и
 * допускает три попытки (`packages/domain/src/accounts/login-code.ts`).
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export class SessionSecretMissingError extends Error {
  override readonly name = 'SessionSecretMissingError';
  constructor() {
    super('SESSION_SECRET не задан в .env — вписывает владелец (openssl rand -hex 32)');
  }
}

function secretFrom(raw: string | undefined): string {
  const v = raw?.trim();
  if (!v) throw new SessionSecretMissingError();
  return v;
}

/** Отпечаток кода или ключа сессии. Шестнадцатеричная строка, 64 символа. */
export function hashSecret(value: string, rawSecret = process.env.SESSION_SECRET): string {
  return createHmac('sha256', secretFrom(rawSecret)).update(value, 'utf8').digest('hex');
}

/**
 * Сравнение за постоянное время. Обычное `===` на строках выходит из цикла на первом
 * несовпавшем символе, и по времени ответа отпечаток подбирается посимвольно.
 */
export function hashEquals(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Ключ сессии: 32 случайных байта в виде, пригодном для заголовка и cookie.
 * Сам ключ уходит человеку и в базе не хранится — там только его отпечаток.
 */
export function newSessionToken(): string {
  return randomBytes(32).toString('base64url');
}
