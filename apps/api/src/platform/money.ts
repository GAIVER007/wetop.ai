/**
 * Деньги компании WETOP (DATA_MODEL §63, владелец 28.10.2026): доход, расходы и прибыль месяца, ожидаемый доход в
 * месяц по подпискам, должники. Суммы целыми центами USD в bigint, без чисел с плавающей точкой (AGENTS §12).
 * Месяц календарный по UTC, «сегодня» тоже по UTC: компания считает в одном поясе.
 */
export const EXPENSE_CATEGORIES = ['SERVER', 'DOMAINS', 'ADS', 'AI', 'SALARIES', 'SERVICES', 'PARTNERS', 'OTHER'] as const;
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
  /**
   * Таблица по месяцам (владелец 30.10.2026): шесть месяцев, выбранный последним; статьи расходов, где за полгода
   * что-то было, по порядку статей; итоги за полгода; маржа месяца десятыми процента к доходу (без дохода `null`)
   */
  table: {
    months: string[];
    income: string[];
    categories: Array<{ category: ExpenseCategory; cents: string[]; totalCents: string }>;
    profit: string[];
    totals: { incomeCents: string; expensesCents: string; profitCents: string };
    margin: Array<number | null>;
  };
  /** Ожидаем оплату в ближайшие 30 дней: подписки клиентов, у которых «оплачено до» в окне, по сроку */
  upcoming: Array<{ organizationId: string; paidUntil: string; monthlyCents: string }>;
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
  const history = [-5, -4, -3, -2, -1, 0].map((d) => sumMonth(shiftMonth(month, d)));
  const months = history.map((h) => h.month);
  const categories = EXPENSE_CATEGORIES.flatMap((category) => {
    const cents = months.map((m) =>
      expenses.filter((e) => e.category === category && monthOf(e.spentOn) === m).reduce((n, e) => n + e.amountCents, 0n),
    );
    const total = cents.reduce((n, c) => n + c, 0n);
    return total === 0n ? [] : [{ category, cents: cents.map(String), totalCents: String(total) }];
  });
  const sum = (pick: (h: MoneyMonth) => string) => history.reduce((n, h) => n + BigInt(pick(h)), 0n);
  const horizon = new Date(Date.parse(`${today}T00:00:00Z`) + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return {
    month: sumMonth(month),
    history,
    expectedMonthlyCents: String(subs.reduce((n, s) => n + s.monthlyCents, 0n)),
    expensesByCategory: EXPENSE_CATEGORIES.filter((c) => byCategory.has(c)).map((category) => ({
      category,
      cents: String(byCategory.get(category)!),
    })),
    overdue: subs
      .filter((s) => s.monthlyCents > 0n && (s.paidUntil === null || s.paidUntil < today))
      .map((s) => ({ organizationId: s.organizationId, paidUntil: s.paidUntil, monthlyCents: String(s.monthlyCents) }))
      .sort((a, b) => (a.paidUntil ?? '').localeCompare(b.paidUntil ?? '')),
    table: {
      months,
      income: history.map((h) => h.incomeCents),
      categories,
      profit: history.map((h) => h.profitCents),
      totals: {
        incomeCents: String(sum((h) => h.incomeCents)),
        expensesCents: String(sum((h) => h.expensesCents)),
        profitCents: String(sum((h) => h.profitCents)),
      },
      // BigInt делит к нулю: маржа без плавающей точки
      margin: history.map((h) => (BigInt(h.incomeCents) > 0n ? Number((BigInt(h.profitCents) * 1000n) / BigInt(h.incomeCents)) : null)),
    },
    upcoming: subs
      .filter((s) => s.monthlyCents > 0n && s.paidUntil !== null && s.paidUntil >= today && s.paidUntil <= horizon)
      .map((s) => ({ organizationId: s.organizationId, paidUntil: s.paidUntil!, monthlyCents: String(s.monthlyCents) }))
      .sort((a, b) => a.paidUntil.localeCompare(b.paidUntil)),
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

/** Ошибка разбора дополнительных полей: контроллер отдаёт её текст как 400 */
export class MoneyFieldError extends Error {}
const optText = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
};
const flag = (v: unknown, fallback: boolean) => (v === true || v === 'true' ? true : v === false || v === 'false' ? false : fallback);

/**
 * Подписка (DATA_MODEL PLATFORM-FIELDS-20261031, миграция 176): промокод (латиница, цифры, «-», до 40 знаков, хранится
 * заглавными), скидка целым процентом 0–100, автопродление (по умолчанию да).
 */
export function parseSubscriptionExtras(b: Record<string, unknown>): { promoCode: string | null; discountPercent: number | null; autoRenew: boolean } {
  const rawPromo = typeof b['promoCode'] === 'string' ? b['promoCode'].trim().toUpperCase() : '';
  if (rawPromo && !/^[A-Z0-9_-]{1,40}$/.test(rawPromo)) throw new MoneyFieldError('Промокод: латиница, цифры и «-», до 40 знаков');
  const rawDiscount = b['discountPercent'];
  let discountPercent: number | null = null;
  if (rawDiscount !== undefined && rawDiscount !== null && rawDiscount !== '') {
    const n = Number(rawDiscount);
    if (!Number.isInteger(n) || n < 0 || n > 100) throw new MoneyFieldError('Скидка: целое число от 0 до 100');
    discountPercent = n;
  }
  return { promoCode: rawPromo || null, discountPercent, autoRenew: flag(b['autoRenew'], true) };
}

/** Расход WETOP (миграция 176): кому заплатили, проект, повторяется ли, номер документа */
export function parseExpenseExtras(b: Record<string, unknown>): { payee: string | null; project: string | null; recurring: boolean; documentRef: string | null } {
  return {
    payee: optText(b['payee'], 200),
    project: optText(b['project'], 100),
    recurring: flag(b['recurring'], false),
    documentRef: optText(b['document'], 200),
  };
}

/** «Оплачено до» после оплаты: от большего из прежнего срока и дня оплаты, плюс месяцы тарифа */
export function extendPaidUntil(before: string | null, paidOn: string, months: number): string {
  const base = before && before > paidOn ? before : paidOn;
  const d = new Date(`${base}T00:00:00.000Z`);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + months;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), last))).toISOString().slice(0, 10);
}
