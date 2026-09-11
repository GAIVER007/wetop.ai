import { describe, expect, it } from 'vitest';
import {
  FinanceRuleError,
  assertAllocationsMatch,
  assertRefundWithin,
  folioBalance,
  penaltyAmount,
  penaltyDue,
  parseMoney,
  stayExtraDefaultMinor,
  channelPrepaymentToKeep,
  stayExtraPercent,
  adjacentNight,
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

describe('penaltyDue (Q-103: ответ управляющего 10.09.2026 — штраф только в день заезда)', () => {
  const stay = { arrivalDate: '2026-10-10' };
  it('отмена заранее — без штрафа, отмена в день заезда и позже — со штрафом', () => {
    expect(penaltyDue({ ...stay, on: '2026-10-01', reason: 'cancel' })).toBe(false);
    expect(penaltyDue({ ...stay, on: '2026-10-09', reason: 'cancel' })).toBe(false); // за день — бесплатно
    expect(penaltyDue({ ...stay, on: '2026-10-10', reason: 'cancel' })).toBe(true); // день заезда
    expect(penaltyDue({ ...stay, on: '2026-10-11', reason: 'cancel' })).toBe(true);
  });
  it('незаезд считается всегда: гость не приехал и место простояло', () => {
    expect(penaltyDue({ ...stay, on: '2026-10-10', reason: 'no_show' })).toBe(true);
    expect(penaltyDue({ ...stay, on: '2026-10-01', reason: 'no_show' })).toBe(true);
  });
});

describe('ранний заезд и поздний выезд — половина ночи по умолчанию (ADR-021)', () => {
  it('половина цены одной ночи, округление вниз до целого тенге', () => {
    // 12 000 ₸ за 2 ночи → ночь 6 000 → половина 3 000 ₸ = 300 000 тиын
    expect(stayExtraDefaultMinor(1_200_000n, 2)).toBe(300_000n);
    // 12 345 ₸ за 3 ночи → ночь 4115 → половина 2057,5 → 2057 ₸ ровно, без тиынов
    expect(stayExtraDefaultMinor(1_234_500n, 3)).toBe(205_700n);
  });
  it('нет ночей или цены — нуль, а не деление на ноль', () => {
    expect(stayExtraDefaultMinor(1_200_000n, 0)).toBe(0n);
    expect(stayExtraDefaultMinor(0n, 2)).toBe(0n);
  });
});

describe('предоплата канала после отмены (ADR-022, Q-108)', () => {
  it('без штрафа предоплата снимается целиком: деньги гостю возвращает площадка', () => {
    expect(channelPrepaymentToKeep({ prepaidMinor: 900_000n, penaltyMinor: 0n })).toBe(0n);
  });
  it('со штрафом остаётся ровно штраф, остальное площадка возвращает', () => {
    expect(channelPrepaymentToKeep({ prepaidMinor: 900_000n, penaltyMinor: 450_000n })).toBe(
      450_000n,
    );
  });
  it('штраф больше предоплаты — остаётся вся предоплата, долг остаётся на счёте', () => {
    expect(channelPrepaymentToKeep({ prepaidMinor: 300_000n, penaltyMinor: 450_000n })).toBe(
      300_000n,
    );
  });
});

describe('доля ночи за ранний заезд и поздний выезд по времени — правило объекта из Exely (ADR-021)', () => {
  it('ранний заезд: до 06:00 — вся ночь, 06:00–11:59 — половина, с 12:00 до расчётного часа 14:00 — бесплатно', () => {
    expect(stayExtraPercent('EARLY_CHECK_IN', '03:30')).toBe(100);
    expect(stayExtraPercent('EARLY_CHECK_IN', '05:59')).toBe(100);
    expect(stayExtraPercent('EARLY_CHECK_IN', '06:00')).toBe(50);
    expect(stayExtraPercent('EARLY_CHECK_IN', '11:59')).toBe(50);
    expect(stayExtraPercent('EARLY_CHECK_IN', '12:00')).toBe(0);
    expect(stayExtraPercent('EARLY_CHECK_IN', '13:59')).toBe(0);
  });
  it('поздний выезд: 12:01–17:59 — половина, с 18:00 — вся ночь, до расчётного часа 12:00 — бесплатно', () => {
    expect(stayExtraPercent('LATE_CHECK_OUT', '12:00')).toBe(0);
    expect(stayExtraPercent('LATE_CHECK_OUT', '12:01')).toBe(50);
    expect(stayExtraPercent('LATE_CHECK_OUT', '17:59')).toBe(50);
    expect(stayExtraPercent('LATE_CHECK_OUT', '18:00')).toBe(100);
    expect(stayExtraPercent('LATE_CHECK_OUT', '23:59')).toBe(100);
  });
  it('кривое время — ошибка, а не тихий ноль', () => {
    expect(() => stayExtraPercent('LATE_CHECK_OUT', '25:00')).toThrow(/время/);
    expect(() => stayExtraPercent('EARLY_CHECK_IN', '7am')).toThrow(/время/);
  });
});

describe('соседняя ночь для раннего заезда и позднего выезда (ADR-021, «выделять доступность» как в Exely)', () => {
  it('ранний заезд занимает ночь перед заездом, поздний выезд — ночь после выезда', () => {
    expect(adjacentNight('EARLY_CHECK_IN', '2026-10-05', '2026-10-07')).toEqual({
      from: '2026-10-04',
      toExclusive: '2026-10-05',
    });
    expect(adjacentNight('LATE_CHECK_OUT', '2026-10-05', '2026-10-07')).toEqual({
      from: '2026-10-07',
      toExclusive: '2026-10-08',
    });
  });
  it('граница месяца и года считается по календарю', () => {
    expect(adjacentNight('EARLY_CHECK_IN', '2027-01-01', '2027-01-03').from).toBe('2026-12-31');
  });
});
