/**
 * Финансы счёта гостя (DATA_MODEL §6, ADR-014: счёт на проживание). Деньги — только integer minor units (ADR-008).
 * Ни HTTP, ни Prisma: чистая арифметика и правила.
 */
export class FinanceRuleError extends Error {
  override readonly name = 'FinanceRuleError';
}

export interface FolioBalance {
  chargedMinor: bigint;
  paidMinor: bigint;
  refundedMinor: bigint;
  /** начислено − оплачено + возвращено; > 0 — гость должен, < 0 — переплата */
  balanceMinor: bigint;
}

export function folioBalance(input: {
  charges: Array<{ amountMinor: bigint; voided: boolean }>;
  allocations: Array<{ amountMinor: bigint }>;
  refunds: Array<{ amountMinor: bigint }>;
}): FolioBalance {
  const chargedMinor = input.charges
    .filter((c) => !c.voided)
    .reduce((s, c) => s + c.amountMinor, 0n);
  const paidMinor = input.allocations.reduce((s, a) => s + a.amountMinor, 0n);
  const refundedMinor = input.refunds.reduce((s, r) => s + r.amountMinor, 0n);
  return {
    chargedMinor,
    paidMinor,
    refundedMinor,
    balanceMinor: chargedMinor - paidMinor + refundedMinor,
  };
}

/** Платёж распределяется по счетам полностью, каждая строка > 0, счёт в платеже один раз. */
export function assertAllocationsMatch(
  amountMinor: bigint,
  allocations: Array<{ folioId: string; amountMinor: bigint }>,
): void {
  if (amountMinor <= 0n) throw new FinanceRuleError('Сумма платежа должна быть больше нуля');
  if (allocations.length === 0)
    throw new FinanceRuleError('Платёж должен быть распределён хотя бы на один счёт');
  const seen = new Set<string>();
  let sum = 0n;
  for (const a of allocations) {
    if (a.amountMinor <= 0n)
      throw new FinanceRuleError('Распределение на счёт должно быть больше нуля');
    if (seen.has(a.folioId))
      throw new FinanceRuleError(`Счёт ${a.folioId} встречается в платеже дважды`);
    seen.add(a.folioId);
    sum += a.amountMinor;
  }
  if (sum !== amountMinor)
    throw new FinanceRuleError(
      `Распределено ${sum}, а сумма платежа ${amountMinor} — должно совпадать`,
    );
}

/** Вернуть можно не больше, чем этот платёж внёс на этот счёт, минус уже возвращённое. */
export function assertRefundWithin(input: {
  allocatedMinor: bigint;
  refundedMinor: bigint;
  refundMinor: bigint;
}): void {
  if (input.refundMinor <= 0n) throw new FinanceRuleError('Сумма возврата должна быть больше нуля');
  const available = input.allocatedMinor - input.refundedMinor;
  if (input.refundMinor > available)
    throw new FinanceRuleError(
      `Вернуть можно не больше ${available} (внесено ${input.allocatedMinor}, уже возвращено ${input.refundedMinor})`,
    );
}

/** "15400", "456.23", "0,5", "-100.10" → minor units; не число или больше 2 знаков — ошибка. */
export function parseMoney(value: string): bigint {
  const m = /^(-)?(\d+)(?:[.,](\d{1,2}))?$/.exec(String(value).trim());
  if (!m)
    throw new FinanceRuleError(
      `Сумма «${value}» — число с не более чем двумя знаками после запятой`,
    );
  const minor = BigInt(m[2]!) * 100n + BigInt((m[3] ?? '').padEnd(2, '0'));
  return m[1] ? -minor : minor;
}
