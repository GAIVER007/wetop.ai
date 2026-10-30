/**
 * Главная владельца салона, вариант «B» (владелец 30.10.2026: «Вариант б хочу»): четыре цифры месяца с прошлым, путь
 * клиента (записались, пришли, оплатили, вернулись повторно), мастера, откуда клиенты и шесть месяцев выручки,
 * расходов и прибыли. Чистый расчёт без базы: источник собирает `owner-home.controller`. Месяц по часам филиала.
 *
 * - выручка: выполненные записи (DONE) по цене, как на прежней Главной; у записи с несколькими мастерами по строкам;
 * - прибыль: выручка минус оплаченные расходы кассы филиала месяца;
 * - «клиенты, оплатили»: люди месяца с выполненной оплаченной записью; средний чек = выручка / выполненные визиты;
 * - «вернулись повторно»: из оплативших те, у кого первый выполненный визит раньше этого месяца.
 * Деньги в минорных единицах bigint, проценты целые (AGENTS §12).
 */
export interface OwnerHomeSource {
  month: string;
  currency: string;
  /** Записи филиала за шесть месяцев до выбранного включительно; `month` по часам филиала */
  appointments: Array<{
    id: string;
    customerId: string;
    employeeId: string;
    month: string;
    status: string;
    priceMinor: bigint;
    source: string;
    /** Есть проведённая оплата записи */
    paid: boolean;
    lines: Array<{ employeeId: string; priceMinor: bigint }>;
  }>;
  /** Месяц первого выполненного визита клиента за всё время */
  firstDone: Map<string, string>;
  /** «Давно не были»: последний визит 60 и больше дней назад (как в сводке салона) */
  lapsed: number;
  expenses: Array<{ month: string; amountMinor: bigint }>;
  /** Оценки визитов выбранного месяца */
  reviews: Array<{ employeeId: string; stars: number }>;
  employees: Map<string, string>;
}

export type FunnelStep = 'BOOKED' | 'CAME' | 'PAID' | 'RETURNED';

export interface OwnerHomeView {
  month: string;
  currency: string;
  kpi: {
    revenueMinor: string;
    /** Оплаченные расходы кассы месяца (владелец 30.10.2026: «выручка, расходы, прибыль») */
    expensesMinor: string;
    profitMinor: string;
    paidClients: number;
    averageMinor: string | null;
    previous: { revenueMinor: string; expensesMinor: string; profitMinor: string; paidClients: number; averageMinor: string | null };
  };
  funnel: Array<{ step: FunnelStep; count: number; percent: number | null }>;
  clients: { new: number; noShow: number; lapsed: number };
  masters: Array<{
    employeeId: string;
    name: string;
    revenueMinor: string;
    visits: number;
    customers: number;
    returning: number;
    reviews: number;
    avgTenths: number | null;
  }>;
  sources: Array<{ source: string; clients: number; revenueMinor: string }>;
  months: Array<{ month: string; revenueMinor: string; expensesMinor: string; profitMinor: string }>;
}

/** Шесть месяцев до выбранного включительно, по порядку */
export function sixMonths(month: string): string[] {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (5 - i), 1));
    return d.toISOString().slice(0, 7);
  });
}

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part * 100) / whole) : null);

function monthKpi(src: OwnerHomeSource, month: string) {
  const rows = src.appointments.filter((a) => a.month === month && a.status === 'DONE');
  const revenue = rows.reduce((n, a) => n + a.priceMinor, 0n);
  const spent = src.expenses.filter((e) => e.month === month).reduce((n, e) => n + e.amountMinor, 0n);
  const paidClients = new Set(rows.filter((a) => a.paid).map((a) => a.customerId)).size;
  return {
    revenueMinor: String(revenue),
    expensesMinor: String(spent),
    profitMinor: String(revenue - spent),
    paidClients,
    averageMinor: rows.length ? String(revenue / BigInt(rows.length)) : null,
    revenue,
    spent,
  };
}

