import { AccessError } from '../auth/contracts';

export type Shift = {
  id: string;
  name: string;
  week: { weekday: number; intervals: { timeFrom: string; timeTo: string }[] }[];
};
export type StaffRevenue = {
  period: 'day' | 'week' | 'month';
  fromDate: string;
  toDate: string;
  items: {
    employeeId: string | null;
    currency: string;
    paidMinor: string;
    refundedMinor: string;
    netMinor: string;
  }[];
};
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AccessError('invalid');
  return value as Record<string, unknown>;
}
function string(value: unknown): string {
  if (typeof value !== 'string') throw new AccessError('invalid');
  return value;
}
function minor(value: unknown, signed = false): string {
  const result = string(value);
  if (!(signed ? /^-?\d+$/ : /^\d+$/).test(result)) throw new AccessError('invalid');
  return result;
}
function list<T>(value: unknown, read: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) throw new AccessError('invalid');
  return value.map(read);
}
export function readShifts(value: unknown): Shift[] {
  return list(record(value).employees, (entry) => {
    const row = record(entry);
    return {
      id: string(row.id),
      name: string(row.name),
      week: list(row.week, (dayValue) => {
        const day = record(dayValue);
        if (
          !Number.isInteger(day.weekday) ||
          (day.weekday as number) < 0 ||
          (day.weekday as number) > 6
        )
          throw new AccessError('invalid');
        return {
          weekday: day.weekday as number,
          intervals: list(day.intervals, (intervalValue) => {
            const interval = record(intervalValue);
            return { timeFrom: string(interval.timeFrom), timeTo: string(interval.timeTo) };
          }),
        };
      }),
    };
  });
}
export function readStaffRevenue(value: unknown): StaffRevenue {
  const row = record(value);
  if (row.period !== 'day' && row.period !== 'week' && row.period !== 'month')
    throw new AccessError('invalid');
  return {
    period: row.period,
    fromDate: string(row.fromDate),
    toDate: string(row.toDate),
    items: list(row.items, (entry) => {
      const item = record(entry);
      return {
        employeeId: item.employeeId === null ? null : string(item.employeeId),
        currency: string(item.currency),
        paidMinor: minor(item.paidMinor),
        refundedMinor: minor(item.refundedMinor),
        netMinor: minor(item.netMinor, true),
      };
    }),
  };
}
export function teamRows(shifts: Shift[], revenue: StaffRevenue | null) {
  return shifts.map((shift) => ({
    ...shift,
    net: revenue?.items.filter((row) => row.employeeId === shift.id) ?? [],
  }));
}

export function unlistedRevenue(
  shifts: Shift[],
  revenue: StaffRevenue | null,
): { currency: string; netMinor: string }[] {
  if (!revenue) return [];
  const listed = new Set(shifts.map((row) => row.id));
  const sums = new Map<string, bigint>();
  for (const row of revenue.items) {
    if (row.employeeId === null || listed.has(row.employeeId)) continue;
    sums.set(row.currency, (sums.get(row.currency) ?? 0n) + BigInt(row.netMinor));
  }
  return [...sums].map(([currency, value]) => ({ currency, netMinor: value.toString() }));
}
