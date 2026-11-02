import { describe, expect, it } from 'vitest';
import { parsePartnerProfile, partnerScore } from './partner-cabinet';
import { buildPartnerCabinet, clientStatus, nextPartnerCode, partnerLinks, type PartnerCabinetSource } from './partner-cabinet';

/**
 * Кабинет партнёра WETOP (владелец 31.10.2026, ТЗ VTOP 01.11.2026, DATA_MODEL §63.3): только свои клиенты (имя и
 * статус), своя ссылка, начислено по правилу первого чека, баланс, история выплат, место в рейтинге партнёров.
 */
const NOW = new Date('2026-11-01T10:00:00Z');
const src = (): PartnerCabinetSource => ({
  partner: { id: 'p1', name: 'Айдар', code: 'P001', percentBp: 3000 },
  partners: [
    { id: 'p1', active: true },
    { id: 'p2', active: true },
    { id: 'p3', active: false },
  ],
  links: [
    { organizationId: 'a', partnerId: 'p1', source: 'LINK', channel: 'instagram' },
    { organizationId: 'b', partnerId: 'p1', source: 'MANUAL', channel: null },
    { organizationId: 'c', partnerId: 'p1', source: 'LINK', channel: null },
    { organizationId: 'x', partnerId: 'p2', source: 'MANUAL', channel: null },
    { organizationId: 'y', partnerId: 'p2', source: 'MANUAL', channel: null },
  ],
  organizations: [
    { id: 'a', name: 'Салон Аня', status: 'ACTIVE', trialEndsAt: null, createdAt: '2026-10-05' },
    { id: 'b', name: 'Отель Б', status: 'TRIAL', trialEndsAt: '2026-11-20T00:00:00Z', createdAt: '2026-10-21' },
    { id: 'c', name: 'Кафе В', status: 'READ_ONLY', trialEndsAt: '2026-10-25T00:00:00Z', createdAt: '2026-09-25' },
    { id: 'x', name: 'Чужой', status: 'ACTIVE', trialEndsAt: null, createdAt: '2026-10-01' },
    { id: 'y', name: 'Чужой 2', status: 'ACTIVE', trialEndsAt: null, createdAt: '2026-10-01' },
  ],
  payments: [
    { organizationId: 'a', amountCents: 19900n, paidOn: '2026-10-10', voided: false, kind: 'PLAN' },
    { organizationId: 'a', amountCents: 19900n, paidOn: '2026-10-20', voided: false, kind: 'PLAN' },
    { organizationId: 'a', amountCents: 9900n, paidOn: '2026-10-12', voided: false, kind: 'ADDON' },
    { organizationId: 'b', amountCents: 1900n, paidOn: '2026-10-22', voided: true, kind: 'PLAN' },
    { organizationId: 'x', amountCents: 1900n, paidOn: '2026-10-02', voided: false, kind: 'PLAN' },
    { organizationId: 'y', amountCents: 1900n, paidOn: '2026-10-02', voided: false, kind: 'PLAN' },
  ],
  planPayouts: [
    { organizationId: 'a', payoutCents: 10000n },
    { organizationId: 'b', payoutCents: 1000n },
    { organizationId: 'x', payoutCents: 1000n },
    { organizationId: 'y', payoutCents: 1000n },
  ],
  payouts: [
    { partnerId: 'p1', amountCents: 5000n, spentOn: '2026-10-25', voided: false, note: 'Kaspi' },
    { partnerId: 'p1', amountCents: 999n, spentOn: '2026-10-26', voided: true, note: null },
    { partnerId: 'p2', amountCents: 100n, spentOn: '2026-10-26', voided: false, note: null },
  ],
});

