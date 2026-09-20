import { describe, expect, it } from 'vitest';
import { checkDay, verdict, type BoardSnapshot, type DaySnapshot } from './day-selfcheck';

const row = (n: string, unitCode: string | null = 'R01') => ({
  confirmationNumber: n,
  unitCode,
  accommodationTypeName: 'Мужская общая',
  status: 'CHECKED_IN',
});
const day = (over: Partial<DaySnapshot> = {}): DaySnapshot => ({
  date: '2026-09-20',
  arrivals: [],
  departures: [],
  inHouse: [row('A-1')],
  counts: { arrivals: 0, departures: 0, inHouse: 1 },
  ...over,
});
const board = (over: Partial<BoardSnapshot> = {}): BoardSnapshot => ({
  occupiedByNumber: { 'A-1': ['R01'] },
  unassigned: [],
  occupiedCells: 1,
  ...over,
});

describe('сутки внутри PMS', () => {
  it('всё сходится — ни одного замечания', () => {
    expect(checkDay(day(), board())).toEqual([]);
    expect(verdict([])).toContain('OK — сутки внутри PMS сходятся');
  });

  it('проживает по «Главной», а на шахматке нет — это койка, проданная дважды', () => {
    const f = checkDay(day(), board({ occupiedByNumber: {}, occupiedCells: 0 }));
    expect(f.some((x) => x.level === 'fail' && x.what.includes('на шахматке его нет'))).toBe(true);
  });

  it('без ячейки — предупреждение, а не отказ: это работа смены', () => {
    const f = checkDay(
      day({ inHouse: [row('A-1', null)] }),
      board({ occupiedByNumber: {}, occupiedCells: 0, unassigned: [{ confirmationNumber: 'A-1', categoryName: 'Мужская общая' }] }),
    );
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ level: 'warn' });
    expect(verdict(f)).toContain('OK с предупреждениями');
  });

  it('ячейка в списке дня и на шахматке разные — расхождение с адресами обеих', () => {
    const f = checkDay(day(), board({ occupiedByNumber: { 'A-1': ['R07'] } }));
    expect(f[0]?.level).toBe('fail');
    expect(f[0]?.what).toContain('R01');
    expect(f[0]?.what).toContain('R07');
  });

  it('счётчик не равен своему же списку', () => {
    const f = checkDay(day({ counts: { arrivals: 0, departures: 0, inHouse: 5 } }), board());
    expect(f.some((x) => x.what.includes('счётчик inHouse: 5, а в списке 1'))).toBe(true);
  });

  it('занятых клеток меньше, чем заселённых с ячейкой', () => {
    const f = checkDay(
      day({ inHouse: [row('A-1'), row('A-2', 'R02')], counts: { arrivals: 0, departures: 0, inHouse: 2 } }),
      board({ occupiedByNumber: { 'A-1': ['R01'], 'A-2': ['R02'] }, occupiedCells: 1 }),
    );
    expect(f.some((x) => x.what.includes('занятых клеток на шахматке 1'))).toBe(true);
  });
});
