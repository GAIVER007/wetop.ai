/**
 * Сессия входа (срез 13, ADR-046, DATA_MODEL §13). Чистые правила: ни базы, ни HTTP.
 *
 * Сам ключ сессии здесь не рождается и не проверяется — это забота `@pms/shared/auth-hash`.
 * Здесь только сроки и ответ на вопрос «эта сессия ещё жива».
 */

/**
 * Тридцать дней. Стойка работает круглосуточно и посменно; заставлять администратора входить
 * заново каждую неделю — это не безопасность, а повод записать код на бумажке под клавиатурой.
 * Досрочно сессия обрывается выходом или отзывом (`revokedAt`).
 */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function sessionExpiresAt(issuedAt: Date): Date {
  return new Date(issuedAt.getTime() + SESSION_TTL_MS);
}

export interface StoredSession {
  expiresAt: Date;
  revokedAt: Date | null;
}

export type SessionCheck =
  | { ok: true }
  | { ok: false; reason: 'expired' | 'revoked' };

/**
 * Порядок важен: отозванную и заодно протухшую сессию называем отозванной. Отзыв — это
 * осознанное действие человека (вышел, или доступ забрали), и в журнале честнее видеть его,
 * а не «истёк срок».
 */
export function checkSession(stored: StoredSession, now: Date): SessionCheck {
  if (stored.revokedAt !== null) return { ok: false, reason: 'revoked' };
  if (stored.expiresAt.getTime() <= now.getTime()) return { ok: false, reason: 'expired' };
  return { ok: true };
}

/**
 * Что показать человеку, у которого сессия кончилась. Причину не различаем: «вас отозвали»
 * и «срок вышел» для того, кто стоит у стойки, — одно и то же действие, войти заново.
 */
export const SESSION_ENDED_MESSAGE = 'Сеанс закончился. Войдите заново.';
