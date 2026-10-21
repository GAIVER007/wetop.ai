import { describe, expect, it } from 'vitest';
import { derivedRuleText, promoPeriodText, promoUsesText } from './rate-rule-text';

/** Слова для производных тарифов и промокодов на стойке (DATA_MODEL §20, срез D4): без кодов и без «null». */
describe('derivedRuleText', () => {
  const rule = { parentName: 'Базовый', discountPercent: 15, minDaysBeforeArrival: null, maxDaysBeforeArrival: null, minNights: null };
  it('скидка от родителя, условий нет', () => {
    expect(derivedRuleText(rule)).toBe('−15% от «Базовый»');
  });
  it('раннее бронирование, last minute и минимум ночей — словами через точку с запятой', () => {
    expect(derivedRuleText({ ...rule, minDaysBeforeArrival: 30, minNights: 2 })).toBe(
      '−15% от «Базовый»; заезд не раньше чем за 30 дн.; от 2 ноч.',
    );
    expect(derivedRuleText({ ...rule, maxDaysBeforeArrival: 7 })).toBe(
      '−15% от «Базовый»; заезд не позже чем за 7 дн.',
    );
    expect(derivedRuleText({ ...rule, minDaysBeforeArrival: 3, maxDaysBeforeArrival: 14 })).toBe(
      '−15% от «Базовый»; заезд за 3–14 дн.',
    );
  });
});

describe('promoPeriodText', () => {
  it('без границ, с одной и с двумя — датами дд.мм.гггг', () => {
    expect(promoPeriodText(null, null)).toBe('Любые даты проживания');
    expect(promoPeriodText('2026-11-01', null)).toBe('Проживание с 01.11.2026');
    expect(promoPeriodText(null, '2026-11-30')).toBe('Проживание по 30.11.2026');
    expect(promoPeriodText('2026-11-01', '2026-11-30')).toBe('Проживание с 01.11.2026 по 30.11.2026');
  });
});

describe('promoUsesText', () => {
  it('использовано и предел', () => {
    expect(promoUsesText(3, null)).toBe('3');
    expect(promoUsesText(3, 10)).toBe('3 из 10');
    expect(promoUsesText(0, 5)).toBe('0 из 5');
  });
});
