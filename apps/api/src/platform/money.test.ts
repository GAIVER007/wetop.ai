import { describe, expect, it } from 'vitest';
import { buildMoney, parseIsoDate, parseUsdCents, shiftMonth, type MoneySource } from './money';

/** Деньги компании WETOP (DATA_MODEL §63): центы USD целыми, отменённое не считается, должники по «оплачено до» */
const src = (over: Partial<MoneySource> = {}): MoneySource => ({
  payments: [],
  expenses: [],
  subscriptions: [],
  clientIds: ['luxx', 'kyial'],
  ...over,
});

describe('деньги компании', () => {
  it('доход, расходы и прибыль месяца; отменённые и чужой месяц не считаются', () => {
    const view = buildMoney(
      src({
        payments: [
          { organizationId: 'luxx', amountCents: 9900n, paidOn: '2026-10-05', voided: false },
          { organizationId: 'kyial', amountCents: 4950n, paidOn: '2026-10-20', voided: false },
          { organizationId: 'kyial', amountCents: 100000n, paidOn: '2026-10-21', voided: true },
          { organizationId: 'luxx', amountCents: 9900n, paidOn: '2026-09-05', voided: false },
        ],
        expenses: [
          { category: 'SERVER', amountCents: 2000n, spentOn: '2026-10-01', voided: false },
          { category: 'ADS', amountCents: 15000n, spentOn: '2026-10-10', voided: false },
          { category: 'ADS', amountCents: 500n, spentOn: '2026-10-11', voided: true },
        ],
      }),
      '2026-10',
      '2026-10-28',
    );
    expect(view.month).toEqual({ month: '2026-10', incomeCents: '14850', expensesCents: '17000', profitCents: '-2150' });
    expect(view.expensesByCategory).toEqual([
      { category: 'SERVER', cents: '2000' },
      { category: 'ADS', cents: '15000' },
    ]);
    expect(view.history.map((h) => h.month)).toEqual(['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
    expect(view.history[4]).toMatchObject({ incomeCents: '9900', expensesCents: '0' });
  });

  it('ожидаемый доход по подпискам и должники: срок прошёл или не задан; бесплатные и не клиенты не считаются', () => {
    const view = buildMoney(
      src({
        subscriptions: [
          { organizationId: 'luxx', monthlyCents: 9900n, paidUntil: '2026-11-05' },
          { organizationId: 'kyial', monthlyCents: 4950n, paidUntil: '2026-10-27' },
          { organizationId: 'own', monthlyCents: 100n, paidUntil: null },
        ],
        clientIds: ['luxx', 'kyial', 'free'],
      }),
      '2026-10',
      '2026-10-28',
    );
    expect(view.expectedMonthlyCents).toBe('14850');
    expect(view.overdue).toEqual([{ organizationId: 'kyial', paidUntil: '2026-10-27', monthlyCents: '4950' }]);
  });

  it('месяцы через год', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });

  it('сумма в долларах: точка или запятая, до двух знаков; иначе null', () => {
    expect(parseUsdCents('99')).toBe(9900n);
    expect(parseUsdCents('49,5')).toBe(4950n);
    expect(parseUsdCents(' 1 200.05 ')).toBe(120005n);
    for (const bad of ['', '-5', '1.234', 'abc', '1e3', 5]) expect(parseUsdCents(bad)).toBeNull();
  });

  it('дата: только настоящий день', () => {
    expect(parseIsoDate('2026-10-28')).toBe('2026-10-28');
    expect(parseIsoDate('2026-02-30')).toBeNull();
    expect(parseIsoDate('28.10.2026')).toBeNull();
  });
});

/**
 * «Деньги» (владелец 30.10.2026: «выстрой прям удобно, чтобы было видно все доходы и все расходы, включая оплаты,
 * зарплаты, подписки»): таблица по месяцам (доход, каждая статья расходов, прибыль, маржа) и кто должен заплатить в
 * ближайшие 30 дней по подпискам.
 */
describe('деньги: таблица по месяцам и ожидаемые оплаты', () => {
  const view = () =>
    buildMoney(
      src({
        payments: [
          { organizationId: 'luxx', amountCents: 9800n, paidOn: '2026-10-05', voided: false },
          { organizationId: 'kyial', amountCents: 4900n, paidOn: '2026-09-20', voided: false },
        ],
        expenses: [
          { category: 'SERVER', amountCents: 2000n, spentOn: '2026-10-01', voided: false },
          { category: 'SALARIES', amountCents: 40000n, spentOn: '2026-10-25', voided: false },
          { category: 'SERVER', amountCents: 2000n, spentOn: '2026-09-01', voided: false },
          { category: 'ADS', amountCents: 999n, spentOn: '2026-10-02', voided: true },
        ],
        subscriptions: [
          { organizationId: 'luxx', monthlyCents: 9800n, paidUntil: '2026-11-15' },
          { organizationId: 'kyial', monthlyCents: 4900n, paidUntil: '2026-11-04' },
          { organizationId: 'stranger', monthlyCents: 4900n, paidUntil: '2026-11-01' },
          { organizationId: 'luxx2', monthlyCents: 4900n, paidUntil: '2026-12-31' },
        ],
        clientIds: ['luxx', 'kyial', 'luxx2'],
      }),
      '2026-10',
      '2026-10-30',
    );

  it('статьи расходов по месяцам: только статьи, где за полгода что-то было; маржа месяца десятыми процента', () => {
    const v = view();
    expect(v.table.months).toEqual(['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
    expect(v.table.categories).toEqual([
      { category: 'SERVER', cents: ['0', '0', '0', '0', '2000', '2000'], totalCents: '4000' },
      { category: 'SALARIES', cents: ['0', '0', '0', '0', '0', '40000'], totalCents: '40000' },
    ]);
    expect(v.table.income).toEqual(['0', '0', '0', '0', '4900', '9800']);
    expect(v.table.profit).toEqual(['0', '0', '0', '0', '2900', '-32200']);
    expect(v.table.totals).toEqual({ incomeCents: '14700', expensesCents: '44000', profitCents: '-29300' });
    // сентябрь: доход 4900, расход 2000, маржа 59,1%; октябрь в минусе; без дохода маржи нет
    expect(v.table.margin).toEqual([null, null, null, null, 591, -3285]);
  });

  it('ожидаем оплату в ближайшие 30 дней: по сроку, только клиенты', () => {
    expect(view().upcoming).toEqual([
      { organizationId: 'kyial', paidUntil: '2026-11-04', monthlyCents: '4900' },
      { organizationId: 'luxx', paidUntil: '2026-11-15', monthlyCents: '9800' },
    ]);
  });
});
