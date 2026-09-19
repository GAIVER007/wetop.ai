/**
 * Приглашение в организацию (срез 13, этап 7; DATA_MODEL §13.6; ролей нет — ADR-023).
 *
 * Вошедший зовёт человека по почте. Письмо несёт ссылку с ключом; в базе лежит только отпечаток
 * ключа (`token_hash`), как у кодов и сессий. Ссылка живёт 7 суток и принимается один раз.
 * Принятие заводит человека и его членство и высылает обычный код для входа: второго пути входа
 * приглашение не создаёт, а ссылка на 7 суток сама по себе сессией не становится — это слишком
 * долгоживущий ключ для такого права.
 */

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function inviteExpiresAt(issuedAt: Date): Date {
  return new Date(issuedAt.getTime() + INVITE_TTL_MS);
}

export interface StoredInvite {
  expiresAt: Date;
  acceptedAt: Date | null;
}

export type InviteCheck = { ok: true } | { ok: false; reason: 'expired' | 'accepted' };

/** Принятое — не принимается снова; в момент истечения — уже просрочено. */
export function checkInvite(stored: StoredInvite, now: Date): InviteCheck {
  if (stored.acceptedAt !== null) return { ok: false, reason: 'accepted' };
  if (now.getTime() >= stored.expiresAt.getTime()) return { ok: false, reason: 'expired' };
  return { ok: true };
}

/** Тексты. Про ввод говорим прямо; про чужую или мёртвую ссылку — одной фразой, без подробностей. */
export const INVITE_EMAIL_MESSAGE = 'Укажите почту человека, которого приглашаете.';
export const INVITE_ALREADY_MEMBER_MESSAGE = 'Этот человек уже в организации.';
export const INVITE_INVALID_MESSAGE = 'Приглашение не найдено, уже принято или его срок истёк.';
