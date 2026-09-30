import type { DeskDay } from '../../lib/api';
/** Current checked-in adults, including today's departures, counted once per stay. Not unique guest cards. */
export function checkedInAdults(day: Pick<DeskDay, 'inHouse' | 'departures'>): number {
  const stays = new Map(
    [...day.inHouse, ...day.departures]
      .filter((row) => row.status === 'CHECKED_IN')
      .map((row) => [row.itemId, row]),
  );
  return [...stays.values()].reduce((sum, row) => sum + row.adults, 0);
}
/** Only the final 0..100 chart ratio is converted to Number; money stays integer. */
export function moneyBarHeight(value: string, maximum: bigint): number {
  const amount = BigInt(value);
  return maximum > 0n && amount > 0n ? Number((amount * 10000n) / maximum) / 100 : 0;
}
