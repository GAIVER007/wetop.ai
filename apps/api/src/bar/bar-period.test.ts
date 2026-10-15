import { describe, expect, it } from 'vitest';
import { growthPercent, monthBounds, shiftDate } from './bar-period';

/** Месяц бара к прошлому месяцу (макет владельца 09.10.2026): границы в датах объекта, без float */
describe('бар: месячные границы и прирост', () => {
  it('границы текущего и прошлого месяца, включая переход через год', () => {
    expect(monthBounds('2026-10-09')).toEqual({ prevMonthStart: '2026-09-01', monthStart: '2026-10-01', nextMonthStart: '2026-11-01' });
    expect(monthBounds('2026-01-31')).toEqual({ prevMonthStart: '2025-12-01', monthStart: '2026-01-01', nextMonthStart: '2026-02-01' });
    expect(monthBounds('2026-12-01')).toEqual({ prevMonthStart: '2026-11-01', monthStart: '2026-12-01', nextMonthStart: '2027-01-01' });
  });

  it('сдвиг даты на дни без часовых поясов', () => {
    expect(shiftDate('2026-10-09', -29)).toBe('2026-09-10');
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('прирост в целых процентах с округлением к ближайшему; без прошлого месяца прироста нет', () => {
    expect(growthPercent(112n, 100n)).toBe(12);
    expect(growthPercent(1_245_600_00n, 1_055_593_22n)).toBe(18);
    expect(growthPercent(90n, 100n)).toBe(-10);
    expect(growthPercent(1n, 3n)).toBe(-67);
    expect(growthPercent(100n, 0n)).toBeNull();
    expect(growthPercent(0n, 0n)).toBeNull();
  });
});
