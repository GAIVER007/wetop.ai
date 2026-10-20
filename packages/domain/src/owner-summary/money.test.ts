import { describe, expect, it } from 'vitest';
import { summarizeOwnerMoney } from './money';
describe('canonical owner money', () => {
  it('preserves bigint, separates currencies and deduplicates source grain', () => {
    const row = { sourceType: 'ORDER', sourceId: 'a', amountMinor: 9007199254740993n, currency: 'KZT' };
    expect(summarizeOwnerMoney([row, row, { ...row, sourceType: 'BAR', currency: 'USD', amountMinor: 2n }])).toEqual({ state: 'READY', reason: null, unresolvedSources: 0, currencies: [{ currency: 'KZT', amountMinor: '9007199254740993' }, { currency: 'USD', amountMinor: '2' }] });
  });
  it('does not assign present currency to unknown history or invent zero buckets', () => {
    expect(summarizeOwnerMoney([{ sourceType: 'CASH', sourceId: 'a', amountMinor: 20n, currency: null }])).toEqual({ state: 'PARTIAL', reason: 'UNKNOWN_SOURCE_CURRENCY', unresolvedSources: 1, currencies: [] });
    expect(summarizeOwnerMoney([]).currencies).toEqual([]);
  });
});
