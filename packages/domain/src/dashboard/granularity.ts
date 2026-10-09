/**
 * Дни периода в недели и месяцы (RPT2.2c-2, `docs/metrics.md` §0). Только суммы и проценты из ночей: процент корзины
 * это занятые ночи к сумме ночей (занято, свободно, закрыто), а не среднее дневных процентов. Неделя ISO, с понедельника.
 * Корзины на краях периода, куда попала только часть недели или месяца, помечаются `partial`.
 */
import type { DashboardDailyPoint } from './metrics';

export type DashboardGranularity = 'day' | 'week' | 'month';

export interface DashboardBucket {
  from: string;
  to: string;
  occupied: number;
  free: number;
  blocked: number;
  percent: number;
  arrivals: number;
  departures: number;
  revenueMinor: string;
  /** В корзину вошла не вся неделя или не весь месяц */
  partial: boolean;
}

const DAY_MS = 86_400_000;
const utc = (d: string) => Date.parse(`${d}T00:00:00Z`);
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Начало корзины и её последний день по календарю */
function bounds(date: string, g: DashboardGranularity): { start: string; end: string } {
  if (g === 'day') return { start: date, end: date };
  const t = utc(date);
  if (g === 'week') {
    const back = (new Date(t).getUTCDay() + 6) % 7;
    return { start: iso(t - back * DAY_MS), end: iso(t - back * DAY_MS + 6 * DAY_MS) };
  }
  const d = new Date(t);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  return { start: iso(Date.UTC(y, m, 1)), end: iso(Date.UTC(y, m + 1, 0)) };
}

export function groupDaily(
  daily: DashboardDailyPoint[],
  granularity: DashboardGranularity,
): DashboardBucket[] {
  const out = new Map<string, DashboardBucket & { end: string; start: string }>();
  for (const p of daily) {
    const { start, end } = bounds(p.date, granularity);
    const b = out.get(start) ?? {
      from: p.date,
      to: p.date,
      occupied: 0,
      free: 0,
      blocked: 0,
      percent: 0,
      arrivals: 0,
      departures: 0,
      revenueMinor: '0',
      partial: false,
      start,
      end,
    };
    b.to = p.date;
    b.occupied += p.occupied;
    b.free += p.free;
    b.blocked += p.blocked;
    b.arrivals += p.arrivals;
    b.departures += p.departures;
    b.revenueMinor = (BigInt(b.revenueMinor) + BigInt(p.revenueMinor)).toString();
    out.set(start, b);
  }
  return [...out.values()].map(({ start, end, ...b }) => {
    const nights = b.occupied + b.free + b.blocked;
    return {
      ...b,
      percent: nights > 0 ? Math.round((b.occupied * 1000) / nights) / 10 : 0,
      partial: b.from !== start || b.to !== end,
    };
  });
}
