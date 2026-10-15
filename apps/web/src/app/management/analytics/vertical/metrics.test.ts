import { describe, expect, it } from 'vitest';
import { periodDates, beautyPeriod, foodPeriod, moneyText } from './metrics';
const beauty = (id: string, status: string, priceMinor = '100', currency = 'KZT') => ({
  id,
  status,
  priceMinor,
  currency,
});
describe('MV9 period reconciliation', () => {
  it('sums only DONE price snapshots without floating point or currency conversion', () => {
    const result = beautyPeriod([
      beauty('a', 'DONE', '9007199254740993'),
      beauty('b', 'DONE', '7'),
      beauty('c', 'BOOKED', '100000'),
      beauty('d', 'DONE', '300', 'USD'),
      beauty('e', 'NO_SHOW'),
      beauty('f', 'CANCELLED'),
    ]);
    expect(result.counts).toEqual({ BOOKED: 1, CONFIRMED: 0, DONE: 3, NO_SHOW: 1, CANCELLED: 1 });
    expect(result.revenue).toEqual({ KZT: '9007199254741000', USD: '300' });
  });
  it('does not silently double count duplicate records or accept unknown statuses', () => {
    expect(() => beautyPeriod([beauty('a', 'DONE'), beauty('a', 'DONE')])).toThrow();
    expect(() => beautyPeriod([beauty('a', 'UNKNOWN')])).toThrow();
    expect(() => beautyPeriod([beauty('a', 'DONE', '12.5')])).toThrow();
    expect(() => beautyPeriod([beauty('a', 'DONE', '-1')])).toThrow();
  });
  it('restaurant counters do not invent financial values', () => {
    expect(
      foodPeriod([
        { id: 'a', status: 'SEATED' },
        { id: 'b', status: 'COMPLETED' },
      ]),
    ).toEqual({ BOOKED: 0, CONFIRMED: 0, SEATED: 1, COMPLETED: 1, CANCELLED: 0, NO_SHOW: 0 });
  });
  it('enumerates valid local dates over DST and leap days, rejects impossible or excessive periods', () => {
    expect(periodDates('2026-03-28', '2026-03-30')).toEqual([
      '2026-03-28',
      '2026-03-29',
      '2026-03-30',
    ]);
    expect(periodDates('2028-02-28', '2028-03-01')).toHaveLength(3);
    for (const [a, b] of [
      ['2026-02-30', '2026-03-01'],
      ['2026-10-08', '2026-10-07'],
      ['2026-01-01', '2026-12-31'],
    ])
      expect(() => periodDates(a!, b!)).toThrow();
  });
  it('formats exact money including currencies with different minor units', () => {
    expect(moneyText('9007199254741000', 'KZT').replace(/\s/g, '')).toBe('90071992547410,00KZT');
    expect(moneyText('-123', 'KZT').replace(/\s/g, '')).toBe('-1,23KZT');
    expect(moneyText('123', 'JPY').replace(/\s/g, '')).toBe('123JPY');
    expect(moneyText('1234', 'KWD').replace(/\s/g, '')).toBe('1,234KWD');
  });
});
