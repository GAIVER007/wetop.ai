/**
 * Загрузка конкурентов (DATA_MODEL §23, ADR-142): разбор ввода и сводка «вы и рынок» по ночам.
 *
 * Проценты живут целыми базисными пунктами (85,5 % = 8 550), как деньги в тиынах (ADR-008): средние и разницы
 * считаются без чисел с плавающей точкой в хранении. Своя загрузка приходит готовыми клетками календаря
 * (занято, свободно, блок), тем же знаменателем, что «Аналитика → Загрузка».
 */

export class MarketInputError extends Error {}

export const MARKET_MAX_DAYS = 31;
export const MARKET_MAX_COMPETITORS = 15;
/** Пороги подсказок (Q-258, умолчание): рынок от 85 % высокий спрос, до 50 % слабый, разница 10 п.п. */
export const HIGH_DEMAND_BP = 8500;
export const LOW_DEMAND_BP = 5000;
export const GAP_BP = 1000;
const MAX_INSIGHTS = 5;

export type ObservationSource = 'MANUAL' | 'AI_AGENT';
export type DemandLevel = 'high' | 'mid' | 'low';

/** «85», «85,5», «92.25 %» → базисные пункты; пусто → null */
export function parseOccupancyPercent(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).replace(/%/g, '').replace(',', '.').trim();
  if (text === '') return null;
  if (!/^-?\d+(\.\d+)?$/.test(text))
    throw new MarketInputError('Загрузка: число процентов от 0 до 100, например 85 или 85,5');
  const [whole, frac = ''] = text.replace('-', '').split('.');
  if (frac.length > 2)
    throw new MarketInputError('Загрузка: не больше двух знаков после запятой');
  const bp = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  if (text.startsWith('-') || bp > 10000)
    throw new MarketInputError('Загрузка: число процентов от 0 до 100');
  return bp;
}

/** 8 500 → «85 %», 8 550 → «85,5 %» */
export function formatOccupancy(bp: number): string {
  const whole = Math.trunc(bp / 100);
  const frac = String(Math.abs(bp % 100)).padStart(2, '0').replace(/0+$/, '');
  return `${whole}${frac ? `,${frac}` : ''} %`;
}

/** Разница в процентных пунктах: 1 000 → «+10 п.п.», −250 → «−2,5 п.п.» */
export function formatPoints(bp: number): string {
  const sign = bp > 0 ? '+' : bp < 0 ? '−' : '';
  return `${sign}${formatOccupancy(Math.abs(bp)).replace(' %', '')} п.п.`;
}

export function demandLevel(bp: number | null | undefined): DemandLevel | null {
  if (bp === null || bp === undefined) return null;
  if (bp >= HIGH_DEMAND_BP) return 'high';
  if (bp <= LOW_DEMAND_BP) return 'low';
  return 'mid';
}

export interface CompetitorInput {
  name?: string;
  distanceM?: number | null;
  unitsTotal?: number | null;
  url?: string | null;
  note?: string | null;
}

const optionalInt = (raw: unknown, label: string, min: number): number | null | undefined => {
  if (raw === undefined) return undefined;
  if (raw === null || String(raw).trim() === '') return null;
  const n = Number(String(raw).replace(/\s/g, ''));
  if (!Number.isInteger(n) || n < min || n > 1_000_000)
    throw new MarketInputError(`${label}: целое число${min > 0 ? ' больше нуля' : ' от нуля'}`);
  return n;
};

const optionalText = (raw: unknown, label: string, max: number): string | null | undefined => {
  if (raw === undefined) return undefined;
  const text = raw === null ? '' : String(raw).trim();
  if (text === '') return null;
  if (text.length > max) throw new MarketInputError(`${label}: не длиннее ${max} знаков`);
  return text;
};

