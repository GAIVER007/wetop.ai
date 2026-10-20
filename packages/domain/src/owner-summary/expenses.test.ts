import { describe, expect, it } from 'vitest';
import { summarizePaidExpenses, type ExpenseSource } from './expenses';
const source = (overrides: Partial<ExpenseSource> = {}): ExpenseSource => ({
  sourceType: 'RESTAURANT_CASH', sourceId: 'one', locationId: 'branch', kind: 'EXPENSE',
  status: 'COMPLETED', amountMinor: 40000n, currency: 'KZT', categoryId: null, ...overrides,
});
describe('canonical paid expenses', () => {
  it('deduplicates canonical references without adding procurement obligations', () => {
    const result = summarizePaidExpenses('branch', [source(), source()]);
    expect(result.currencies).toEqual([{ currency: 'KZT', paidMinor: '40000', categories: [{ categoryId: null, categoryName: 'Без статьи', paidMinor: '40000' }] }]);
  });
  it('excludes voids, transfers and income and preserves currencies and large integers', () => {
    const result = summarizePaidExpenses('branch', [source(), source({ sourceId: 'usd', currency: 'USD', amountMinor: 9007199254740993n }), source({ sourceId: 'void', status: 'VOIDED' }), source({ sourceId: 'transfer', kind: 'TRANSFER' }), source({ sourceId: 'income', kind: 'INCOME' })]);
    expect(result.currencies.map(r => r.paidMinor)).toEqual(['40000', '9007199254740993']);
  });
  it('rejects conflicting duplicate source data and foreign branches', () => {
    expect(() => summarizePaidExpenses('branch', [source(), source({ amountMinor: 1n })])).toThrow('Conflicting');
    expect(() => summarizePaidExpenses('branch', [source({ locationId: 'foreign' })])).toThrow('scope');
  });
  it('does not assign current property currency to unknown historical cash', () => {
    const result = summarizePaidExpenses('branch', [source({ sourceType: 'HOTEL_CASH', currency: null })]);
    expect(result).toEqual({ state: 'PARTIAL', reason: 'UNKNOWN_SOURCE_CURRENCY', unresolvedSources: 1, currencies: [] });
  });
  it('category classification preserves the total and rejects unsafe monetary inputs', () => {
    const result = summarizePaidExpenses('branch', [source({ categoryId: 'procurement' }), source({ sourceId: 'other', amountMinor: 12n })]);
    expect(result.currencies[0]?.paidMinor).toBe('40012');
    expect(result.currencies[0]?.categories.map(c => c.paidMinor)).toEqual(['12', '40000']);
    expect(() => summarizePaidExpenses('branch', [source({ amountMinor: -1n })])).toThrow('amount');
    expect(() => summarizePaidExpenses('branch', [source({ currency: 'bad' })])).toThrow('currency');
  });
});
