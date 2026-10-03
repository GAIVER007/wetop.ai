import { describe, expect, it } from 'vitest';
import { halfYearMonths, incomeFor910 } from './form910';

describe('доход для формы 910 (K7, ADR-141)', () => {
  it('полугодие — шесть месяцев с границами в датах объекта', () => {
    expect(halfYearMonths(2026, 1)[0]).toEqual({ month: '2026-01', from: '2026-01-01', to: '2026-01-31' });
    expect(halfYearMonths(2026, 1)[1]).toEqual({ month: '2026-02', from: '2026-02-01', to: '2026-02-28' });
    expect(halfYearMonths(2028, 1)[1]!.to).toBe('2028-02-29');
    expect(halfYearMonths(2026, 2).map((m) => m.month)).toEqual([
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
      '2026-11',
      '2026-12',
    ]);
    expect(() => halfYearMonths(2026, 3 as 1)).toThrow();
  });
  it('доход = поступившие деньги минус возвраты; гарантия картой — не деньги', () => {
    const r = incomeFor910({
      paymentsByMethod: [
        { method: 'CASH', amountMinor: '1000000' },
        { method: 'KASPI', amountMinor: '250050' },
        { method: 'CARD_GUARANTEE', amountMinor: '999999' },
      ],
      refundedMinor: '50',
    });
    expect(r).toEqual({
      receivedMinor: 1250050n,
      refundedMinor: 50n,
      incomeMinor: 1250000n,
      byMethod: [
        { method: 'CASH', amountMinor: 1000000n },
        { method: 'KASPI', amountMinor: 250050n },
      ],
    });
  });
});
