/**
 * Воронка маркетинга «Расходы → Обращения → Брони → Выручка» (МКТ-В5a, ADR-MKT-B5a, Q-MKT-ATTR).
 * Чистая сборка: расходы по платформам из журнала «Бюджета» и результаты каналов из своих таблиц
 * (брони, ИИ-продавец, заявки сайта). Деньги BigInt в minor units (ADR-008), делим целыми с округлением.
 * Реклама без кабинетов (Meta, Google, TikTok, YouTube, прочее) показывает только расход: связать её
 * с бронями можно будет с кабинетами (этап В3), до тех пор результат не выдумывается.
 */

/** Каналы, у которых результат известен из своих данных */
export const RESULT_CHANNELS = ['SITE', 'WHATSAPP', 'INSTAGRAM', 'PHONE'] as const;
export type ResultChannel = (typeof RESULT_CHANNELS)[number];

export interface ChannelResult {
  channel: ResultChannel;
  /** Обращения: заявки, предложения ИИ-продавца (разные диалоги), брони без ИИ-продавца */
  leads: number;
  /** Брони без отменённых и незаездов */
  bookings: number;
  /** Выручка этих броней в валюте объекта, minor units */
  revenueMinor: bigint;
}

export interface FunnelRow {
  platform: string;
  spendMinor: bigint;
  /** false: у канала нет своих результатов (реклама до кабинетов) */
  hasResults: boolean;
  leads: number | null;
  bookings: number | null;
  revenueMinor: bigint | null;
  cplMinor: bigint | null;
  costPerBookingMinor: bigint | null;
  romiPct: number | null;
}

export interface FunnelTotal {
  spendMinor: bigint;
  leads: number;
  bookings: number;
  revenueMinor: bigint;
  cplMinor: bigint | null;
  costPerBookingMinor: bigint | null;
  romiPct: number | null;
}

export interface MarketingFunnel {
  rows: FunnelRow[];
  total: FunnelTotal;
  /** ROMI сравнивает выручку с расходом: только при известной выручке в той же валюте */
  romiAvailable: boolean;
}

const RESULT_SET = new Set<string>(RESULT_CHANNELS);

/**
 * ROMI сравнивает выручку с расходом: только когда выручка известна и в той же валюте. `revenueCurrency: null`
 * значит, что результатов каналов нет (салон и ресторан, сбой): выручка неизвестна, а не ноль, и ROMI не −100 %
 * (аудит платформы 17.10.2026, Д7).
 */
const romiComparable = (revenueCurrency: string | null, reportingCurrency: string): boolean =>
  revenueCurrency !== null && revenueCurrency === reportingCurrency;

/** a / b целыми, к ближайшему; b > 0 */
const divRound = (a: bigint, b: bigint): bigint => (a * 2n + b) / (b * 2n);

const perUnit = (spend: bigint, count: number): bigint | null =>
  spend > 0n && count > 0 ? divRound(spend, BigInt(count)) : null;

/** (выручка − расход) / расход в целых процентах, к ближайшему; знак сохраняется */
const romi = (revenue: bigint, spend: bigint): number | null => {
  if (spend <= 0n) return null;
  const num = (revenue - spend) * 100n;
  const rounded = num >= 0n ? divRound(num, spend) : -divRound(-num, spend);
  return Number(rounded);
};

