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
      activeTrials: 0,
      firstPayments: 1,
      renewals: 1,
      conversion: { visitorToRegistration: null, registrationToTrial: 500, trialToActive: null, trialToPaid: 500, renewal: 1000 },
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

describe('отток месяца (план §1: ушли в «только чтение» или приостановку за месяц)', () => {
  it('считает клиентов по журналу статусов месяца, один клиент один раз; вернувшиеся тоже считаются; своя организация нет', () => {
    const g = buildGrowth(
      {
        ...src(),
        statusChanges: [
          { organizationId: 'd', to: 'READ_ONLY', at: new Date('2026-10-05T00:00:00Z') },
          { organizationId: 'd', to: 'SUSPENDED', at: new Date('2026-10-06T00:00:00Z') },
          { organizationId: 'a', to: 'READ_ONLY', at: new Date('2026-10-07T00:00:00Z') },
          { organizationId: 'a', to: 'ACTIVE', at: new Date('2026-10-08T00:00:00Z') },
          { organizationId: 'b', to: 'READ_ONLY', at: new Date('2026-09-30T23:00:00Z') },
          { organizationId: 'own', to: 'SUSPENDED', at: new Date('2026-10-09T00:00:00Z') },
        ],
      },
      '2026-10',
      NOW,
    );
    expect(g.churn).toEqual({ count: 2, previous: 1 });
  });

  it('журнала нет (старый источник): ноль', () => {
    expect(buildGrowth(src(), '2026-10', NOW).churn).toEqual({ count: 0, previous: 0 });
  });
});


/**
 * Главная кабинета, вариант «B» (владелец 30.10.2026): клиенты, оплатившие в месяце, средний чек, сумма оплат;
 * активность на пробном (дни с работой в системе), не оплатившие после пробного; по месяцам «пробный в оплату» и
 * «продлили». Активный на пробном: работал в системе 3 дня и больше за срок пробного.
 */
