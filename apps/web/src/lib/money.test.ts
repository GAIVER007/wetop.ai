import { describe, expect, it } from 'vitest';
import { formatMoney, inputToMinor, minorToInput } from './money';

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

describe('inputToMinor: цена в тенге на входе, тиыны в базе', () => {
  it('converts whole and fractional amounts', () => {
    expect(inputToMinor('5000')).toBe('500000');
    expect(inputToMinor('8 000')).toBe('800000');
    expect(inputToMinor('1234,5')).toBe('123450');
    expect(inputToMinor('')).toBe('');
  });
  it('rejects non-amounts and negatives', () => {
    expect(inputToMinor('abc')).toBeNull();
    expect(inputToMinor('1.234')).toBeNull();
    expect(inputToMinor('-5')).toBeNull();
  });
  it('round-trips minorToInput', () => {
    for (const m of ['0', '500000', '123450', '99']) expect(inputToMinor(minorToInput(m))).toBe(m);
  });
});
