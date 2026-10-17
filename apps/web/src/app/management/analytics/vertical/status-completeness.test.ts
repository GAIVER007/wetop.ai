import { describe, it, expect } from 'vitest';
import { beautyStatus } from '../../../../lib/status/beauty';
import { BEAUTY_LABELS, beautyPeriod, foodPeriod } from './metrics';
describe('TZ21 canonical Beauty report statuses', () => {
  it('counts every canonical status in one period without changing DONE snapshot revenue', () => {
    const statuses = Object.keys(beautyStatus);
    const rows = statuses.map((status) => ({
      id: status,
      status,
      priceMinor: status === 'DONE' ? '101' : '9007199254740999',
      currency: 'KZT',
    }));
    const result = beautyPeriod(rows);
    expect(Object.keys(BEAUTY_LABELS).sort()).toEqual([...statuses].sort());
    expect(result.counts).toEqual(Object.fromEntries(statuses.map((s) => [s, 1])));
    expect(result.revenue).toEqual({ KZT: '101' });
    expect(BEAUTY_LABELS.IN_PROGRESS).toBe(beautyStatus.IN_PROGRESS.groupLabel);
  });
  it('IN_PROGRESS is a counted in-service record, not DONE or invented revenue', () => {
    expect(
      beautyPeriod([
        { id: 'progress', status: 'IN_PROGRESS', priceMinor: '9007199254740999', currency: 'KZT' },
      ]),
    ).toEqual({
      counts: { BOOKED: 0, CONFIRMED: 0, IN_PROGRESS: 1, DONE: 0, NO_SHOW: 0, CANCELLED: 0 },
      revenue: {},
    });
  });
  it('empty data yields canonical zero counts but malformed states still throw', () => {
    expect(beautyPeriod([])).toEqual({
      counts: Object.fromEntries(Object.keys(beautyStatus).map((s) => [s, 0])),
      revenue: {},
    });
    for (const status of ['UNKNOWN', '__proto__', 'constructor', ''])
      expect(() => beautyPeriod([{ id: 'bad', status, priceMinor: '0', currency: 'KZT' }])).toThrow(
        'Некорректный ответ отчёта',
      );
  });
  it('does not add salon statuses to restaurant counters', () => {
    expect(() => foodPeriod([{ id: 'foreign', status: 'IN_PROGRESS' }])).toThrow();
  });
});
