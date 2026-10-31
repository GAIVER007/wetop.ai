import { describe, expect, it } from 'vitest';
import { mondayOf, monthStarts, shiftWeek, weekDates } from './week';

describe('сетка графика', () => {
  it('неделя от понедельника и переход по неделям', () => {
    expect(mondayOf('2026-10-17')).toBe('2026-10-12');
    expect(mondayOf('2026-10-12')).toBe('2026-10-12');
    expect(mondayOf('2026-10-18')).toBe('2026-10-12');
    expect(weekDates('2026-10-12').map((d) => d.weekday)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(weekDates('2026-10-12')[6]!.date).toBe('2026-10-18');
    expect(shiftWeek('2026-10-26', 7)).toBe('2026-11-02');
  });

  // владелец 31.10.2026: «добавь выбор месяца, чтобы видеть график на следующую неделю, удобный выбор»
  it('выбор месяца: прошлый, текущий и пять следующих, понедельник недели с 1-м числом', () => {
    const months = monthStarts('2026-10-31');
    expect(months.map((m) => m.month)).toEqual(['2026-09', '2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03']);
    expect(months.find((m) => m.month === '2026-11')!.monday).toBe('2026-10-26');
    expect(months.find((m) => m.month === '2027-01')!.monday).toBe('2026-12-28');
  });
});
