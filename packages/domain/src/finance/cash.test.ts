import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CASH_METHODS,
  assertCashReconciliation,
  reconciliationAdjustment,
  NON_CASH_METHODS,
  assertCashOperation,
  cashBalances,
  commissionFromPercent,
} from './cash';

describe('assertCashOperation (DATA_MODEL §21)', () => {
  it('поступление и расход: сумма больше нуля, статья того же вида', () => {
    expect(() =>
      assertCashOperation({ kind: 'INCOME', method: 'CASH', amountMinor: 1n }),
    ).not.toThrow();
    expect(() =>
      assertCashOperation({
        kind: 'EXPENSE',
        method: 'KASPI',
        amountMinor: 500n,
        categoryKind: 'EXPENSE',
      }),
    ).not.toThrow();
    expect(() =>
      assertCashOperation({ kind: 'INCOME', method: 'CASH', amountMinor: 0n }),
    ).toThrow(/больше нуля/);
    expect(() =>
      assertCashOperation({ kind: 'INCOME', method: 'CASH', amountMinor: -100n }),
    ).toThrow(/больше нуля/);
    expect(() =>
      assertCashOperation({
        kind: 'INCOME',
        method: 'CASH',
        amountMinor: 100n,
        categoryKind: 'EXPENSE',
      }),
    ).toThrow(/статья/i);
  });

  it('EXTERNAL, DEPOSIT и CARD_GUARANTEE — не живые деньги кассы (Q-237)', () => {
    for (const method of NON_CASH_METHODS)
      expect(() => assertCashOperation({ kind: 'EXPENSE', method, amountMinor: 100n })).toThrow(
        /касс/i,
      );
    expect(() =>
      assertCashOperation({
        kind: 'TRANSFER',
        method: 'CASH',
        methodTo: 'DEPOSIT',
        amountMinor: 100n,
      }),
    ).toThrow(/касс/i);
  });

  it('перевод: нужен другой способ-получатель, статьи у перевода нет', () => {
    expect(() =>
      assertCashOperation({
        kind: 'TRANSFER',
        method: 'KASPI',
        methodTo: 'CASH',
        amountMinor: 100n,
      }),
    ).not.toThrow();
    expect(() =>
      assertCashOperation({ kind: 'TRANSFER', method: 'KASPI', amountMinor: 100n }),
    ).toThrow(/куда/i);
    expect(() =>
      assertCashOperation({
        kind: 'TRANSFER',
        method: 'KASPI',
        methodTo: 'KASPI',
        amountMinor: 100n,
      }),
    ).toThrow(/тот же/i);
    expect(() =>
      assertCashOperation({
        kind: 'TRANSFER',
        method: 'KASPI',
        methodTo: 'CASH',
        amountMinor: 100n,
        categoryKind: 'EXPENSE',
      }),
    ).toThrow(/статья/i);
    // у поступления и расхода получателя не бывает
    expect(() =>
      assertCashOperation({
        kind: 'INCOME',
        method: 'CASH',
        methodTo: 'KASPI',
        amountMinor: 100n,
      }),
    ).toThrow(/перевод/i);
  });
});

describe('cashBalances', () => {
  it('остаток по способу: оплаты гостей − возвраты + поступления − расходы ± переводы', () => {
    const r = cashBalances({
      payments: [
        { method: 'CASH', amountMinor: 10_000n },
        { method: 'KASPI', amountMinor: 5_000n },
      ],
      refunds: [{ method: 'CASH', amountMinor: 1_000n }],
      operations: [
        { kind: 'INCOME', method: 'CASH', methodTo: null, amountMinor: 2_000n },
        { kind: 'EXPENSE', method: 'CASH', methodTo: null, amountMinor: 500n },
        { kind: 'TRANSFER', method: 'KASPI', methodTo: 'CASH', amountMinor: 3_000n },
      ],
    });
    const by = Object.fromEntries(r.balances.map((b) => [b.method, b.balanceMinor]));
    expect(by['CASH']).toBe(10_000n - 1_000n + 2_000n - 500n + 3_000n);
    expect(by['KASPI']).toBe(5_000n - 3_000n);
    expect(r.totalMinor).toBe(by['CASH']! + by['KASPI']!);
  });

  it('плитки по умолчанию видны и при нуле; EXTERNAL в кассу не попадает', () => {
    const r = cashBalances({
      payments: [{ method: 'EXTERNAL', amountMinor: 9_999n }],
      refunds: [],
      operations: [],
    });
    const methods = r.balances.map((b) => b.method);
    for (const m of DEFAULT_CASH_METHODS) expect(methods).toContain(m);
    expect(methods).not.toContain('EXTERNAL');
    expect(r.totalMinor).toBe(0n);
  });

  it('способ вне умолчаний появляется, когда по нему было движение', () => {
    const r = cashBalances({
      payments: [{ method: 'BANK_TRANSFER_PERSON', amountMinor: 700n }],
      refunds: [],
      operations: [],
    });
    expect(r.balances.map((b) => b.method)).toContain('BANK_TRANSFER_PERSON');
  });
});

describe('commissionFromPercent', () => {
  it('целыми тиынами, вниз: 2,5 % от 10 000 тиын — 250', () => {
    expect(commissionFromPercent(10_000n, '2.5')).toBe(250n);
    expect(commissionFromPercent(10_000n, '0,95')).toBe(95n);
    expect(commissionFromPercent(999n, '1')).toBe(9n);
  });
  it('не число, ноль или больше 100 — ошибка', () => {
    expect(() => commissionFromPercent(10_000n, 'abc')).toThrow();
    expect(() => commissionFromPercent(10_000n, '0')).toThrow();
    expect(() => commissionFromPercent(10_000n, '101')).toThrow();
    expect(() => commissionFromPercent(10_000n, '1.234')).toThrow();
  });
});

describe('сверка наличных (§21.4)', () => {
  it('counted ≥ 0, способ — кассовый', () => {
    expect(() =>
      assertCashReconciliation({ method: 'CASH', countedMinor: 0n }),
    ).not.toThrow();
    expect(() =>
      assertCashReconciliation({ method: 'CASH', countedMinor: -1n }),
    ).toThrow(/не бывает отрицательной/);
    expect(() =>
      assertCashReconciliation({ method: 'EXTERNAL', countedMinor: 100n }),
    ).toThrow(/касс/i);
  });

  it('поправка: излишек — поступление, недостача — расход, совпало — нет поправки', () => {
    expect(reconciliationAdjustment(10_000n, 12_000n)).toEqual({
      kind: 'INCOME',
      amountMinor: 2_000n,
    });
    expect(reconciliationAdjustment(10_000n, 9_500n)).toEqual({
      kind: 'EXPENSE',
      amountMinor: 500n,
    });
    expect(reconciliationAdjustment(10_000n, 10_000n)).toBeNull();
  });
});
