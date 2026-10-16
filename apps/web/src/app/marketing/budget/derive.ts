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

/** Строка разбивки плана по каналам (§52) в ответе API */
export interface BudgetLine {
  platform: string;
  amount: string;
}

/** План месяца по правилу §52: общий план главный, без него план это сумма каналов; ни того ни другого: null */
const effectivePlan = (plan: string | null, lines: BudgetLine[] | undefined): bigint | null => {
  if (plan !== null) return BigInt(plan);
  const sum = (lines ?? []).reduce((s, l) => s + BigInt(l.amount), 0n);
  return sum > 0n ? sum : null;
};

export function summarize(view: {
  month: string;
  today: string;
  plan: string | null;
  lines?: BudgetLine[] | undefined;
  expenses: BudgetExpense[];
}): BudgetTotals {
  const daysInMonth = daysIn(view.month);
  const todayMonth = view.today.slice(0, 7);
  const daysPassed =
    view.month < todayMonth ? daysInMonth : view.month > todayMonth ? 0 : Number(view.today.slice(8, 10));
  const daysLeft = daysInMonth - daysPassed;
  const spent = counted(view.expenses).reduce((s, e) => s + BigInt(e.baseAmount), 0n);
  const plan = effectivePlan(view.plan, view.lines);
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

export interface ChannelPlanRow {
  platform: string;
  /** План канала; null: расход есть, а канала в разбивке нет */
  plan: bigint | null;
  spent: bigint;
  remainder: bigint | null;
  /** Прогноз конца месяца канала тем же правилом, что у месяца; будущий месяц: null */
  forecast: bigint | null;
  /** Прогноз выше плана канала */
  over: boolean;
}

export interface ChannelPlan {
  /** Сначала каналы с планом (по убыванию плана), затем каналы с расходом без плана (по убыванию расхода) */
  rows: ChannelPlanRow[];
  /** Сумма планов каналов */
  allocated: bigint;
  /** Общий план минус разбивка; null: общего плана нет (план месяца это сама разбивка) */
  unallocated: bigint | null;
  /** Каналы расписали больше общего плана: предупреждение, ввод не запрещён (ADR-MKT-B7) */
  overAllocated: boolean;
}

/** План против факта по каналам (DATA_MODEL §52): из разбивки плана и учтённых расходов месяца */
export function channelPlan(view: {
  month: string;
  today: string;
  plan: string | null;
  lines: BudgetLine[];
  expenses: BudgetExpense[];
}): ChannelPlan {
  const t = summarize({ ...view, lines: [] });
  const scale = (v: bigint): bigint | null =>
    t.forecast === null ? null : t.daysPassed === 0 || t.daysPassed === t.daysInMonth ? v : (v * BigInt(t.daysInMonth)) / BigInt(t.daysPassed);
  const spentBy = new Map<string, bigint>();
  for (const e of counted(view.expenses))
    spentBy.set(e.platform, (spentBy.get(e.platform) ?? 0n) + BigInt(e.baseAmount));
  const row = (platform: string, plan: bigint | null): ChannelPlanRow => {
    const spent = spentBy.get(platform) ?? 0n;
    const forecast = scale(spent);
    return {
      platform,
      plan,
      spent,
      remainder: plan === null ? null : plan - spent,
      forecast,
      over: plan !== null && forecast !== null && forecast > plan,
    };
  };
  const desc = (a: bigint, b: bigint) => (a === b ? 0 : a > b ? -1 : 1);
  const planned = view.lines
    .map((l) => row(l.platform, BigInt(l.amount)))
    .sort((a, b) => desc(a.plan!, b.plan!));
  const unplanned = [...spentBy.keys()]
    .filter((p) => !view.lines.some((l) => l.platform === p))
    .map((p) => row(p, null))
    .sort((a, b) => desc(a.spent, b.spent));
  const allocated = view.lines.reduce((s, l) => s + BigInt(l.amount), 0n);
  const plan = view.plan === null ? null : BigInt(view.plan);
  return {
    rows: [...planned, ...unplanned],
    allocated,
    unallocated: plan === null ? null : plan - allocated,
    overAllocated: plan !== null && allocated > plan,
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
