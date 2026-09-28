/**
 * Счёт на проживание (DATA_MODEL §6, ADR-014). Общие операции API: создать счёт вместе
 * с проживанием и держать ровно одно активное начисление «проживание» равным цене.
 */
import type { Prisma } from './generated/prisma/client';

type Tx = Prisma.TransactionClient;

export interface EnsureFolioInput {
  reservationItemId: string;
  currency: string;
  /** integer minor units */
  amountMinor: bigint;
  description: string;
  /** Дата услуги (YYYY-MM-DD) — дата заезда: по ней проживание попадает в отчёт за период */
  serviceDate: string;
  /** false — проживание отменено / незаезд: начисление сторнируется, новое не создаётся (штраф — вручную, Q-103) */
  active?: boolean | undefined;
}

export interface EnsureChargeInput {
  folioId: string;
  kind: 'ACCOMMODATION' | 'SERVICE' | 'PENALTY' | 'ADJUSTMENT';
  /** Активное начисление ищется по kind и, если задано, по описанию (у удержания ADR-051 — своё описание) */
  matchDescription?: string | undefined;
  description: string;
  /** integer minor units */
  amountMinor: bigint;
  /** Дата услуги (YYYY-MM-DD) */
  serviceDate: string;
  /** false — начисления быть не должно: активное сторнируется, новое не создаётся */
  wanted: boolean;
}

/**
 * Ровно одно активное начисление данного вида, равное сумме, пока оно нужно; иначе — ни одного.
 * Сторно — voided_at, строки не удаляются. Общий механизм для «проживание = цене» (импорт и API)
 * и для удержания ADR-051.
 */
export async function ensureSingleActiveCharge(
  tx: Tx,
  input: EnsureChargeInput,
): Promise<'created' | 'voided' | 'unchanged'> {
  const current = await tx.charge.findFirst({
    where: {
      folioId: input.folioId,
      kind: input.kind,
      voidedAt: null,
      ...(input.matchDescription ? { description: input.matchDescription } : {}),
    },
    select: { id: true, amount: true },
  });
  if (!input.wanted) {
    if (!current) return 'unchanged';
    await tx.charge.update({ where: { id: current.id }, data: { voidedAt: new Date() } });
    return 'voided';
  }
  if (current && current.amount === input.amountMinor) return 'unchanged';
  if (current)
    await tx.charge.update({ where: { id: current.id }, data: { voidedAt: new Date() } });
  await tx.charge.create({
    data: {
      folioId: input.folioId,
      kind: input.kind,
      description: input.description,
      quantity: 1,
      unitPrice: input.amountMinor,
      amount: input.amountMinor,
      serviceDate: new Date(`${input.serviceDate}T00:00:00Z`),
    },
  });
  return 'created';
}

/** Создаёт счёт, если его нет; синхронизирует начисление за проживание с ценой (сторно + новое при изменении). */
export async function ensureFolioWithAccommodation(
  tx: Tx,
  input: EnsureFolioInput,
): Promise<{ folioId: string; chargeChanged: boolean }> {
  const folio =
    (await tx.folio.findUnique({
      where: { reservationItemId: input.reservationItemId },
      select: { id: true },
    })) ??
    (await tx.folio.create({
      data: { reservationItemId: input.reservationItemId, currency: input.currency },
      select: { id: true },
    }));
  const result = await ensureSingleActiveCharge(tx, {
    folioId: folio.id,
    kind: 'ACCOMMODATION',
    description: input.description,
    amountMinor: input.amountMinor,
    serviceDate: input.serviceDate,
    wanted: input.active !== false,
  });
  return { folioId: folio.id, chargeChanged: result !== 'unchanged' };
}

/**
 * Платёж EXTERNAL: деньги, полученные вне кассы PMS, например предоплата, собранная каналом.
 * Ключ идемпотентности — `externalReference` в пределах объекта: повтор не создаёт дубль, а поправит сумму.
 */
export async function recordExternalPayment(
  tx: Tx,
  input: {
    propertyId: string;
    folioId: string;
    externalReference: string;
    amountMinor: bigint;
    currency: string;
    note: string;
  },
): Promise<'created' | 'updated' | 'skipped'> {
  if (input.amountMinor <= 0n) return 'skipped';
  const { propertyId, folioId, externalReference, amountMinor } = input;
  const existing = await tx.payment.findUnique({
    where: { propertyId_externalReference: { propertyId, externalReference } },
    select: { id: true, amount: true },
  });
  if (existing) {
    if (existing.amount === amountMinor) return 'skipped';
    await tx.payment.update({ where: { id: existing.id }, data: { amount: amountMinor } });
    await tx.paymentAllocation.upsert({
      where: { paymentId_folioId: { paymentId: existing.id, folioId } },
      create: { paymentId: existing.id, folioId, amount: amountMinor },
      update: { amount: amountMinor },
    });
    return 'updated';
  }
  await tx.payment.create({
    data: {
      propertyId,
      method: 'EXTERNAL',
      amount: amountMinor,
      currency: input.currency,
      externalReference,
      note: input.note,
      allocations: { create: { folioId, amount: amountMinor } },
    },
  });
  return 'created';
}
