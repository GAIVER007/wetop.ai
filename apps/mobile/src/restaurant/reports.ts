export type Overview = {
  date: string;
  currency: string;
  tiles: {
    tablesOccupied: number;
    tablesTotal: number;
    ordersCount: number;
    revenueMinor: string;
    kitchenQueue: number;
    kitchenAvgWaitMinutes: number | null;
    staffOnShift: number;
    staffTotal: number;
  };
};
export type Analytics = {
  from: string;
  to: string;
  currency: string;
  ordersCount: number;
  revenueMinor: string;
  averageCheckMinor: string | null;
  payments: { method: string; amountMinor: string; count: number }[];
  topDishes: { name: string; qty: number; revenueMinor: string }[];
  topByStation: {
    KITCHEN: { name: string; qty: number; revenueMinor: string }[];
    BAR: { name: string; qty: number; revenueMinor: string }[];
  };
  revenueByDay: { date: string; revenueMinor: string; orders: number }[];
  waiters: { name: string; orders: number; revenueMinor: string }[];
};
import { AccessError } from '../auth/contracts';
function obj(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new AccessError('invalid');
  return v as Record<string, unknown>;
}
function str(v: unknown): string {
  if (typeof v !== 'string') throw new AccessError('invalid');
  return v;
}
function number(v: unknown): number {
  if (!Number.isSafeInteger(v) || (v as number) < 0) throw new AccessError('invalid');
  return v as number;
}
function minor(v: unknown): string {
  const s = str(v);
  if (!/^\d+$/.test(s)) throw new AccessError('invalid');
  return s;
}
function rows<T>(v: unknown, read: (v: unknown) => T): T[] {
  if (!Array.isArray(v)) throw new AccessError('invalid');
  return v.map(read);
}
export function readOverview(value: unknown): Overview {
  const v = obj(value),
    t = obj(v.tiles);
  return {
    date: str(v.date),
    currency: str(v.currency),
    tiles: {
      tablesOccupied: number(t.tablesOccupied),
      tablesTotal: number(t.tablesTotal),
      ordersCount: number(t.ordersCount),
      revenueMinor: minor(t.revenueMinor),
      kitchenQueue: number(t.kitchenQueue),
      kitchenAvgWaitMinutes:
        t.kitchenAvgWaitMinutes === null ? null : number(t.kitchenAvgWaitMinutes),
      staffOnShift: number(t.staffOnShift),
      staffTotal: number(t.staffTotal),
    },
  };
}
export function readAnalytics(value: unknown): Analytics {
  const v = obj(value);
  return {
    from: str(v.from),
    to: str(v.to),
    currency: str(v.currency),
    ordersCount: number(v.ordersCount),
    revenueMinor: minor(v.revenueMinor),
    averageCheckMinor: v.averageCheckMinor === null ? null : minor(v.averageCheckMinor),
    payments: rows(v.payments, (value) => {
      const r = obj(value);
      return { method: str(r.method), amountMinor: minor(r.amountMinor), count: number(r.count) };
    }),
    topDishes: rows(v.topDishes, (value) => {
      const r = obj(value);
      return { name: str(r.name), qty: number(r.qty), revenueMinor: minor(r.revenueMinor) };
    }),
    topByStation: {
      KITCHEN: rows(obj(v.topByStation).KITCHEN, (value) => {
        const r = obj(value);
        return { name: str(r.name), qty: number(r.qty), revenueMinor: minor(r.revenueMinor) };
      }),
      BAR: rows(obj(v.topByStation).BAR, (value) => {
        const r = obj(value);
        return { name: str(r.name), qty: number(r.qty), revenueMinor: minor(r.revenueMinor) };
      }),
    },
    revenueByDay: rows(v.revenueByDay, (value) => {
      const r = obj(value);
      return { date: str(r.date), revenueMinor: minor(r.revenueMinor), orders: number(r.orders) };
    }),
    waiters: rows(v.waiters, (value) => {
      const r = obj(value);
      return { name: str(r.name), orders: number(r.orders), revenueMinor: minor(r.revenueMinor) };
    }),
  };
}
export function localDate(time: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(time);
  const get = (part: string) => parts.find((p) => p.type === part)?.value;
  if (!get('year') || !get('month') || !get('day')) throw new AccessError('invalid');
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function weeklyRevenue(
  days: Analytics['revenueByDay'],
): { from: string; to: string; revenueMinor: string; orders: number }[] {
  const weeks = new Map<
    string,
    { from: string; to: string; revenueMinor: bigint; orders: number }
  >();
  for (const day of days) {
    const date = new Date(`${day.date}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
    const monday = date.toISOString().slice(0, 10);
    const week = weeks.get(monday) ?? { from: day.date, to: day.date, revenueMinor: 0n, orders: 0 };
    if (day.date < week.from) week.from = day.date;
    if (day.date > week.to) week.to = day.date;
    week.revenueMinor += BigInt(day.revenueMinor);
    week.orders += day.orders;
    weeks.set(monday, week);
  }
  return [...weeks.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, week]) => ({
      from: week.from,
      to: week.to,
      revenueMinor: week.revenueMinor.toString(),
      orders: week.orders,
    }));
}
