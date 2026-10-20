/**
 * «Сколько принёс сотрудник» (решение владельца 20.10.2026, docs/decisions/2026-10-20-personnel-revenue.md):
 * оплачено минус возвраты за день, неделю (с понедельника) или месяц по часам филиала. Деньги только BigInt в тиынах.
 */
import { localDate, zonedStartOfDay } from './web-analytics/metrics';

export const REVENUE_PERIODS = ['day', 'week', 'month'] as const;
export type RevenuePeriod = (typeof REVENUE_PERIODS)[number];

export function parseRevenuePeriod(value: unknown): RevenuePeriod {
  if (value === undefined || value === '') return 'day';
  if (typeof value === 'string' && (REVENUE_PERIODS as readonly string[]).includes(value)) return value as RevenuePeriod;
  throw new RangeError('Период: day, week или month');
}

const DAY = 86_400_000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const at = (date: string) => Date.parse(`${date}T00:00:00Z`);

/** Окно периода: календарные даты филиала и полуинтервал моментов UTC [from, toExclusive) */
export function revenueWindow(period: RevenuePeriod, now: Date, timezone: string) {
  const today = localDate(now, timezone);
  let fromDate = today;
  let toDate = today;
  if (period === 'week') {
    const weekday = (new Date(at(today)).getUTCDay() + 6) % 7; // 0 = понедельник
    fromDate = iso(at(today) - weekday * DAY);
    toDate = iso(at(fromDate) + 6 * DAY);
  } else if (period === 'month') {
    const [y, m] = today.split('-').map(Number) as [number, number];
    fromDate = `${today.slice(0, 7)}-01`;
    toDate = iso(Date.UTC(y, m, 1) - DAY);
  }
  return {
    fromDate,
    toDate,
    from: zonedStartOfDay(fromDate, timezone),
    toExclusive: zonedStartOfDay(iso(at(toDate) + DAY), timezone),
  };
}

/**
 * Прошлый период для сравнения на плитках «Персонала»: та же доля периода, а не весь (четверг этой недели против
 * понедельника по четверг прошлой, 22-е число против 1–22 прошлого месяца, сегодня против вчера до того же часа).
 * `fromDate`/`toDate` показывают весь прошлый период для подписи; окно денег обрезано до того же момента.
 */
export function previousRevenueWindow(period: RevenuePeriod, now: Date, timezone: string) {
  const current = revenueWindow(period, now, timezone);
  const prevDay = iso(at(current.fromDate) - DAY);
  const previous = revenueWindow(period, zonedStartOfDay(prevDay, timezone), timezone);
  const elapsed = Math.max(0, now.getTime() - current.from.getTime());
  const cut = Math.min(previous.from.getTime() + elapsed, previous.toExclusive.getTime());
  return { ...previous, toExclusive: new Date(cut) };
}

/** Итоги периода по валютам: оплачено, возвраты, чистые деньги; валюты не смешиваются */
export function revenueTotals(entries: readonly RevenueEntry[]) {
  const map = new Map<string, { paid: bigint; refunded: bigint }>();
  for (const e of entries) {
    const row = map.get(e.currency) ?? { paid: 0n, refunded: 0n };
    row.paid += e.paidMinor;
    row.refunded += e.refundedMinor;
    map.set(e.currency, row);
  }
  return [...map].map(([currency, r]) => ({
    currency,
    paidMinor: r.paid.toString(),
    refundedMinor: r.refunded.toString(),
    netMinor: (r.paid - r.refunded).toString(),
  }));
}

/**
 * Деление суммы по весам (цене услуг мастеров в записи) в целых тиынах: сумма долей равна сумме,
 * остаток раздают крупнейшим остаткам, при равенстве первым по порядку. Нулевые веса: поровну.
 */
export function splitByWeights(amount: bigint, weights: readonly bigint[]): bigint[] {
  if (weights.length === 0) throw new RangeError('Не на кого делить');
  if (weights.some((w) => w < 0n)) throw new RangeError('Вес не может быть отрицательным');
  const total = weights.reduce((a, b) => a + b, 0n);
  const w = total === 0n ? weights.map(() => 1n) : weights;
  const sum = total === 0n ? BigInt(weights.length) : total;
  const sign = amount < 0n ? -1n : 1n;
  const abs = amount * sign;
  const base = w.map((x) => (abs * x) / sum);
  const rest = w.map((x, i) => ({ i, r: (abs * x) % sum }));
  let left = abs - base.reduce((a, b) => a + b, 0n);
  rest.sort((a, b) => (b.r > a.r ? 1 : b.r < a.r ? -1 : a.i - b.i));
  for (const { i } of rest) {
    if (left === 0n) break;
    base[i]! += 1n;
    left -= 1n;
  }
  return base.map((x) => x * sign);
}

export interface RevenueEntry {
  /** null: деньги без сотрудника (заказ без официанта, бронь из канала или сайта) */
  employeeId: string | null;
  currency: string;
  paidMinor: bigint;
  refundedMinor: bigint;
}
export interface RevenueRow {
  employeeId: string | null;
  currency: string;
  paidMinor: string;
  refundedMinor: string;
  netMinor: string;
}

/** Свод: по сотруднику и валюте, валюты не смешиваются; внутри валюты по убыванию, «без сотрудника» последним */
export function revenueSummary(entries: readonly RevenueEntry[]): RevenueRow[] {
  const map = new Map<string, { employeeId: string | null; currency: string; paid: bigint; refunded: bigint }>();
  const currencies: string[] = [];
  for (const e of entries) {
    if (!currencies.includes(e.currency)) currencies.push(e.currency);
    const key = `${e.currency}\u0000${e.employeeId ?? ''}`;
    const row = map.get(key) ?? { employeeId: e.employeeId, currency: e.currency, paid: 0n, refunded: 0n };
    row.paid += e.paidMinor;
    row.refunded += e.refundedMinor;
    map.set(key, row);
  }
  return currencies.flatMap((currency) =>
    [...map.values()]
      .filter((r) => r.currency === currency)
      .sort((a, b) => {
        if ((a.employeeId === null) !== (b.employeeId === null)) return a.employeeId === null ? 1 : -1;
        const d = b.paid - b.refunded - (a.paid - a.refunded);
        return d > 0n ? 1 : d < 0n ? -1 : (a.employeeId ?? '').localeCompare(b.employeeId ?? '');
      })
      .map((r) => ({
        employeeId: r.employeeId,
        currency: r.currency,
        paidMinor: r.paid.toString(),
        refundedMinor: r.refunded.toString(),
        netMinor: (r.paid - r.refunded).toString(),
      })),
  );
}
