import { describe, expect, it } from 'vitest';
import { buildPartners, parsePercentBp, type PartnersSource } from './partners';

/**
 * Партнёры WETOP (владелец 30.10.2026, PARTNERS-20261030): у клиента может быть партнёр, который его привёл. По
 * каждому партнёру: заведено на пробный (все его клиенты), подключено (клиенты с оплатой), доход от его клиентов,
 * начислено = доход × процент (вниз до цента), выплачено (расходы «Партнёрам» с его отметкой), к выплате = разница,
 * не меньше нуля. Деньги центами в bigint, процент в сотых долях процента (`2000` это 20%).
 */
const src = (): PartnersSource => ({
  partners: [
    { id: 'p1', name: 'Айдар', phone: '+974 5500 0001', email: null, percentBp: 2000, active: true },
    { id: 'p2', name: 'Студия Маркет', phone: null, email: 'm@example.invalid', percentBp: 1250, active: true },
    { id: 'p3', name: 'Ушёл', phone: null, email: null, percentBp: 1000, active: false },
  ],
  links: [
    { organizationId: 'a', partnerId: 'p1' },
    { organizationId: 'b', partnerId: 'p1' },
    { organizationId: 'c', partnerId: 'p1' },
    { organizationId: 'd', partnerId: 'p2' },
  ],
  payments: [
    { organizationId: 'a', amountCents: 9800n, voided: false },
    { organizationId: 'a', amountCents: 9800n, voided: false },
    { organizationId: 'b', amountCents: 4900n, voided: false },
    { organizationId: 'c', amountCents: 50000n, voided: true },
    { organizationId: 'd', amountCents: 999n, voided: false, kind: 'ADDON' },
    { organizationId: 'x', amountCents: 100000n, voided: false },
  ],
  payouts: [
    { partnerId: 'p1', amountCents: 2000n, voided: false },
    { partnerId: 'p1', amountCents: 7000n, voided: true },
    { partnerId: 'p2', amountCents: 500n, voided: false },
  ],
});

describe('партнёры: клиенты, доход, начислено, выплачено, к выплате', () => {
  it('по каждому партнёру; отменённые оплаты и выплаты не считаются, чужие клиенты тоже', () => {
    const v = buildPartners(src());
    expect(v.partners[0]).toEqual({
      id: 'p1',
      name: 'Айдар',
      phone: '+974 5500 0001',
      email: null,
      percentBp: 2000,
      active: true,
      trials: 3,
      connected: 2,
      incomeCents: '24500',
      // у тарифов клиентов p1 суммы выплаты нет, допов нет: начислено 0, переплата не уходит в минус
      accruedCents: '0',
      paidCents: '2000',
      dueCents: '0',
    });
  });

  it('процент с допа вниз до цента; переплата не даёт минуса к выплате', () => {
    const p2 = buildPartners(src()).partners[1]!;
    // 999 × 12,5% = 124,875 цента: 124
    expect(p2).toMatchObject({ trials: 1, connected: 1, incomeCents: '999', accruedCents: '124', paidCents: '500', dueCents: '0' });
  });

  it('итоги по всем партнёрам; ушедший партнёр в списке последним', () => {
    const v = buildPartners(src());
    expect(v.partners.map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
    expect(v.totals).toEqual({ partners: 2, trials: 4, connected: 3, incomeCents: '25499', accruedCents: '124', paidCents: '2500', dueCents: '0' });
  });
});

// владелец 30.10.2026: «с $19 партнёру $10, с $199 ровно $100, разово с первого чека; плюс 30% с допов: ИИ-продавец,
// таргетолог, контент и всё, что связано с продвижением»
describe('выплата партнёру: разово за тариф с первого чека и процент с допов', () => {
  const rule = (): PartnersSource => ({
    partners: [{ id: 'p1', name: 'Айдар', phone: null, email: null, percentBp: 3000, active: true }],
    links: [
      { organizationId: 'year', partnerId: 'p1' },
      { organizationId: 'month', partnerId: 'p1' },
      { organizationId: 'free', partnerId: 'p1' },
    ],
    payments: [
      // годовой тариф: первый чек $199, второй год тоже $199, но выплата партнёру одна
      { organizationId: 'year', amountCents: 19900n, voided: false, kind: 'PLAN' },
      { organizationId: 'year', amountCents: 19900n, voided: false, kind: 'PLAN' },
      // месячный $19 трижды: выплата одна, $10
      { organizationId: 'month', amountCents: 1900n, voided: false, kind: 'PLAN' },
      { organizationId: 'month', amountCents: 1900n, voided: false, kind: 'PLAN' },
      { organizationId: 'month', amountCents: 1900n, voided: false, kind: 'PLAN' },
      // доп: ИИ-продавец $50 и таргетолог $33,33; 30% вниз до цента
      { organizationId: 'month', amountCents: 5000n, voided: false, kind: 'ADDON' },
      { organizationId: 'year', amountCents: 3333n, voided: false, kind: 'ADDON' },
      // отменённая оплата тарифа не даёт выплаты
      { organizationId: 'free', amountCents: 1900n, voided: true, kind: 'PLAN' },
    ],
    payouts: [],
    planPayouts: [
      { organizationId: 'year', payoutCents: 10000n },
      { organizationId: 'month', payoutCents: 1000n },
      { organizationId: 'free', payoutCents: 1000n },
    ],
  });

  it('$100 за годовой, $10 за месячный разово; 30% с допов вниз до цента; отменённый чек ничего не даёт', () => {
    const p = buildPartners(rule()).partners[0]!;
    // 10000 + 1000 + 30% × (5000 + 3333) = 11000 + 2499 (2499,9 вниз)
    expect(p).toMatchObject({ trials: 3, connected: 2, incomeCents: '53833', accruedCents: '13499', dueCents: '13499' });
  });

  it('у тарифа клиента нет суммы выплаты: за тариф 0, допы по проценту', () => {
    const src = { ...rule(), planPayouts: [] };
    expect(buildPartners(src).partners[0]).toMatchObject({ accruedCents: '2499' });
  });
});

describe('процент партнёра', () => {
  it('«20», «12.5», «12,5», «0», «100»; больше 100, минус, три знака после точки и мусор: null', () => {
    expect(parsePercentBp('20')).toBe(2000);
    expect(parsePercentBp('12.5')).toBe(1250);
    expect(parsePercentBp(' 12,55 ')).toBe(1255);
    expect(parsePercentBp('0')).toBe(0);
    expect(parsePercentBp('100')).toBe(10000);
    for (const bad of ['101', '-5', '1.234', 'abc', '', null, 20]) expect(parsePercentBp(bad)).toBeNull();
  });
});
