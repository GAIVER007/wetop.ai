/**
 * Состояние колонки «Финансы» списка броней (ADR-101, ТЗ «Брони v2» §15–16).
 *
 * Считается только из того, что уже есть в счетах (folioBalance): начислено, оплачено, возвращено,
 * остаток. Никаких новых статусов в модели — это представление, а не правило (§54 ТЗ).
 * У отменённой брони с пустым счётом больше не бывает «оплачено»: пустой счёт — «—»,
 * оставшийся платёж — «к возврату», сделанный возврат — «возвращено».
 */
export type FinanceState =
  | { kind: 'none' }
  | { kind: 'unpaid' }
  | { kind: 'due'; minor: bigint }
  | { kind: 'paid' }
  | { kind: 'refund-due'; minor: bigint }
  | { kind: 'refunded' };

export function financeState(row: {
  hasFolios: boolean;
  paidMinor: string;
  balanceMinor: string;
  chargedMinor?: string | undefined;
  refundedMinor?: string | undefined;
}): FinanceState {
  if (!row.hasFolios) return { kind: 'none' };
  const paid = BigInt(row.paidMinor);
  const balance = BigInt(row.balanceMinor);
  const refunded = row.refundedMinor === undefined ? 0n : BigInt(row.refundedMinor);
  // Старый API начисленного не присылает — оно восстанавливается из баланса (balance = charged − paid + refunded)
  const charged =
    row.chargedMinor === undefined ? balance + paid - refunded : BigInt(row.chargedMinor);
  if (balance > 0n) return paid > 0n ? { kind: 'due', minor: balance } : { kind: 'unpaid' };
  if (balance < 0n) return { kind: 'refund-due', minor: -balance };
  if (charged === 0n && refunded > 0n) return { kind: 'refunded' };
  return paid > 0n ? { kind: 'paid' } : { kind: 'none' };
}
