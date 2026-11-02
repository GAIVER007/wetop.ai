/**
 * «Кабинет владельца: все бизнесы», вариант C (владелец 30.10.2026: «3»). Владелец видит сразу все свои бизнесы и
 * филиалы во всех организациях, где он владелец (Вячеслав: WETOP и Luxx Aparts с двумя филиалами), и из строки
 * переходит в любой. Чистый расчёт без базы: источник собирает `owner-businesses.controller`.
 *
 * - деньги филиала: выручка и оплаченные расходы по месяцам в его валюте; прибыль = выручка минус расходы;
 * - всё в валюте компании (владелец 01.11.2026, ADR-OWNER-FX-20261101): каждая сумма дня переводится по курсу
 *   Нацбанка РК на этот день (или последнему известному до него); без курса валюта остаётся своим итогом;
 * - без `fx` (курсов нет вовсе): итог по валютам, QAR, KZT и USD не складываются (AGENTS §12);
 * - WETOP (только главному администратору): доход и расходы компании в USD из «Денег», отдельной строкой.
 */
import { convertMinor, type DailyRates } from '@pms/domain';

type Day = { date: string; revenueMinor: bigint; expensesMinor: bigint };

export interface OwnerBusinessesSource {
  month: string;
  /** Шесть месяцев до выбранного включительно */
  months: string[];
  branches: Array<{
    organizationId: string;
    organizationName: string;
    /** Организация текущей сессии: «вы здесь» */
    current: boolean;
    businessName: string;
    vertical: string;
    locationId: string;
    locationName: string;
    currency: string;
    /** Деньги по дням филиала (YYYY-MM-DD в поясе филиала): день нужен для курса */
    days: Day[];
    /** Дел «Требуют решения» сегодня; не считали: 0 */
    attention: number;
  }>;
  /** Деньги компании WETOP по дням (центы USD); не главный администратор: `null` */
  platform: { days: Day[] } | null;
  /** Валюта компании и курсы Нацбанка РК; нет: итог по валютам */
  fx?: { currency: string; rates: DailyRates } | null;
}

export interface OwnerBusinessesView {
  month: string;
  months: string[];
  totals: Array<{ currency: string; revenueMinor: string; expensesMinor: string; profitMinor: string; previousProfitMinor: string }>;
  counts: { businesses: number; branches: number };
  rows: Array<{
    kind: 'PLATFORM' | 'BRANCH';
    organizationId: string | null;
    locationId: string | null;
    name: string;
    businessName: string;
    vertical: string | null;
    /** Валюта сумм строки: валюта компании, если строку удалось перевести */
    currency: string;
    revenueMinor: string;
    expensesMinor: string;
    profitMinor: string;
    /** Суммы месяца в валюте филиала, если строка переведена; своя валюта: null */
    source: { currency: string; revenueMinor: string; expensesMinor: string; profitMinor: string } | null;
    attention: number;
    current: boolean;
  }>;
  chart: Array<{ currency: string; revenueMinor: string[] }>;
  /** Перевод в валюту компании: какие валюты переведены, был ли курс не своего дня, у каких валют курса нет */
  fx: { currency: string; source: 'NBK'; converted: string[]; approximate: boolean; missing: string[] } | null;
}

export function buildOwnerBusinesses(src: OwnerBusinessesSource): OwnerBusinessesView {
  const prevMonth = src.months[src.months.length - 2]!;
  const fx = src.fx ?? null;
  const converted = new Set<string>();
  const missing = new Set<string>();
  let approximate = false;
  /** Дни строки в валюте показа; курса нет хоть на один день: строка остаётся в своей валюте */
  const show = (currency: string, days: Day[]): { currency: string; days: Day[] } => {
    if (!fx || currency === fx.currency) return { currency, days };
    const out: Day[] = [];
    for (const d of days) {
      const rev = convertMinor(d.revenueMinor, currency, fx.currency, d.date, fx.rates);
      const exp = convertMinor(d.expensesMinor, currency, fx.currency, d.date, fx.rates);
      if (rev === null || exp === null) {
        missing.add(currency);
        return { currency, days };
      }
      const exact = fx.rates.get(currency)?.some((r) => r.date === d.date);
      if (!exact) approximate = true;
      out.push({ date: d.date, revenueMinor: rev, expensesMinor: exp });
    }
    converted.add(currency);
    return { currency: fx.currency, days: out };
  };
  const sumMonth = (days: Day[], m: string) =>
    days.reduce(
      (t, d) => (d.date.slice(0, 7) === m ? { rev: t.rev + d.revenueMinor, exp: t.exp + d.expensesMinor } : t),
      { rev: 0n, exp: 0n },
    );
  const totals = new Map<string, { rev: bigint; exp: bigint; prevProfit: bigint; chart: bigint[] }>();
  const rows: OwnerBusinessesView['rows'] = [];
  const add = (
    row: Omit<OwnerBusinessesView['rows'][number], 'currency' | 'revenueMinor' | 'expensesMinor' | 'profitMinor' | 'source'>,
    currency: string,
    days: Day[],
  ) => {
    const shown = show(currency, days);
    const t = totals.get(shown.currency) ?? { rev: 0n, exp: 0n, prevProfit: 0n, chart: src.months.map(() => 0n) };
    totals.set(shown.currency, t);
    const cur = sumMonth(shown.days, src.month);
    const prev = sumMonth(shown.days, prevMonth);
    t.rev += cur.rev;
    t.exp += cur.exp;
    t.prevProfit += prev.rev - prev.exp;
    src.months.forEach((m, i) => (t.chart[i]! += sumMonth(shown.days, m).rev));
    const own = shown.currency === currency ? null : sumMonth(days, src.month);
    rows.push({
      ...row,
      currency: shown.currency,
      revenueMinor: String(cur.rev),
      expensesMinor: String(cur.exp),
      profitMinor: String(cur.rev - cur.exp),
      source: own
        ? { currency, revenueMinor: String(own.rev), expensesMinor: String(own.exp), profitMinor: String(own.rev - own.exp) }
        : null,
    });
  };
  if (src.platform)
    add(
      { kind: 'PLATFORM', organizationId: null, locationId: null, name: 'WETOP', businessName: 'WETOP', vertical: null, attention: 0, current: false },
      'USD',
      src.platform.days,
    );
  for (const b of src.branches)
    add(
      {
        kind: 'BRANCH',
        organizationId: b.organizationId,
        locationId: b.locationId,
        name: b.locationName,
        businessName: b.businessName,
        vertical: b.vertical,
        attention: b.attention,
        current: b.current,
      },
      b.currency,
      b.days,
    );
  // валюта компании первой, остальные (без курса) по алфавиту
  const currencies = [...totals.keys()].sort((a, b) => (a === fx?.currency ? -1 : b === fx?.currency ? 1 : a.localeCompare(b)));
  const businesses = new Set(src.branches.map((b) => `${b.organizationId}:${b.businessName}`)).size + (src.platform ? 1 : 0);
  return {
    month: src.month,
    months: src.months,
    totals: currencies.map((currency) => {
      const t = totals.get(currency)!;
      return {
        currency,
        revenueMinor: String(t.rev),
        expensesMinor: String(t.exp),
        profitMinor: String(t.rev - t.exp),
        previousProfitMinor: String(t.prevProfit),
      };
    }),
    counts: { businesses, branches: src.branches.length },
    rows,
    chart: currencies.map((currency) => ({ currency, revenueMinor: totals.get(currency)!.chart.map(String) })),
    fx: fx
      ? { currency: fx.currency, source: 'NBK', converted: [...converted].sort(), approximate, missing: [...missing].sort() }
      : null,
  };
}
