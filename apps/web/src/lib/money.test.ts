import { describe, expect, it } from 'vitest';
import { formatMoney } from './money';

describe('formatMoney — DESIGN.md §14', () => {
  it('целая сумма без тиынов, разряды через пробел', () => {
    expect(formatMoney('1250000')).toBe('12 500 ₸');
    expect(formatMoney('1568801800')).toBe('15 688 018 ₸');
    expect(formatMoney('0')).toBe('0 ₸');
    expect(formatMoney(45000n)).toBe('450 ₸');
  });
  it('тиыны показываются только когда они есть', () => {
    expect(formatMoney('1250050')).toBe('12 500,50 ₸');
    expect(formatMoney('105')).toBe('1,05 ₸');
  });
  it('отрицательная сумма — минус U+2212, валюта не KZT — кодом', () => {
    expect(formatMoney('-1250000')).toBe('−12 500 ₸');
    expect(formatMoney('1250000', 'USD')).toBe('12 500 USD');
  });
});
