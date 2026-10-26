import { describe, expect, it } from 'vitest';
import { monthGrid, shiftMonth } from './month-grid';

describe('сетка месяца журнала', () => {
  it('октябрь 2026: с пн 28.09 по вс 01.11, 35 дней', () => {
    const g = monthGrid('2026-10-14');
    expect(g.month).toBe('2026-10');
    expect(g.days[0]).toBe('2026-09-28');
    expect(g.days.at(-1)).toBe('2026-11-01');
    expect(g.days).toHaveLength(35);
  });
  it('март 2026 начинается в воскресенье: 6 недель', () => {
    expect(monthGrid('2026-03-01').days).toHaveLength(42);
  });
  it('февраль 2027 ровно 4 недели с понедельника', () => {
    expect(monthGrid('2027-02-10').days).toHaveLength(28);
  });
  it('соседний месяц: 31-е становится последним днём короткого', () => {
    expect(shiftMonth('2026-10-31', 1)).toBe('2026-11-30');
    expect(shiftMonth('2026-03-31', -1)).toBe('2026-02-28');
    expect(shiftMonth('2026-01-15', -1)).toBe('2025-12-15');
  });
});
