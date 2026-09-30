import { describe, expect, it } from 'vitest';
import { ReservationRuleError } from '../reservations/reservations';
import {
  assertDerivedRuleAllows,
  assertPromoAllows,
  discountedMinor,
  normalizePromoCode,
  pickDiscount,
  validateDerivedRule,
} from './discounts';

/** Производный тариф и промокод (DATA_MODEL §20, ADR-128, срез D4): деньги — целые тиыны, процент — целый. */
describe('discountedMinor', () => {
  it('скидка процентом, округление к ближайшему тиыну (половина — вверх)', () => {
    expect(discountedMinor(10_000_00n, 10)).toBe(9_000_00n);
    expect(discountedMinor(1_005n, 10)).toBe(905n); // 904,5 → 905
    expect(discountedMinor(1_001n, 33)).toBe(671n); // 670,67 → 671
    expect(discountedMinor(0n, 50)).toBe(0n);
  });
  it('процент вне 1…90 или нецелый — ошибка', () => {
    expect(() => discountedMinor(1000n, 0)).toThrow(ReservationRuleError);
    expect(() => discountedMinor(1000n, 91)).toThrow(ReservationRuleError);
    expect(() => discountedMinor(1000n, 12.5)).toThrow(ReservationRuleError);
  });
});

describe('validateDerivedRule', () => {
  const ok = { discountPercent: 15, minDaysBeforeArrival: null, maxDaysBeforeArrival: null, minNights: null };
  it('принимает верное правило', () => {
    expect(validateDerivedRule(ok)).toBeNull();
    expect(validateDerivedRule({ ...ok, minDaysBeforeArrival: 30, minNights: 3 })).toBeNull();
  });
  it('отвергает процент, отрицательные и обратные окна, нулевой минимум ночей', () => {
    expect(validateDerivedRule({ ...ok, discountPercent: 0 })).toMatch(/1.*90/);
    expect(validateDerivedRule({ ...ok, minDaysBeforeArrival: -1 })).toBeTruthy();
    expect(validateDerivedRule({ ...ok, minDaysBeforeArrival: 10, maxDaysBeforeArrival: 5 })).toBeTruthy();
    expect(validateDerivedRule({ ...ok, minNights: 0 })).toBeTruthy();
    expect(validateDerivedRule({ ...ok, minNights: 1.5 })).toBeTruthy();
  });
});

describe('assertDerivedRuleAllows', () => {
  const rule = { discountPercent: 20, minDaysBeforeArrival: null, maxDaysBeforeArrival: null, minNights: null };
  const base = { planName: 'Раннее бронирование', today: '2026-10-01', arrivalDate: '2026-11-01', nights: 3 };
  it('без окон и минимума продаётся всегда', () => {
    expect(() => assertDerivedRuleAllows(rule, base)).not.toThrow();
  });
  it('раннее бронирование: заезд не раньше чем через N дней (граница включается)', () => {
    const early = { ...rule, minDaysBeforeArrival: 31 };
    expect(() => assertDerivedRuleAllows(early, base)).not.toThrow(); // 31 день
    expect(() => assertDerivedRuleAllows(early, { ...base, arrivalDate: '2026-10-31' })).toThrow(/30 дн/);
  });
  it('last minute: заезд не позже чем через N дней', () => {
    const late = { ...rule, maxDaysBeforeArrival: 3 };
    expect(() => assertDerivedRuleAllows(late, { ...base, arrivalDate: '2026-10-04' })).not.toThrow();
    expect(() => assertDerivedRuleAllows(late, { ...base, arrivalDate: '2026-10-05' })).toThrow(/4 дн/);
  });
  it('long stay: срок не короче N ночей', () => {
    const long = { ...rule, minNights: 5 };
    expect(() => assertDerivedRuleAllows(long, { ...base, nights: 5 })).not.toThrow();
    expect(() => assertDerivedRuleAllows(long, { ...base, nights: 4 })).toThrow(/5 ноч/);
  });
  it('заезд в прошлом — ошибка правила, а не отрицательные дни', () => {
    expect(() =>
      assertDerivedRuleAllows({ ...rule, maxDaysBeforeArrival: 3 }, { ...base, arrivalDate: '2026-09-30' }),
    ).toThrow(ReservationRuleError);
  });
});

describe('normalizePromoCode', () => {
  it('верхний регистр, обрезка, допустимые знаки', () => {
    expect(normalizePromoCode('  summer-10 ')).toBe('SUMMER-10');
    expect(normalizePromoCode('a_b3')).toBe('A_B3');
  });
  it('пустое, короткое, длинное и со странными знаками — нет', () => {
    expect(normalizePromoCode('')).toBeNull();
    expect(normalizePromoCode('ab')).toBeNull();
    expect(normalizePromoCode('x'.repeat(33))).toBeNull();
    expect(normalizePromoCode('лето 10')).toBeNull();
    expect(normalizePromoCode('A B')).toBeNull();
  });
});

describe('assertPromoAllows', () => {
  const promo = { code: 'SUMMER10', discountPercent: 10, stayFrom: null, stayTo: null, maxUses: null, uses: 0, active: true };
  const stay = { arrivalDate: '2026-11-01', departureDate: '2026-11-04' };
  it('без границ и пределов действует', () => {
    expect(() => assertPromoAllows(promo, stay)).not.toThrow();
  });
  it('выключенный, исчерпанный и вне периода проживания — отказ словами', () => {
    expect(() => assertPromoAllows({ ...promo, active: false }, stay)).toThrow(/не действует/);
    expect(() => assertPromoAllows({ ...promo, maxUses: 5, uses: 5 }, stay)).toThrow(/исчерпан/);
    expect(() => assertPromoAllows({ ...promo, stayFrom: '2026-11-02' }, stay)).toThrow(/период/);
  });
  it('границы периода включаются по ночам: последняя ночь — день перед выездом', () => {
    expect(() => assertPromoAllows({ ...promo, stayTo: '2026-11-03' }, stay)).not.toThrow(); // ночи 1, 2, 3 ноября
    expect(() => assertPromoAllows({ ...promo, stayTo: '2026-11-02' }, stay)).toThrow(/период/);
    expect(() => assertPromoAllows({ ...promo, stayFrom: '2026-11-01' }, stay)).not.toThrow();
  });
});

describe('pickDiscount', () => {
  it('одна большая скидка, без суммирования (Q-231)', () => {
    expect(pickDiscount(15, 10)).toEqual({ percent: 15, source: 'PLAN' });
    expect(pickDiscount(10, 25)).toEqual({ percent: 25, source: 'PROMO' });
  });
  it('при равных — скидка тарифа; одной из двух нет — другая; обеих нет — без скидки', () => {
    expect(pickDiscount(10, 10)).toEqual({ percent: 10, source: 'PLAN' });
    expect(pickDiscount(null, 10)).toEqual({ percent: 10, source: 'PROMO' });
    expect(pickDiscount(15, null)).toEqual({ percent: 15, source: 'PLAN' });
    expect(pickDiscount(null, null)).toEqual({ percent: 0, source: null });
  });
});
