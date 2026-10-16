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
  /** ROMI сравнивает выручку с расходом, поэтому только при одной валюте */
  romiAvailable: boolean;
}

const RESULT_SET = new Set<string>(RESULT_CHANNELS);

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
  const romiAvailable =
    input.revenueCurrency === null || input.revenueCurrency === input.reportingCurrency;
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
