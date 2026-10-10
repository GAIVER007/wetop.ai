/**
 * Производные числа раздела «Маркетинг → Бюджет» (МКТ-В1/В2, ТЗ §6): чистые функции поверх ответа
 * `GET /marketing/budget`, без своих запросов (как derive в /market). Деньги BigInt в minor units
 * (ADR-008): входные строки API превращаются в bigint здесь и форматируются только на экране.
 */

export interface BudgetExpense {
  id: string;
  date: string;
  platform: string;
  campaign: string | null;
  category: string;
  description: string | null;
  amount: string;
  currency: string;
  fxRate: string;
  baseAmount: string;
  countedInBudget: boolean;
}

export interface BudgetTotals {
  /** Учтённый расход месяца в валюте отчётности */
  spent: bigint;
  /** План минус учтённое; null: план не задан */
  remainder: bigint | null;
  /** Прогноз конца месяца: темп прошедших дней на весь месяц; будущий месяц прогноза не имеет */
  forecast: bigint | null;
  daysInMonth: number;
  daysPassed: number;
  daysLeft: number;
  /** Сколько процентов плана уже израсходовано; null: план не задан */
  planUsedPct: number | null;
  /** Прогноз укладывается в план; null: нет плана или прогноза */
  onTrack: boolean | null;
}

const daysIn = (month: string): number => {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y!, m!, 0)).getUTCDate();
};

const counted = (expenses: BudgetExpense[]): BudgetExpense[] =>
  expenses.filter((e) => e.countedInBudget);

const pct = (part: bigint, whole: bigint): number => Number((part * 100n + whole / 2n) / whole);

export function summarize(view: {
  month: string;
  today: string;
  plan: string | null;
  expenses: BudgetExpense[];
}): BudgetTotals {
  const daysInMonth = daysIn(view.month);
  const todayMonth = view.today.slice(0, 7);
  const daysPassed =
    view.month < todayMonth ? daysInMonth : view.month > todayMonth ? 0 : Number(view.today.slice(8, 10));
  const daysLeft = daysInMonth - daysPassed;
  const spent = counted(view.expenses).reduce((s, e) => s + BigInt(e.baseAmount), 0n);
  const plan = view.plan === null ? null : BigInt(view.plan);
  const forecast =
    view.month > todayMonth
      ? null
      : view.month < todayMonth || daysPassed === 0
        ? spent
        : (spent * BigInt(daysInMonth)) / BigInt(daysPassed);
  return {
    spent,
    remainder: plan === null ? null : plan - spent,
    forecast,
    daysInMonth,
    daysPassed,
    daysLeft,
    planUsedPct: plan === null || plan === 0n ? null : pct(spent, plan),
    onTrack: plan === null || forecast === null ? null : forecast <= plan,
  };
}

export interface PlatformShare {
  platform: string;
  /** Учтённый расход платформы в валюте отчётности */
  base: bigint;
  /** Доля в процентах от учтённого расхода месяца */
  share: number;
}

export function byPlatform(expenses: BudgetExpense[]): PlatformShare[] {
  const sums = new Map<string, bigint>();
  for (const e of counted(expenses))
    sums.set(e.platform, (sums.get(e.platform) ?? 0n) + BigInt(e.baseAmount));
  const total = [...sums.values()].reduce((s, v) => s + v, 0n);
  if (total === 0n) return [];
  return [...sums.entries()]
    .map(([platform, base]) => ({ platform, base, share: pct(base, total) }))
    .sort((a, b) => (a.base === b.base ? a.platform.localeCompare(b.platform) : a.base > b.base ? -1 : 1));
}

/** Расход каждого дня месяца (все строки, и вне бюджета тоже: график показывает деньги, а не план) */
export function byDay(expenses: BudgetExpense[], month: string): bigint[] {
  const days: bigint[] = Array.from({ length: daysIn(month) }, () => 0n);
  for (const e of expenses) {
    if (e.date.slice(0, 7) !== month) continue;
    const i = Number(e.date.slice(8, 10)) - 1;
    days[i] = days[i]! + BigInt(e.baseAmount);
  }
  return days;
}

/** Изменение к прошлому месяцу в процентах; прошлого нет: null (делить не на что) */
export function monthDelta(current: bigint, previous: bigint): number | null {
  if (previous === 0n) return null;
  return Number(((current - previous) * 100n + (current >= previous ? previous / 2n : -(previous / 2n))) / previous);
}