export function buildMarketingFunnel(input: {
  spendByPlatform: Record<string, bigint>;
  channels: ChannelResult[];
  reportingCurrency: string;
  revenueCurrency: string | null;
}): MarketingFunnel {
  const romiAvailable = romiComparable(input.revenueCurrency, input.reportingCurrency);
  const results = new Map(input.channels.map((c) => [c.channel as string, c]));
  const platforms = new Set<string>([
    ...Object.keys(input.spendByPlatform).filter((p) => (input.spendByPlatform[p] ?? 0n) > 0n),
    ...input.channels
      .filter((c) => c.leads > 0 || c.bookings > 0 || c.revenueMinor > 0n)
      .map((c) => c.channel),
  ]);

  const rows: FunnelRow[] = [...platforms].map((platform) => {
    const spend = input.spendByPlatform[platform] ?? 0n;
    if (!RESULT_SET.has(platform)) {
      return {
        platform,
        spendMinor: spend,
        hasResults: false,
        leads: null,
        bookings: null,
        revenueMinor: null,
        cplMinor: null,
        costPerBookingMinor: null,
        romiPct: null,
      };
    }
    const r = results.get(platform);
    const leads = r?.leads ?? 0;
    const bookings = r?.bookings ?? 0;
    const revenue = r?.revenueMinor ?? 0n;
    return {
      platform,
      spendMinor: spend,
      hasResults: true,
      leads,
      bookings,
      revenueMinor: revenue,
      cplMinor: perUnit(spend, leads),
      costPerBookingMinor: perUnit(spend, bookings),
      romiPct: romiAvailable ? romi(revenue, spend) : null,
    };
  });

  rows.sort((a, b) =>
    a.hasResults !== b.hasResults
      ? a.hasResults
        ? -1
        : 1
      : a.spendMinor === b.spendMinor
        ? a.platform.localeCompare(b.platform)
        : a.spendMinor > b.spendMinor
          ? -1
          : 1,
  );

  const spendMinor = Object.values(input.spendByPlatform).reduce((s, v) => s + v, 0n);
  const leads = input.channels.reduce((s, c) => s + c.leads, 0);
  const bookings = input.channels.reduce((s, c) => s + c.bookings, 0);
  const revenueMinor = input.channels.reduce((s, c) => s + c.revenueMinor, 0n);
  return {
    rows,
    romiAvailable,
    total: {
      spendMinor,
      leads,
      bookings,
      revenueMinor,
      cplMinor: perUnit(spendMinor, leads),
      costPerBookingMinor: perUnit(spendMinor, bookings),
      romiPct: romiAvailable ? romi(revenueMinor, spendMinor) : null,
    },
  };
}

/**
 * Результаты одного дня по всем маркетинговым каналам вместе. Обращение относится к дню первого
 * предложения ИИ-продавца в диалоге или к дню заявки и брони, поэтому сумма дней равна месяцу.
 */
export interface DayResult {
  /** ГГГГ-ММ-ДД в поясе объекта */
  date: string;
  leads: number;
  /** Живые брони дня (без отменённых и незаездов) */
  bookings: number;
  /** Из них брони гостей, у которых раньше не было броней у этого объекта */
  newGuests: number;
  revenueMinor: bigint;
}

export interface DayRow extends DayResult {
  spendMinor: bigint;
  cplMinor: bigint | null;
  romiPct: number | null;
}

export interface MarketingDays {
  rows: DayRow[];
  total: Omit<DayRow, 'date'>;
}

/**
 * «Календарь маркетинга»: каждый день месяца (до `lastDay`, если месяц текущий) с расходом,
 * обращениями, CPL, бронями, новыми гостями, выручкой и ROMI по выручке; итог равен сумме дней.
 * Пустой день без расхода и результата даёт прочерки в CPL и ROMI, а не нули процентов.
 */
export function buildMarketingDays(input: {
  month: string;
  /** Последний показанный день (сегодня для текущего месяца); без него весь месяц */
  lastDay?: number;
  days: DayResult[];
  spendByDay: Record<string, bigint>;
  reportingCurrency: string;
  revenueCurrency: string | null;
}): MarketingDays {
  const romiAvailable = romiComparable(input.revenueCurrency, input.reportingCurrency);
  const [y, m] = input.month.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  const last = Math.min(input.lastDay ?? daysInMonth, daysInMonth);
  const byDate = new Map(input.days.map((d) => [d.date, d]));
  const rows: DayRow[] = [];
  for (let n = 1; n <= last; n += 1) {
    const date = `${input.month}-${String(n).padStart(2, '0')}`;
    const r = byDate.get(date);
    const spend = input.spendByDay[date] ?? 0n;
    const leads = r?.leads ?? 0;
    const revenue = r?.revenueMinor ?? 0n;
    rows.push({
      date,
      spendMinor: spend,
      leads,
      bookings: r?.bookings ?? 0,
      newGuests: r?.newGuests ?? 0,
      revenueMinor: revenue,
      cplMinor: perUnit(spend, leads),
      romiPct: romiAvailable ? romi(revenue, spend) : null,
    });
  }
  const spendMinor = rows.reduce((s, r) => s + r.spendMinor, 0n);
  const leads = rows.reduce((s, r) => s + r.leads, 0);
  const revenueMinor = rows.reduce((s, r) => s + r.revenueMinor, 0n);
  return {
    rows,
    total: {
      spendMinor,
      leads,
      bookings: rows.reduce((s, r) => s + r.bookings, 0),
      newGuests: rows.reduce((s, r) => s + r.newGuests, 0),
      revenueMinor,
      cplMinor: perUnit(spendMinor, leads),
      romiPct: romiAvailable ? romi(revenueMinor, spendMinor) : null,
    },
  };
}
