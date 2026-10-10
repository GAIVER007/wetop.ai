import { demandLevel, type DemandLevel } from '@pms/domain';

/**
 * «Анализ конкурентов» (COMP3.2): производные числа экрана из `MarketView`, без своих запросов.
 * Всё в базисных пунктах, как в домене; округление только при показе. Сигнал даты для календаря:
 * `shift` (резкое изменение рынка к сравнению, от порога) важнее уровня спроса, `none` — нет данных.
 */
export const SHIFT_BP = 1000;

export type Signal = DemandLevel | 'shift' | 'none';

interface CellLike {
  date: string;
  bp: number | null;
  deltaBp: number | null;
}

interface BoardLike {
  dates: string[];
  own: Array<{ date: string; bp: number | null }>;
  market: Array<{ date: string; bp: number | null; count: number }>;
  competitors: Array<{ cells: CellLike[] }>;
}

export interface SignalCell {
  date: string;
  ownBp: number | null;
  marketBp: number | null;
  /** средняя динамика рынка на дату: по конкурентам, у которых есть изменение */
  deltaBp: number | null;
  /** сколько конкурентов с данными на дату */
  count: number;
  signal: Signal;
}

const mean = (values: number[]): number | null =>
  values.length === 0 ? null : Math.round(values.reduce((a, b) => a + b, 0) / values.length);

/** Средняя загрузка и динамика конкурента за окно: только по ночам с данными */
export function competitorStats(cells: CellLike[]): {
  avgBp: number | null;
  avgDeltaBp: number | null;
  nights: number;
} {
  const bps = cells.map((c) => c.bp).filter((v): v is number => v !== null);
  const deltas = cells.map((c) => c.deltaBp).filter((v): v is number => v !== null);
  return { avgBp: mean(bps), avgDeltaBp: mean(deltas), nights: bps.length };
}

export function signalCells(board: BoardLike): SignalCell[] {
  const own = new Map(board.own.map((o) => [o.date, o.bp]));
  const market = new Map(board.market.map((m) => [m.date, m]));
  return board.dates.map((date) => {
    const m = market.get(date);
    const marketBp = m?.bp ?? null;
    const deltas = board.competitors
      .map((c) => c.cells.find((cell) => cell.date === date)?.deltaBp ?? null)
      .filter((v): v is number => v !== null);
    const deltaBp = mean(deltas);
    const level = demandLevel(marketBp);
    const signal: Signal =
      level === null
        ? 'none'
        : deltaBp !== null && Math.abs(deltaBp) >= SHIFT_BP
          ? 'shift'
          : level;
    return { date, ownBp: own.get(date) ?? null, marketBp, deltaBp, count: m?.count ?? 0, signal };
  });
}

/** Дат с сигналом в окне: высокий или слабый спрос либо резкое изменение; обычные и пустые не в счёт */
export const signalNights = (cells: SignalCell[]): number =>
  cells.filter((c) => c.signal === 'high' || c.signal === 'low' || c.signal === 'shift').length;