/** Поля конкурента из формы; при правке пустое необязательное поле снимается (null) */
export function parseCompetitorInput(
  dto: Record<string, unknown>,
  mode: 'create' | 'update',
): CompetitorInput {
  const out: CompetitorInput = {};
  if (dto.name !== undefined || mode === 'create') {
    const name = String(dto.name ?? '').trim();
    if (!name) throw new MarketInputError('Название конкурента обязательно');
    if (name.length > 120) throw new MarketInputError('Название: не длиннее 120 знаков');
    out.name = name;
  }
  const distanceM = optionalInt(dto.distanceM, 'Расстояние в метрах', 0);
  if (distanceM !== undefined) out.distanceM = distanceM;
  const unitsTotal = optionalInt(dto.unitsTotal, 'Номеров у конкурента', 1);
  if (unitsTotal !== undefined) out.unitsTotal = unitsTotal;
  const url = optionalText(dto.url, 'Ссылка', 500);
  if (url !== undefined) {
    if (url !== null && !/^https?:\/\/[^\s]+$/i.test(url))
      throw new MarketInputError('Ссылка: адрес страницы, начинается с https://');
    out.url = url;
  }
  const note = optionalText(dto.note, 'Заметка', 500);
  if (note !== undefined) out.note = note;
  return out;
}

const plusDays = (iso: string, n: number): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Ночи окна подряд, начиная с `from` */
export function marketDates(from: string, days: number): string[] {
  return Array.from({ length: days }, (_, i) => plusDays(from, i));
}

export interface MarketReading {
  competitorId: string;
  stayDate: string;
  observedOn: string;
  occupancyBp: number;
  source: ObservationSource;
}

export interface MarketCompetitorRef {
  id: string;
  name: string;
  distanceM: number | null;
  unitsTotal: number | null;
  url: string | null;
}

export interface OwnDay {
  occupied: number;
  free: number;
  blocked: number;
}

export interface MarketCell {
  date: string;
  bp: number | null;
  /** Изменение к дате сравнения; null: сравнения нет или нового снимка после неё не было */
  deltaBp: number | null;
  source: ObservationSource | null;
}

export type InsightKind = 'high-behind' | 'high' | 'low-ahead' | 'low' | 'missing';

export interface MarketInsight {
  kind: InsightKind;
  from: string;
  to: string;
  nights: number;
  /** Средние по отрезку; у «нет данных» не заданы */
  marketBp: number | null;
  ownBp: number | null;
  /** Только у «нет данных»: у кого нет ни одного снимка в окне */
  competitors?: string[];
}

export interface MarketBoard {
  dates: string[];
  asOf: string;
  compareDays: number;
  own: Array<{ date: string; bp: number | null }>;
  competitors: Array<
    MarketCompetitorRef & {
      cells: MarketCell[];
      sources: ObservationSource[];
      lastObservedOn: string | null;
    }
  >;
  market: Array<{ date: string; bp: number | null; count: number }>;
  gap: Array<{ date: string; bp: number | null }>;
  summary: {
    marketBp: number | null;
    ownBp: number | null;
    gapBp: number | null;
    highDemandNights: number;
    competitors: number;
    competitorsWithData: number;
  };
  insights: MarketInsight[];
}

const mean = (xs: number[]): number | null =>
  xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null;

/** Последний снимок каждой пары «конкурент, ночь» с днём снимка не позже `asOf` */
function latestAsOf(readings: MarketReading[], asOf: string): Map<string, MarketReading> {
  const out = new Map<string, MarketReading>();
  for (const r of readings) {
    if (r.observedOn > asOf) continue;
    const key = `${r.competitorId}|${r.stayDate}`;
    const prev = out.get(key);
    if (!prev || r.observedOn > prev.observedOn) out.set(key, r);
  }
  return out;
}

const INSIGHT_ORDER: InsightKind[] = ['high-behind', 'high', 'low-ahead', 'low', 'missing'];

function nightKind(market: number | null, own: number | null): InsightKind | null {
  if (market === null) return null;
  if (market >= HIGH_DEMAND_BP)
    return own !== null && own <= market - GAP_BP ? 'high-behind' : 'high';
  if (market <= LOW_DEMAND_BP)
    return own !== null && own >= market + GAP_BP ? 'low-ahead' : 'low';
  return null;
}

