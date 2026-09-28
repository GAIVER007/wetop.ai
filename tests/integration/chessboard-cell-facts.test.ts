import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { LUXX_APARTS_PROPERTY } from '@pms/imports';
import { PrismaChessboardRepository } from '../../apps/api/src/chessboard/chessboard.repository';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

/**
 * Срез 7.1: на клетке шахматки появились канал брони и остаток к оплате, в строке ячейки — статус
 * уборки. Домен и экран доказаны своими тестами на выдуманных данных; здесь доказывается то, чего
 * они не видят, — что репозиторий читает эти три факта из настоящей базы и считает остаток тем же
 * `folioBalance`, что список броней и «Сегодня».
 *
 * Всё пишется внутри транзакции и откатывается: ни брони, ни платежа в базе не остаётся.
 */
describe.skipIf(!url)('шахматка: канал, долг и уборка из базы (integration, rolled back)', () => {
  let db: Db;
  beforeAll(() => {
    db = createPrismaClient(url);
  });
  afterAll(async () => {
    if (db) await db.$disconnect();
  });

  it('клетка несёт канал и остаток по счёту, строка ячейки — статус уборки', async () => {
    const from = '2027-12-01';
    const to = '2027-12-03';
    const number = `INTEGRATION-BOARD-${Date.now().toString(36)}`;
    let seen: Record<string, unknown> | null = null;
    class Rollback extends Error {}

    await db
      .$transaction(
        async (tx) => {
          const property = await tx.property.findFirstOrThrow({
            where: { name: LUXX_APARTS_PROPERTY.name },
            select: { id: true, currency: true },
          });
          // ячейка, свободная в окне: иначе сработает ограничение пересечения в базе
          const busy = await tx.allocation.findMany({
            where: {
              startDate: { lte: new Date(`${to}T00:00:00Z`) },
              endDate: { gt: new Date(`${from}T00:00:00Z`) },
            },
            select: { inventoryUnitId: true },
          });
          const unit = await tx.inventoryUnit.findFirstOrThrow({
            where: {
              active: true,
              accommodationType: { propertyId: property.id },
              id: { notIn: busy.map((b) => b.inventoryUnitId) },
            },
            select: { id: true, accommodationTypeId: true },
          });

          const reservation = await tx.reservation.create({
            data: {
              propertyId: property.id,
              confirmationNumber: number,
              source: 'OTA',
              channel: 'Booking.com',
              status: 'CONFIRMED',
              arrivalDate: new Date(`${from}T00:00:00Z`),
              departureDate: new Date(`${to}T00:00:00Z`),
              adults: 1,
              currency: property.currency,
              totalAmount: 1_200_000n,
            },
            select: { id: true },
          });
          const item = await tx.reservationItem.create({
            data: {
              reservationId: reservation.id,
              accommodationTypeId: unit.accommodationTypeId,
              arrivalDate: new Date(`${from}T00:00:00Z`),
              departureDate: new Date(`${to}T00:00:00Z`),
              price: 1_200_000n,
              status: 'CONFIRMED',
            },
            select: { id: true },
          });
          await tx.allocation.create({
            data: {
              reservationItemId: item.id,
              inventoryUnitId: unit.id,
              startDate: new Date(`${from}T00:00:00Z`),
              endDate: new Date(`${to}T00:00:00Z`),
            },
          });
          const folio = await tx.folio.create({
            data: { reservationItemId: item.id, currency: property.currency },
            select: { id: true },
          });
          await tx.charge.create({
            data: {
              folioId: folio.id,
              kind: 'ACCOMMODATION',
              description: 'Проживание (integration)',
              unitPrice: 1_200_000n,
              amount: 1_200_000n,
            },
          });
          // сторнированное начисление в остаток не входит
          await tx.charge.create({
            data: {
              folioId: folio.id,
              kind: 'PENALTY',
              description: 'Сторнированный штраф (integration)',
              unitPrice: 500_000n,
              amount: 500_000n,
              voidedAt: new Date(),
            },
          });
          const payment = await tx.payment.create({
            data: {
              propertyId: property.id,
              method: 'KASPI',
              amount: 450_000n,
              currency: property.currency,
              externalReference: `integration:${randomUUID()}`,
            },
            select: { id: true },
          });
          await tx.paymentAllocation.create({
            data: { paymentId: payment.id, folioId: folio.id, amount: 450_000n },
          });

          const repo = new PrismaChessboardRepository({ db: tx } as PrismaService);
          const units = await repo.units();
          const allocations = await repo.allocations(from, to);
          const mine = allocations.find((a) => a.confirmationNumber === number);
          seen = {
            channel: mine?.channel,
            source: mine?.source,
            balanceMinor: mine?.balanceMinor,
            // статус уборки известен у каждой ячейки — по нему работает фильтр «Уборка»
            housekeepingKnown:
              units.length > 0 &&
              units.every((u) =>
                ['DIRTY', 'CLEAN', 'INSPECTED'].includes(u.housekeepingStatus ?? ''),
              ),
            // физическая комната у каждого места (ТЗ v2 §17, подготовка к Q-095): пока 1:1, UI не группирует
            physicalRoomKnown:
              units.length > 0 &&
              units.every(
                (u) =>
                  typeof (u as { physicalRoomNumber?: unknown }).physicalRoomNumber === 'string' &&
                  ((u as { physicalRoomNumber?: string }).physicalRoomNumber ?? '') !== '',
              ),
          };
          throw new Rollback();
        },
        { timeout: 60_000 },
      )
      .catch((e: unknown) => {
        if (!(e instanceof Rollback)) throw e;
      });

    // 12 000 ₸ начислено, сторно не считается, 4 500 ₸ оплачено → к оплате 7 500 ₸ строкой в тиынах
    expect(seen).toEqual({
      channel: 'Booking.com',
      source: 'OTA',
      balanceMinor: '750000',
      housekeepingKnown: true,
      physicalRoomKnown: true,
    });
    expect(await db.reservation.findFirst({ where: { confirmationNumber: number } })).toBeNull();
  });
});
