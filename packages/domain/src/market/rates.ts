import { MarketInputError, type ObservationSource } from './occupancy';

/**
 * Цены конкурентов (DATA_MODEL §23.1, ADR-155): разбор ввода и «ценовая доска». Всё в минорных единицах целым
 * (ADR-008). Правило то же, что у загрузки: значение на день снимка D это последний снимок с `observed_on ≤ D`.
 * Неизвестное не равно нулю: нет цены на ночь, значит `null`, а не 0.
 */
const MAX_MAJOR = 100_000_000n;

/**
 * «42 000», «42000,50», «42000.5» → минорные единицы. Пусто значит «цены нет» (`null`). Ноль, минус, буквы и сумма
 * сверх ста миллионов отклоняются.
 */
export function parsePriceInput(raw: unknown): bigint | null {
  if (raw === undefined || raw === null) return null;
  const text = String(raw).replace(/\s/g, '').replace(',', '.');
  if (text === '') return null;
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) throw new MarketInputError('Цена: число, например 42 000 или 42000,50');
  const major = BigInt(match[1]!);
  const minor = BigInt((match[2] ?? '').padEnd(2, '0') || '0');
  const total = major * 100n + minor;
  if (total <= 0n) throw new MarketInputError('Цена: больше нуля');
  if (major >= MAX_MAJOR) throw new MarketInputError('Цена: слишком большое число');
  return total;
}

export interface PriceReading {
  competitorId: string;
  stayDate: string;
  observedOn: string;
  priceMinor: bigint;
  currency: string;
  source: ObservationSource;
}

export interface PriceCell {
  date: string;
  priceMinor: bigint | null;
  source: ObservationSource | null;
}

export interface PriceBoard {
  /** Валюта цен; `null`, если цен нет вовсе. Разные валюты в одном объекте не смешиваются: берётся первая найденная */
  currency: string | null;
  competitors: Array<{
    id: string;
    cells: PriceCell[];
    /** Средняя цена по ночам, где она есть */
    avgMinor: bigint | null;
    /** Изменение средней к дате сравнения, в десятых долях процента (50 = +5 %), по ночам, где цена была в обе даты */
    changePermille: number | null;
    lastObservedOn: string | null;
  }>;
  market: Array<{
    date: string;
    avgMinor: bigint | null;
    minMinor: bigint | null;
    maxMinor: bigint | null;
    count: number;
  }>;
  summary: {
    marketAvgMinor: bigint | null;
    minMinor: bigint | null;
    maxMinor: bigint | null;
    competitorsWithData: number;
  };
}

const plusDays = (iso: string, n: number): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Среднее целым с округлением к ближайшему; пусто это `null` */
const mean = (values: bigint[]): bigint | null => {
  if (values.length === 0) return null;
  const n = BigInt(values.length);
  const sum = values.reduce((a, b) => a + b, 0n);
  return (sum * 2n + n) / (n * 2n);
};

function latestAsOf(readings: PriceReading[], asOf: string): Map<string, PriceReading> {
  const out = new Map<string, PriceReading>();
  for (const r of readings) {
    if (r.observedOn > asOf) continue;
    const key = `${r.competitorId}|${r.stayDate}`;
    const prev = out.get(key);
    if (!prev || r.observedOn > prev.observedOn) out.set(key, r);
  }
  return out;
}

export function buildPriceBoard(input: {
  dates: string[];
  asOf: string;
  /** 0: без сравнения, 1: со вчера, 7: с неделей назад */
  compareDays: number;
  competitors: Array<{ id: string }>;
  readings: PriceReading[];
}): PriceBoard {
  const { dates, asOf, compareDays } = input;
  const current = latestAsOf(input.readings, asOf);
  const compareOn = compareDays > 0 ? plusDays(asOf, -compareDays) : null;
  const earlier = compareOn ? latestAsOf(input.readings, compareOn) : new Map<string, PriceReading>();
  let currency: string | null = null;

  const competitors = input.competitors.map((c) => {
    let lastObservedOn: string | null = null;
    let nowSum = 0n;
    let beforeSum = 0n;
    let both = 0;
    const cells = dates.map((date): PriceCell => {
      const now = current.get(`${c.id}|${date}`);
      if (!now) return { date, priceMinor: null, source: null };
      currency ??= now.currency;
      if (!lastObservedOn || now.observedOn > lastObservedOn) lastObservedOn = now.observedOn;
      const before = compareOn && now.observedOn > compareOn ? earlier.get(`${c.id}|${date}`) : undefined;
      if (before) {
        nowSum += now.priceMinor;
        beforeSum += before.priceMinor;
        both += 1;
      }
      return { date, priceMinor: now.priceMinor, source: now.source };
    });
    const prices = cells.flatMap((cell) => (cell.priceMinor === null ? [] : [cell.priceMinor]));
    return {
      id: c.id,
      cells,
      avgMinor: mean(prices),
      changePermille: both > 0 && beforeSum > 0n ? Number(((nowSum - beforeSum) * 1000n) / beforeSum) : null,
      lastObservedOn,
    };
  });

  const market = dates.map((date, i) => {
    const values = competitors.flatMap((c) => (c.cells[i]!.priceMinor === null ? [] : [c.cells[i]!.priceMinor!]));
    return {
      date,
      avgMinor: mean(values),
      minMinor: values.length ? values.reduce((a, b) => (b < a ? b : a)) : null,
      maxMinor: values.length ? values.reduce((a, b) => (b > a ? b : a)) : null,
      count: values.length,
    };
  });
  const known = market.filter((m) => m.avgMinor !== null);
  return {
    currency,
    competitors,
    market,
    summary: {
      marketAvgMinor: mean(known.map((m) => m.avgMinor!)),
      minMinor: known.length ? known.map((m) => m.minMinor!).reduce((a, b) => (b < a ? b : a)) : null,
      maxMinor: known.length ? known.map((m) => m.maxMinor!).reduce((a, b) => (b > a ? b : a)) : null,
      competitorsWithData: competitors.filter((c) => c.lastObservedOn !== null).length,
    },
  };
}
