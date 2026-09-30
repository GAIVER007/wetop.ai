import { describe, expect, it } from 'vitest';
import type { DeskDay } from '../../lib/api';
import { checkedInAdults, moneyBarHeight } from './owner-metrics';
describe('owner dashboard semantics', () => {
  it('counts checked in adults once including departing stays, not checked out guests', () => {
    const row = (itemId: string, status: string, adults: number) =>
      ({ itemId, status, adults }) as DeskDay['inHouse'][number];
    expect(
      checkedInAdults({
        inHouse: [row('a', 'CHECKED_IN', 2)],
        departures: [
          row('a', 'CHECKED_IN', 2),
          row('b', 'CHECKED_IN', 3),
          row('c', 'CHECKED_OUT', 8),
        ],
      }),
    ).toBe(5);
  });
  it('scales large integer money without losing precision before ratio', () => {
    expect(moneyBarHeight('50000000000000000001', 100000000000000000002n)).toBe(50);
    expect(moneyBarHeight('0', 0n)).toBe(0);
    expect(moneyBarHeight('-100', 100n)).toBe(0);
  });
});
