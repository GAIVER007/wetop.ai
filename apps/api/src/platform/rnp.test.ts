import { describe, expect, it } from 'vitest';
import { buildRnp, type RnpSource } from './rnp';

/**
 * РНП («рука на пульсе», владелец 30.10.2026, эскиз «РНП в Кабинете WETOP»): каждый день месяца строкой, итоги
 * периода, конверсии целыми десятыми процента, деньги центами bigint строкой; вкладка «Партнёры» за месяц.
 */
const src = (): RnpSource => ({
  visitors: [
    { day: '2026-10-01', visitorKey: 'v1' },
    { day: '2026-10-01', visitorKey: 'v2' },
    { day: '2026-10-01', visitorKey: 'v2' },
    { day: '2026-10-02', visitorKey: 'v3' },
    { day: '2026-09-30', visitorKey: 'old' },
  ],
  leads: [
    { day: '2026-10-01', visitorKey: 'v1' },
    { day: '2026-10-02', visitorKey: 'v3' },
  ],
  organizations: [
    { id: 'a', createdAt: new Date('2026-10-01T10:00:00Z') },
    { id: 'b', createdAt: new Date('2026-10-02T10:00:00Z') },
    { id: 'old', createdAt: new Date('2026-08-01T10:00:00Z') },
  ],
  payments: [
    { organizationId: 'a', amountCents: 19900n, paidOn: '2026-10-02', voided: false },
    { organizationId: 'a', amountCents: 19900n, paidOn: '2026-10-03', voided: false },
    { organizationId: 'old', amountCents: 1900n, paidOn: '2026-08-05', voided: false },
    { organizationId: 'old', amountCents: 1900n, paidOn: '2026-10-05', voided: false },
    { organizationId: 'b', amountCents: 99900n, paidOn: '2026-10-02', voided: true },
  ],
  expenses: [
    { amountCents: 3000n, spentOn: '2026-10-01', voided: false, partnerId: null },
    { amountCents: 4000n, spentOn: '2026-10-02', voided: false, partnerId: 'p1' },
    { amountCents: 9999n, spentOn: '2026-10-02', voided: true, partnerId: null },
  ],
  partners: [
    { id: 'p1', name: 'Айдар', percentBp: 2000, active: true },
    { id: 'p2', name: 'Дина', percentBp: 1000, active: true },
  ],
  links: [
    { organizationId: 'a', partnerId: 'p1' },
    { organizationId: 'old', partnerId: 'p2' },
  ],
});

describe('РНП по дням', () => {
  it('каждый день месяца строкой: посетители, заявки, регистрации, первые оплаты, сумма, расходы', () => {
    const v = buildRnp(src(), '2026-10');
    expect(v.days).toHaveLength(31);
    expect(v.days[0]).toMatchObject({ day: '2026-10-01', visitors: 2, leads: 1, registrations: 1, firstPayments: 0, incomeCents: '0', expensesCents: '3000' });
    // первая оплата клиента «a» 02.10; «b» аннулирована и не считается
    expect(v.days[1]).toMatchObject({ day: '2026-10-02', visitors: 1, leads: 1, registrations: 1, firstPayments: 1, incomeCents: '19900', expensesCents: '4000' });
    // повторная оплата идёт в сумму, но не в первые оплаты
    expect(v.days[2]).toMatchObject({ firstPayments: 0, incomeCents: '19900' });
    expect(v.days[4]).toMatchObject({ firstPayments: 0, incomeCents: '1900' });
  });

  it('итоги периода и конверсии десятыми: посетитель в заявку, заявка в регистрацию, регистрация в оплату', () => {
    const t = buildRnp(src(), '2026-10').total;
    expect(t).toMatchObject({ visitors: 3, leads: 2, registrations: 2, firstPayments: 1, incomeCents: '41700', expensesCents: '7000' });
    expect(t.visitorToLead).toBe(666);
    expect(t.leadToRegistration).toBe(1000);
    expect(t.registrationToPaid).toBe(500);
    // цена регистрации: расходы / регистрации, вниз до цента
    expect(t.costPerRegistrationCents).toBe('3500');
  });

  it('пустой знаменатель: конверсии и цена null, а не ноль', () => {
    const empty: RnpSource = { ...src(), visitors: [], leads: [], organizations: [], payments: [], expenses: [] };
    const t = buildRnp(empty, '2026-10').total;
    expect(t.visitorToLead).toBeNull();
    expect(t.registrationToPaid).toBeNull();
    expect(t.costPerRegistrationCents).toBeNull();
  });
});

describe('РНП по партнёрам', () => {
  it('за месяц: регистрации, первые оплаты, принесли денег, начислено, выплачено; за всё время отдельно', () => {
    const p = buildRnp(src(), '2026-10').partners;
    const aidar = p.rows.find((r) => r.id === 'p1')!;
    expect(aidar).toMatchObject({ clients: 1, registrations: 1, firstPayments: 1, broughtCents: '39800', accruedCents: '7960', paidCents: '4000', broughtAllTimeCents: '39800' });
    const dina = p.rows.find((r) => r.id === 'p2')!;
    // клиент заведён в августе: в месяце нет регистрации, но его оплата октября идёт в «принесли»
    expect(dina).toMatchObject({ clients: 1, registrations: 0, firstPayments: 0, broughtCents: '1900', broughtAllTimeCents: '3800' });
    expect(p.total).toMatchObject({ partners: 2, active: 2, registrations: 1, firstPayments: 1, broughtCents: '41700', paidCents: '4000', broughtAllTimeCents: '43600' });
  });
});
