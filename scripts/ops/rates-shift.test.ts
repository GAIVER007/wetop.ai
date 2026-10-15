import { describe, expect, it } from 'vitest';
// @ts-expect-error — скрипт на чистом JS, типов нет
import { buildPlan, minorToMajor, changeState } from './rates-shift.mjs';

const day = (date: string, prices: Record<string, string>) => ({ date, prices });

describe('rates-shift: план «+N ₸ к каждой цене»', () => {
  it('прибавляет 1 000 ₸ (100 000 тиын) к каждой цене каждой вместимости', () => {
    const plan = buildPlan(
      [
        {
          accommodationTypeCode: 'DBL',
          ratePlanCode: 'BAR',
          days: [day('2026-10-06', { '1': '600000', '2': '800000' })],
        },
      ],
      100_000n,
    );
    expect(plan).toEqual([
      {
        accommodationTypeCode: 'DBL',
        ratePlanCode: 'BAR',
        occupancy: 1,
        dateFrom: '2026-10-06',
        dateTo: '2026-10-06',
        beforeMinor: '600000',
        afterMinor: '700000',
      },
      {
        accommodationTypeCode: 'DBL',
        ratePlanCode: 'BAR',
        occupancy: 2,
        dateFrom: '2026-10-06',
        dateTo: '2026-10-06',
        beforeMinor: '800000',
        afterMinor: '900000',
      },
    ]);
  });

  it('склеивает подряд идущие даты с одной ценой и режет отрезок там, где цена меняется или есть пропуск', () => {
    const plan = buildPlan(
      [
        {
          accommodationTypeCode: 'BED',
          ratePlanCode: 'BAR',
          days: [
            day('2026-10-06', { '1': '600000' }),
            day('2026-10-07', { '1': '600000' }),
            day('2026-10-08', { '1': '650000' }),
            day('2026-10-09', {}),
            day('2026-10-10', { '1': '650000' }),
          ],
        },
      ],
      100_000n,
    );
    expect(plan.map((p: { dateFrom: string; dateTo: string; afterMinor: string }) => [p.dateFrom, p.dateTo, p.afterMinor])).toEqual([
      ['2026-10-06', '2026-10-07', '700000'],
      ['2026-10-08', '2026-10-08', '750000'],
      ['2026-10-10', '2026-10-10', '750000'],
    ]);
  });

  it('тариф без своих цен (производный) в план не попадает', () => {
    expect(
      buildPlan([{ accommodationTypeCode: 'DBL', ratePlanCode: 'PROMO', days: [day('2026-10-06', {})] }], 100_000n),
    ).toEqual([]);
  });

  it('цена в основных единицах для API: 700000 тиын → "7000.00", 45623 → "456.23"', () => {
    expect(minorToMajor(700000n)).toBe('7000.00');
    expect(minorToMajor(45623n)).toBe('456.23');
  });

  it('повторный запуск не прибавляет второй раз: уже «после» — пропуск, чужая цена — стоп', () => {
    const change = { beforeMinor: '600000', afterMinor: '700000' };
    expect(changeState(change, ['600000', '600000'])).toBe('send');
    expect(changeState(change, ['700000', '700000'])).toBe('skip');
    expect(changeState(change, ['600000', '700000'])).toBe('conflict');
    expect(changeState(change, ['650000'])).toBe('conflict');
    expect(changeState(change, [undefined])).toBe('conflict');
  });
});
