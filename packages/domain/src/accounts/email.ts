/**
 * Почта — логин сотрудника, значит она же ключ: в базе хранится в нижнем регистре без пробелов по краям.
 * Почта и имя сотрудника — персональные данные: настоящие только в базе Казахстана (ADR-018, Q-145).
 */
const SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim().toLowerCase();
  return SHAPE.test(value) ? value : null;
}