describe('кабинет партнёра: свои клиенты и деньги', () => {
  it('только свои клиенты: имя, статус, пробный до, оплачен; без контактов и чужих', () => {
    const v = buildPartnerCabinet(src(), NOW);
    expect(v.clients.map((c) => c.name)).toEqual(['Отель Б', 'Салон Аня', 'Кафе В']);
    expect(v.clients.find((c) => c.organizationId === 'a')).toEqual({
      organizationId: 'a', name: 'Салон Аня', status: 'PAID', paid: true, trialEndsAt: null, source: 'LINK', channel: 'instagram', since: '2026-10-05', commissionCents: '12970',
    });
    expect(v.clients.find((c) => c.organizationId === 'b')).toMatchObject({ status: 'TRIAL', paid: false, trialEndsAt: '2026-11-20', commissionCents: '0' });
    expect(v.clients.find((c) => c.organizationId === 'c')).toMatchObject({ status: 'TRIAL_ENDED', paid: false });
    expect(JSON.stringify(v)).not.toMatch(/Чужой|phone|email/);
  });

  it('начислено по правилу первого чека, баланс = начислено − выплачено, история выплат без отменённых', () => {
    const v = buildPartnerCabinet(src(), NOW);
    // $100 за тариф «a» один раз + 30% от первого допа $99 = $29,70; повторный чек и отменённый ничего не дают
    expect(v.money).toEqual({ accruedCents: '12970', paidCents: '5000', balanceCents: '7970' });
    expect(v.payouts).toEqual([{ spentOn: '2026-10-25', amountCents: '5000', note: 'Kaspi' }]);
  });

  it('цифры: клиентов, на пробном, оплатили, конверсия десятыми процента; место в рейтинге действующих', () => {
    const v = buildPartnerCabinet(src(), NOW);
    expect(v.stats).toEqual({ clients: 3, trial: 1, paid: 1, trialEnded: 1, conversion: 333 });
    // у p1 один оплативший клиент и $129,70, у p2 два оплативших: p2 первый, p1 второй из двух действующих
    expect(v.rating).toEqual({ place: 2, of: 2 });
  });
});

describe('статус клиента партнёра', () => {
  it('оплата тарифа: оплачен; пробный идёт; пробный кончился или только чтение; приостановлен: потерян', () => {
    expect(clientStatus({ status: 'TRIAL', trialEndsAt: '2026-11-02T00:00:00Z' }, true, NOW)).toBe('PAID');
    expect(clientStatus({ status: 'TRIAL', trialEndsAt: '2026-11-02T00:00:00Z' }, false, NOW)).toBe('TRIAL');
    expect(clientStatus({ status: 'TRIAL', trialEndsAt: '2026-10-31T00:00:00Z' }, false, NOW)).toBe('TRIAL_ENDED');
    expect(clientStatus({ status: 'ACTIVE', trialEndsAt: null }, false, NOW)).toBe('ACTIVE');
    expect(clientStatus({ status: 'SUSPENDED', trialEndsAt: null }, false, NOW)).toBe('LOST');
  });
});

describe('Partner ID и ссылки', () => {
  it('следующий свободный номер P001, P002 … по уже выданным', () => {
    expect(nextPartnerCode([])).toBe('P001');
    expect(nextPartnerCode(['P001', 'P007', 'X1'])).toBe('P008');
    expect(nextPartnerCode(['P999'])).toBe('P1000');
  });
  it('ссылка клиента и ссылка приглашения разные', () => {
    expect(partnerLinks('https://app.wetop.ai', 'P007')).toEqual({ client: 'https://app.wetop.ai/start?p=P007' });
  });
});

describe('Partner Score и профиль (DATA_MODEL §63.4)', () => {
  it('Score 0..100: конверсия 50, оплатившие до 10 штук 30, живые клиенты 20; клиентов нет: 0 «Новый»', () => {
    expect(partnerScore({ clients: 0, paid: 0, alive: 0 })).toEqual({ score: 0, level: 'NEW' });
    // 4 клиента, 2 оплатили, 3 живых: 25 + 6 + 15 = 46
    expect(partnerScore({ clients: 4, paid: 2, alive: 3 })).toEqual({ score: 46, level: 'ACTIVE' });
    expect(partnerScore({ clients: 10, paid: 10, alive: 10 })).toEqual({ score: 100, level: 'TOP' });
    expect(partnerScore({ clients: 3, paid: 1, alive: 1 }).score).toBe(26);
  });
  it('профиль: обрезка, пустое в null, опыт целым 0..60, телефон нормализуется; кривое: ошибка словами', () => {
    expect(
      parsePartnerProfile({ specialization: '  Маркетолог ', city: 'Алматы', experienceYears: '5', about: '', phone: '+7 (701) 000-00-01' }),
    ).toEqual({ ok: true, value: { specialization: 'Маркетолог', city: 'Алматы', experienceYears: 5, about: null, phone: '+77010000001' } });
    expect(parsePartnerProfile({ experienceYears: '61' })).toEqual({ ok: false, error: 'Опыт: целое число лет от 0 до 60' });
    expect(parsePartnerProfile({ experienceYears: '2.5' })).toEqual({ ok: false, error: 'Опыт: целое число лет от 0 до 60' });
    expect(parsePartnerProfile({ phone: 'abc' })).toEqual({ ok: false, error: 'Проверьте телефон: от 10 до 15 цифр' });
    expect(parsePartnerProfile({ about: 'я'.repeat(1001) })).toEqual({ ok: false, error: 'Описание: до 1000 знаков' });
    expect(parsePartnerProfile({})).toEqual({ ok: true, value: { specialization: null, city: null, experienceYears: null, about: null, phone: null } });
  });
});
