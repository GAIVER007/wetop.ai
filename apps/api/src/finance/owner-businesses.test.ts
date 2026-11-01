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
      days: [
        { date: '2026-09-10', revenueMinor: 1000n, expensesMinor: 400n },
        { date: '2026-10-05', revenueMinor: 1200n, expensesMinor: 500n },
        { date: '2026-10-20', revenueMinor: 800n, expensesMinor: 0n },
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
      days: [{ date: '2026-10-11', revenueMinor: 1500n, expensesMinor: 0n }],
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
      days: [{ date: '2026-10-12', revenueMinor: 900n, expensesMinor: 100n }],
      attention: 1,
    },
  ],
  platform: {
    days: [
      { date: '2026-09-15', revenueMinor: 300n, expensesMinor: 100n },
      { date: '2026-10-15', revenueMinor: 490n, expensesMinor: 280n },
    ],
  },
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

/**
 * Всё в валюте компании (владелец 01.11.2026: «вариант первый, только всё показывай в той валюте, которая в системе»;
 * курс Нацбанка РК на день операции): итог одной строкой, строки и график в валюте компании, исходная валюта строки
 * остаётся подписью. Валюта без курса не выдумывается: она остаётся своим итогом и названа в `fx.missing`.
 */
describe('все бизнесы в валюте компании по курсу Нацбанка РК', () => {
  const rates = new Map([
    ['USD', [{ date: '2026-09-01', micro: 480_000_000n }, { date: '2026-10-15', micro: 450_000_000n }]],
    ['QAR', [{ date: '2026-09-01', micro: 130_000_000n }, { date: '2026-10-11', micro: 125_000_000n }]],
  ]);
  it('итог одной строкой в тенге: каждая сумма по курсу своего дня', () => {
    const v = buildOwnerBusinesses({ ...src(), fx: { currency: 'KZT', rates } });
    // октябрь: QAR 1200 и 800 по 130 (5 и 20 октября, курс 1 сентября и 11 октября: 130 и 125), 1500 по 125;
    // KZT 900; USD 490 по 450
    const rev = 1200n * 130n + 800n * 125n + 1500n * 125n + 900n + 490n * 450n;
    const exp = 500n * 130n + 100n + 280n * 450n;
    const prevProfit = (1000n - 400n) * 130n + (300n - 100n) * 480n;
    expect(v.totals).toEqual([
      { currency: 'KZT', revenueMinor: String(rev), expensesMinor: String(exp), profitMinor: String(rev - exp), previousProfitMinor: String(prevProfit) },
    ]);
    expect(v.fx).toEqual({ currency: 'KZT', source: 'NBK', converted: ['QAR', 'USD'], approximate: true, missing: [] });
  });
  it('строки в тенге, исходная валюта подписью; график одной валютой', () => {
    const v = buildOwnerBusinesses({ ...src(), fx: { currency: 'KZT', rates } });
    const luxx = v.rows.find((r) => r.name === 'Luxx Aparts 1')!;
    expect([luxx.currency, luxx.revenueMinor]).toEqual(['KZT', String(1200n * 130n + 800n * 125n)]);
    expect(luxx.source).toEqual({ currency: 'QAR', revenueMinor: '2000', expensesMinor: '500', profitMinor: '1500' });
    expect(v.rows.find((r) => r.name === 'Lashes')!.source).toBeNull();
    expect(v.chart.map((c) => c.currency)).toEqual(['KZT']);
    expect(v.chart[0]!.revenueMinor[4]).toBe(String(1000n * 130n + 300n * 480n));
  });
  it('нет курса валюты: она не пересчитывается и остаётся своим итогом', () => {
    const v = buildOwnerBusinesses({ ...src(), fx: { currency: 'KZT', rates: new Map([['USD', rates.get('USD')!]]) } });
    expect(v.totals.map((t) => t.currency)).toEqual(['KZT', 'QAR']);
    expect(v.fx!.missing).toEqual(['QAR']);
    expect(v.rows.find((r) => r.name === 'Luxx Aparts 1')!.currency).toBe('QAR');
  });
});
