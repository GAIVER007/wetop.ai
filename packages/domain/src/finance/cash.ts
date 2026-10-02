/**
 * Касса (DATA_MODEL §21, план plans/finance-cashbox-2026-10-02.md): движения денег мимо счетов
 * гостей и остатки по способам оплаты. Гостевые оплаты в кассу не дублируются — остаток по способу
 * вычисляется из платежей, возвратов и операций кассы. Деньги — integer minor units (ADR-008).
 */
import { FinanceRuleError } from './finance';

export type CashOperationKind = 'INCOME' | 'EXPENSE' | 'TRANSFER';

/** Не живые деньги объекта (Q-237): площадка, депозит и гарантия картой в кассе не участвуют */
export const NON_CASH_METHODS = ['EXTERNAL', 'DEPOSIT', 'CARD_GUARANTEE'] as const;
/** Плитки остатков по умолчанию (Q-237) — видны и при нуле */
export const DEFAULT_CASH_METHODS = ['CASH', 'KASPI', 'HALYK', 'CARD_TERMINAL'] as const;
/** Все способы, по которым касса считает остаток, в порядке показа */
export const CASH_METHODS = [
  ...DEFAULT_CASH_METHODS,
  'BANK_TRANSFER_PERSON',
  'BANK_TRANSFER_LEGAL',
] as const;

const isCash = (method: string) => (CASH_METHODS as readonly string[]).includes(method);

/** Правила операции кассы: сумма > 0, способы — живые деньги, перевод — в другой способ и без статьи */
export function assertCashOperation(input: {
  kind: CashOperationKind;
  method: string;
  methodTo?: string | null;
  amountMinor: bigint;
  /** вид указанной статьи; статья не указана — undefined/null */
  categoryKind?: 'INCOME' | 'EXPENSE' | null;
}): void {
  if (input.amountMinor <= 0n)
    throw new FinanceRuleError('Сумма операции должна быть больше нуля');
  if (!isCash(input.method))
    throw new FinanceRuleError(`Способ ${input.method} в кассе не участвует`);
  if (input.kind === 'TRANSFER') {
    if (!input.methodTo) throw new FinanceRuleError('У перевода нужен способ «куда»');
    if (input.methodTo === input.method)
      throw new FinanceRuleError('Перевод в тот же способ не имеет смысла');
    if (!isCash(input.methodTo))
      throw new FinanceRuleError(`Способ ${input.methodTo} в кассе не участвует`);
    if (input.categoryKind != null)
      throw new FinanceRuleError('У перевода статья не указывается');
    return;
  }
  if (input.methodTo)
    throw new FinanceRuleError('Способ «куда» бывает только у перевода');
  if (input.categoryKind != null && input.categoryKind !== input.kind)
    throw new FinanceRuleError('Статья другого вида: у поступления — статья дохода, у расхода — расхода');
}

export interface CashBalances {
  balances: Array<{ method: string; balanceMinor: bigint }>;
  totalMinor: bigint;
}

/**
 * Остатки по способам: Σ оплат гостей (COMPLETED) − Σ возвратов + поступления − расходы ± переводы.
 * Способы по умолчанию видны всегда, остальные кассовые — при любом движении; не-кассовые не считаются.
 */
export function cashBalances(input: {
  payments: Array<{ method: string; amountMinor: bigint }>;
  refunds: Array<{ method: string; amountMinor: bigint }>;
  operations: Array<{
    kind: CashOperationKind;
    method: string;
    methodTo: string | null;
    amountMinor: bigint;
  }>;
}): CashBalances {
  const by = new Map<string, bigint>();
  const touched = new Set<string>();
  const add = (method: string, delta: bigint) => {
    if (!isCash(method)) return;
    by.set(method, (by.get(method) ?? 0n) + delta);
    touched.add(method);
  };
  for (const p of input.payments) add(p.method, p.amountMinor);
  for (const r of input.refunds) add(r.method, -r.amountMinor);
  for (const o of input.operations) {
    if (o.kind === 'INCOME') add(o.method, o.amountMinor);
    else if (o.kind === 'EXPENSE') add(o.method, -o.amountMinor);
    else {
      add(o.method, -o.amountMinor);
      if (o.methodTo) add(o.methodTo, o.amountMinor);
    }
  }
  const balances = CASH_METHODS.filter(
    (m) => (DEFAULT_CASH_METHODS as readonly string[]).includes(m) || touched.has(m),
  ).map((method) => ({ method, balanceMinor: by.get(method) ?? 0n }));
  return {
    balances,
    totalMinor: balances.reduce((s, b) => s + b.balanceMinor, 0n),
  };
}

/** Комиссия процентом: до двух знаков после запятой, 0 < % ≤ 100; результат — целые тиыны, вниз */
export function commissionFromPercent(amountMinor: bigint, percent: string): bigint {
  const m = /^(\d{1,3})(?:[.,](\d{1,2}))?$/.exec(String(percent).trim());
  if (!m)
    throw new FinanceRuleError(
      `Процент «${percent}» — число с не более чем двумя знаками после запятой`,
    );
  const hundredths = BigInt(m[1]!) * 100n + BigInt((m[2] ?? '').padEnd(2, '0'));
  if (hundredths <= 0n || hundredths > 10_000n)
    throw new FinanceRuleError('Процент комиссии — больше нуля и не больше 100');
  return (amountMinor * hundredths) / 10_000n;
}

/** Сверка (§21.4): пересчитанная сумма не бывает отрицательной, способ — живые деньги кассы */
export function assertCashReconciliation(input: { method: string; countedMinor: bigint }): void {
  if (input.countedMinor < 0n)
    throw new FinanceRuleError('Пересчитанная сумма не бывает отрицательной');
  if (!isCash(input.method))
    throw new FinanceRuleError(`Способ ${input.method} в кассе не участвует`);
}

/** Поправка по сверке: излишек — поступление, недостача — расход; совпало — поправки нет */
export function reconciliationAdjustment(
  expectedMinor: bigint,
  countedMinor: bigint,
): { kind: 'INCOME' | 'EXPENSE'; amountMinor: bigint } | null {
  const delta = countedMinor - expectedMinor;
  if (delta === 0n) return null;
  return delta > 0n
    ? { kind: 'INCOME', amountMinor: delta }
    : { kind: 'EXPENSE', amountMinor: -delta };
}
