import type { DashboardStay } from './metrics';

/**
 * «Эффективность каналов» (ADR-141): доход, ночи и средняя стоимость ночи по каналу продаж.
 *
 * Правило: то же, что у «Обзора» «Аналитики» (Q-208, Q-209): берутся брони с заездом в периоде, без отменённых
 * и незаездов (и без отменённых мест внутри живой брони); доход брони: цена её действующих мест, по ночам сумма
 * не делится (разбивки выручки по ночам в данных нет). Ночи: ночи тех же мест. Средняя стоимость: доход на ночь,
 * целыми тиынами с отбрасыванием остатка, как ADR «Обзора». Канал брони OTA: её канал (имя уже сведено к одному
 * написанию), остальные источники (стойка, сайт, телефон…): строкой по источнику.
 */
export interface ChannelEfficiencyRow {
  /** Ключ строки: имя канала для OTA, код источника для прочих */
  label: string;
  source: string;
  channel: string | null;
  bookings: number;
  revenueMinor: string;
  /** Доля дохода, % с одним знаком */
  revenueShare: number;
  nights: number;
  nightsShare: number;
  adrMinor: string | null;
}
export interface ChannelEfficiency {
  from: string;
  to: string;
  rows: ChannelEfficiencyRow[];
  /** Все каналы периода для выбора на экране (порядок: по доходу), отбор по каналу их не сокращает */
  channels: Array<{ label: string; source: string }>;
  totals: { revenueMinor: string; nights: number; adrMinor: string | null; bookings: number };
}
export type ChannelEfficiencySort = 'revenue' | 'nights' | 'adr';

const inactive = new Set(['CANCELLED', 'NO_SHOW']);
const DAY = 86_400_000;
const nightsOf = (a: string, d: string) =>
  Math.max(0, Math.round((Date.parse(`${d}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY));
const percent = (part: bigint | number, whole: bigint | number) => {
  const p = BigInt(part);
  const w = BigInt(whole);
  return w > 0n ? Number((p * 1000n + w / 2n) / w) / 10 : 0;
};
const adr = (revenue: bigint, nights: number) =>
  nights > 0 ? (revenue / BigInt(nights)).toString() : null;

export function buildChannelEfficiency(
  stays: DashboardStay[],
  from: string,
  to: string,
  opts: { knownChannels?: string[]; channel?: string; sort?: ChannelEfficiencySort } = {},
): ChannelEfficiency {
  const groups = new Map<
    string,
    { source: string; channel: string | null; revenue: bigint; nights: number; bookings: Set<string> }
  >();
  for (const st of stays) {
    if (st.arrivalDate < from || st.arrivalDate > to) continue;
    if (inactive.has(st.reservationStatus) || inactive.has(st.status)) continue;
    const label = st.source === 'OTA' && st.channel ? st.channel : st.source;
    const g = groups.get(label) ?? {
      source: st.source,
      channel: st.source === 'OTA' ? st.channel : null,
      revenue: 0n,
      nights: 0,
      bookings: new Set<string>(),
    };
    g.revenue += st.priceMinor;
    g.nights += nightsOf(st.arrivalDate, st.departureDate);
    g.bookings.add(st.reservationId);
    groups.set(label, g);
  }
  for (const known of opts.knownChannels ?? [])
    if (!groups.has(known))
      groups.set(known, { source: 'OTA', channel: known, revenue: 0n, nights: 0, bookings: new Set() });

  let revenue = 0n;
  let nights = 0;
  let bookings = 0;
  for (const g of groups.values()) {
    revenue += g.revenue;
    nights += g.nights;
    bookings += g.bookings.size;
  }
  const channels = [...groups.entries()]
    .sort(([, a], [, b]) => cmp(b.revenue, a.revenue) || b.nights - a.nights)
    .map(([label, g]) => ({ label, source: g.source }));
  const sort = opts.sort ?? 'revenue';
  const rows = [...groups.entries()]
    .map(([label, g]): ChannelEfficiencyRow => ({
      label,
      source: g.source,
      channel: g.channel,
      bookings: g.bookings.size,
      revenueMinor: g.revenue.toString(),
      revenueShare: percent(g.revenue, revenue),
      nights: g.nights,
      nightsShare: percent(g.nights, nights),
      adrMinor: adr(g.revenue, g.nights),
    }))
    .filter((row) => !opts.channel || row.label === opts.channel)
    .sort((a, b) => {
      const by =
        sort === 'nights'
          ? b.nights - a.nights
          : sort === 'adr'
            ? cmp(BigInt(b.adrMinor ?? '0'), BigInt(a.adrMinor ?? '0'))
            : cmp(BigInt(b.revenueMinor), BigInt(a.revenueMinor));
      return by || (a.nights === 0 ? 1 : 0) - (b.nights === 0 ? 1 : 0) || 0;
    });
  // отбор по каналу: «Итого» равен показанным строкам, доли остаются от всех каналов периода
  if (opts.channel) {
    revenue = rows.reduce((s, r) => s + BigInt(r.revenueMinor), 0n);
    nights = rows.reduce((s, r) => s + r.nights, 0);
    bookings = rows.reduce((s, r) => s + r.bookings, 0);
  }
  return {
    from,
    to,
    rows,
    channels,
    totals: { revenueMinor: revenue.toString(), nights, adrMinor: adr(revenue, nights), bookings },
  };
}

const cmp = (a: bigint, b: bigint) => (a === b ? 0 : a > b ? 1 : -1);
