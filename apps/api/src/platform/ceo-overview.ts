import type { ExpenseCategory } from './money';

/**
 * VTOP Owner Admin, главная «Overview» (ТЗ владельца 30.10.2026 «две категории админок», п. 3): Revenue, Clients,
 * Subscriptions, Partners, Finance одним экраном. Считается только из того, что Кабинет уже ведёт: оплаты, расходы,
 * подписки, тарифы, партнёры, путь клиента. Данные бизнесов клиентов сюда не попадают (уровень 1 ≠ уровень 3).
 * Деньги центами USD bigint строкой; проценты десятыми, вниз (AGENTS §12). Месяц и «сегодня» по UTC, как у Кабинета.
 */
export interface CeoSource {
  month: string;
  today: string;
  clientIds: string[];
  payments: Array<{ organizationId: string; amountCents: bigint; paidOn: string; voided: boolean }>;
  expenses: Array<{ category: ExpenseCategory; amountCents: bigint; spentOn: string; voided: boolean }>;
  plans: Array<{ id: string; name: string; priceCents: bigint; periodMonths: number }>;
  subscriptions: Array<{ organizationId: string; planId: string | null; monthlyCents: bigint; paidUntil: string | null }>;
  /** Из `buildGrowth`: MRR на сегодня, платящие, на пробном */
  kpi: { mrrCents: string; paying: number; trial: number };
  registrations: number;
  churned: number;
  atRisk: number;
  partners: {
    rows: Array<{ active: boolean; createdAt: string }>;
    totals: { trials: number; incomeCents: string; accruedCents: string; paidCents: string; dueCents: string };
  };
}

const shift = (month: string, delta: number) => {
  const d = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
};
const sum = (rows: Array<{ amountCents: bigint }>) => rows.reduce((n, r) => n + r.amountCents, 0n);

export function buildCeoOverview(src: CeoSource) {
  const clients = new Set(src.clientIds);
  const paid = src.payments.filter((p) => !p.voided);
  const spent = src.expenses.filter((e) => !e.voided);
  const inMonth = (m: string) => sum(paid.filter((p) => p.paidOn.slice(0, 7) === m));
  const thisMonth = inMonth(src.month);
  const lastMonth = inMonth(shift(src.month, -1));
  const year = src.month.slice(0, 4);
  const ytd = sum(paid.filter((p) => p.paidOn.slice(0, 4) === year && p.paidOn.slice(0, 7) <= src.month));
  const plans = new Map(src.plans.map((p) => [p.id, p]));
  const subs = src.subscriptions.filter((s) => clients.has(s.organizationId));
  // прогноз месяца: получено + продления, срок которых наступает с сегодня до конца месяца (цена тарифа целиком)
  const monthEnd = `${shift(src.month, 1)}-01`;
  const due = subs.filter((s) => s.paidUntil !== null && s.paidUntil >= src.today && s.paidUntil < monthEnd);
  const expected = due.reduce((n, s) => n + (s.planId && plans.get(s.planId) ? plans.get(s.planId)!.priceCents : s.monthlyCents), 0n);
  const current = src.today.slice(0, 7) === src.month;
  const active = subs.filter((s) => s.monthlyCents > 0n && s.paidUntil !== null && s.paidUntil >= src.today);
  const period = (s: (typeof subs)[number]) => (s.planId ? plans.get(s.planId)?.periodMonths : undefined);
  const byPlan = src.plans
    .map((p) => ({ planId: p.id, name: p.name, count: active.filter((s) => s.planId === p.id).length }))
    .filter((p) => p.count > 0);
  const overdue = subs.filter((s) => s.monthlyCents > 0n && (s.paidUntil === null || s.paidUntil < src.today));
  const monthSpent = sum(spent.filter((e) => e.spentOn.slice(0, 7) === src.month));
  const mrr = BigInt(src.kpi.mrrCents);
  return {
    month: src.month,
    revenue: {
      mrrCents: String(mrr),
      arrCents: String(mrr * 12n),
      thisMonthCents: String(thisMonth),
      lastMonthCents: String(lastMonth),
      ytdCents: String(ytd),
      forecastCents: String(thisMonth + (current ? expected : 0n)),
      growthTenths: lastMonth > 0n ? Number(((thisMonth - lastMonth) * 1000n) / lastMonth) : null,
    },
    clients: {
      total: clients.size,
      new: src.registrations,
      active: src.kpi.paying,
      trial: src.kpi.trial,
      churned: src.churned,
      atRisk: src.atRisk,
    },
    subscriptions: {
      active: active.length,
      monthly: active.filter((s) => period(s) === 1).length,
      annual: active.filter((s) => period(s) === 12).length,
      byPlan,
    },
    partners: {
      total: src.partners.rows.length,
      active: src.partners.rows.filter((p) => p.active).length,
      new: src.partners.rows.filter((p) => p.createdAt.slice(0, 7) === src.month).length,
      clients: src.partners.totals.trials,
      revenueCents: src.partners.totals.incomeCents,
      commissionsCents: src.partners.totals.accruedCents,
      dueCents: src.partners.totals.dueCents,
    },
    finance: {
      // касса: всё полученное минус всё потраченное за всё время (движение денег, не выручка и не прибыль)
      cashBalanceCents: String(sum(paid) - sum(spent)),
      incomeCents: String(thisMonth),
      expensesCents: String(monthSpent),
      profitCents: String(thisMonth - monthSpent),
      // дебиторка: просроченные подписки, по месячной цене
      receivableCents: String(sum(overdue.map((s) => ({ amountCents: s.monthlyCents })))),
      // кредиторка: должны партнёрам
      payableCents: src.partners.totals.dueCents,
    },
  };
}

export type CeoOverview = ReturnType<typeof buildCeoOverview>;
