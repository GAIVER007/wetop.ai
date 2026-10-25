import { foodId, foodObject, foodText } from './food';
import type { OrderStatus } from './restaurant';

/** Касса ресторанного филиала (DATA_MODEL §35, ADR-165). Деньги — bigint minor units (ADR-008). */
export const FOOD_PAYMENT_METHODS = [
  'CASH',
  'CARD_TERMINAL',
  'KASPI',
  'HALYK',
  'BANK_TRANSFER_PERSON',
  'BANK_TRANSFER_LEGAL',
  // «Другое» (PAYMENT-OTHER-20261025): ссылка на оплату, кошелёк; по умолчанию выключено в настройках филиала
  'OTHER',
] as const;
export type FoodPaymentMethod = (typeof FOOD_PAYMENT_METHODS)[number];
export const FOOD_CASH_KINDS = ['INCOME', 'EXPENSE', 'TRANSFER'] as const;
export type FoodCashKind = (typeof FOOD_CASH_KINDS)[number];
type Status = 'COMPLETED' | 'VOIDED';

/** Платёж по заказу: не больше остатка; SERVED при полной оплате закрывается (§35.1) */
export function orderPayment(
  status: OrderStatus,
  total: bigint,
  paid: bigint,
  amount: bigint,
): { paidAfter: bigint; close: boolean } {
  if (status === 'CLOSED') throw new Error('Заказ уже закрыт');
  if (status === 'CANCELLED') throw new Error('Заказ отменён');
  if (amount <= 0n) throw new Error('Сумма больше нуля');
  if (paid + amount > total) throw new Error('Сумма больше остатка к оплате');
  const paidAfter = paid + amount;
  return { paidAfter, close: status === 'SERVED' && paidAfter === total };
}

/** Возврат по закрытому заказу (§56): только после закрытия, не больше чистой оплаты */
export function orderRefund(status: OrderStatus, paidNet: bigint, amount: bigint): void {
  if (status !== 'CLOSED') throw new Error('Возврат оформляют по закрытому заказу: до этого аннулируйте платёж');
  if (amount <= 0n) throw new Error('Сумма больше нуля');
  if (amount > paidNet) throw new Error('Сумма больше оплаченного по заказу');
}

/** Остаток кассы по способам: платежи + приход − расход ± перевод; аннулированное не считается */
export function foodCashBalances(
  payments: Array<{ method: string; amount: bigint; status: Status }>,
  operations: Array<{
    kind: FoodCashKind;
    method: string;
    methodTo: string | null;
    amount: bigint;
    status: Status;
  }>,
): Record<FoodPaymentMethod, bigint> {
  const out = Object.fromEntries(FOOD_PAYMENT_METHODS.map((m) => [m, 0n])) as Record<string, bigint>;
  // только живые деньги: бонусы и сертификат (оплата записи салона) в кассе не лежат
  const add = (m: string, v: bigint) => {
    if (m in out) out[m] = (out[m] ?? 0n) + v;
  };
  for (const p of payments) if (p.status === 'COMPLETED') add(p.method, p.amount);
  for (const o of operations) {
    if (o.status !== 'COMPLETED') continue;
    if (o.kind === 'INCOME') add(o.method, o.amount);
    else add(o.method, -o.amount);
    if (o.kind === 'TRANSFER' && o.methodTo) add(o.methodTo, o.amount);
  }
  return out as Record<FoodPaymentMethod, bigint>;
}

/** Выплата зарплаты не больше «осталось» = к выплате − уже выплачено (§35.3) */
export function payoutCheck(due: bigint, paid: bigint, amount: bigint): void {
  if (amount <= 0n) throw new Error('Сумма больше нуля');
  if (amount > due - paid) throw new Error('Сумма больше остатка к выплате');
}

function amountOf(v: unknown, min: 0 | 1): bigint {
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < min)
    throw new Error('Сумма — целое число minor units');
  return BigInt(v);
}
function methodOf(v: unknown): FoodPaymentMethod {
  if (!FOOD_PAYMENT_METHODS.includes(v as FoodPaymentMethod)) throw new Error('Неизвестный способ оплаты');
  return v as FoodPaymentMethod;
}
const noteOf = (v: unknown) => (v == null ? null : foodText(v, 500));

export function parseFoodPayment(raw: unknown) {
  const b = foodObject(raw, ['method', 'amount', 'idempotencyKey', 'itemIds']);
  // §33.7: оплата по позициям; без списка обычная частичная оплата суммой
  let itemIds: string[] | null = null;
  if (b.itemIds !== undefined && b.itemIds !== null) {
    if (!Array.isArray(b.itemIds) || b.itemIds.length > 100) throw new Error('Позиции списком до 100');
    if (!b.itemIds.length) throw new Error('Отметьте хотя бы одну позицию');
    itemIds = b.itemIds.map(foodId);
  }
  return {
    method: methodOf(b.method),
    amount: amountOf(b.amount, 1),
    idempotencyKey: foodText(b.idempotencyKey, 100),
    itemIds,
  };
}

export function parseFoodCashOperation(raw: unknown) {
  const b = foodObject(raw, ['kind', 'method', 'methodTo', 'amount', 'note']);
  if (!FOOD_CASH_KINDS.includes(b.kind as FoodCashKind)) throw new Error('Неизвестный вид операции');
  const kind = b.kind as FoodCashKind;
  const method = methodOf(b.method);
  let methodTo: FoodPaymentMethod | null = null;
  if (kind === 'TRANSFER') {
    methodTo = methodOf(b.methodTo);
    if (methodTo === method) throw new Error('Перевод в тот же способ');
  } else if (b.methodTo != null) throw new Error('Способ «куда» только у перевода');
  return { kind, method, methodTo, amount: amountOf(b.amount, 1), note: noteOf(b.note) };
}

export function parseFoodReconciliation(raw: unknown) {
  const b = foodObject(raw, ['method', 'counted', 'note']);
  return { method: methodOf(b.method), counted: amountOf(b.counted, 0), note: noteOf(b.note) };
}

/** Период приходит как `ГГГГ-ММ`, храним первым днём месяца */
export function parseFoodPayout(raw: unknown) {
  const b = foodObject(raw, ['period', 'method', 'amount']);
  const period = foodText(b.period, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error('Период в формате ГГГГ-ММ');
  return { period: `${period}-01`, method: methodOf(b.method), amount: amountOf(b.amount, 1) };
}
