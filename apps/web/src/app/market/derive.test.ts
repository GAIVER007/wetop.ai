import { describe, expect, it } from 'vitest';
import { competitorStats, signalCells, signalNights, SHIFT_BP } from './derive';

/**
 * «Анализ конкурентов» (COMP3.2, план `plans/competitor-analysis-comp3-2026-10-09.md`): производные
 * числа экрана из уже посчитанного `MarketView`. Средняя по конкуренту за окно, сигнал даты для
 * календаря (высокий/обычный/слабый спрос, резкое изменение, нет данных) и счёт дат с сигналами.
 */
const cell = (date: string, bp: number | null, deltaBp: number | null = null) => ({
  date,
  bp,
  deltaBp,
  source: null,
});

describe('competitorStats', () => {
  it('средняя по непустым ночам, динамика по непустым изменениям', () => {
    const s = competitorStats([cell('2026-10-09', 8000, 1000), cell('2026-10-10', 9000, null), cell('2026-10-11', null, null)]);
    expect(s.avgBp).toBe(8500);
    expect(s.avgDeltaBp).toBe(1000);
    expect(s.nights).toBe(2);
  });

  it('без данных: null, не ноль (честное «Недостаточно данных»)', () => {
    const s = competitorStats([cell('2026-10-09', null), cell('2026-10-10', null)]);
    expect(s.avgBp).toBeNull();
    expect(s.avgDeltaBp).toBeNull();
    expect(s.nights).toBe(0);
  });
});

const board = {
  dates: ['2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12'],
  own: [
    { date: '2026-10-09', bp: 7800 },
    { date: '2026-10-10', bp: null },
    { date: '2026-10-11', bp: 5000 },
    { date: '2026-10-12', bp: 5000 },
  ],
  market: [
    { date: '2026-10-09', bp: 9000, count: 2 },
    { date: '2026-10-10', bp: 6000, count: 2 },
    { date: '2026-10-11', bp: 4000, count: 1 },
    { date: '2026-10-12', bp: null, count: 0 },
  ],
  competitors: [
    {
      cells: [
        cell('2026-10-09', 9000, 500),
        cell('2026-10-10', 6000, SHIFT_BP + 200),
        cell('2026-10-11', 4000, null),
        cell('2026-10-12', null, null),
      ],
    },
    {
      cells: [
        cell('2026-10-09', 9000, -500),
        cell('2026-10-10', 6000, SHIFT_BP + 400),
        cell('2026-10-11', null, null),
        cell('2026-10-12', null, null),
      ],
    },
  ],
};

describe('signalCells', () => {
  it('уровень рынка по дате, резкое изменение важнее уровня, без данных — none', () => {
    const cells = signalCells(board);
    expect(cells.map((c) => c.signal)).toEqual(['high', 'shift', 'low', 'none']);
    // средняя динамика рынка на 10.10: (1200 + 1400) / 2 = 1300 ≥ порога
    expect(cells[1]?.deltaBp).toBe(SHIFT_BP + 300);
    // своя загрузка и число конкурентов с данными идут в ячейку как есть
    expect(cells[0]?.ownBp).toBe(7800);
    expect(cells[0]?.count).toBe(2);
    // разнонаправленные изменения на 09.10 гасят друг друга: сигнал — уровень, не сдвиг
    expect(cells[0]?.signal).toBe('high');
  });

  it('signalNights считает высокие, слабые и резкие даты, обычные и пустые — нет', () => {
    expect(signalNights(signalCells(board))).toBe(3);
  });
});
