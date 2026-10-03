import { describe, expect, it } from 'vitest';
import type { PropertyClock } from '../../lib/property-time';
import { reconciliationView } from './format';

/** «Сверка с каналом» на обзоре каналов (X3, ADR-143) */
const clock = {
  moment: (iso: string) => `[${iso.slice(11, 16)}]`,
  full: (iso: string) => iso,
} as unknown as PropertyClock;
const NOW = Date.parse('2026-10-03T12:00:00Z');

describe('сверка остатков с каналом словами', () => {
  it('нет данных у старого API — не «всё хорошо»', () => {
    expect(reconciliationView(undefined, clock, NOW)).toMatchObject({
      tone: 'muted',
      value: 'нет данных',
    });
  });
  it('сверки ещё не было', () => {
    expect(reconciliationView({ lastCheckedAt: null, mismatch: null }, clock, NOW)).toMatchObject({
      tone: 'muted',
      value: 'ещё не было',
    });
  });
  it('свежая сверка без расхождений', () => {
    expect(
      reconciliationView({ lastCheckedAt: '2026-10-03T03:00:00Z', mismatch: null }, clock, NOW),
    ).toEqual({ tone: 'ok', value: 'расхождений нет', sub: 'проверено [03:00]' });
  });
  it('сверка старше 36 часов — повод посмотреть', () => {
    expect(
      reconciliationView({ lastCheckedAt: '2026-10-01T03:00:00Z', mismatch: null }, clock, NOW),
    ).toMatchObject({ tone: 'warn', value: 'давно не было' });
  });
  it('расхождение важнее давности; ночи склоняются', () => {
    const r = reconciliationView(
      {
        lastCheckedAt: '2026-10-03T03:00:00Z',
        mismatch: { since: '2026-10-03T03:00:05Z', nights: 2 },
      },
      clock,
      NOW,
    );
    expect(r).toMatchObject({ tone: 'danger', value: 'расхождение: 2 ночи' });
    expect(r.sub).toContain('канал видит больше мест');
    expect(
      reconciliationView(
        { lastCheckedAt: null, mismatch: { since: '2026-10-03T03:00:05Z', nights: 5 } },
        clock,
        NOW,
      ).value,
    ).toBe('расхождение: 5 ночей');
  });
});