export function buildMarketBoard(input: {
  dates: string[];
  asOf: string;
  /** 0: без сравнения, 1: со вчера, 7: с неделей назад */
  compareDays: number;
  own: Record<string, OwnDay>;
  competitors: MarketCompetitorRef[];
  readings: MarketReading[];
}): MarketBoard {
  const { dates, asOf, compareDays } = input;
  const current = latestAsOf(input.readings, asOf);
  const compareOn = compareDays > 0 ? plusDays(asOf, -compareDays) : null;
  const earlier = compareOn ? latestAsOf(input.readings, compareOn) : new Map();

  let ownOccupied = 0;
  let ownTotal = 0;
  const own = dates.map((date) => {
    const d = input.own[date];
    const total = d ? d.occupied + d.free + d.blocked : 0;
    if (!d || total === 0) return { date, bp: null };
    ownOccupied += d.occupied;
    ownTotal += total;
    return { date, bp: Math.round((d.occupied * 10000) / total) };
  });

  const sorted = [...input.competitors].sort(
    (a, b) =>
      (a.distanceM ?? Number.MAX_SAFE_INTEGER) - (b.distanceM ?? Number.MAX_SAFE_INTEGER) ||
      a.name.localeCompare(b.name, 'ru'),
  );
  const competitors = sorted.map((c) => {
    const sources = new Set<ObservationSource>();
    let lastObservedOn: string | null = null;
    const cells = dates.map((date): MarketCell => {
      const now = current.get(`${c.id}|${date}`);
      if (!now) return { date, bp: null, deltaBp: null, source: null };
      sources.add(now.source);
      if (!lastObservedOn || now.observedOn > lastObservedOn) lastObservedOn = now.observedOn;
      const before = compareOn && now.observedOn > compareOn ? earlier.get(`${c.id}|${date}`) : undefined;
      return {
        date,
        bp: now.occupancyBp,
        deltaBp: before ? now.occupancyBp - before.occupancyBp : null,
        source: now.source,
      };
    });
    return { ...c, cells, sources: [...sources].sort(), lastObservedOn };
  });

  const market = dates.map((date, i) => {
    const values = competitors.flatMap((c) => (c.cells[i]!.bp === null ? [] : [c.cells[i]!.bp!]));
    return { date, bp: mean(values), count: values.length };
  });
  const gap = dates.map((date, i) => {
    const m = market[i]!.bp;
    const o = own[i]!.bp;
    return { date, bp: m === null || o === null ? null : o - m };
  });

  const marketBp = mean(market.flatMap((m) => (m.bp === null ? [] : [m.bp])));
  const ownBp = ownTotal ? Math.round((ownOccupied * 10000) / ownTotal) : null;
  const withData = competitors.filter((c) => c.lastObservedOn !== null);

  // Подсказки: ночи одного правила подряд: один отрезок
  const ranges: MarketInsight[] = [];
  let open: { kind: InsightKind; idx: number[] } | null = null;
  const close = () => {
    if (!open) return;
    const ms = open.idx.map((i) => market[i]!.bp!);
    const os = open.idx.flatMap((i) => (own[i]!.bp === null ? [] : [own[i]!.bp!]));
    ranges.push({
      kind: open.kind,
      from: dates[open.idx[0]!]!,
      to: dates[open.idx.at(-1)!]!,
      nights: open.idx.length,
      marketBp: mean(ms),
      ownBp: mean(os),
    });
    open = null;
  };
  dates.forEach((_, i) => {
    const kind = nightKind(market[i]!.bp, own[i]!.bp);
    if (open && open.kind === kind) open.idx.push(i);
    else {
      close();
      if (kind) open = { kind, idx: [i] };
    }
  });
  close();
  const missing = competitors.filter((c) => c.lastObservedOn === null).map((c) => c.name);
  if (missing.length && dates.length)
    ranges.push({
      kind: 'missing',
      from: dates[0]!,
      to: dates.at(-1)!,
      nights: dates.length,
      marketBp: null,
      ownBp: null,
      competitors: missing,
    });
  const insights = ranges
    .sort(
      (a, b) =>
        INSIGHT_ORDER.indexOf(a.kind) - INSIGHT_ORDER.indexOf(b.kind) || a.from.localeCompare(b.from),
    )
    .slice(0, MAX_INSIGHTS);

  return {
    dates,
    asOf,
    compareDays,
    own,
    competitors,
    market,
    gap,
    summary: {
      marketBp,
      ownBp,
      gapBp: marketBp === null || ownBp === null ? null : ownBp - marketBp,
      highDemandNights: market.filter((m) => m.bp !== null && m.bp >= HIGH_DEMAND_BP).length,
      competitors: competitors.length,
      competitorsWithData: withData.length,
    },
    insights,
  };
}

