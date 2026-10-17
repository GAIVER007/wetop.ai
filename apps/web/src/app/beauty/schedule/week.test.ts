import { describe, expect, it } from 'vitest';
import { mondayOf, shiftWeek, toggleWeekday, weekDates } from './week';

const week = [1, 2, 3, 4, 5, 6, 0].map((weekday) => ({
  weekday,
  intervals: weekday === 1 ? [{ timeFrom: '10:00', timeTo: '19:00' }] : [],
}));

describe('сетка графика', () => {
  it('включённый день берёт часы первого рабочего дня', () => {
    expect(toggleWeekday(week, 3, true)).toEqual([
      { weekday: 1, timeFrom: '10:00', timeTo: '19:00' },
      { weekday: 3, timeFrom: '10:00', timeTo: '19:00' },
    ]);
  });
  it('у мастера без графика новый день 09:00–18:00', () => {
    const empty = week.map((d) => ({ ...d, intervals: [] }));
    expect(toggleWeekday(empty, 2, true)).toEqual([{ weekday: 2, timeFrom: '09:00', timeTo: '18:00' }]);
  });
  it('выключенный день убирается, остальные остаются', () => {
    expect(toggleWeekday(week, 1, false)).toEqual([]);
  });
  it('неделя от понедельника и переход по неделям', () => {
    expect(mondayOf('2026-10-17')).toBe('2026-10-12');
    expect(mondayOf('2026-10-12')).toBe('2026-10-12');
    expect(mondayOf('2026-10-18')).toBe('2026-10-12');
    expect(weekDates('2026-10-12').map((d) => d.weekday)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(weekDates('2026-10-12')[6]!.date).toBe('2026-10-18');
    expect(shiftWeek('2026-10-26', 7)).toBe('2026-11-02');
  });
});
