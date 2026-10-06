/** Остатки продаж используют завершённые назначения, не сохранённый период начислений. */
export function soldDeparture(input: {
  status: string;
  departureDate: string;
  allocationEndDates?: string[];
}): string | null {
  if (input.status === 'CANCELLED' || input.status === 'NO_SHOW') return null;
  if (input.status !== 'CHECKED_OUT' || input.allocationEndDates === undefined)
    return input.departureDate;
  if (!input.allocationEndDates.length) return null;
  const last = input.allocationEndDates.reduce((latest, end) => (end > latest ? end : latest), '');
  return last < input.departureDate ? last : input.departureDate;
}