export interface NightHistory {
  stayDate: string;
  competitors: MarketCompetitorRef[];
  /** Дни снимков по возрастанию: значение конкурента на этот день и средняя по рынку */
  days: Array<{
    observedOn: string;
    values: Array<{ competitorId: string; bp: number | null; observed: boolean }>;
    marketBp: number | null;
    count: number;
  }>;
  /** Темп рынка: средняя последнего дня минус средняя первого дня, где рынок известен; null — меньше двух точек */
  pickupBp: number | null;
}

/**
 * «История ночи» (ADR-142, M1.2): как заполнялись соседи на одну ночь по дням снимков. Значение конкурента держится до
 * его следующего снимка, `observed` говорит, был ли снимок в этот самый день. Показываются свежие `maxDays` дней.
 */
export function buildNightHistory(input: {
  stayDate: string;
  competitors: MarketCompetitorRef[];
  readings: MarketReading[];
  maxDays?: number;
}): NightHistory {
  const ids = new Set(input.competitors.map((c) => c.id));
  const readings = input.readings.filter(
    (r) => r.stayDate === input.stayDate && ids.has(r.competitorId),
  );
  const byDay = new Map<string, Map<string, number>>();
  for (const r of readings) {
    const day = byDay.get(r.observedOn) ?? new Map<string, number>();
    day.set(r.competitorId, r.occupancyBp);
    byDay.set(r.observedOn, day);
  }
  const allDays = [...byDay.keys()].sort();
  const last = new Map<string, number>();
  const days = allDays.map((observedOn) => {
    const today = byDay.get(observedOn)!;
    for (const [id, bp] of today) last.set(id, bp);
    const values = input.competitors.map((c) => ({
      competitorId: c.id,
      bp: last.get(c.id) ?? null,
      observed: today.has(c.id),
    }));
    const known = values.flatMap((v) => (v.bp === null ? [] : [v.bp]));
    return { observedOn, values, marketBp: mean(known), count: known.length };
  });
  const shown = days.slice(-(input.maxDays ?? 30));
  const withMarket = shown.filter((d) => d.marketBp !== null);
  const pickupBp =
    withMarket.length >= 2 ? withMarket.at(-1)!.marketBp! - withMarket[0]!.marketBp! : null;
  return { stayDate: input.stayDate, competitors: input.competitors, days: shown, pickupBp };
}

/**
 * Площадка по ссылке конкурента: стойка подписывает «Сбор не подключён» у соседа со ссылкой на площадку. Будет ли
 * сборщик читать площадки, не решено (Q-257 открыт; ADR-142 автоматический сбор с площадок запрещает).
 */
const PLATFORMS: Array<[RegExp, string]> = [
  [/(^|\.)booking\.com$/, 'Booking.com'],
  [/(^|\.)trip\.com$/, 'Trip.com'],
  [/(^|\.)ostrovok\.ru$/, 'Ostrovok'],
  [/(^|\.)airbnb\.[a-z.]+$/, 'Airbnb'],
];

export function competitorPlatform(url: string | null | undefined): string | null {
  if (!url) return null;
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  return PLATFORMS.find(([re]) => re.test(host))?.[1] ?? null;
}
