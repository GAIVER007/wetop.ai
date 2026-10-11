import type { MarketRates, MarketView } from '../../lib/api';

/**
 * Данные графиков экрана «Загрузка конкурентов» (SALES2.3). Загрузка: всё в базисных пунктах (8 550 = 85,5 %). Цены
 * (DATA_MODEL §23.1) приходят отдельным запросом и рисуются отдельным графиком. Пропуск это `null`, а не ноль.
 */
export interface ChartRow {
  date: string;
  own: number | null;
  market: number | null;
  /** Самый свободный и самый загруженный сосед на ночь */
  min: number | null;
  max: number | null;
  /** Соседей с данными на ночь и всего соседей */
  withData: number;
  total: number;
  /** Среднее изменение загрузки соседей к прошлому снимку; нет сравнения нет и значения */
  changeBp: number | null;
}

export function buildChartRows(board: MarketView['board']): ChartRow[] {
  return board.dates.map((date, i) => {
    const cells = board.competitors.map((c) => c.cells[i]);
    const values = cells.flatMap((c) => (c && c.bp !== null ? [c.bp] : []));
    const deltas = cells.flatMap((c) => (c && c.deltaBp !== null ? [c.deltaBp] : []));
    return {
      date,
      own: board.own[i]?.bp ?? null,
      market: board.market[i]?.bp ?? null,
      min: values.length ? Math.min(...values) : null,
      max: values.length ? Math.max(...values) : null,
      withData: values.length,
      total: board.competitors.length,
      changeBp: deltas.length ? Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length) : null,
    };
  });
}

/** Путь линии: рвётся на пропуске, одиночная точка остаётся точкой */
export function linePath(
  values: Array<number | null>,
  y: (v: number) => number,
  x: (i: number) => number,
): string {
  let d = '';
  let open = false;
  values.forEach((v, i) => {
    if (v === null) {
      open = false;
      return;
    }
    d += `${open ? 'L' : 'M'}${x(i)},${y(v)}`;
    open = true;
  });
  // одиночная точка между пропусками: M без L не рисуется, добавляем нулевой отрезок
  return d.replace(/M([\d.-]+,[\d.-]+)(?=M|$)/g, 'M$1L$1');
}

/** Цены рынка по ночам для графика: минорные единицы числом (до сотен миллионов тиын, в Number без потерь), пропуск `null` */
export interface PriceRow {
  date: string;
  avg: number | null;
  min: number | null;
  max: number | null;
  count: number;
}
export function buildPriceRows(rates: MarketRates): PriceRow[] {
  const n = (v: string | null) => (v === null ? null : Number(v));
  return rates.board.market.map((m) => ({
    date: m.date,
    avg: n(m.avgMinor),
    min: n(m.minMinor),
    max: n(m.maxMinor),
    count: m.count,
  }));
}

/** Подпись оси цены: «42 тыс.», «950» (в основных единицах валюты) */
export function shortMoney(minor: number): string {
  const major = minor / 100;
  if (major < 1000) return String(Math.round(major));
  const k = major / 1000;
  return `${(Number.isInteger(k) ? String(k) : k.toFixed(1)).replace('.', ',')} тыс.`;
}
