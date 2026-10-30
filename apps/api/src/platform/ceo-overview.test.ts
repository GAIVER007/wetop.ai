import { describe, expect, it } from 'vitest';
import { buildCeoOverview, type CeoSource } from './ceo-overview';

/**
 * VTOP Owner Admin, главная «Overview» (ТЗ владельца 30.10.2026 «две категории админок», п. 3): Revenue, Clients,
 * Subscriptions, Partners, Finance одним экраном. Только из того, что Кабинет уже ведёт: оплаты, расходы, подписки,
 * тарифы, партнёры. Деньги центами bigint строкой, проценты десятыми, без плавающей точки (AGENTS §12).
 */
const src = (): CeoSource => ({
  month: '2026-10',
  today: '2026-10-20',
  clientIds: ['a', 'b', 'c', 'd'],
  payments: [
    { organizationId: 'a', amountCents: 1900n, paidOn: '2026-10-05', voided: false },
    { organizationId: 'b', amountCents: 19900n, paidOn: '2026-10-07', voided: false },
    { organizationId: 'c', amountCents: 1900n, paidOn: '2026-09-10', voided: false },
    { organizationId: 'c', amountCents: 1900n, paidOn: '2026-01-10', voided: false },
    { organizationId: 'c', amountCents: 1900n, paidOn: '2025-12-10', voided: false },
    { organizationId: 'a', amountCents: 5000n, paidOn: '2026-10-06', voided: true },
  ],
  expenses: [
    { category: 'SERVER', amountCents: 3000n, spentOn: '2026-10-01', voided: false },
    { category: 'PARTNERS', amountCents: 1000n, spentOn: '2026-09-02', voided: false },
  ],
  plans: [
    { id: 'm', name: 'Месяц', priceCents: 1900n, periodMonths: 1 },
    { id: 'y', name: 'Год', priceCents: 19900n, periodMonths: 12 },
  ],
  subscriptions: [
    { organizationId: 'a', planId: 'm', monthlyCents: 1900n, paidUntil: '2026-11-05' },
    { organizationId: 'b', planId: 'y', monthlyCents: 1658n, paidUntil: '2027-10-07' },
    // c: оплачено до 25.10, продление ждём в этом месяце; d: просрочен
    { organizationId: 'c', planId: 'm', monthlyCents: 1900n, paidUntil: '2026-10-25' },
    { organizationId: 'd', planId: 'm', monthlyCents: 1900n, paidUntil: '2026-10-01' },
  ],
  kpi: { mrrCents: '5458', paying: 3, trial: 1 },
  registrations: 2,
  churned: 1,
  atRisk: 1,
  partners: {
    rows: [
      { active: true, createdAt: '2026-10-03' },
      { active: false, createdAt: '2026-05-01' },
    ],
    totals: { trials: 3, incomeCents: '23700', accruedCents: '11000', paidCents: '1000', dueCents: '10000' },
  },
});

describe('VTOP Overview', () => {
  it('Revenue: MRR, ARR = MRR × 12, месяц, прошлый, с начала года, прогноз, рост', () => {
    expect(buildCeoOverview(src()).revenue).toEqual({
      mrrCents: '5458',
      arrCents: '65496',
      thisMonthCents: '21800',
      lastMonthCents: '1900',
      // 2026: 21800 + 1900 + 1900; декабрь 2025 не входит
      ytdCents: '25600',
      // получено 21800 + ждём продление c до конца месяца 1900
      forecastCents: '23700',
      // (21800 − 1900) / 1900 = 1047,3%: десятыми вниз
      growthTenths: 10473,
    });
  });

  it('Clients, Subscriptions: активные, месячные и годовые, по тарифам', () => {
    const v = buildCeoOverview(src());
    expect(v.clients).toEqual({ total: 4, new: 2, active: 3, trial: 1, churned: 1, atRisk: 1 });
    expect(v.subscriptions).toEqual({
      active: 3,
      monthly: 2,
      annual: 1,
      byPlan: [
        { planId: 'm', name: 'Месяц', count: 2 },
        { planId: 'y', name: 'Год', count: 1 },
      ],
    });
  });

  it('Partners и Finance: касса за всё время, дебиторка = просроченные подписки, долг партнёрам', () => {
    const v = buildCeoOverview(src());
    expect(v.partners).toEqual({ total: 2, active: 1, new: 1, clients: 3, revenueCents: '23700', commissionsCents: '11000', dueCents: '10000' });
    expect(v.finance).toEqual({
      // все оплаты 27500 − все расходы 4000
      cashBalanceCents: '23500',
      incomeCents: '21800',
      expensesCents: '3000',
      profitCents: '18800',
      receivableCents: '1900',
      payableCents: '10000',
    });
  });

  it('прошлого месяца без дохода: рост пустой, без деления на ноль', () => {
    const s = src();
    s.payments = s.payments.filter((p) => p.paidOn.startsWith('2026-10'));
    expect(buildCeoOverview(s).revenue.growthTenths).toBeNull();
  });
});