export function buildOwnerHome(src: OwnerHomeSource): OwnerHomeView {
  const months = sixMonths(src.month);
  const prevMonth = months[4]!;
  const cur = monthKpi(src, src.month);
  const prev = monthKpi(src, prevMonth);
  const inMonth = src.appointments.filter((a) => a.month === src.month);
  const done = inMonth.filter((a) => a.status === 'DONE');
  const booked = new Set(inMonth.map((a) => a.customerId));
  const came = new Set(done.map((a) => a.customerId));
  const paid = new Set(done.filter((a) => a.paid).map((a) => a.customerId));
  const before = (c: string) => {
    const first = src.firstDone.get(c);
    return first !== undefined && first < src.month;
  };
  const returned = [...paid].filter(before);
  const counts: Array<[FunnelStep, number]> = [
    ['BOOKED', booked.size],
    ['CAME', came.size],
    ['PAID', paid.size],
    ['RETURNED', returned.length],
  ];
  const funnel = counts.map(([step, count], i) => ({ step, count, percent: i === 0 ? null : pct(count, counts[i - 1]![1]) }));

  // мастера: строки записи, у старой записи без строк цена целиком мастеру записи
  const per = new Map<string, { revenue: bigint; visits: Set<string>; customers: Set<string> }>();
  for (const a of done) {
    const parts = a.lines.length ? a.lines.map((l) => [l.employeeId, l.priceMinor] as const) : [[a.employeeId, a.priceMinor] as const];
    for (const [e, minor] of parts) {
      const m = per.get(e) ?? { revenue: 0n, visits: new Set<string>(), customers: new Set<string>() };
      m.revenue += minor;
      m.visits.add(a.id);
      m.customers.add(a.customerId);
      per.set(e, m);
    }
  }
  const stars = new Map<string, { sum: number; count: number }>();
  for (const r of src.reviews) {
    const s = stars.get(r.employeeId) ?? { sum: 0, count: 0 };
    s.sum += r.stars;
    s.count += 1;
    stars.set(r.employeeId, s);
  }
  const masters = [...per]
    .map(([employeeId, m]) => {
      const s = stars.get(employeeId);
      return {
        employeeId,
        name: src.employees.get(employeeId) ?? '',
        revenueMinor: String(m.revenue),
        visits: m.visits.size,
        customers: m.customers.size,
        returning: [...m.customers].filter(before).length,
        reviews: s?.count ?? 0,
        avgTenths: s ? Math.round((s.sum * 10) / s.count) : null,
        revenue: m.revenue,
      };
    })
    .sort((a, b) => (a.revenue === b.revenue ? a.name.localeCompare(b.name) : a.revenue > b.revenue ? -1 : 1))
    .map((m) => ({
      employeeId: m.employeeId,
      name: m.name,
      revenueMinor: m.revenueMinor,
      visits: m.visits,
      customers: m.customers,
      returning: m.returning,
      reviews: m.reviews,
      avgTenths: m.avgTenths,
    }));

  // откуда клиенты: источник первой оплаченной выполненной записи человека в месяце, выручка его оплаченных записей
  const bySource = new Map<string, { clients: Set<string>; revenue: bigint }>();
  const firstSource = new Map<string, string>();
  for (const a of done.filter((x) => x.paid)) if (!firstSource.has(a.customerId)) firstSource.set(a.customerId, a.source);
  for (const a of done.filter((x) => x.paid)) {
    const source = firstSource.get(a.customerId)!;
    const s = bySource.get(source) ?? { clients: new Set<string>(), revenue: 0n };
    s.clients.add(a.customerId);
    s.revenue += a.priceMinor;
    bySource.set(source, s);
  }
  const sources = [...bySource]
    .sort((a, b) => (a[1].revenue === b[1].revenue ? 0 : a[1].revenue > b[1].revenue ? -1 : 1))
    .map(([source, s]) => ({ source, clients: s.clients.size, revenueMinor: String(s.revenue) }));

  return {
    month: src.month,
    currency: src.currency,
    kpi: {
      revenueMinor: cur.revenueMinor,
      expensesMinor: cur.expensesMinor,
      profitMinor: cur.profitMinor,
      paidClients: cur.paidClients,
      averageMinor: cur.averageMinor,
      previous: { revenueMinor: prev.revenueMinor, expensesMinor: prev.expensesMinor, profitMinor: prev.profitMinor, paidClients: prev.paidClients, averageMinor: prev.averageMinor },
    },
    funnel,
    clients: {
      new: [...came].filter((c) => src.firstDone.get(c) === src.month).length,
      noShow: inMonth.filter((a) => a.status === 'NO_SHOW').length,
      lapsed: src.lapsed,
    },
    masters,
    sources,
    months: months.map((m) => {
      const k = monthKpi(src, m);
      return { month: m, revenueMinor: String(k.revenue), expensesMinor: String(k.spent), profitMinor: String(k.revenue - k.spent) };
    }),
  };
}
