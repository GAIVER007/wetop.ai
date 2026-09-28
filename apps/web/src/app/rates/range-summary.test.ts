import { describe, expect, it } from 'vitest';
import type { RateCalendarDay } from '../../lib/api';
import { orderedRange, pricesInRange, summarizePrices } from './range-summary';

const day = (date: string, prices: Record<string, string>): RateCalendarDay => ({
  date,
  prices,
  minStay: null,
  maxStay: null,
  stopSell: false,
  closedToArrival: false,
  closedToDeparture: false,
});

const month = [
  day('2026-10-01', { '1': '800000', '2': '1000000' }),
  day('2026-10-02', { '1': '800000', '2': '1000000' }),
  day('2026-10-03', { '1': '1200000', '2': '1200000' }),
  day('2026-10-04', {}),
];

describe('выбор отрезка в календаре цен (RT2, ADR-111)', () => {
  it('отрезок упорядочен по датам, в какую бы сторону его ни выбрали', () => {
    expect(orderedRange('2026-10-08', '2026-10-01')).toEqual({ from: '2026-10-01', to: '2026-10-08' });
    expect(orderedRange('2026-10-05', null)).toEqual({ from: '2026-10-05', to: '2026-10-05' });
  });

  it('в отрезок попадают ровно дни между краями включительно', () => {
    expect(pricesInRange(month, '2026-10-02', '2026-10-03').map((d) => d.date)).toEqual([
      '2026-10-02',
      '2026-10-03',
    ]);
  });
});

describe('текущая цена отрезка — то, что предпросмотр скажет до сохранения', () => {
  it('у всех дней одна цена — она и есть текущая', () => {
    expect(summarizePrices(month.slice(0, 2), 2)).toEqual({ kind: 'same', minor: '1000000' });
  });

  it('цены разные — «отличаются», с наименьшей и наибольшей', () => {
    expect(summarizePrices(month.slice(0, 3), 2)).toEqual({
      kind: 'mixed',
      min: '1000000',
      max: '1200000',
      missing: 0,
    });
  });

  it('у части дней цены нет — это тоже «отличаются», и сколько дней без цены названо', () => {
    expect(summarizePrices(month.slice(1, 4), 1)).toEqual({
      kind: 'mixed',
      min: '800000',
      max: '1200000',
      missing: 1,
    });
  });

  it('цены нет ни у одного дня — «нет цены»', () => {
    expect(summarizePrices(month.slice(3), 2)).toEqual({ kind: 'none' });
  });

  it('вместимости считаются порознь: у 1 гостя своя цена', () => {
    expect(summarizePrices(month.slice(0, 2), 1)).toEqual({ kind: 'same', minor: '800000' });
  });

  it('суммы сравниваются целыми, а не строками: 9 000 ₸ меньше 10 000 ₸', () => {
    const days = [day('2026-10-01', { '1': '900000' }), day('2026-10-02', { '1': '1000000' })];
    expect(summarizePrices(days, 1)).toMatchObject({ min: '900000', max: '1000000' });
  });
});
