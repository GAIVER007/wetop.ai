import { describe, expect, it } from 'vitest';
import { TRIAL_DAYS, canWrite, daysLeft, statusAfterTrial, trialEndsAt, writeBlocked } from './trial';

const t = (iso: string) => new Date(iso);

describe('trialEndsAt', () => {
  it('семь суток от создания (решение владельца 17.10.2026, ADR-TRIAL-7-DAYS-20261017)', () => {
    expect(trialEndsAt(t('2026-09-15T12:00:00Z')).toISOString()).toBe('2026-09-22T12:00:00.000Z');
    expect(TRIAL_DAYS).toBe(7);
  });
  it('ровно 7 × 24 часа в UTC: переход через полночь Алматы и конец месяца не сдвигают срок', () => {
    expect(trialEndsAt(t('2026-10-28T19:30:00Z')).toISOString()).toBe('2026-11-04T19:30:00.000Z');
  });
});

describe('daysLeft', () => {
  it('в первый день показывает семь, а не шесть с хвостом', () => {
    expect(daysLeft(t('2026-09-22T12:00:00Z'), t('2026-09-15T12:00:00Z'))).toBe(7);
  });
  it('за час до конца показывает один день, а не ноль', () => {
    expect(daysLeft(t('2026-09-22T12:00:00Z'), t('2026-09-22T11:00:00Z'))).toBe(1);
  });
  it('новый срок: сразу после регистрации семь дней, в момент конца ноль', () => {
    const start = t('2026-10-17T08:00:00Z');
    const end = trialEndsAt(start);
    expect(daysLeft(end, start)).toBe(7);
    expect(daysLeft(end, new Date(end.getTime() - 1))).toBe(1);
    expect(daysLeft(end, end)).toBe(0);
  });
  it('после конца — ноль, отрицательных дней не бывает', () => {
    expect(daysLeft(t('2026-09-22T12:00:00Z'), t('2026-09-25T00:00:00Z'))).toBe(0);
  });
});

describe('canWrite', () => {
  const end = t('2026-09-22T12:00:00Z');
  it('в пробном периоде писать можно', () => {
    expect(canWrite('TRIAL', end, t('2026-09-20T00:00:00Z'))).toBe(true);
  });
  it('после конца пробного периода писать нельзя', () => {
    expect(canWrite('TRIAL', end, t('2026-09-23T00:00:00Z'))).toBe(false);
  });
  it('граница: за миллисекунду до конца писать можно, в момент конца и после уже нельзя', () => {
    expect(canWrite('TRIAL', end, new Date(end.getTime() - 1))).toBe(true);
    expect(canWrite('TRIAL', end, end)).toBe(false);
    expect(canWrite('TRIAL', end, new Date(end.getTime() + 1))).toBe(false);
    expect(statusAfterTrial('TRIAL', end, end)).toBe('READ_ONLY');
  });
  it('оплаченная организация пишет и после конца пробного срока', () => {
    expect(canWrite('ACTIVE', end, t('2027-01-01T00:00:00Z'))).toBe(true);
  });
  it('TRIAL без срока не даёт писать: пустое поле это не бессрочный доступ', () => {
    expect(canWrite('TRIAL', null, t('2026-09-20T00:00:00Z'))).toBe(false);
  });
  it('ACTIVE пишет всегда, READ_ONLY и SUSPENDED не пишут никогда', () => {
    expect(canWrite('ACTIVE', null, t('2030-01-01T00:00:00Z'))).toBe(true);
    expect(canWrite('READ_ONLY', end, t('2026-09-16T00:00:00Z'))).toBe(false);
    expect(canWrite('SUSPENDED', end, t('2026-09-16T00:00:00Z'))).toBe(false);
  });
});

describe('statusAfterTrial', () => {
  const end = t('2026-09-22T12:00:00Z');
  it('срок вышел — только чтение, данные остаются', () => {
    expect(statusAfterTrial('TRIAL', end, t('2026-09-23T00:00:00Z'))).toBe('READ_ONLY');
  });
  it('срок не вышел — остаётся TRIAL', () => {
    expect(statusAfterTrial('TRIAL', end, t('2026-09-20T00:00:00Z'))).toBe('TRIAL');
  });
  it('оплаченную организацию пробный период не трогает', () => {
    expect(statusAfterTrial('ACTIVE', null, t('2030-01-01T00:00:00Z'))).toBe('ACTIVE');
  });
});

/**
 * «Только чтение» после пробного периода (Q-144 — Б, ADR-102): видит всё, менять не может до оплаты; вход не закрыт.
 */
describe('writeBlocked', () => {
  const end = t('2026-09-29T12:00:00Z');
  const after = t('2026-09-30T00:00:00Z');
  const expired = { status: 'TRIAL' as const, trialEndsAt: end };
  const base = { path: '/hotel/reservations', organization: expired, platformAdmin: false, now: after };

  it('срок вышел — запись закрыта, чтение открыто', () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) expect(writeBlocked({ ...base, method })).toBe(true);
    for (const method of ['GET', 'HEAD', 'OPTIONS']) expect(writeBlocked({ ...base, method })).toBe(false);
  });

  it('в срок и после оплаты — пишет', () => {
    expect(writeBlocked({ ...base, method: 'POST', now: t('2026-09-20T00:00:00Z') })).toBe(false);
    expect(writeBlocked({ ...base, method: 'POST', organization: { status: 'ACTIVE', trialEndsAt: end } })).toBe(false);
  });

  it('READ_ONLY, выставленный руками, закрывает запись и без срока', () => {
    expect(writeBlocked({ ...base, method: 'POST', organization: { status: 'READ_ONLY', trialEndsAt: null } })).toBe(true);
  });

  it('выход, смена пароля и вход не блокируются — иначе человек застрянет', () => {
    for (const path of ['/auth/logout', '/auth/password', '/auth/login']) {
      expect(writeBlocked({ ...base, method: 'POST', path })).toBe(false);
    }
  });

  it('главному администратору «Платформа» открыта — он и подтверждает оплату', () => {
    expect(writeBlocked({ ...base, method: 'PUT', path: '/platform/organizations/x/status', platformAdmin: true })).toBe(false);
    expect(writeBlocked({ ...base, method: 'PUT', path: '/platform/organizations/x/status' })).toBe(true);
  });

  it('организации в сессии нет — правило молчит, решает замок входа', () => {
    expect(writeBlocked({ ...base, method: 'POST', organization: null })).toBe(false);
  });
});
