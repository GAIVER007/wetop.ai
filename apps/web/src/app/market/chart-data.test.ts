import { describe, expect, it } from 'vitest';
import type { MarketView } from '../../lib/api';
import { buildChartRows, linePath } from './chart-data';

type Board = MarketView['board'];
const cell = (date: string, bp: number | null, deltaBp: number | null = null) => ({ date, bp, deltaBp, source: null });

const board = {
  dates: ['2026-10-09', '2026-10-10', '2026-10-11'],
  asOf: '2026-10-09',
  compareDays: 1,
  own: [
    { date: '2026-10-09', bp: 6000 },
    { date: '2026-10-10', bp: null },
    { date: '2026-10-11', bp: 7000 },
  ],
  competitors: [
    { id: 'a', name: 'А', distanceM: 100, unitsTotal: 10, url: null, sources: [], lastObservedOn: null,
      cells: [cell('2026-10-09', 9000, 1000), cell('2026-10-10', 8000, null), cell('2026-10-11', null)] },
    { id: 'b', name: 'Б', distanceM: 200, unitsTotal: null, url: null, sources: [], lastObservedOn: null,
      cells: [cell('2026-10-09', 5000, -500), cell('2026-10-10', null), cell('2026-10-11', null)] },
  ],
  market: [
    { date: '2026-10-09', bp: 7000, count: 2 },
    { date: '2026-10-10', bp: 8000, count: 1 },
    { date: '2026-10-11', bp: null, count: 0 },
  ],
  gap: [],
  summary: { marketBp: 7500, ownBp: 6500, gapBp: -1000, highDemandNights: 0, competitors: 2, competitorsWithData: 2 },
  insights: [],
} as unknown as Board;

describe('графики «Загрузки конкурентов»: данные', () => {
  it('на каждую ночь: вы, рынок, самый свободный и самый загруженный сосед, число соседей с данными', () => {
    const rows = buildChartRows(board);
    expect(rows[0]).toMatchObject({ date: '2026-10-09', own: 6000, market: 7000, min: 5000, max: 9000, withData: 2, total: 2 });
    expect(rows[1]).toMatchObject({ own: null, market: 8000, min: 8000, max: 8000, withData: 1, total: 2 });
    expect(rows[2]).toMatchObject({ own: 7000, market: null, min: null, max: null, withData: 0, total: 2 });
  });

  it('изменение: среднее по соседям, у которых есть сравнение; нет сравнения нет и столбца', () => {
    const rows = buildChartRows(board);
    expect(rows[0]?.changeBp).toBe(250); // (1000 + -500) / 2
    expect(rows[1]?.changeBp).toBeNull();
    expect(rows[2]?.changeBp).toBeNull();
  });

  it('линия рвётся там, где данных нет, а не соединяет через пропуск', () => {
    const d = linePath([0, 10, null, 30, 40], (v) => 100 - v, (i) => i * 10);
    expect(d).toBe('M0,100L10,90M30,70L40,60');
  });

  it('одиночная точка между пропусками рисуется точкой, а не пропадает', () => {
    expect(linePath([null, 5, null], (v) => v, (i) => i)).toBe('M1,5L1,5');
  });
});
