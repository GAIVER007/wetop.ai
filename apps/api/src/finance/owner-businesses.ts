/**
 * «Кабинет владельца: все бизнесы», вариант C (владелец 30.10.2026: «3»). Владелец видит сразу все свои бизнесы и
 * филиалы во всех организациях, где он владелец (Вячеслав: WETOP и Luxx Aparts с двумя филиалами), и из строки
 * переходит в любой. Чистый расчёт без базы: источник собирает `owner-businesses.controller`.
 *
 * - деньги филиала: выручка и оплаченные расходы по месяцам в его валюте; прибыль = выручка минус расходы;
 * - итог только по валютам: QAR, KZT и USD не складываются (AGENTS §12, курсы не придумываем);
 * - WETOP (только главному администратору): доход и расходы компании в USD из «Денег», отдельной строкой.
 */
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
    money: Array<{ month: string; revenueMinor: bigint; expensesMinor: bigint }>;
    /** Дел «Требуют решения» сегодня; не считали: 0 */
    attention: number;
  }>;
  /** Деньги компании WETOP по месяцам `months` (центы USD); не главный администратор: `null` */
  platform: { incomeMinor: bigint[]; expensesMinor: bigint[] } | null;
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
    currency: string;
    revenueMinor: string;
    expensesMinor: string;
    profitMinor: string;
    attention: number;
    current: boolean;
  }>;
  chart: Array<{ currency: string; revenueMinor: string[] }>;
}

export function buildOwnerBusinesses(src: OwnerBusinessesSource): OwnerBusinessesView {
  const prevMonth = src.months[src.months.length - 2]!;
  const at = (b: OwnerBusinessesSource['branches'][number], m: string) =>
    b.money.find((x) => x.month === m) ?? { revenueMinor: 0n, expensesMinor: 0n };
  const totals = new Map<string, { rev: bigint; exp: bigint; prevProfit: bigint; chart: bigint[] }>();
  const bucket = (currency: string) => {
    const t = totals.get(currency) ?? { rev: 0n, exp: 0n, prevProfit: 0n, chart: src.months.map(() => 0n) };
    totals.set(currency, t);
    return t;
  };
  const rows: OwnerBusinessesView['rows'] = [];
  const last = src.months.length - 1;
  if (src.platform) {
    const p = src.platform;
    const t = bucket('USD');
    t.rev += p.incomeMinor[last] ?? 0n;
    t.exp += p.expensesMinor[last] ?? 0n;
    t.prevProfit += (p.incomeMinor[last - 1] ?? 0n) - (p.expensesMinor[last - 1] ?? 0n);
    src.months.forEach((_, i) => (t.chart[i]! += p.incomeMinor[i] ?? 0n));
    const rev = p.incomeMinor[last] ?? 0n;
    const exp = p.expensesMinor[last] ?? 0n;
    rows.push({
      kind: 'PLATFORM',
      organizationId: null,
      locationId: null,
      name: 'WETOP',
      businessName: 'WETOP',
      vertical: null,
      currency: 'USD',
      revenueMinor: String(rev),
      expensesMinor: String(exp),
      profitMinor: String(rev - exp),
      attention: 0,
      current: false,
    });
  }
  for (const b of src.branches) {
    const cur = at(b, src.month);
    const prev = at(b, prevMonth);
    const t = bucket(b.currency);
    t.rev += cur.revenueMinor;
    t.exp += cur.expensesMinor;
    t.prevProfit += prev.revenueMinor - prev.expensesMinor;
    src.months.forEach((m, i) => (t.chart[i]! += at(b, m).revenueMinor));
    rows.push({
      kind: 'BRANCH',
      organizationId: b.organizationId,
      locationId: b.locationId,
      name: b.locationName,
      businessName: b.businessName,
      vertical: b.vertical,
      currency: b.currency,
      revenueMinor: String(cur.revenueMinor),
      expensesMinor: String(cur.expensesMinor),
      profitMinor: String(cur.revenueMinor - cur.expensesMinor),
      attention: b.attention,
      current: b.current,
    });
  }
  const currencies = [...totals.keys()].sort();
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
  };
}
