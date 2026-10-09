/**
 * Дашборд собственника за период (срез 14, план plans/slice-14-dashboard-2026-09-16.md).
 * Только арифметика над тем, что уже посчитали шахматка и счета — правил здесь нет.
 * Деньги — integer minor units (ADR-008), наружу строки; доли и проценты — с одним знаком после запятой.
 */
import { dateRange } from '../chessboard/build';

/** Тип фонда (Аналитика v2, AN1): номер и койку в одну среднюю цену не смешиваем (ТЗ §6) */
export type DashboardFund = 'all' | 'rooms' | 'beds';
export const DASHBOARD_FUNDS: readonly DashboardFund[] = ['all', 'rooms', 'beds'];
/** Единица продажи категории — как `InventoryUnit.kind`: номер или койка (ADR-013) */
export type DashboardUnitKind = 'ROOM' | 'BED';
const FUND_KIND: Record<Exclude<DashboardFund, 'all'>, DashboardUnitKind> = {
  rooms: 'ROOM',
  beds: 'BED',
};

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
  /** Статус проживания (места) */
  status: string;
  /** Бронь, которой принадлежит проживание: одна Reservation — одна бронь (Q-209) */
  reservationId: string;
  /** Статус брони целиком — по нему бронь считается отменённой или незаездом */
  reservationStatus: string;
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
  /** Дата услуги; у начисления за проживание — день заезда (одно начисление на проживание) */
  serviceDate: string;
}
export interface DashboardPayment {
  method: string;
  amountMinor: bigint;
}
export interface DashboardInput {
  from: string;
  to: string;
  categories: Array<{ code: string; name: string; units: number; kind: DashboardUnitKind }>;
  /** По одной записи на каждую дату периода, в порядке дат */
  days: DashboardDay[];
  /** Проживаний без ячейки, касающихся периода, по коду категории: в загрузку не входят (Q-107) */
  unassignedByCategory: Record<string, number>;
  /** Проживания, у которых заезд или выезд попадает в период */
  stays: DashboardStay[];
  /** Начисления без сторно с `service_date` в периоде */
  charges: DashboardCharge[];
  /** Платежи COMPLETED, проведённые в периоде (сутки объекта). Типом фонда не делятся — это деньги объекта */
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
  kind: DashboardUnitKind;
  units: number;
  unitNights: number;
  occupiedNights: number;
  freeNights: number;
  /** Закрытые клетко-ночи: входят в фонд категории (знаменатель загрузки) */
  blockedNights: number;
  /** Проживаний без ячейки в этой категории, касающихся периода */
  unassigned: number;
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
  /** Начислено за проживание с датой услуги в этот день — то есть по заездам дня */
  revenueMinor: string;
  /** Выручка за ночь этого дня: цена мест, занятых в эту ночь, поровну по ночам (ADR и RevPAR, ADR-155) */
  nightRevenueMinor: string;
}
/**
 * Брони периода по дате заезда (Q-209): одна Reservation — одна бронь, в каком бы числе мест она ни была.
 * Бронь попадает в период, если хоть одно её проживание выбранного типа фонда заезжает в периоде.
 */
