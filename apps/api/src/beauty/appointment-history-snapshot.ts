type StoredLineValues = Readonly<{
  employeeId: string;
  serviceId: string;
  startsAt: Date;
  endsAt: Date;
  basePriceMinor: bigint;
  discountMinor: bigint;
  surchargeMinor: bigint;
  priceMinor: bigint;
  discountPercent: number | null;
  currency: string;
}>;

/** Audit only: serialize already accepted/stored values, never reprice from current catalog.
 * IDs identify the historical entities; scoped readers resolve current display names separately.
 * Excludes notes, customer details and raw request input.
 */
export function appointmentLineHistorySnapshot(line: StoredLineValues, position: number) {
  return {
    position,
    employeeId: line.employeeId,
    serviceId: line.serviceId,
    startsAt: line.startsAt.toISOString(),
    endsAt: line.endsAt.toISOString(),
    basePriceMinor: line.basePriceMinor.toString(),
    discountMinor: line.discountMinor.toString(),
    surchargeMinor: line.surchargeMinor.toString(),
    priceMinor: line.priceMinor.toString(),
    discountPercent: line.discountPercent,
    currency: line.currency,
  };
}
