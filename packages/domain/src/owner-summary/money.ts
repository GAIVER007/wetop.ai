export type OwnerMoneySource = { sourceType: string; sourceId: string; amountMinor: bigint; currency: string | null };
/** Source grain, never joins to allocation/line cardinality or current location currency. */
export function summarizeOwnerMoney(rows: OwnerMoneySource[]) {
  const seen = new Set<string>(), totals = new Map<string, bigint>();
  let unresolvedSources = 0;
  for (const r of rows) {
    const key = `${r.sourceType}:${r.sourceId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!r.currency || !/^[A-Z]{3}$/.test(r.currency)) { unresolvedSources++; continue; }
    totals.set(r.currency, (totals.get(r.currency) ?? 0n) + r.amountMinor);
  }
  return { state: unresolvedSources ? 'PARTIAL' as const : 'READY' as const, reason: unresolvedSources ? 'UNKNOWN_SOURCE_CURRENCY' as const : null, unresolvedSources, currencies: [...totals].sort(([a], [b]) => a.localeCompare(b)).map(([currency, amount]) => ({ currency, amountMinor: amount.toString() })) };
}