export interface DashboardBookings {
  total: number;
  /** Брони без отмены и незаезда */
  active: number;
  /** Размещения (проживания) действующих броней: групповая бронь на три койки — одна бронь и три размещения */
  stays: number;
  cancelled: number;
  noShow: number;
  /** Доли от `total`, % с одним знаком */
  cancelledPercent: number;
  noShowPercent: number;
  /** Стоимость действующих проживаний действующих броней */
  valueMinor: string;
  /** Средний чек брони: стоимость / число действующих броней; null — их нет */
  averageMinor: string | null;
}
export interface DashboardPeriod {
  from: string;
  to: string;
  /** Какие категории вошли в расчёт; платежи и возвраты — всегда по объекту */
  fund: DashboardFund;
  /** Сколько номеров и коек во всём фонде — при любом `fund`, чтобы экран знал, есть ли что делить */
  funds: { rooms: number; beds: number };
  nights: number;
  units: number;
  occupancy: {
    unitNights: number;
    occupiedNights: number;
    blockedNights: number;
    freeNights: number;
    /** Доступно к продаже: ночи фонда минус закрытые (ADR-155, Q-286); знаменатель загрузки и RevPAR */
    sellableNights: number;
    percent: number;
  };
  unassigned: number;
  revenue: {
    accommodationMinor: string;
    servicesMinor: string;
    penaltiesMinor: string;
    adjustmentsMinor: string;
    totalMinor: string;
    /** Выручка за ночи периода: сумма `nightRevenueMinor` по дням; числитель ADR и RevPAR */
    nightsMinor: string;
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
  bookings: DashboardBookings;
  sources: DashboardSource[];
  categories: DashboardCategory[];
  /** Категории типа фонда для выбора в отчёте: фильтр по категории список не сужает */
  categoryOptions: Array<{ code: string; name: string; kind: DashboardUnitKind }>;
  daily: DashboardDailyPoint[];
}

const inactive = new Set(['CANCELLED', 'NO_SHOW']);
const s = (v: bigint) => v.toString();
/** Проценты с одним знаком после запятой, без float-накопления: считаем в десятых долях */
const percent = (part: number, whole: number) =>
  whole > 0 ? Math.round((part * 1000) / whole) / 10 : 0;
const divide = (amount: bigint, by: number): string | null =>
  by > 0 ? s(amount / BigInt(by)) : null;

/**
 * Оставляет только категории одного типа фонда: дни пересобираются из `byCategory`, проживания,
 * начисления и «без ячейки» — по коду категории. Платежи и возвраты не трогаются (см. `DashboardInput`).
 */
function restrictToFund(input: DashboardInput, fund: DashboardFund): DashboardInput {
  if (fund === 'all') return input;
  const kind = FUND_KIND[fund];
  return restrictToCategories(
    input,
    input.categories.filter((c) => c.kind === kind),
  );
}

/** Одна категория (RPT2.2c-2, фильтр отчёта): та же пересборка, что у типа фонда; код вне фонда даёт пустой фонд */
function restrictToCategory(input: DashboardInput, code: string): DashboardInput {
  return restrictToCategories(
    input,
    input.categories.filter((c) => c.code === code),
  );
}

function restrictToCategories(
  input: DashboardInput,
  categories: DashboardInput['categories'],
): DashboardInput {
  const codes = new Set(categories.map((c) => c.code));
  const days = input.days.map((d) => {
    const byCategory = Object.fromEntries(
      Object.entries(d.byCategory).filter(([code]) => codes.has(code)),
    );
    const sum = (key: 'occupied' | 'free' | 'blocked') =>
      Object.values(byCategory).reduce((n, c) => n + c[key], 0);
    return {
      date: d.date,
      occupied: sum('occupied'),
      free: sum('free'),
      blocked: sum('blocked'),
      byCategory,
    };
  });
  return {
    ...input,
    categories,
    days,
    unassignedByCategory: Object.fromEntries(
      Object.entries(input.unassignedByCategory).filter(([code]) => codes.has(code)),
    ),
    stays: input.stays.filter((st) => codes.has(st.categoryCode)),
    charges: input.charges.filter((ch) => codes.has(ch.categoryCode)),
  };
}

/** Отбор отчёта поверх типа фонда: категория (код). Источник сюда не входит: загрузка и начисления по источнику не делятся */
export interface DashboardFilter {
  category?: string;
}

/**
 * Выручка за ночи (ADR-155, Q-290, `docs/metrics.md` §2): цена места делится поровну по его ночам, остаток тиынов
 * достаётся последней ночи, так что сумма по всем ночам равна цене. Берутся действующие проживания; в расчёт идут
 * только ночи внутри периода. Начисление по дню заезда это другая база («Начислено»), здесь она не участвует.
 */
function nightlyRevenue(stays: DashboardStay[], dates: string[]): Map<string, bigint> {
  const inPeriod = new Set(dates);
  const out = new Map<string, bigint>();
  for (const st of stays) {
    if (inactive.has(st.status) || inactive.has(st.reservationStatus)) continue;
    const nightsOfStay = Math.max(
      1,
      Math.round(
        (Date.parse(`${st.departureDate}T00:00:00Z`) - Date.parse(`${st.arrivalDate}T00:00:00Z`)) /
          86_400_000,
      ),
    );
    const base = st.priceMinor / BigInt(nightsOfStay);
    const rest = st.priceMinor - base * BigInt(nightsOfStay);
    for (let i = 0; i < nightsOfStay; i += 1) {
      const date = new Date(Date.parse(`${st.arrivalDate}T00:00:00Z`) + i * 86_400_000)
        .toISOString()
        .slice(0, 10);
      if (!inPeriod.has(date)) continue;
      out.set(date, (out.get(date) ?? 0n) + base + (i === nightsOfStay - 1 ? rest : 0n));
    }
  }
  return out;
}

export function buildDashboard(
  whole: DashboardInput,
  fund: DashboardFund = 'all',
  filter: DashboardFilter = {},
): DashboardPeriod {
  const fundUnits = (kind: DashboardUnitKind) =>
    whole.categories.filter((c) => c.kind === kind).reduce((n, c) => n + c.units, 0);
  const funds = { rooms: fundUnits('ROOM'), beds: fundUnits('BED') };
  const byFund = restrictToFund(whole, fund);
  const input = filter.category ? restrictToCategory(byFund, filter.category) : byFund;
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

  // Брони периода (Q-209): проживания с заездом в периоде, сгруппированные по Reservation
  const reservationMap = new Map<string, { status: string; stays: DashboardStay[] }>();
  for (const st of arrivalsAll) {
    const r = reservationMap.get(st.reservationId) ?? { status: st.reservationStatus, stays: [] };
    r.stays.push(st);
    reservationMap.set(st.reservationId, r);
  }
  const reservations = [...reservationMap.values()];
  const activeReservations = reservations
    .filter((r) => !inactive.has(r.status))
    .map((r) => ({ ...r, stays: r.stays.filter((st) => !inactive.has(st.status)) }));
  const stayValue = (stays: DashboardStay[]) => stays.reduce((a, st) => a + st.priceMinor, 0n);

  // Источники — бронями (Q-209): источник и канал у брони один, сумма — её действующие места
  const sourceMap = new Map<string, DashboardSource & { amount: bigint }>();
  for (const r of activeReservations) {
    const first = r.stays[0];
    if (!first) continue;
    const key = `${first.source}|${first.channel ?? ''}`;
    const v = sourceMap.get(key) ?? {
      source: first.source,
      channel: first.channel,
      count: 0,
      amount: 0n,
      amountMinor: '0',
      share: 0,
    };
    sourceMap.set(key, { ...v, count: v.count + 1, amount: v.amount + stayValue(r.stays) });
  }
  const sources = [...sourceMap.values()]
    .sort((a, b) => b.count - a.count || (a.amount === b.amount ? 0 : a.amount > b.amount ? -1 : 1))
    .map(({ amount, ...v }) => ({
      ...v,
      amountMinor: s(amount),
      share: percent(v.count, activeReservations.length),
    }));

  const categories = input.categories.map((c): DashboardCategory => {
    const sumOf = (key: 'occupied' | 'free' | 'blocked') =>
      input.days.reduce((n, d) => n + (d.byCategory[c.code]?.[key] ?? 0), 0);
    const occupied = sumOf('occupied');
    const revenue = input.charges
      .filter((ch) => ch.kind === 'ACCOMMODATION' && ch.categoryCode === c.code)
      .reduce((a, ch) => a + ch.amountMinor, 0n);
    const catNights = c.units * nights;
    const catNightRevenue = [
      ...nightlyRevenue(
        input.stays.filter((st) => st.categoryCode === c.code),
        dates,
      ).values(),
    ].reduce((n, v) => n + v, 0n);
    return {
      code: c.code,
      name: c.name,
      kind: c.kind,
      units: c.units,
      unitNights: catNights,
      occupiedNights: occupied,
      freeNights: sumOf('free'),
      blockedNights: sumOf('blocked'),
      unassigned: input.unassignedByCategory[c.code] ?? 0,
      percent: percent(occupied, catNights - sumOf('blocked')),
      revenueMinor: s(revenue),
      adrMinor: divide(catNightRevenue, occupied),
    };
  });

  const revenueByDay = new Map<string, bigint>();
  for (const ch of input.charges)
    if (ch.kind === 'ACCOMMODATION')
      revenueByDay.set(ch.serviceDate, (revenueByDay.get(ch.serviceDate) ?? 0n) + ch.amountMinor);
  const nightRevenueByDay = nightlyRevenue(input.stays, dates);
  const nightsRevenue = [...nightRevenueByDay.values()].reduce((n, v) => n + v, 0n);
  const daily = input.days.map((d) => ({
    date: d.date,
    occupied: d.occupied,
    free: d.free,
    blocked: d.blocked,
    percent: percent(d.occupied, units - d.blocked),
    arrivals: arrivals.filter((st) => st.arrivalDate === d.date).length,
    departures: departures.filter((st) => st.departureDate === d.date).length,
    revenueMinor: s(revenueByDay.get(d.date) ?? 0n),
    nightRevenueMinor: s(nightRevenueByDay.get(d.date) ?? 0n),
  }));

  const cancelledStays = arrivalsAll.filter((st) => st.status === 'CANCELLED').length;
  const noShowStays = arrivalsAll.filter((st) => st.status === 'NO_SHOW').length;
  const cancelled = reservations.filter((r) => r.status === 'CANCELLED').length;
  const noShow = reservations.filter((r) => r.status === 'NO_SHOW').length;
  const bookedStays = activeReservations.flatMap((r) => r.stays);
  const bookingsValue = stayValue(bookedStays);

  return {
    from: input.from,
    to: input.to,
    fund,
    funds,
    nights,
    units,
    occupancy: {
      unitNights,
      occupiedNights,
      blockedNights,
      freeNights,
      sellableNights: unitNights - blockedNights,
      percent: percent(occupiedNights, unitNights - blockedNights),
    },
    unassigned: Object.values(input.unassignedByCategory).reduce((n, v) => n + v, 0),
    revenue: {
      accommodationMinor: s(accommodation),
      servicesMinor: s(services),
      penaltiesMinor: s(penalties),
      adjustmentsMinor: s(adjustments),
      totalMinor: s(accommodation + services + penalties + adjustments),
      nightsMinor: s(nightsRevenue),
    },
    payments: { totalMinor: s(paid), count: input.payments.length, byMethod },
    refundsMinor: s(input.refundsMinor),
    adrMinor: divide(nightsRevenue, occupiedNights),
    revparMinor: divide(nightsRevenue, unitNights - blockedNights),
    arrivals: {
      count: arrivals.length,
      guests: arrivals.reduce((n, st) => n + st.adults + st.children, 0),
      cancelled: cancelledStays,
      noShow: noShowStays,
    },
    departures: { count: departures.length },
    bookings: {
      total: reservations.length,
      active: activeReservations.length,
      stays: bookedStays.length,
      cancelled,
      noShow,
      cancelledPercent: percent(cancelled, reservations.length),
      noShowPercent: percent(noShow, reservations.length),
      valueMinor: s(bookingsValue),
      averageMinor: divide(bookingsValue, activeReservations.length),
    },
    sources,
    categories,
    categoryOptions: byFund.categories.map(({ code, name, kind }) => ({ code, name, kind })),
    daily,
  };
}
