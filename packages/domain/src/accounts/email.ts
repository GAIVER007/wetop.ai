/**
 * Почта — логин сотрудника, значит она же ключ: в базе в нижнем регистре и без пробелов по краям.
 * Почта и имя сотрудника — персональные данные: настоящие только в базе Казахстана (ADR-018, Q-145).
 *
 * 16.09.2026 приведение и проверку писали дважды в двух сессиях (вход по паролю и вход по коду).
 * Осталось одно приведение — `normalizeEmail`; оно и `isEmailShaped` переехали сюда 20.09.2026 из
 * снятого модуля `login-code` (ADR-053): к коду на почту они отношения не имели. `validEmail` рядом —
 * ответ на вопрос «это вообще почта»: `null` удобнее там, где непригодный ввод просто игнорируется.
 */
export function validEmail(raw: string | null | undefined): string | null {
  const value = normalizeEmail(raw ?? '');
  return isEmailShaped(value) ? value : null;
}

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
