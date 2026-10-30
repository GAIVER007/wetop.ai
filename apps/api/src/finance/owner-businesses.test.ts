import { describe, expect, it } from 'vitest';
import { buildOwnerBusinesses, type OwnerBusinessesSource } from './owner-businesses';

/**
 * «Кабинет владельца: все бизнесы», вариант C (владелец 30.10.2026: «3»): итог всех бизнесов месяца по валютам (разные
 * валюты не складываются), строка на каждый филиал своих бизнесов, полгода выручки и дела дня. Деньги минорными
 * единицами bigint строкой.
 */
const src = (): OwnerBusinessesSource => ({
  month: '2026-10',
  months: ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'],
  branches: [
    {
      organizationId: 'o1',
      organizationName: 'Luxx',
      current: true,
      businessName: 'Luxx Aparts',
      vertical: 'HOSPITALITY',
      locationId: 'l1',
      locationName: 'Luxx Aparts 1',
      currency: 'QAR',
      money: [
        { month: '2026-09', revenueMinor: 1000n, expensesMinor: 400n },
        { month: '2026-10', revenueMinor: 2000n, expensesMinor: 500n },
      ],
      attention: 3,
    },
    {
      organizationId: 'o1',
      organizationName: 'Luxx',
      current: true,
      businessName: 'Luxx Aparts',
      vertical: 'HOSPITALITY',
      locationId: 'l2',
      locationName: 'Luxx Aparts 2',
      currency: 'QAR',
      money: [{ month: '2026-10', revenueMinor: 1500n, expensesMinor: 0n }],
      attention: 0,
    },
    {
      organizationId: 'o2',
      organizationName: 'Salon',
      current: false,
      businessName: 'Lashes',
      vertical: 'BEAUTY',
      locationId: 'l3',
      locationName: 'Lashes',
      currency: 'KZT',
      money: [{ month: '2026-10', revenueMinor: 900n, expensesMinor: 100n }],
      attention: 1,
    },
  ],
  platform: { incomeMinor: [0n, 0n, 0n, 0n, 300n, 490n], expensesMinor: [0n, 0n, 0n, 0n, 100n, 280n] },
});

describe('кабинет владельца: все бизнесы', () => {
  it('итог месяца по валютам с прошлым месяцем; WETOP в долларах отдельной строкой', () => {
    const v = buildOwnerBusinesses(src());
    expect(v.totals).toEqual([
      { currency: 'KZT', revenueMinor: '900', expensesMinor: '100', profitMinor: '800', previousProfitMinor: '0' },
      { currency: 'QAR', revenueMinor: '3500', expensesMinor: '500', profitMinor: '3000', previousProfitMinor: '600' },
      { currency: 'USD', revenueMinor: '490', expensesMinor: '280', profitMinor: '210', previousProfitMinor: '200' },
    ]);
    expect(v.counts).toEqual({ businesses: 3, branches: 3 });
  });

  it('строка на филиал: месяц, дела дня, «вы здесь» у текущей организации; WETOP первой строкой', () => {
    const v = buildOwnerBusinesses(src());
    expect(v.rows.map((r) => [r.kind, r.name, r.revenueMinor, r.profitMinor, r.attention, r.current])).toEqual([
      ['PLATFORM', 'WETOP', '490', '210', 0, false],
      ['BRANCH', 'Luxx Aparts 1', '2000', '1500', 3, true],
      ['BRANCH', 'Luxx Aparts 2', '1500', '1500', 0, true],
      ['BRANCH', 'Lashes', '900', '800', 1, false],
    ]);
  });

  it('полгода выручки по валютам', () => {
    const c = buildOwnerBusinesses(src()).chart;
    expect(c.find((x) => x.currency === 'QAR')!.revenueMinor).toEqual(['0', '0', '0', '0', '1000', '3500']);
    expect(c.find((x) => x.currency === 'USD')!.revenueMinor).toEqual(['0', '0', '0', '0', '300', '490']);
  });

  it('без WETOP (не главный администратор): только свои филиалы', () => {
    const v = buildOwnerBusinesses({ ...src(), platform: null });
    expect(v.rows.some((r) => r.kind === 'PLATFORM')).toBe(false);
    expect(v.totals.map((t) => t.currency)).toEqual(['KZT', 'QAR']);
    expect(v.counts).toEqual({ businesses: 2, branches: 3 });
  });
});
