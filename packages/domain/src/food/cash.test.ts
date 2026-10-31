import { describe, expect, it } from 'vitest';
import {
  FOOD_PAYMENT_METHODS,
  orderRefund,
  foodCashBalances,
  orderPayment,
  payoutCheck,
  parseFoodPayment,
  parseFoodCashOperation,
  parseFoodReconciliation,
  parseFoodPayout,
} from './cash';

/** Касса ресторана (DATA_MODEL §35, ADR-165): деньги только bigint minor units (ADR-008) */
describe('оплата заказа частями (§35.1)', () => {
  it('принимает часть и закрывает SERVED при полной оплате', () => {
    expect(orderPayment('SERVED', 10000n, 0n, 4000n)).toEqual({ paidAfter: 4000n, close: false });
    expect(orderPayment('SERVED', 10000n, 4000n, 6000n)).toEqual({ paidAfter: 10000n, close: true });
  });
  it('полная оплата до подачи заказ не закрывает', () => {
    expect(orderPayment('COOKING', 10000n, 0n, 10000n)).toEqual({ paidAfter: 10000n, close: false });
  });
  it('переплата и ноль отклоняются', () => {
    expect(() => orderPayment('SERVED', 10000n, 4000n, 6001n)).toThrow(/больше остатка/);
    expect(() => orderPayment('SERVED', 10000n, 0n, 0n)).toThrow();
  });
  it('закрытый и отменённый заказ не оплачиваются', () => {
    expect(() => orderPayment('CLOSED', 10000n, 10000n, 1n)).toThrow(/закрыт/i);
    expect(() => orderPayment('CANCELLED', 10000n, 0n, 1n)).toThrow(/отмен/i);
  });
});

describe('остатки кассы по способам (§35.2)', () => {
  it('платежи + приход − расход ± перевод, аннулированное не считается', () => {
    const b = foodCashBalances(
      [
        { method: 'CASH', amount: 10000n, status: 'COMPLETED' },
        { method: 'KASPI', amount: 5000n, status: 'COMPLETED' },
        { method: 'CASH', amount: 999n, status: 'VOIDED' },
      ],
      [
        { kind: 'INCOME', method: 'CASH', methodTo: null, amount: 2000n, status: 'COMPLETED' },
        { kind: 'EXPENSE', method: 'CASH', methodTo: null, amount: 3000n, status: 'COMPLETED' },
        { kind: 'TRANSFER', method: 'KASPI', methodTo: 'CASH', amount: 1000n, status: 'COMPLETED' },
        { kind: 'EXPENSE', method: 'KASPI', methodTo: null, amount: 777n, status: 'VOIDED' },
      ],
    );
    expect(b.CASH).toBe(10000n);
    expect(b.KASPI).toBe(4000n);
    expect(b.CARD_TERMINAL).toBe(0n);
  });
  it('бонусы и сертификат не деньги в кассе: в остатках их нет (решение 21.10.2026)', () => {
    const b = foodCashBalances([], [
      { kind: 'INCOME', method: 'BONUS', methodTo: null, amount: 500n, status: 'COMPLETED' },
      { kind: 'INCOME', method: 'GIFT_CERTIFICATE', methodTo: null, amount: 700n, status: 'COMPLETED' },
      { kind: 'INCOME', method: 'CASH', methodTo: null, amount: 100n, status: 'COMPLETED' },
    ]);
    expect(Object.keys(b).sort()).toEqual([...FOOD_PAYMENT_METHODS].sort());
    expect(b.CASH).toBe(100n);
  });
});

describe('выплата зарплаты (§35.3)', () => {
  it('не больше остатка к выплате', () => {
    expect(() => payoutCheck(50000n, 20000n, 30000n)).not.toThrow();
    expect(() => payoutCheck(50000n, 20000n, 30001n)).toThrow(/больше/);
    expect(() => payoutCheck(0n, 0n, 1n)).toThrow();
  });
});

describe('разбор запросов кассы', () => {
  const key = 'pay-1';
  it('платёж: способ ресторана, сумма, ключ повтора', () => {
    expect(parseFoodPayment({ method: 'CASH', amount: 5000, idempotencyKey: key })).toEqual({
      method: 'CASH',
      amount: 5000n,
      idempotencyKey: key,
      itemIds: null,
    });
    expect(() => parseFoodPayment({ method: 'DEPOSIT', amount: 5000, idempotencyKey: key })).toThrow();
    expect(() => parseFoodPayment({ method: 'CASH', amount: 50.5, idempotencyKey: key })).toThrow();
    expect(() => parseFoodPayment({ method: 'CASH', amount: 5000 })).toThrow();
    expect(FOOD_PAYMENT_METHODS).not.toContain('CARD_GUARANTEE');
  });
  it('операция: перевод требует другой способ «куда», остальные без него', () => {
    expect(
      parseFoodCashOperation({ kind: 'TRANSFER', method: 'CASH', methodTo: 'KASPI', amount: 100 }),
    ).toMatchObject({ kind: 'TRANSFER', methodTo: 'KASPI', amount: 100n });
    expect(() =>
      parseFoodCashOperation({ kind: 'TRANSFER', method: 'CASH', methodTo: 'CASH', amount: 100 }),
    ).toThrow();
    expect(() =>
      parseFoodCashOperation({ kind: 'INCOME', method: 'CASH', methodTo: 'KASPI', amount: 100 }),
    ).toThrow();
    expect(() => parseFoodCashOperation({ kind: 'EXPENSE', method: 'CASH', amount: 0 })).toThrow();
  });
  it('сверка: пересчитано не меньше нуля', () => {
    expect(parseFoodReconciliation({ method: 'CASH', counted: 0 })).toMatchObject({ counted: 0n });
    expect(() => parseFoodReconciliation({ method: 'CASH', counted: -1 })).toThrow();
  });
  it('выплата: месяц ГГГГ-ММ хранится первым числом', () => {
    expect(parseFoodPayout({ period: '2026-10', method: 'CASH', amount: 30000 })).toEqual({
      period: '2026-10-01',
      payDate: null,
      method: 'CASH',
      amount: 30000n,
    });
    expect(() => parseFoodPayout({ period: '2026-13', method: 'CASH', amount: 1 })).toThrow();
  });
});

describe('возврат по закрытому заказу (§56)', () => {
  it('только у закрытого, больше нуля и не больше чистой оплаты', () => {
    expect(() => orderRefund('SERVED', 100n, 1n)).toThrow('Возврат оформляют по закрытому заказу');
    expect(() => orderRefund('CLOSED', 100n, 0n)).toThrow('Сумма больше нуля');
    expect(() => orderRefund('CLOSED', 100n, 101n)).toThrow('Сумма больше оплаченного по заказу');
    expect(() => orderRefund('CLOSED', 100n, 100n)).not.toThrow();
  });
});
