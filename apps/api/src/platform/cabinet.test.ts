import { describe, expect, it } from 'vitest';
import { buildCabinet, trialDaysLeft, type CabinetSource } from './cabinet';

/**
 * Кабинет компании WETOP, срез 1 (владелец 28.10.2026): путь клиента, клиенты и сроки только из того, что есть в
 * базе. Своя организация главного администратора не клиент. Денег в ответе нет до среза 2.
 */
const NOW = new Date('2026-10-28T12:00:00Z');
const day = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

const org = (
  id: string,
  over: Partial<CabinetSource['organizations'][number]> = {},
): CabinetSource['organizations'][number] => ({
  id,
  name: id,
  status: 'ACTIVE',
  trialEndsAt: null,
  createdAt: day(-60),
  verticals: ['HOSPITALITY'],
  locations: 1,
  members: [{ email: `${id}@example.invalid`, owner: true, lastLoginAt: day(-1) }],
  ...over,
});

const src = (organizations: CabinetSource['organizations'], extra: Partial<CabinetSource> = {}): CabinetSource => ({
  organizations,
  records30d: [],
  ownOrganizationId: null,
  ...extra,
});

describe('кабинет компании: срез 1', () => {
  it('своя организация главного администратора не клиент', () => {
    const view = buildCabinet(src([org('own'), org('luxx')], { ownOrganizationId: 'own' }), NOW);
    expect(view.clients.map((c) => c.id)).toEqual(['luxx']);
    expect(view.totals.clients).toBe(1);
  });

  it('путь клиента: регистрации за 30 дней, работают за 7 дней, пробный, платят, ушли', () => {
    const view = buildCabinet(
      src([
        org('paying'),
        org('trial', { status: 'TRIAL', trialEndsAt: day(5), createdAt: day(-3) }),
        org('sleeping', { members: [{ email: 's@example.invalid', owner: true, lastLoginAt: day(-8) }] }),
        org('unpaid', { status: 'READ_ONLY' }),
        org('gone', { status: 'SUSPENDED', createdAt: day(-10) }),
      ]),
      NOW,
    );
    expect(view.funnel).toEqual({ registered30d: 2, working: 3, trial: 1, paying: 2, left: 2 });
    // архив в клиентах не показывается
    expect(view.clients.map((c) => c.id)).not.toContain('gone');
  });

  it('клиент: люди, владелец, последний вход, записи за 30 дней; свежий вход выше', () => {
    const view = buildCabinet(
      src(
        [
          org('kyial', {
            status: 'TRIAL',
            trialEndsAt: day(5),
            verticals: ['BEAUTY'],
            members: [
              { email: 'boss@example.invalid', owner: true, lastLoginAt: day(-2) },
              { email: 'admin@example.invalid', owner: false, lastLoginAt: new Date(NOW.getTime() - 3_600_000) },
            ],
          }),
          org('luxx', { locations: 2 }),
        ],
        { records30d: [{ organizationId: 'kyial', count: 20 }] },
      ),
      NOW,
    );
    expect(view.clients[0]).toMatchObject({
      id: 'kyial',
      members: 2,
      owner: 'boss@example.invalid',
      records30d: 20,
      trialDaysLeft: 5,
      lastLoginAt: '2026-10-28T11:00:00.000Z',
    });
    expect(view.clients[1]).toMatchObject({ id: 'luxx', locations: 2, records30d: 0, trialDaysLeft: null });
    expect(view.totals).toEqual({ clients: 2, people: 3, activePeople7d: 3 });
  });

  it('сроки: ближайший конец пробного первым, неоплаченные с нулём дней', () => {
    const view = buildCabinet(
      src([
        org('later', { status: 'TRIAL', trialEndsAt: day(6) }),
        org('soon', { status: 'TRIAL', trialEndsAt: day(1) }),
        org('unpaid', { status: 'READ_ONLY' }),
        org('paying'),
      ]),
      NOW,
    );
    expect(view.deadlines.map((d) => [d.id, d.kind, d.daysLeft])).toEqual([
      ['unpaid', 'unpaid', 0],
      ['soon', 'trial', 1],
      ['later', 'trial', 6],
    ]);
  });

  it('дней пробного: кончился это 0, неполный день округляется вверх, без даты null', () => {
    expect(trialDaysLeft(day(-2), NOW)).toBe(0);
    expect(trialDaysLeft(new Date(NOW.getTime() + 3_600_000), NOW)).toBe(1);
    expect(trialDaysLeft(null, NOW)).toBeNull();
  });

  it('денег в ответе нет до среза 2: ни дохода, ни MRR', () => {
    const view = buildCabinet(src([org('luxx')]), NOW);
    expect(JSON.stringify(view)).not.toMatch(/mrr|revenue|income|amount/i);
  });

  it('карточка в списке (ТЗ «две админки» п. 4, 30.10.2026): город, тариф, следующий платёж, партнёр', () => {
    const view = buildCabinet(
      src([org('kyial', { city: 'Алматы' }), org('luxx')], {
        subscriptions: [{ organizationId: 'kyial', planName: 'Месяц', paidUntil: '2026-11-05' }],
        partners: [{ organizationId: 'kyial', partnerName: 'Айдар' }],
      }),
      NOW,
    );
    expect(view.clients.find((c) => c.id === 'kyial')).toMatchObject({ city: 'Алматы', plan: 'Месяц', nextPaymentOn: '2026-11-05', partner: 'Айдар' });
    // без данных: пусто, не выдумываем
    expect(view.clients.find((c) => c.id === 'luxx')).toMatchObject({ city: null, plan: null, nextPaymentOn: null, partner: null });
  });
});
