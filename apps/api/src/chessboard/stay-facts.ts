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
