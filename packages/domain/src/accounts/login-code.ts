/**
 * Вход по одноразовому коду (срез 13, ADR-046, DATA_MODEL §13).
 *
 * Здесь только правила: как выглядит код, сколько живёт, когда годен, когда сгорел. Ни базы, ни HTTP,
 * ни отправки почты — этот файл должен читаться и проверяться без них.
 *
 * Почему без паролей: нечего хранить, нечего восстанавливать, нечему утечь. Цена — код живёт минуты,
 * поэтому правила его жизни должны быть в одном месте и покрыты тестами, а не размазаны по контроллеру.
 */

/** Шесть цифр: меньше — подбирается, больше — не переписать с телефона на слух. */
export const CODE_LENGTH = 6;
/** Десять минут: письмо успевает дойти, украденный код успевает протухнуть. */
export const CODE_TTL_MS = 10 * 60 * 1000;
/** Три попытки на код. Четвёртой нет: база это тоже проверяет (CHECK в миграции). */
export const MAX_ATTEMPTS = 3;
/** Лимиты запроса кода: на почту и на адрес. Срез 9 считает посетителя так же. */
export const MAX_CODES_PER_EMAIL_PER_HOUR = 5;
export const MAX_CODES_PER_IP_PER_HOUR = 20;

/** Почта хранится и сравнивается в нижнем регистре: иначе один человек заведёт два аккаунта. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Проверка почты нарочно мягкая: строгие регулярки отсекают живые адреса, а настоящая проверка —
 * письмо, которое дошло. Отсекаем только то, что письмом заведомо не является.
 */
export function isEmailShaped(raw: string): boolean {
  const email = normalizeEmail(raw);
  if (email.length < 6 || email.length > 320) return false;
  if (/\s/.test(email)) return false;
  const at = email.indexOf('@');
  if (at < 1 || at !== email.lastIndexOf('@')) return false;
  const domain = email.slice(at + 1);
  if (!domain.includes('.') || domain.startsWith('.') || domain.endsWith('.')) return false;
  return true;
}

/** Код как строка, чтобы не потерять ведущие нули: 004217 это не 4217. */
export function formatCode(value: number): string {
  return String(value % 10 ** CODE_LENGTH).padStart(CODE_LENGTH, '0');
}

export function isCodeShaped(raw: string): boolean {
  return new RegExp(`^\\d{${CODE_LENGTH}}$`).test(raw.trim());
}

export function expiresAt(issuedAt: Date): Date {
  return new Date(issuedAt.getTime() + CODE_TTL_MS);
}

export type StoredCode = {
  expiresAt: Date;
  attempts: number;
  usedAt: Date | null;
};

export type CodeCheck =
  | { ok: true }
  | { ok: false; reason: 'expired' | 'used' | 'too_many_attempts' | 'mismatch' };

/**
 * Одно место, где решается, годен ли код. Порядок причин важен: сгоревший код не должен сообщать,
 * угадал ли звонящий цифры.
 */
export function checkCode(stored: StoredCode, matches: boolean, now: Date): CodeCheck {
  if (stored.usedAt) return { ok: false, reason: 'used' };
  if (now >= stored.expiresAt) return { ok: false, reason: 'expired' };
  if (stored.attempts >= MAX_ATTEMPTS) return { ok: false, reason: 'too_many_attempts' };
  if (!matches) return { ok: false, reason: 'mismatch' };
  return { ok: true };
}

/**
 * Ответ человеку одинаков для «нет такого кода», «сгорел», «исчерпаны попытки» и «не совпал»: иначе
 * форма входа превращается в справочник о том, какие почты у нас заведены и какие коды ещё живы.
 */
export const CODE_REJECTED_MESSAGE = 'Код не подошёл. Запросите новый.';
