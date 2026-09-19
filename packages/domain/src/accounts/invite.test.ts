import { describe, expect, it } from 'vitest';
import {
  INVITE_ALREADY_MEMBER_MESSAGE,
  INVITE_EMAIL_MESSAGE,
  INVITE_INVALID_MESSAGE,
  INVITE_TTL_MS,
  checkInvite,
  inviteExpiresAt,
} from './invite';

/** Срез 13, этап 7: приглашение живёт 7 суток и принимается один раз (DATA_MODEL §13.6). */
describe('invite: срок и проверка', () => {
  const issued = new Date('2026-09-19T10:00:00.000Z');

  it('приглашение действует 7 суток от выдачи', () => {
    expect(INVITE_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
    expect(inviteExpiresAt(issued).toISOString()).toBe('2026-09-26T10:00:00.000Z');
  });

  it('живое и не принятое — годится', () => {
    const stored = { expiresAt: inviteExpiresAt(issued), acceptedAt: null };
    expect(checkInvite(stored, new Date('2026-09-25T10:00:00.000Z'))).toEqual({ ok: true });
  });

  it('в момент истечения и позже — просрочено', () => {
    const stored = { expiresAt: inviteExpiresAt(issued), acceptedAt: null };
    expect(checkInvite(stored, new Date('2026-09-26T10:00:00.000Z'))).toEqual({
      ok: false,
      reason: 'expired',
    });
  });

  it('принятое не принимается второй раз, даже если срок не вышел', () => {
    const stored = {
      expiresAt: inviteExpiresAt(issued),
      acceptedAt: new Date('2026-09-20T10:00:00.000Z'),
    };
    expect(checkInvite(stored, new Date('2026-09-21T10:00:00.000Z'))).toEqual({
      ok: false,
      reason: 'accepted',
    });
  });

  it('тексты для формы и ссылки — словами, без кодов', () => {
    for (const m of [INVITE_EMAIL_MESSAGE, INVITE_ALREADY_MEMBER_MESSAGE, INVITE_INVALID_MESSAGE]) {
      expect(m).toMatch(/[а-я]/);
      expect(m).not.toMatch(/[A-Z_]{4,}/);
    }
  });
});
