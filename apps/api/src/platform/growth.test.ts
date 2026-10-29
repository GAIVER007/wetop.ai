import { describe, expect, it } from 'vitest';
import { buildGrowth, type GrowthSource } from './growth';

/**
 * Кабинет руководителя, срез 3 (владелец 29.10.2026, вариант «А»): путь клиента месяца с конверсиями, MRR, средний
 * LTV, сколько клиент с нами. Деньги центами в bigint, проценты целыми десятыми, без плавающей точки в деньгах.
 */
const NOW = new Date('2026-10-29T10:00:00Z');
const org = (id: string, createdAt: string, status: GrowthSource['organizations'][number]['status'], trialEndsAt: string | null = null) => ({
  id,
  name: id.toUpperCase(),
  status,
  createdAt: new Date(createdAt),
  trialEndsAt: trialEndsAt ? new Date(trialEndsAt) : null,
});
const src = (): GrowthSource => ({
  ownOrganizationId: 'own',
  visitors: null,
  registrations: [new Date('2026-10-02T00:00:00Z'), new Date('2026-10-20T00:00:00Z'), new Date('2026-10-21T00:00:00Z'), new Date('2026-10-22T00:00:00Z'), new Date('2026-09-10T00:00:00Z')],
  organizations: [
    org('own', '2026-01-01T00:00:00Z', 'ACTIVE'),
    org('a', '2026-06-01T00:00:00Z', 'ACTIVE'),
    org('b', '2026-10-03T00:00:00Z', 'ACTIVE'),
    org('c', '2026-10-21T00:00:00Z', 'TRIAL', '2026-10-31T00:00:00Z'),
    org('d', '2026-08-01T00:00:00Z', 'READ_ONLY'),
  ],
  payments: [
    { organizationId: 'a', amountCents: 10000n, paidOn: '2026-07-01', voided: false },
    { organizationId: 'a', amountCents: 10000n, paidOn: '2026-08-01', voided: false },
    { organizationId: 'a', amountCents: 10000n, paidOn: '2026-10-01', voided: false },
    { organizationId: 'b', amountCents: 5000n, paidOn: '2026-10-10', voided: false },
    { organizationId: 'b', amountCents: 99900n, paidOn: '2026-10-11', voided: true },
    { organizationId: 'd', amountCents: 3000n, paidOn: '2026-08-15', voided: false },
    { organizationId: 'own', amountCents: 777n, paidOn: '2026-10-01', voided: false },
  ],
  subscriptions: [
    { organizationId: 'a', monthlyCents: 10000n, paidUntil: '2026-11-01' },
    { organizationId: 'b', monthlyCents: 5000n, paidUntil: '2026-11-10' },
    { organizationId: 'd', monthlyCents: 3000n, paidUntil: '2026-09-15' },
  ],
});

describe('путь клиента и деньги руководителя', () => {
  it('воронка месяца: регистрации, пробные, первая оплата, продления; отменённые оплаты и своя организация не в счёт', () => {
    const g = buildGrowth(src(), '2026-10', NOW);
    expect(g.funnel).toEqual({
      visitors: null,
      registrations: 4,
      trials: 2,
      firstPayments: 1,
      renewals: 1,
      conversion: { visitorToRegistration: null, registrationToTrial: 500, trialToPaid: 500, renewal: 1000 },
    });
  });

  it('MRR только по подпискам, где «оплачено до» не прошло; LTV без отменённых; средний по платившим', () => {
    const g = buildGrowth(src(), '2026-10', NOW);
    expect(g.kpi.mrrCents).toBe('15000');
    expect(g.kpi.paying).toBe(2);
    expect(g.kpi.trial).toBe(1);
    expect(g.kpi.trialEndingSoon).toBe(1);
    // a 30000, b 5000, d 3000: (38000 / 3) округление вниз
    expect(g.kpi.avgLtvCents).toBe('12666');
    const a = g.clients.find((c) => c.id === 'a')!;
    expect(a).toMatchObject({ ltvCents: '30000', payments: 3, monthlyCents: '10000', paidUntil: '2026-11-01' });
    expect(a.daysWithUs).toBe(150);
    expect(g.clients.some((c) => c.id === 'own')).toBe(false);
  });

  it('доход по месяцам: шесть месяцев, выбранный последним', () => {
    const g = buildGrowth(src(), '2026-10', NOW);
    expect(g.income.map((m) => m.month)).toEqual(['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
    expect(g.income.map((m) => m.cents)).toEqual(['0', '0', '10000', '13000', '0', '15000']);
  });

  it('прошлый месяц для сравнения, отток месяца', () => {
    const g = buildGrowth(src(), '2026-10', NOW);
    expect(g.previous).toEqual({ registrations: 1, trials: 0, firstPayments: 0, incomeCents: '0' });
    // d ушёл в «только чтение»: оплачено до 15.09, в октябре оплат нет
    expect(g.kpi.unpaid).toBe(1);
  });

  it('посетители известны: конверсия посетитель → регистрация', () => {
    const s = src();
    s.visitors = 200;
    expect(buildGrowth(s, '2026-10', NOW).funnel.conversion.visitorToRegistration).toBe(20);
  });
});
