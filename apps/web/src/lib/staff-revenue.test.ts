import { describe, expect, it } from 'vitest';
import { periodHref, revenueCells, revenuePeriodParam, revenueTotal, unattributedLabel } from './staff-revenue';

// «Сколько принёс сотрудник» на экранах персонала (docs/decisions/2026-10-20-personnel-revenue.md)
describe('staff revenue view helpers', () => {
  const items = [
    { employeeId: 'a', currency: 'KZT', paidMinor: '1000000', refundedMinor: '100000', netMinor: '900000' },
    { employeeId: 'a', currency: 'USD', paidMinor: '5000', refundedMinor: '0', netMinor: '5000' },
    { employeeId: null, currency: 'KZT', paidMinor: '200000', refundedMinor: '0', netMinor: '200000' },
  ];
  it('сумма сотрудника в валютах, без смешивания; нет денег = прочерк', () => {
    const cells = revenueCells(items);
    expect(cells.get('a')).toBe('9 000 ₸ · 50 USD');
    expect(cells.get('b')).toBeUndefined();
  });
  it('деньги без сотрудника подписаны по направлению', () => {
    expect(unattributedLabel(items, 'FOOD_SERVICE')).toBe('Заказы без официанта: 2 000 ₸');
    expect(unattributedLabel(items, 'HOSPITALITY')).toBe('Брони из каналов и сайта: 2 000 ₸');
    expect(unattributedLabel(items.slice(0, 2), 'HOSPITALITY')).toBeNull();
  });
  it('период из адреса: только day, week, month; иначе день', () => {
    expect(revenuePeriodParam('week')).toBe('week');
    expect(revenuePeriodParam(['month'])).toBe('month');
    expect(revenuePeriodParam('year')).toBe('day');
    expect(revenuePeriodParam(undefined)).toBe('day');
  });
  it('ссылка периода сохраняет путь', () => {
    expect(periodHref('/employees', 'month')).toBe('/employees?period=month');
    expect(periodHref('/team', 'day')).toBe('/team');
  });
  it('итог периода: все деньги, включая без сотрудника, по валютам; пусто = 0', () => {
    expect(revenueTotal(items)).toBe('11 000 ₸ · 50 USD');
    expect(revenueTotal([])).toBe('0 ₸');
  });
});
