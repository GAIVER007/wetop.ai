/** Срок сессии от входа. Смена на стойке — 12 часов; после этого вход спрашивают заново (умолчание ADR-047). */
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
