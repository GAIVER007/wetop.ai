import { describe, expect, it } from 'vitest';
import { cashAmount, closeCashShift, cashDelta } from './cash-shift-rules';

describe('кассовая смена', () => {
  it('считает деньги целыми minor units', () => {
    expect(cashAmount('100.01')).toBe(10001n);
    expect(cashAmount('0')).toBe(0n);
    expect(() => cashAmount('1.001')).toThrow();
    expect(() => cashAmount('-1')).toThrow();
    expect(() => cashAmount('1e5')).toThrow();
  });
  it('закрывает с расхождением, сохраняя его без корректирующего расхода', () => {
    expect(closeCashShift(8150000n, 8100000n, 1000000n, 'Перепроверить')).toEqual({
      expected: '8150000',
      counted: '8100000',
      difference: '-50000',
      retained: '1000000',
      plannedHandover: '7100000',
    });
  });
  it('требует объяснения расхождения и не позволяет оставить больше факта', () => {
    expect(() => closeCashShift(100n, 90n, 10n, '')).toThrow();
    expect(() => closeCashShift(100n, 100n, 101n, '')).toThrow();
    expect(closeCashShift(0n, 0n, 0n, '').plannedHandover).toBe('0');
  });
  it('учитывает наличные отдельно от банковских способов', () => {
    const opening = { CASH: '1000000', CARD_TERMINAL: '0' };
    const current = { CASH: '8150000', CARD_TERMINAL: '6000000' };
    expect(cashDelta(opening, current)).toEqual({ CASH: '7150000', CARD_TERMINAL: '6000000' });
  });
});
