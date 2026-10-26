import { describe, it, expect } from 'vitest';
import { topByStation } from './station-top';
describe('station sales ranking', () => {
  it('ranks kitchen and bar by sold quantity without mixing same names', () => {
    const top = topByStation([
      { station: 'KITCHEN', name: 'Сет', qty: 3, price: 100n },
      { station: 'BAR', name: 'Сет', qty: 4, price: 200n },
      { station: 'KITCHEN', name: 'Паста', qty: 8, price: 300n },
    ]);
    expect(top.KITCHEN).toEqual([
      { name: 'Паста', qty: 8, revenueMinor: '2400' },
      { name: 'Сет', qty: 3, revenueMinor: '300' },
    ]);
    expect(top.BAR).toEqual([{ name: 'Сет', qty: 4, revenueMinor: '800' }]);
  });
  it('limits each station independently to three rows', () => {
    const lines = Array.from({ length: 5 }, (_, n) => ({
      station: 'BAR' as const,
      name: `Напиток ${n}`,
      qty: n + 1,
      price: 1n,
    }));
    expect(topByStation(lines).BAR.map((x) => x.qty)).toEqual([5, 4, 3]);
    expect(topByStation(lines).KITCHEN).toEqual([]);
  });
});
