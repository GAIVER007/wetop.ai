export type ExpenseSource = {
  sourceType: 'HOTEL_CASH' | 'RESTAURANT_CASH';
  sourceId: string;
  locationId: string;
  kind: string;
  status: string;
  amountMinor: bigint;
  /** Null means historical currency has not been proven, not current branch currency. */
  currency: string | null;
  /** Document category, then explicit mapping, otherwise null. */
  categoryId: string | null;
  /** Current persisted label, including archived categories, not a historical snapshot. */
  categoryName?: string;
};
export type PaidExpenses = {
  state: 'READY' | 'PARTIAL';
  reason: 'UNKNOWN_SOURCE_CURRENCY' | null;
  unresolvedSources: number;
  currencies: Array<{ currency: string; paidMinor: string; categories: Array<{ categoryId: string | null; categoryName: string; paidMinor: string }> }>;
};
/** Input grain is one cash operation. Documents, receipts and budgets are never monetary inputs. */
export function summarizePaidExpenses(locationId: string, sources: readonly ExpenseSource[]): PaidExpenses {
  if (!locationId) throw new Error('Missing expense scope');
  const unique = new Map<string, ExpenseSource>();
  const totals = new Map<string, Map<string | null, bigint>>();
  let unresolvedSources = 0;
  for (const row of sources) {
    if (row.locationId !== locationId) throw new Error('Expense scope mismatch');
    if (typeof row.amountMinor !== 'bigint' || row.amountMinor <= 0n) throw new Error('Invalid expense amount');
    if (row.currency !== null && !/^[A-Z]{3}$/.test(row.currency)) throw new Error('Invalid expense currency');
    const key = `${row.sourceType}:${row.sourceId}`;
    const previous = unique.get(key);
    if (previous) {
      if (Object.keys(row).some(k => row[k as keyof ExpenseSource] !== previous[k as keyof ExpenseSource]))
        throw new Error('Conflicting expense source');
      continue;
    }
    unique.set(key, row);
    if (row.kind !== 'EXPENSE' || row.status !== 'COMPLETED') continue;
    if (row.currency === null) { unresolvedSources++; continue; }
    const categories = totals.get(row.currency) ?? new Map<string | null, bigint>();
    categories.set(row.categoryId, (categories.get(row.categoryId) ?? 0n) + row.amountMinor);
    totals.set(row.currency, categories);
  }
  return {
    state: unresolvedSources ? 'PARTIAL' : 'READY',
    reason: unresolvedSources ? 'UNKNOWN_SOURCE_CURRENCY' : null,
    unresolvedSources,
    currencies: [...totals].sort(([a], [b]) => a.localeCompare(b)).map(([currency, categories]) => ({
      currency,
      paidMinor: [...categories.values()].reduce((a, b) => a + b, 0n).toString(),
      categories: [...categories].sort(([a], [b]) => (a ?? '').localeCompare(b ?? '')).map(([categoryId, amount]) => ({ categoryId, categoryName: categoryId === null ? 'Без статьи' : [...unique.values()].find(r => r.categoryId === categoryId)?.categoryName ?? 'Без статьи', paidMinor: amount.toString() })),
    })),
  };
}
