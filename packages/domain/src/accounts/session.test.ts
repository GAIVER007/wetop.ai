import { describe, expect, it } from 'vitest';

import { SESSION_TTL_MS, checkSession, sessionExpiresAt } from './session';

const NOW = new Date('2026-09-16T12:00:00.000Z');

describe('срок сессии', () => {
  it('тридцать дней от выдачи', () => {
    expect(sessionExpiresAt(NOW).toISOString()).toBe('2026-10-16T12:00:00.000Z');
    expect(SESSION_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });
});

describe('жива ли сессия', () => {
  const alive = { expiresAt: new Date('2026-10-16T12:00:00.000Z'), revokedAt: null };

  it('свежая — жива', () => {
    expect(checkSession(alive, NOW)).toEqual({ ok: true });
  });

  it('протухшая — не жива', () => {
    expect(checkSession({ ...alive, expiresAt: new Date('2026-09-16T11:59:59.000Z') }, NOW)).toEqual(
      { ok: false, reason: 'expired' },
    );
  });

  it('ровно в момент истечения уже не жива', () => {
    expect(checkSession({ ...alive, expiresAt: NOW }, NOW)).toEqual({
      ok: false,
      reason: 'expired',
    });
  });

  it('отозванная — не жива, даже если срок ещё не вышел', () => {
    expect(checkSession({ ...alive, revokedAt: new Date('2026-09-16T11:00:00.000Z') }, NOW)).toEqual(
      { ok: false, reason: 'revoked' },
    );
  });

  it('отозванная и протухшая называется отозванной: отзыв — осознанное действие человека', () => {
    expect(
      checkSession(
        {
          expiresAt: new Date('2026-09-01T12:00:00.000Z'),
          revokedAt: new Date('2026-08-30T12:00:00.000Z'),
        },
        NOW,
      ),
    ).toEqual({ ok: false, reason: 'revoked' });
  });
});
