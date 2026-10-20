import { describe, expect, it } from 'vitest';
import { periodHref, revenueCells, revenuePeriodParam, revenueTotal, staffSummaryStats, unattributedLabel } from './staff-revenue';

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

// плитки «Персонала» (замечание владельца 20.10.2026: «на смене сейчас» не нужно, нужна полезная сводка)
describe('staffSummaryStats: деньги команды, лучший, средний, возвраты', () => {
  const rev = (over: Record<string, unknown> = {}) => ({
    period: 'week' as const, fromDate: '2026-10-19', toDate: '2026-10-25',
    items: [
      { employeeId: 'a', currency: 'KZT', paidMinor: '1000000', refundedMinor: '100000', netMinor: '900000' },
      { employeeId: 'b', currency: 'KZT', paidMinor: '300000', refundedMinor: '0', netMinor: '300000' },
      { employeeId: null, currency: 'KZT', paidMinor: '200000', refundedMinor: '0', netMinor: '200000' },
    ],
    totals: [{ currency: 'KZT', paidMinor: '1500000', refundedMinor: '100000', netMinor: '1400000' }],
    previous: { fromDate: '2026-10-12', toDate: '2026-10-18', totals: [{ currency: 'KZT', paidMinor: '1000000', refundedMinor: '0', netMinor: '1000000' }] },
    ...over,
  });
  const names = new Map([['a', 'Анна Ким'], ['b', 'Борис']]);
  it('четыре плитки с подсказками, без «на смене» и «в архиве»', () => {
    const stats = staffSummaryStats({ revenue: rev(), names, earners: 3, unassigned: 0 });
    expect(stats.map((s) => [s.label, s.value, s.hint])).toEqual([
      ['Принесли за неделю', '14 000 ₸', 'оплачено 15 000 ₸'],
      ['Лучший за неделю', 'Анна Ким', '9 000 ₸, 64 % от всех денег'],
      ['В среднем на сотрудника', '4 000 ₸', 'приносят деньги: 3'],
      ['Возвраты за неделю', '1 000 ₸', '7 % от оплат'],
    ]);
    expect(stats[0]!.delta).toEqual({ direction: 'up', text: '+40 % к прошлой неделе' });
    expect(stats.map((s) => s.label)).not.toContain('На смене сейчас');
  });
  it('не назначено > 0: пятая плитка-предупреждение с действием', () => {
    const stats = staffSummaryStats({ revenue: rev(), names, earners: 3, unassigned: 2 });
    expect(stats.at(-1)).toMatchObject({ label: 'Не назначено', value: 2, tone: 'warning', hint: 'укажите, кто это' });
  });
  it('нет денег за период: честные прочерки, без деления на ноль', () => {
    const stats = staffSummaryStats({
      revenue: rev({ items: [], totals: [], previous: { fromDate: '', toDate: '', totals: [] } }),
      names, earners: 0, unassigned: 0,
    });
    expect(stats.map((s) => s.value)).toEqual(['0 ₸', '—', '—', '0 ₸']);
    expect(stats[3]!.hint).toBe('возвратов не было');
    expect(stats[0]!.delta).toBeUndefined();
  });
  it('без права на отчёты: только состав персонала', () => {
    expect(staffSummaryStats({ revenue: null, names, earners: 3, unassigned: 1, people: 7 }).map((s) => s.label))
      .toEqual(['В персонале', 'Не назначено']);
  });
});
