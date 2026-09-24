import { describe, expect, it } from 'vitest';
import { priceRuns, restrictionRuns } from './rate-history';

/**
 * SECURITY.md §6: правка цены и ограничений пишется в журнал с `before`. Массовая правка на год даёт тысячи строк —
 * в журнал они ложатся диапазонами: подряд идущие дни с одним значением сворачиваются в один.
 */
describe('priceRuns', () => {
  it('подряд идущие дни с одной ценой — один диапазон; разрыв в датах или другая цена — новый', () => {
    const rows = [
      { date: '2026-11-01', occupancy: 1, priceMinor: '1540000' },
      { date: '2026-11-02', occupancy: 1, priceMinor: '1540000' },
      { date: '2026-11-03', occupancy: 1, priceMinor: '1600000' },
      { date: '2026-11-05', occupancy: 1, priceMinor: '1600000' },
      { date: '2026-11-01', occupancy: 2, priceMinor: '2000000' },
      { date: '2026-11-02', occupancy: 2, priceMinor: '2000000' },
    ];
    expect(priceRuns([...rows].reverse())).toEqual([
      { occupancy: 1, from: '2026-11-01', to: '2026-11-02', priceMinor: '1540000' },
      { occupancy: 1, from: '2026-11-03', to: '2026-11-03', priceMinor: '1600000' },
      { occupancy: 1, from: '2026-11-05', to: '2026-11-05', priceMinor: '1600000' },
      { occupancy: 2, from: '2026-11-01', to: '2026-11-02', priceMinor: '2000000' },
    ]);
  });

  it('пусто — пусто', () => {
    expect(priceRuns([])).toEqual([]);
  });
});

describe('restrictionRuns', () => {
  it('одинаковые ограничения подряд — один диапазон', () => {
    const base = { minStay: 2, maxStay: null, stopSell: false, closedToArrival: false, closedToDeparture: false };
    expect(
      restrictionRuns([
        { date: '2026-12-30', ...base },
        { date: '2026-12-31', ...base },
        { date: '2027-01-01', ...base, stopSell: true },
      ]),
    ).toEqual([
      { from: '2026-12-30', to: '2026-12-31', ...base },
      { from: '2027-01-01', to: '2027-01-01', ...base, stopSell: true },
    ]);
  });
});
