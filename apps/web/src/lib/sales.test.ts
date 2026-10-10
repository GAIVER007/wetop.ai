import { describe, expect, it } from 'vitest';
import type { SalesSummary } from './api';
import { competitorsFreshness, conversionText, countDelta, moneyDelta, salesPeriod } from './sales';

const base: SalesSummary = {
  period: { from: '2026-10-08', to: '2026-10-14' },
  previousPeriod: { from: '2026-10-01', to: '2026-10-07' },
  bookings: { current: 3, previous: 2 },
  offers: { current: 8, previous: 10 },
  conversionPermille: { current: 375, previous: 200 },
  revenue: { currentMinor: '9000000', previousMinor: '4000000', currency: 'KZT' },
  competitors: { count: 5, lastObservedOn: '2026-10-09', addedLast30: 2 },
};

describe('хаб «Продажи»: слова и сравнения', () => {
  it('изменение числа: к прошлому отрезку; нулевая база и неизвестное сравнения не дают', () => {
    expect(countDelta(3, 2)).toMatchObject({ direction: 'up' });
    expect(countDelta(1, 2)).toMatchObject({ direction: 'down' });
    expect(countDelta(2, 2)).toMatchObject({ direction: 'flat' });
    expect(countDelta(3, 0)).toMatchObject({ direction: null });
  });

  it('изменение денег считается по минорным единицам строкой', () => {
    expect(moneyDelta('9000000', '4000000')).toMatchObject({ direction: 'up', text: '+125 %' });
    expect(moneyDelta('0', '0')).toMatchObject({ direction: null });
  });

  it('конверсия: проценты с десятой долей; неизвестная это знак пропуска, а не 0 %', () => {
    expect(conversionText(375)).toBe('37,5 %');
    expect(conversionText(1000)).toBe('100 %');
    expect(conversionText(0)).toBe('0 %');
    expect(conversionText(null)).toBeNull();
  });

  it('свежесть данных конкурентов: когда обновлялись и пора ли предупредить', () => {
    expect(competitorsFreshness(base.competitors, '2026-10-09')).toEqual({ state: 'fresh', ageDays: 0 });
    expect(competitorsFreshness(base.competitors, '2026-10-14')).toEqual({ state: 'stale', ageDays: 5 });
    expect(competitorsFreshness({ count: 3, lastObservedOn: null, addedLast30: 0 }, '2026-10-14')).toEqual({ state: 'none', ageDays: null });
    expect(competitorsFreshness({ count: 0, lastObservedOn: null, addedLast30: 0 }, '2026-10-14')).toEqual({ state: 'empty', ageDays: null });
  });

  it('период хаба: готовые отрезки, неверный адрес возвращается к 30 дням', () => {
    expect(salesPeriod({}, '2026-10-09')).toEqual({ from: '2026-09-10', to: '2026-10-09', preset: '30' });
    expect(salesPeriod({ days: '7' }, '2026-10-09')).toEqual({ from: '2026-10-03', to: '2026-10-09', preset: '7' });
    expect(salesPeriod({ from: '2026-10-01', to: '2026-10-05' }, '2026-10-09')).toEqual({
      from: '2026-10-01',
      to: '2026-10-05',
      preset: 'custom',
    });
    expect(salesPeriod({ from: 'мусор', to: '2026-10-05' }, '2026-10-09').preset).toBe('30');
    expect(salesPeriod({ from: '2026-10-09', to: '2026-10-01' }, '2026-10-09').preset).toBe('30');
    // несуществующие даты по форме похожи на настоящие, но периодом не считаются
    expect(salesPeriod({ from: '2026-02-30', to: '2026-03-05' }, '2026-10-09').preset).toBe('30');
    expect(salesPeriod({ from: '2026-13-01', to: '2026-13-05' }, '2026-10-09').preset).toBe('30');
  });
});
