import { describe, expect, it } from 'vitest';
import { formatMoney } from './money';

describe('formatMoney — DESIGN.md §14', () => {
  it('без копеек, если их нет', () => {
    expect(formatMoney('1250000')).toBe('12 500 ₸');
    expect(formatMoney('0')).toBe('0 ₸');
    expect(formatMoney(1568801800n)).toBe('15 688 018 ₸');
  });
  it('тиыны только когда они есть, минус — типографский', () => {
    expect(formatMoney('123450')).toBe('1 234,50 ₸');
    expect(formatMoney('-1566000')).toBe('−15 660 ₸');
    expect(formatMoney('5')).toBe('0,05 ₸');
  });
  it('другая валюта — кодом', () => {
    expect(formatMoney('1000', 'USD')).toBe('10 USD');
  });
});
