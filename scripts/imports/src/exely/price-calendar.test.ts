import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseExelyPriceCalendar } from './price-calendar';

const json = JSON.parse(
  readFileSync(new URL('./__fixtures__/price-calendar.json', import.meta.url), 'utf-8'),
) as unknown;

describe('parseExelyPriceCalendar', () => {
  it('expands RLE series into one DailyRate row per date × tariff × category × occupancy, money in minor units', () => {
    const plan = parseExelyPriceCalendar(json);
    expect(plan.period).toEqual({ from: '2026-01-01', to: '2026-01-05' });
    expect(plan.tariffs).toEqual([
      { exelyId: '800001', name: 'Тестовый базовый', currency: 'KZT', parentExelyId: null },
      {
        exelyId: '800002',
        name: 'Тестовый для ОТА +35%',
        currency: 'USD',
        parentExelyId: '800001',
      },
    ]);
    // 800001: 900001 ×5 (occ 1) + 900002 ×5 (occ 1) + ×5 (occ 2); 800002: 900001 ×2 (3 дня без цены — строк нет)
    expect(plan.dailyRates).toHaveLength(5 + 5 + 5 + 2);
    const single = plan.dailyRates.filter(
      (r) => r.ratePlanExelyId === '800001' && r.accommodationTypeExelyId === '900001',
    );
    expect(single.map((r) => r.date)).toEqual([
      '2026-01-01',
      '2026-01-02',
      '2026-01-03',
      '2026-01-04',
      '2026-01-05',
    ]);
    expect(single.every((r) => r.occupancy === 1 && r.priceMinor === 1_100_000n)).toBe(true);
    const double1 = plan.dailyRates.filter(
      (r) => r.accommodationTypeExelyId === '900002' && r.occupancy === 1,
    );
    expect(double1.map((r) => r.priceMinor)).toEqual([
      1_500_000n,
      1_500_000n,
      1_500_000n,
      1_600_050n,
      1_600_050n,
    ]);
    expect(
      plan.dailyRates.filter((r) => r.accommodationTypeExelyId === '900002' && r.occupancy === 2),
    ).toHaveLength(5);
    const usd = plan.dailyRates.filter((r) => r.ratePlanExelyId === '800002');
    expect(usd.map((r) => [r.date, r.priceMinor])).toEqual([
      ['2026-01-01', 3_700n],
      ['2026-01-02', 3_700n],
    ]);
  });

  it('emits Restriction rows only for dates that have at least one restriction', () => {
    const plan = parseExelyPriceCalendar(json);
    // 900002/800001: MinLOS=2 все 5 дней, StopSell дни 4–5, CTA день 5
    expect(plan.restrictions).toHaveLength(5);
    expect(
      plan.restrictions.map((r) => [r.date, r.minStay, r.stopSell, r.closedToArrival]),
    ).toEqual([
      ['2026-01-01', 2, false, false],
      ['2026-01-02', 2, false, false],
      ['2026-01-03', 2, false, false],
      ['2026-01-04', 2, true, false],
      ['2026-01-05', 2, true, true],
    ]);
    expect(
      plan.restrictions.every((r) => r.maxStay === null && r.closedToDeparture === false),
    ).toBe(true);
  });

  it('rejects a series whose day count does not match daysCount', () => {
    const broken = structuredClone(json) as {
      tariffs: Array<{ roomTypes: Array<{ placements: Array<{ prices: unknown }> }> }>;
    };
    broken.tariffs[0]!.roomTypes[0]!.placements[0]!.prices = [['11000', 4]];
    expect(() => parseExelyPriceCalendar(broken)).toThrow(/800001.*900001.*4.*5/);
  });

  it('rejects an unknown placement name instead of guessing occupancy', () => {
    const broken = structuredClone(json) as {
      tariffs: Array<{ roomTypes: Array<{ placements: Array<{ name: string }> }> }>;
    };
    broken.tariffs[0]!.roomTypes[0]!.placements[0]!.name = '1 доп.';
    expect(() => parseExelyPriceCalendar(broken)).toThrow(/1 доп\./);
  });
});