describe('главная «B»: оплаты месяца и пробный', () => {
  const trialSrc = (): GrowthSource => {
    const s = src();
    s.organizations.push(
      org('e', '2026-10-01T00:00:00Z', 'READ_ONLY', '2026-10-08T00:00:00Z'),
      org('f', '2026-10-02T00:00:00Z', 'ACTIVE', '2026-10-09T00:00:00Z'),
    );
    s.payments.push({ organizationId: 'f', amountCents: 4900n, paidOn: '2026-10-09', voided: false });
    s.activity = [
      // e: 1 день; f: 4 дня в пробном и 1 после (не в счёт); b: 3 дня; c: 2 дня
      { organizationId: 'e', day: '2026-10-01' },
      { organizationId: 'f', day: '2026-10-02' },
      { organizationId: 'f', day: '2026-10-03' },
      { organizationId: 'f', day: '2026-10-05' },
      { organizationId: 'f', day: '2026-10-07' },
      { organizationId: 'f', day: '2026-10-20' },
      { organizationId: 'b', day: '2026-10-03' },
      { organizationId: 'b', day: '2026-10-04' },
      { organizationId: 'b', day: '2026-10-06' },
      { organizationId: 'c', day: '2026-10-21' },
      { organizationId: 'c', day: '2026-10-22' },
    ];
    return s;
  };

  it('оплаты месяца: оплатившие клиенты, число оплат, сумма, средний чек; прошлый месяц для сравнения', () => {
    const g = buildGrowth(trialSrc(), '2026-10', NOW);
    expect(g.money).toEqual({
      paidClients: 3,
      paymentsCount: 3,
      incomeCents: '19900',
      avgCheckCents: '6633',
      previous: { paidClients: 0, paymentsCount: 0, incomeCents: '0', avgCheckCents: '0' },
    });
  });

  it('воронка: активные на пробном (3 дня и больше за срок пробного) между пробным и оплатой', () => {
    const g = buildGrowth(trialSrc(), '2026-10', NOW);
    // пробных месяца 4: b, c, e, f; активны b и f
    expect(g.funnel.trials).toBe(4);
    expect(g.funnel.activeTrials).toBe(2);
    expect(g.funnel.conversion.trialToActive).toBe(500);
  });

  it('пробный: средняя активность у оплативших и нет, после пробного не оплатили', () => {
    const g = buildGrowth(trialSrc(), '2026-10', NOW);
    // пробный кончился в месяце у e (не оплатил) и f (оплатил); у b срока нет: 7 дней от создания, тоже кончился
    expect(g.trial).toEqual({
      registrations: 4,
      previousRegistrations: 1,
      now: 1,
      endingSoon: 1,
      ended: 3,
      endedUnpaid: 1,
      avgActiveDaysTenths: 27,
      paidActiveDaysTenths: 35,
      unpaidActiveDaysTenths: 10,
    });
  });

  it('по месяцам: пробный в оплату и продления, шесть месяцев, выбранный последним', () => {
    const g = buildGrowth(trialSrc(), '2026-10', NOW);
    expect(g.rates.map((r) => r.month)).toEqual(['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
    expect(g.rates.at(-1)).toEqual({ month: '2026-10', trialToPaid: 500, renewal: 1000 });
    expect(g.rates[0]).toEqual({ month: '2026-05', trialToPaid: null, renewal: null });
  });

  it('без журнала работы (старый источник): активность пустая, нули', () => {
    const g = buildGrowth(src(), '2026-10', NOW);
    expect(g.funnel.activeTrials).toBe(0);
    expect(g.trial.avgActiveDaysTenths).toBeNull();
  });
});

/**
 * «Клиенты» вариант C (владелец 30.10.2026: «Давай»): у пробного видно, сколько дней он работал на пробном и за 7 дней;
 * «под риском» тот, кто на пробном с нами 3 дня и больше, а работал меньше 3 дней из последних 7.
 */
describe('клиенты C: работа на пробном и «под риском»', () => {
  it('дни работы на пробном и за 7 дней; риск только у пробного старше 3 дней с работой меньше 3 дней', () => {
    const s = src();
    s.organizations.push(org('e', '2026-10-28T00:00:00Z', 'TRIAL', '2026-11-04T00:00:00Z'));
    s.activity = [
      { organizationId: 'c', day: '2026-10-21' },
      { organizationId: 'c', day: '2026-10-27' },
      { organizationId: 'a', day: '2026-10-28' },
      { organizationId: 'e', day: '2026-10-28' },
    ];
    const g = buildGrowth(s, '2026-10', NOW);
    const by = new Map(g.clients.map((c) => [c.id, c]));
    expect(by.get('c')).toMatchObject({ trialActiveDays: 2, activeDays7: 1, atRisk: true });
    // новый пробный (1 день с нами) ещё не под риском
    expect(by.get('e')).toMatchObject({ trialActiveDays: 1, activeDays7: 1, atRisk: false });
    // платящий: риск пробного к нему не относится
    expect(by.get('a')).toMatchObject({ activeDays7: 1, atRisk: false });
  });

  it('без журнала работы: дни неизвестны, риска нет', () => {
    const c = buildGrowth(src(), '2026-10', NOW).clients.find((x) => x.id === 'c')!;
    expect(c).toMatchObject({ trialActiveDays: null, activeDays7: null, atRisk: false });
  });
});

// «Клиенты» C (владелец 30.10.2026): страна клиента в строке и фильтр по стране; страны нет: null
describe('страна клиента', () => {
  it('страна организации идёт в строку клиента, без страны: null', () => {
    const source = src();
    source.organizations = source.organizations.map((o) => (o.id === 'a' ? { ...o, countryCode: 'QA' } : o));
    const view = buildGrowth(source, '2026-10', NOW);
    expect(view.clients.find((c) => c.id === 'a')?.country).toBe('QA');
    expect(view.clients.find((c) => c.id === 'b')?.country).toBeNull();
  });
});
