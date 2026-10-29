import { describe, expect, it } from 'vitest';
import { buildCountries } from './countries';

/**
 * «Страны» в кабинете руководителя (владелец 29.10.2026): по стране посетители сайта, новые клиенты, платящие,
 * доход месяца, MRR и средний LTV. Страна клиента из регистрации (телефон), посетителя из CF-IPCountry.
 * Деньги центами строкой, доли десятыми процента.
 */
const NOW = new Date('2026-10-29T12:00:00Z');
const org = (id: string, countryCode: string | null, createdAt: string, status: 'TRIAL' | 'ACTIVE' | 'READ_ONLY' | 'SUSPENDED') => ({
  id,
  name: id,
  countryCode,
  status,
  createdAt: new Date(createdAt),
  trialEndsAt: null,
});

describe('страны в кабинете руководителя', () => {
  const view = buildCountries(
    {
      organizations: [
        org('kz1', 'KZ', '2026-10-03T00:00:00Z', 'ACTIVE'),
        org('kz2', 'KZ', '2026-10-10T00:00:00Z', 'TRIAL'),
        org('kz-old', 'KZ', '2026-08-01T00:00:00Z', 'ACTIVE'),
        org('qa1', 'QA', '2026-10-12T00:00:00Z', 'TRIAL'),
        org('none', null, '2026-07-01T00:00:00Z', 'ACTIVE'),
        org('own', 'KZ', '2026-01-01T00:00:00Z', 'ACTIVE'),
      ],
      payments: [
        { organizationId: 'kz1', amountCents: 4900n, paidOn: '2026-10-05', voided: false },
        { organizationId: 'kz-old', amountCents: 4900n, paidOn: '2026-09-01', voided: false },
        { organizationId: 'kz-old', amountCents: 4900n, paidOn: '2026-10-01', voided: false },
        { organizationId: 'kz-old', amountCents: 9900n, paidOn: '2026-10-02', voided: true },
        { organizationId: 'none', amountCents: 2000n, paidOn: '2026-10-07', voided: false },
        { organizationId: 'own', amountCents: 100000n, paidOn: '2026-10-07', voided: false },
      ],
      subscriptions: [
        { organizationId: 'kz1', monthlyCents: 4900n, paidUntil: '2026-11-05' },
        { organizationId: 'kz-old', monthlyCents: 4900n, paidUntil: '2026-10-20' },
        { organizationId: 'none', monthlyCents: 2000n, paidUntil: '2026-11-07' },
      ],
      visitors: [
        { country: 'KZ', visitors: 40 },
        { country: 'QA', visitors: 10 },
        { country: 'AE', visitors: 5 },
        { country: null, visitors: 2 },
      ],
      ownOrganizationId: 'own',
    },
    '2026-10',
    NOW,
  );

  it('Казахстан: посетители, новые клиенты, платящие, доход и MRR месяца', () => {
    expect(view.rows[0]).toEqual({
      country: 'KZ',
      visitors: 40,
      newClients: 2,
      firstPayments: 1,
      paying: 2,
      incomeCents: '9800',
      mrrCents: '4900',
      avgLtvCents: '7350',
      visitorToClient: 50,
      clientToPaid: 500,
    });
  });

  it('страны без денег и без посетителей тоже в списке; сортировка по доходу, потом по посетителям', () => {
    expect(view.rows.map((r) => r.country)).toEqual(['KZ', null, 'QA', 'AE']);
    expect(view.rows.find((r) => r.country === 'AE')).toMatchObject({ visitors: 5, newClients: 0, incomeCents: '0', visitorToClient: 0 });
  });

  it('своя организация WETOP не клиент; отменённая оплата не доход', () => {
    expect(view.total).toMatchObject({ visitors: 57, newClients: 3, paying: 3, incomeCents: '11800', mrrCents: '6900' });
  });

  it('счётчика нет: посетители null, переход не считается', () => {
    const v = buildCountries({ organizations: [org('kz1', 'KZ', '2026-10-03T00:00:00Z', 'TRIAL')], payments: [], subscriptions: [], visitors: null, ownOrganizationId: null }, '2026-10', NOW);
    expect(v.rows[0]).toMatchObject({ country: 'KZ', visitors: null, newClients: 1, visitorToClient: null });
    expect(v.total.visitors).toBeNull();
  });
});
