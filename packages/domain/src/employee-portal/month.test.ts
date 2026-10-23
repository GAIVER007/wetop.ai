import { describe, expect, it } from 'vitest';
import { monthBounds, monthShiftDays, shiftMonth } from './month';

describe('«Мой месяц»: смены по недельному графику минус отсутствия', () => {
  it('границы месяца и соседние месяцы', () => {
    expect(monthBounds('2026-10')).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(monthBounds('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });

  it('октябрь 2026, пн-пт: 22 смены и 9 выходных', () => {
    const r = monthShiftDays({ month: '2026-10', workingWeekdays: [1, 2, 3, 4, 5], timeOffs: [] });
    expect(r).toEqual({ shifts: 22, daysOff: 9, absenceDays: 0 });
  });

  it('отсутствие в рабочие дни убирает смены; в выходной не считается дважды; границы месяца обрезаются', () => {
    const r = monthShiftDays({
      month: '2026-10',
      workingWeekdays: [1, 2, 3, 4, 5],
      timeOffs: [
        { dateFrom: '2026-09-28', dateTo: '2026-10-02' }, // чт 1, пт 2 в октябре
        { dateFrom: '2026-10-10', dateTo: '2026-10-11' }, // сб, вс: уже выходные
        { dateFrom: '2026-10-30', dateTo: '2026-11-03' }, // пт 30, сб 31
        { dateFrom: '2026-10-02', dateTo: '2026-10-02' }, // пересечение не удваивает
      ],
    });
    expect(r.shifts).toBe(22 - 3);
    expect(r.absenceDays).toBe(3);
    expect(r.daysOff).toBe(31 - r.shifts);
  });

  it('пустой график: ни одной смены', () => {
    expect(monthShiftDays({ month: '2026-02', workingWeekdays: [], timeOffs: [] })).toEqual({ shifts: 0, daysOff: 28, absenceDays: 0 });
  });
});
