/**
 * Сроки сессий. В коде два входа, пока владелец не выбрал (Q-146), и у них разные сроки — это не
 * случайность и не дубль: вход по одноразовому коду (ADR-046) держит сессию 30 дней, вход по паролю
 * (ADR-049) — смену в 12 часов. Когда способ выберут, лишнее уйдёт вместе со своим входом.
 */

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

export type SessionCheck = { ok: true } | { ok: false; reason: 'expired' | 'revoked' };

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

/**
 * Подпись сеанса для списка «где я вошёл» (§13.5: `user_agent` хранится ради этого списка).
 * Строка агента человеку не читается — называем браузер и систему словами. Это подпись, а не
 * право: ошибиться нестрашно, а незнакомое честно называется незнакомым, без сырой строки.
 */
export function describeUserAgent(userAgent: string | null | undefined): string {
  const ua = userAgent?.trim() ?? '';
  if (!ua) return 'неизвестное устройство';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Firefox\//.test(ua)
      ? 'Firefox'
      : /Chrome\/|CriOS\//.test(ua)
        ? 'Chrome'
        : /Safari\//.test(ua) && /Version\//.test(ua)
          ? 'Safari'
          : null;
  const system = /iPhone/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua)
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android'
        : /Windows/.test(ua)
          ? 'Windows'
          : /Mac OS X|Macintosh/.test(ua)
            ? 'macOS'
            : /Linux/.test(ua)
              ? 'Linux'
              : null;
  if (!browser && !system) return 'неизвестное устройство';
  return [browser ?? 'браузер', system ?? 'неизвестная система'].join(', ');
}

// ─────────── вход по паролю (ADR-049) ───────────

/** Вход по паролю (ADR-049): смена на стойке — 12 часов, потом вход спрашивают заново. */
export const SESSION_HOURS = 12;

export type SessionState = 'active' | 'expired' | 'revoked';

export function sessionExpiry(from: Date): Date {
  return new Date(from.getTime() + SESSION_HOURS * 3_600_000);
}

/** Годна ли сессия. Отзыв («Выйти», смена пароля) сильнее срока: отозванная не пускает и до истечения. */
export function sessionState(
  session: { expiresAt: Date; revokedAt: Date | null },
  now = new Date(),
): SessionState {
  if (session.revokedAt !== null) return 'revoked';
  return session.expiresAt.getTime() > now.getTime() ? 'active' : 'expired';
}
