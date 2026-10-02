import type { DashboardPeriod } from '@pms/domain';
type Row = { branch: { currency: string }; stats: Pick<DashboardPeriod, 'occupancy' | 'arrivals' | 'revenue' | 'payments' | 'refundsMinor'> };
export function summarizeBranches(rows: readonly Row[]) {
  const occupied = rows.reduce((n, row) => n + row.stats.occupancy.occupiedNights, 0);
  const capacity = rows.reduce((n, row) => n + row.stats.occupancy.unitNights, 0);
  const guests = rows.reduce((n, row) => n + row.stats.arrivals.guests, 0);
  const currencies = new Map<string, { revenue: bigint; paid: bigint; refunded: bigint }>();
  for (const { branch, stats } of rows) {
    const total = currencies.get(branch.currency) ?? { revenue: 0n, paid: 0n, refunded: 0n };
    total.revenue += BigInt(stats.revenue.totalMinor);
    total.paid += BigInt(stats.payments.totalMinor);
    total.refunded += BigInt(stats.refundsMinor);
    currencies.set(branch.currency, total);
  }
  return { guests, percent: capacity ? Math.round(occupied * 1000 / capacity) / 10 : 0, currencies };
}
