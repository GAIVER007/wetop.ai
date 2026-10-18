import { describe, expect, it } from 'vitest';
import { mondayOf, shiftWeek, weekDates } from './week';

describe('сетка графика', () => {
  it('неделя от понедельника и переход по неделям', () => {
    expect(mondayOf('2026-10-17')).toBe('2026-10-12');
    expect(mondayOf('2026-10-12')).toBe('2026-10-12');
    expect(mondayOf('2026-10-18')).toBe('2026-10-12');
    expect(weekDates('2026-10-12').map((d) => d.weekday)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(weekDates('2026-10-12')[6]!.date).toBe('2026-10-18');
    expect(shiftWeek('2026-10-26', 7)).toBe('2026-11-02');
  });
});
