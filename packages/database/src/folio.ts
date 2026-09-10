/**
 * Счёт на проживание (DATA_MODEL §6, ADR-014). Общие операции для импорта и API: создать счёт вместе
 * с проживанием, держать ровно одно активное начисление «проживание» равным цене, перенести оплату из Exely.
 */
import type { Prisma } from './generated/prisma/client';

type Tx = Prisma.TransactionClient;

export interface EnsureFolioInput {
  reservationItemId: string;
  currency: string;
  /** integer minor units */
  amountMinor: bigint;
  description: string;
  /** false — проживание отменено / незаезд: начисление сторнируется, новое не создаётся (штраф — вручную, Q-103) */
  active?: boolean | undefined;
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
  const current = await tx.charge.findFirst({
    where: { folioId: folio.id, kind: 'ACCOMMODATION', voidedAt: null },
    select: { id: true, amount: true },
  });
  const wanted = input.active !== false;
  if (!wanted) {
    if (!current) return { folioId: folio.id, chargeChanged: false };
    await tx.charge.update({ where: { id: current.id }, data: { voidedAt: new Date() } });
    return { folioId: folio.id, chargeChanged: true };
  }
  if (current && current.amount === input.amountMinor)
    return { folioId: folio.id, chargeChanged: false };
  if (current)
    await tx.charge.update({ where: { id: current.id }, data: { voidedAt: new Date() } });
  await tx.charge.create({
    data: {
      folioId: folio.id,
      kind: 'ACCOMMODATION',
      description: input.description,
      quantity: 1,
      unitPrice: input.amountMinor,
      amount: input.amountMinor,
    },
  });
  return { folioId: folio.id, chargeChanged: true };
}

/**
 * Платёж EXTERNAL: деньги, полученные вне кассы PMS — перенос из Exely или предоплата, собранная каналом.
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

/** Оплаченная в Exely часть проживания → платёж EXTERNAL со ссылкой exely:<roomStayId>. */
export async function recordImportedPayment(
  tx: Tx,
  input: {
    propertyId: string;
    folioId: string;
    roomStayId: string;
    paidMinor: bigint;
    currency: string;
  },
): Promise<'created' | 'updated' | 'skipped'> {
  return recordExternalPayment(tx, {
    propertyId: input.propertyId,
    folioId: input.folioId,
    externalReference: `exely:${input.roomStayId}`,
    amountMinor: input.paidMinor,
    currency: input.currency,
    note: 'Перенос из Exely: оплачено на момент миграции',
  });
}
