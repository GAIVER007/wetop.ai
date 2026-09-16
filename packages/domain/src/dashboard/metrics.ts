/**
 * Дашборд собственника за период (срез 14, план plans/slice-14-dashboard-2026-09-16.md).
 * Только арифметика над тем, что уже посчитали шахматка и счета — правил здесь нет.
 * Деньги — integer minor units (ADR-008), наружу строки; доли и проценты — с одним знаком после запятой.
 */
import { dateRange } from '../chessboard/build';

export interface DashboardCategoryDay {
  units: number;
  occupied: number;
  free: number;
  blocked: number;
}
/** Сводка шахматки на одну дату: как `Chessboard.summary[date]` и `Chessboard.byCategory[date]` */
export interface DashboardDay {
  date: string;
  occupied: number;
  free: number;
  blocked: number;
  byCategory: Record<string, DashboardCategoryDay>;
}
export interface DashboardStay {
  arrivalDate: string;
  departureDate: string;
  status: string;
  adults: number;
  children: number;
  priceMinor: bigint;
  source: string;
  channel: string | null;
  categoryCode: string;
}
export type DashboardChargeKind = 'ACCOMMODATION' | 'SERVICE' | 'PENALTY' | 'ADJUSTMENT';
export interface DashboardCharge {
  kind: DashboardChargeKind;
  amountMinor: bigint;
  categoryCode: string;
}
export interface DashboardPayment {
  method: string;
  amountMinor: bigint;
}
export interface DashboardInput {
  from: string;
  to: string;
  categories: Array<{ code: string; name: string; units: number }>;
  /** По одной записи на каждую дату периода, в порядке дат */
  days: DashboardDay[];
  /** Проживаний без ячейки, касающихся периода: в загрузку не входят (Q-107) */
  unassigned: number;
  /** Проживания, у которых заезд или выезд попадает в период */
  stays: DashboardStay[];
  /** Начисления без сторно с `service_date` в периоде */
  charges: DashboardCharge[];
  /** Платежи COMPLETED, проведённые в периоде (сутки объекта) */
  payments: DashboardPayment[];
  refundsMinor: bigint;
}

export interface DashboardSource {
  source: string;
  channel: string | null;
  count: number;
  amountMinor: string;
  /** Доля от заездов периода, % */
  share: number;
}
export interface DashboardCategory {
  code: string;
  name: string;
  units: number;
  unitNights: number;
  occupiedNights: number;
  percent: number;
  /** Начислено за проживание по категории */
  revenueMinor: string;
  adrMinor: string | null;
}
export interface DashboardDailyPoint {
  date: string;
  occupied: number;
  free: number;
  blocked: number;
  percent: number;
  arrivals: number;
  departures: number;
}
export interface DashboardPeriod {
  from: string;
  to: string;
  nights: number;
  units: number;
  occupancy: {
    unitNights: number;
    occupiedNights: number;
    blockedNights: number;
    freeNights: number;
    percent: number;
  };
  unassigned: number;
  revenue: {
    accommodationMinor: string;
    servicesMinor: string;
    penaltiesMinor: string;
    adjustmentsMinor: string;
    totalMinor: string;
  };
  payments: {
    totalMinor: string;
    count: number;
    byMethod: Array<{ method: string; count: number; amountMinor: string }>;
  };
  refundsMinor: string;
  /** Средняя цена проданной ночи; null — ночей не было */
  adrMinor: string | null;
  /** Доход на единицу продажи за ночь; null — единиц нет */
  revparMinor: string | null;
  arrivals: { count: number; guests: number; cancelled: number; noShow: number };
  departures: { count: number };
  sources: DashboardSource[];
  categories: DashboardCategory[];
  daily: DashboardDailyPoint[];
}

const inactive = new Set(['CANCELLED', 'NO_SHOW']);
const s = (v: bigint) => v.toString();
/** Проценты с одним знаком после запятой, без float-накопления: считаем в десятых долях */
const percent = (part: number, whole: number) =>
  whole > 0 ? Math.round((part * 1000) / whole) / 10 : 0;
const divide = (amount: bigint, by: number): string | null => (by > 0 ? s(amount / BigInt(by)) : null);

