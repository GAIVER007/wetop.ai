import { describe, expect, it } from 'vitest';
import {
  FinanceRuleError,
  assertAllocationsMatch,
  assertRefundWithin,
  folioBalance,
  penaltyAmount,
  parseMoney,
} from './finance';

describe('folioBalance', () => {
  it('= active charges − allocated payments + refunds, in minor units', () => {
    const b = folioBalance({
      charges: [
        { amountMinor: 2_200_000n, voided: false },
        { amountMinor: 50_000n, voided: false },
        { amountMinor: 999n, voided: true },
      ],
      allocations: [{ amountMinor: 2_000_000n }],
      refunds: [{ amountMinor: 100_000n }],
    });
    expect(b).toEqual({
      chargedMinor: 2_250_000n,
      paidMinor: 2_000_000n,
      refundedMinor: 100_000n,
      balanceMinor: 350_000n,
    });
  });
});

describe('payment rules', () => {
  it('allocations must sum exactly to the payment amount and be positive', () => {
    expect(() =>
      assertAllocationsMatch(1_000n, [
        { folioId: 'f1', amountMinor: 600n },
        { folioId: 'f2', amountMinor: 400n },
      ]),
    ).not.toThrow();
    expect(() => assertAllocationsMatch(1_000n, [{ folioId: 'f1', amountMinor: 600n }])).toThrow(
      FinanceRuleError,
    );
    expect(() =>
      assertAllocationsMatch(1_000n, [
        { folioId: 'f1', amountMinor: 1_000n },
        { folioId: 'f1', amountMinor: 0n },
      ]),
    ).toThrow(/больше нуля/);
    expect(() => assertAllocationsMatch(0n, [])).toThrow(/[Сс]умма/);
  });
  it('refund cannot exceed what this payment allocated to the folio minus earlier refunds', () => {
    expect(() =>
      assertRefundWithin({ allocatedMinor: 1_000n, refundedMinor: 300n, refundMinor: 700n }),
    ).not.toThrow();
    expect(() =>
      assertRefundWithin({ allocatedMinor: 1_000n, refundedMinor: 300n, refundMinor: 701n }),
    ).toThrow(/700/);
    expect(() =>
      assertRefundWithin({ allocatedMinor: 1_000n, refundedMinor: 0n, refundMinor: 0n }),
    ).toThrow(/больше нуля/);
  });
});

describe('parseMoney', () => {
  it('parses major-unit strings into minor units without floats', () => {
    expect(parseMoney('15400')).toBe(1_540_000n);
    expect(parseMoney('456.23')).toBe(45_623n);
    expect(parseMoney('0,5')).toBe(50n);
    expect(parseMoney('-100.10')).toBe(-10_010n);
    expect(() => parseMoney('1e3')).toThrow(FinanceRuleError);
    expect(() => parseMoney('12.345')).toThrow(FinanceRuleError);
  });
});

describe('penaltyAmount (Q-103: правило Exely «первые сутки»)', () => {
  it('NONE → 0; FIRST_NIGHT → цена первой ночи из календаря, без календаря — средняя ночь; FULL_STAY → вся цена', () => {
    const stay = { totalMinor: 2_700_000n, nights: 3, firstNightMinor: 1_000_000n };
    expect(penaltyAmount('NONE', stay)).toBe(0n);
    expect(penaltyAmount('FIRST_NIGHT', stay)).toBe(1_000_000n);
    expect(penaltyAmount('FIRST_NIGHT', { ...stay, firstNightMinor: null })).toBe(900_000n);
    expect(penaltyAmount('FULL_STAY', stay)).toBe(2_700_000n);
    expect(penaltyAmount('FIRST_NIGHT', { totalMinor: 0n, nights: 1, firstNightMinor: null })).toBe(
      0n,
    );
    expect(
      penaltyAmount('FIRST_NIGHT', { totalMinor: 500n, nights: 0, firstNightMinor: null }),
    ).toBe(0n);
  });
});
