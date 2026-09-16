import { isEmailShaped, normalizeEmail } from './login-code';

/**
 * Почта — логин сотрудника, значит она же ключ: в базе в нижнем регистре и без пробелов по краям.
 * Почта и имя сотрудника — персональные данные: настоящие только в базе Казахстана (ADR-018, Q-145).
 *
 * 16.09.2026 приведение и проверку писали дважды в двух сессиях (вход по паролю и вход по коду).
 * Осталось одно приведение — `normalizeEmail` из `login-code`; здесь только ответ на вопрос
 * «это вообще почта»: `null` вместо адреса удобнее там, где непригодный ввод просто игнорируется.
 */
export function validEmail(raw: string | null | undefined): string | null {
  const value = normalizeEmail(raw ?? '');
  return isEmailShaped(value) ? value : null;
}
