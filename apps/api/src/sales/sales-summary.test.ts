import { describe, expect, it } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { buildSalesSummary, parsePeriod, previousPeriod } from './sales-summary';

describe('хаб «Продажи»: период', () => {
  it('прошлый отрезок той же длины стоит сразу перед текущим', () => {
    expect(previousPeriod('2026-10-08', '2026-10-14')).toEqual({ from: '2026-10-01', to: '2026-10-07' });
    expect(previousPeriod('2026-10-09', '2026-10-09')).toEqual({ from: '2026-10-08', to: '2026-10-08' });
    expect(previousPeriod('2026-03-01', '2026-03-31')).toEqual({ from: '2026-01-29', to: '2026-02-28' });
    expect(previousPeriod('2028-03-01', '2028-03-02')).toEqual({ from: '2028-02-28', to: '2028-02-29' });
  });

  it('период разбирается строго: даты, порядок, не длиннее года', () => {
    expect(parsePeriod('2026-10-01', '2026-10-31')).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    for (const [from, to] of [
      ['2026-13-01', '2026-13-02'],
      ['2026-10-05', '2026-10-01'],
      ['2025-01-01', '2026-10-01'],
      ['', ''],
      [undefined, undefined],
    ] as const)
      expect(() => parsePeriod(from, to)).toThrow(BadRequestException);
  });
});

describe('хаб «Продажи»: сводка', () => {
  const current = { offered: 8, booked: 3, revenueMinor: 90_000_00n, currency: 'KZT' };
  const previous = { offered: 10, booked: 2, revenueMinor: 40_000_00n, currency: 'KZT' };

  it('собирает числа, конверсию в десятых долях процента и деньги строкой', () => {
    const s = buildSalesSummary({
      period: { from: '2026-10-08', to: '2026-10-14' },
      current,
      previous,
      competitors: { count: 5, lastObservedOn: '2026-10-09' },
    });
    expect(s.bookings).toEqual({ current: 3, previous: 2 });
    expect(s.offers).toEqual({ current: 8, previous: 10 });
    expect(s.conversionPermille).toEqual({ current: 375, previous: 200 });
    expect(s.revenue).toEqual({ currentMinor: '9000000', previousMinor: '4000000', currency: 'KZT' });
    expect(s.previousPeriod).toEqual({ from: '2026-10-01', to: '2026-10-07' });
    expect(s.competitors).toEqual({ count: 5, lastObservedOn: '2026-10-09' });
  });

  it('нет предложений: конверсия неизвестна, а не ноль', () => {
    const s = buildSalesSummary({
      period: { from: '2026-10-08', to: '2026-10-14' },
      current: { offered: 0, booked: 0, revenueMinor: 0n, currency: null },
      previous: { offered: 0, booked: 0, revenueMinor: 0n, currency: null },
      competitors: { count: 0, lastObservedOn: null },
    });
    expect(s.conversionPermille).toEqual({ current: null, previous: null });
    expect(s.revenue.currency).toBeNull();
    expect(s.competitors.lastObservedOn).toBeNull();
  });

  it('валюта берётся у отрезка, где она есть', () => {
    const s = buildSalesSummary({
      period: { from: '2026-10-08', to: '2026-10-14' },
      current: { offered: 0, booked: 0, revenueMinor: 0n, currency: null },
      previous,
      competitors: { count: 1, lastObservedOn: null },
    });
    expect(s.revenue.currency).toBe('KZT');
  });
});