export function buildDashboard(input: DashboardInput): DashboardPeriod {
  const dates = dateRange(input.from, input.to);
  if (input.days.length !== dates.length || input.days.some((d, i) => d.date !== dates[i]))
    throw new Error(
      `buildDashboard: ожидалось ${dates.length} дней ${input.from}…${input.to}, получено ${input.days.length}`,
    );
  const units = input.categories.reduce((n, c) => n + c.units, 0);
  const nights = dates.length;
  const occupiedNights = input.days.reduce((n, d) => n + d.occupied, 0);
  const blockedNights = input.days.reduce((n, d) => n + d.blocked, 0);
  const freeNights = input.days.reduce((n, d) => n + d.free, 0);
  const unitNights = units * nights;

  const byKind = (kind: DashboardChargeKind) =>
    input.charges.filter((c) => c.kind === kind).reduce((a, c) => a + c.amountMinor, 0n);
  const accommodation = byKind('ACCOMMODATION');
  const services = byKind('SERVICE');
  const penalties = byKind('PENALTY');
  const adjustments = byKind('ADJUSTMENT');

  const methods = new Map<string, { count: number; amountMinor: bigint }>();
  for (const p of input.payments) {
    const v = methods.get(p.method) ?? { count: 0, amountMinor: 0n };
    methods.set(p.method, { count: v.count + 1, amountMinor: v.amountMinor + p.amountMinor });
  }
  const byMethod = [...methods]
    .map(([method, v]) => ({ method, count: v.count, amountMinor: v.amountMinor }))
    .sort((a, b) => (a.amountMinor === b.amountMinor ? 0 : a.amountMinor > b.amountMinor ? -1 : 1))
    .map((x) => ({ ...x, amountMinor: s(x.amountMinor) }));
  const paid = input.payments.reduce((a, p) => a + p.amountMinor, 0n);

  const inPeriod = (d: string) => d >= input.from && d <= input.to;
  const arrivalsAll = input.stays.filter((st) => inPeriod(st.arrivalDate));
  const arrivals = arrivalsAll.filter((st) => !inactive.has(st.status));
  const departures = input.stays.filter(
    (st) => inPeriod(st.departureDate) && !inactive.has(st.status),
  );

  const sourceMap = new Map<string, DashboardSource & { amount: bigint }>();
  for (const st of arrivals) {
    const key = `${st.source}|${st.channel ?? ''}`;
    const v = sourceMap.get(key) ?? {
      source: st.source,
      channel: st.channel,
      count: 0,
      amount: 0n,
      amountMinor: '0',
      share: 0,
    };
    sourceMap.set(key, { ...v, count: v.count + 1, amount: v.amount + st.priceMinor });
  }
  const sources = [...sourceMap.values()]
    .sort((a, b) => b.count - a.count || (a.amount === b.amount ? 0 : a.amount > b.amount ? -1 : 1))
    .map(({ amount, ...v }) => ({
      ...v,
      amountMinor: s(amount),
      share: percent(v.count, arrivals.length),
    }));

  const categories = input.categories.map((c): DashboardCategory => {
    const occupied = input.days.reduce((n, d) => n + (d.byCategory[c.code]?.occupied ?? 0), 0);
    const revenue = input.charges
      .filter((ch) => ch.kind === 'ACCOMMODATION' && ch.categoryCode === c.code)
      .reduce((a, ch) => a + ch.amountMinor, 0n);
    const catNights = c.units * nights;
    return {
      code: c.code,
      name: c.name,
      units: c.units,
      unitNights: catNights,
      occupiedNights: occupied,
      percent: percent(occupied, catNights),
      revenueMinor: s(revenue),
      adrMinor: divide(revenue, occupied),
    };
  });

  const daily = input.days.map((d) => ({
    date: d.date,
    occupied: d.occupied,
    free: d.free,
    blocked: d.blocked,
    percent: percent(d.occupied, units),
    arrivals: arrivals.filter((st) => st.arrivalDate === d.date).length,
    departures: departures.filter((st) => st.departureDate === d.date).length,
  }));

  return {
    from: input.from,
    to: input.to,
    nights,
    units,
    occupancy: {
      unitNights,
      occupiedNights,
      blockedNights,
      freeNights,
      percent: percent(occupiedNights, unitNights),
    },
    unassigned: input.unassigned,
    revenue: {
      accommodationMinor: s(accommodation),
      servicesMinor: s(services),
      penaltiesMinor: s(penalties),
      adjustmentsMinor: s(adjustments),
      totalMinor: s(accommodation + services + penalties + adjustments),
    },
    payments: { totalMinor: s(paid), count: input.payments.length, byMethod },
    refundsMinor: s(input.refundsMinor),
    adrMinor: divide(accommodation, occupiedNights),
    revparMinor: divide(accommodation, unitNights),
    arrivals: {
      count: arrivals.length,
      guests: arrivals.reduce((n, st) => n + st.adults + st.children, 0),
      cancelled: arrivalsAll.filter((st) => st.status === 'CANCELLED').length,
      noShow: arrivalsAll.filter((st) => st.status === 'NO_SHOW').length,
    },
    departures: { count: departures.length },
    sources,
    categories,
    daily,
  };
}
