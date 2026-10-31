import { folioBalance } from '@pms/domain';

/** Что полоса и страница ревизии знают о проживании кроме имени и статуса: источник, канал, остаток к оплате (тиыны строкой) */
export interface StayFacts {
  source?: string;
  channel?: string | null;
  balanceMinor?: string;
}

/** Строки счёта, как их отдаёт Prisma; сумма — integer minor units (ADR-008). */
export interface FolioRows {
  charges: Array<{ amount: bigint; voidedAt: Date | null }>;
  allocations: Array<{ amount: bigint }>;
  refunds: Array<{ amount: bigint }>;
}

/**
 * Что полоса брони показывает кроме имени и статуса (DESIGN.md §8, §9): источник, канал, остаток к оплате.
 * Только чтение: остаток считает `folioBalance` — та же функция, что у `/finance/*`.
 */
export function stayFacts(item: {
  reservation: { source: string; channel: string | null };
  folio: FolioRows | null;
}): StayFacts {
  const facts: StayFacts = { source: item.reservation.source, channel: item.reservation.channel };
  if (item.folio) {
    facts.balanceMinor = folioBalance({
      charges: item.folio.charges.map((c) => ({
        amountMinor: c.amount,
        voided: c.voidedAt !== null,
      })),
      allocations: item.folio.allocations.map((a) => ({ amountMinor: a.amount })),
      refunds: item.folio.refunds.map((r) => ({ amountMinor: r.amount })),
    }).balanceMinor.toString();
  }
  return facts;
}

/** Деньги проживания для «Быстрого отчёта» гостиницы (владелец 31.10.2026: как у салона), тиыны строкой */
export interface StayMoney {
  /** начислено по счёту без отменённых начислений: «Сумма броней» */
  totalMinor: string;
  paidCashMinor: string;
  /** карта, переводы, Kaspi, Halyk и прочее кроме наличных */
  paidNonCashMinor: string;
  refundedMinor: string;
  balanceMinor: string;
}

export function stayMoney(
  folio: {
    charges: Array<{ amount: bigint; voidedAt: Date | null }>;
    allocations: Array<{ amount: bigint; payment: { method: string } }>;
    refunds: Array<{ amount: bigint }>;
  } | null,
): StayMoney | null {
  if (!folio) return null;
  const total = folio.charges.filter((c) => c.voidedAt === null).reduce((s, c) => s + c.amount, 0n);
  let cash = 0n;
  let nonCash = 0n;
  for (const a of folio.allocations) {
    if (a.payment.method === 'CASH') cash += a.amount;
    else nonCash += a.amount;
  }
  const refunded = folio.refunds.reduce((s, r) => s + r.amount, 0n);
  const balance = folioBalance({
    charges: folio.charges.map((c) => ({ amountMinor: c.amount, voided: c.voidedAt !== null })),
    allocations: folio.allocations.map((a) => ({ amountMinor: a.amount })),
    refunds: folio.refunds.map((r) => ({ amountMinor: r.amount })),
  }).balanceMinor;
  return {
    totalMinor: total.toString(),
    paidCashMinor: cash.toString(),
    paidNonCashMinor: nonCash.toString(),
    refundedMinor: refunded.toString(),
    balanceMinor: balance.toString(),
  };
}

