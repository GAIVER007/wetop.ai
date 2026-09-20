import { describe, expect, it } from 'vitest';
import { SESSION_TTL_MS, shouldRenewSession } from './session';

/**
 * Продление сессии при работе (§13.5: «30 суток, продление при активности»). Сдвигать срок на
 * каждой странице нельзя — это запись в базу на каждый показ экрана; сдвигаем не чаще раза в сутки.
 */
const NOW = new Date('2026-09-20T10:00:00.000Z');
const inDays = (d: number) => new Date(NOW.getTime() + d * 86_400_000);

describe('shouldRenewSession', () => {
  it('сессия открыта только что — продлевать нечего', () => {
    expect(shouldRenewSession(new Date(NOW.getTime() + SESSION_TTL_MS), NOW)).toBe(false);
  });

  it('в тот же день работы срок не трогаем', () => {
    expect(shouldRenewSession(inDays(29.5), NOW)).toBe(false);
  });

  it('прошли сутки — срок сдвигается', () => {
    expect(shouldRenewSession(inDays(29), NOW)).toBe(true);
    expect(shouldRenewSession(inDays(1), NOW)).toBe(true);
  });

  it('свой срок у сессии другой длины: смена по паролю 12 часов не продлевается по правилу 30 суток', () => {
    const shift = 12 * 3_600_000;
    expect(shouldRenewSession(new Date(NOW.getTime() + shift), NOW, shift)).toBe(false);
  });
});
