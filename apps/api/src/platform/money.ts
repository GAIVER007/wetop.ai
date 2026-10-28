/**
 * Деньги компании WETOP (DATA_MODEL §63, владелец 28.10.2026): доход, расходы и прибыль месяца, ожидаемый доход в
 * месяц по подпискам, должники. Суммы целыми центами USD в bigint, без чисел с плавающей точкой (AGENTS §12).
 * Месяц календарный по UTC, «сегодня» тоже по UTC: компания считает в одном поясе.
 */
export const EXPENSE_CATEGORIES = ['SERVER', 'DOMAINS', 'ADS', 'AI', 'SALARIES', 'SERVICES', 'OTHER'] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export interface MoneySource {
  payments: Array<{ organizationId: string; amountCents: bigint; paidOn: string; voided: boolean }>;
  expenses: Array<{ category: ExpenseCategory; amountCents: bigint; spentOn: string; voided: boolean }>;
  subscriptions: Array<{ organizationId: string; monthlyCents: bigint; paidUntil: string | null }>;
  /** Клиенты, которых считаем: без своей организации и без архива */
  clientIds: string[];
}

export interface MoneyMonth {
  month: string;
  incomeCents: string;
  expensesCents: string;
  profitCents: string;
}

export interface MoneyView {
  month: MoneyMonth;
  /** Тот же месяц год назад не нужен: шесть последних месяцев для графика, текущий последним */
  history: MoneyMonth[];
  /** Ожидаемый доход в месяц по подпискам клиентов */
  expectedMonthlyCents: string;
  expensesByCategory: Array<{ category: ExpenseCategory; cents: string }>;
  /** Подписка есть, а «оплачено до» раньше сегодня или пусто */
  overdue: Array<{ organizationId: string; paidUntil: string | null; monthlyCents: string }>;
}

const monthOf = (isoDate: string) => isoDate.slice(0, 7);

export function shiftMonth(month: string, delta: number): string {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7)) - 1 + delta;
  const d = new Date(Date.UTC(y, m, 1));
  return d.toISOString().slice(0, 7);
}

export function buildMoney(src: MoneySource, month: string, today: string): MoneyView {
  const clients = new Set(src.clientIds);
  const payments = src.payments.filter((p) => !p.voided);
  const expenses = src.expenses.filter((e) => !e.voided);
  const sumMonth = (m: string) => {
    const income = payments.filter((p) => monthOf(p.paidOn) === m).reduce((n, p) => n + p.amountCents, 0n);
    const spent = expenses.filter((e) => monthOf(e.spentOn) === m).reduce((n, e) => n + e.amountCents, 0n);
    return { month: m, incomeCents: String(income), expensesCents: String(spent), profitCents: String(income - spent) };
  };
  const byCategory = new Map<ExpenseCategory, bigint>();
  for (const e of expenses)
    if (monthOf(e.spentOn) === month) byCategory.set(e.category, (byCategory.get(e.category) ?? 0n) + e.amountCents);
  const subs = src.subscriptions.filter((s) => clients.has(s.organizationId));
  return {
    month: sumMonth(month),
    history: [-5, -4, -3, -2, -1, 0].map((d) => sumMonth(shiftMonth(month, d))),
    expectedMonthlyCents: String(subs.reduce((n, s) => n + s.monthlyCents, 0n)),
    expensesByCategory: EXPENSE_CATEGORIES.filter((c) => byCategory.has(c)).map((category) => ({
      category,
      cents: String(byCategory.get(category)!),
    })),
    overdue: subs
      .filter((s) => s.monthlyCents > 0n && (s.paidUntil === null || s.paidUntil < today))
      .map((s) => ({ organizationId: s.organizationId, paidUntil: s.paidUntil, monthlyCents: String(s.monthlyCents) }))
      .sort((a, b) => (a.paidUntil ?? '').localeCompare(b.paidUntil ?? '')),
  };
}

/** «12.50» или «12» в центы; запятая как точка; больше двух знаков после точки, минус и мусор: null */
export function parseUsdCents(input: unknown): bigint | null {
  if (typeof input !== 'string') return null;
  const text = input.trim().replace(/\s/g, '').replace(',', '.');
  const m = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(text);
  if (!m) return null;
  return BigInt(m[1]!) * 100n + BigInt((m[2] ?? '').padEnd(2, '0') || '0');
}

/** Дата `ГГГГ-ММ-ДД`, настоящая календарная */
export function parseIsoDate(input: unknown): string | null {
  if (typeof input !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input)) return null;
  const d = new Date(`${input}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== input ? null : input;
}
