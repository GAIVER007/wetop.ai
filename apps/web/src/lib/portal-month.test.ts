import { describe, expect, it } from 'vitest';
import type { PortalMonthStats } from '@pms/domain';
import { portalMonthLabel, portalMonthLine, portalShiftMonth } from './portal-month';

const base: PortalMonthStats = {
  month: '2026-10', status: 'AVAILABLE', currency: 'KZT',
  shifts: null, daysOff: null, absenceDays: null, appointmentsDone: null, servicesDone: null,
  ordersClosed: null, tablesServed: null, guests: null, revenueMinor: null, bonusMinor: null, percent: null,
};

describe('строка «Мой месяц»', () => {
  it('салон: смены, выходные, услуги, выручка, бонусы одной строкой', () => {
    const line = portalMonthLine({ ...base, shifts: 12, daysOff: 19, absenceDays: 0, appointmentsDone: 30, servicesDone: 37, revenueMinor: '45000000', bonusMinor: '1000000' }, '2026');
    expect(line).toMatch(/^Октябрь: 12 смен, 19 выходных, 30 записей, 37 услуг, выручка 450\s000\s?₸, бонусы 10\s000\s?₸$/u);
  });
  it('ресторан: заказы, столы, гости, процент; отсутствия в скобках', () => {
    const line = portalMonthLine({ ...base, month: '2025-03', shifts: 21, daysOff: 10, absenceDays: 2, ordersClosed: 41, tablesServed: 22, guests: 1, revenueMinor: '0', bonusMinor: '0', percent: 5 }, '2026');
    expect(line).toContain('Март 2025: 21 смена, 10 выходных (из них 2 дня отсутствия), 41 заказ, 22 стола, 1 гость');
    expect(line).toContain('мой процент 5%');
  });
  it('без филиала просит выбрать филиал; соседние месяцы через год', () => {
    expect(portalMonthLine({ ...base, status: 'SELECT_LOCATION' }, '2026')).toBe('Октябрь: выберите филиал, чтобы увидеть итоги месяца');
    expect(portalShiftMonth('2026-01', -1)).toBe('2025-12');
    expect(portalShiftMonth('2026-12', 1)).toBe('2027-01');
    expect(portalMonthLabel('2026-05', '2026')).toBe('Май');
  });
});
