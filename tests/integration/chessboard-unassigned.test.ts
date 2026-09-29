import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { LUXX_APARTS_PROPERTY } from '@pms/domain';
import { PrismaChessboardRepository } from '../../apps/api/src/chessboard/chessboard.repository';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

/**
 * «Шахматка v2» PR 6 (ТЗ §12): ящик «Брони без размещения» показывает гостя и назначает место прямо из
 * карточки. Для этого у брони без ячейки в ответе шахматки нужны id проживания (команда `assign` берёт
 * его) и имя главного гостя — тем же правилом, что у плашек сетки. Доказывается на настоящей базе:
 * репозиторий читает оба поля. Гость вымышленный (ADR-010); всё в транзакции и откатывается.
 */
describe.skipIf(!url)(
  'шахматка: бронь без ячейки несёт проживание и гостя (integration, rolled back)',
  () => {
    let db: Db;
    beforeAll(() => {
      db = createPrismaClient(url);
    });
    afterAll(async () => {
      if (db) await db.$disconnect();
    });

    it('у брони без ячейки есть itemId и имя гостя', async () => {
      const from = '2027-12-10';
      const to = '2027-12-12';
      const number = `INTEGRATION-UNASSIGNED-${Date.now().toString(36)}`;
      let seen: unknown = null;
      let itemId = '';
      class Rollback extends Error {}

      await db
        .$transaction(
          async (tx) => {
            const property = await tx.property.findFirstOrThrow({
              where: { name: LUXX_APARTS_PROPERTY.name },
              select: { id: true, currency: true, organizationId: true },
            });
            const category = await tx.accommodationType.findFirstOrThrow({
              where: { propertyId: property.id },
              select: { id: true },
            });
            const guest = await tx.guest.create({
              data: {
                organizationId: property.organizationId,
                firstName: 'Тестовый',
                lastName: 'Безместный',
              },
              select: { id: true },
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
                totalAmount: 1_000_000n,
                primaryGuestId: guest.id,
              },
              select: { id: true },
            });
            const item = await tx.reservationItem.create({
              data: {
                reservationId: reservation.id,
                accommodationTypeId: category.id,
                arrivalDate: new Date(`${from}T00:00:00Z`),
                departureDate: new Date(`${to}T00:00:00Z`),
                price: 1_000_000n,
                status: 'CONFIRMED',
              },
              select: { id: true },
            });
            itemId = item.id;
            const repo = new PrismaChessboardRepository({ db: tx } as PrismaService);
            seen = (await repo.unassignedStays(from, to)).find(
              (u) => u.confirmationNumber === number,
            );
            throw new Rollback();
          },
          { timeout: 60_000 },
        )
        .catch((e: unknown) => {
          if (!(e instanceof Rollback)) throw e;
        });

      expect(seen).toMatchObject({
        confirmationNumber: number,
        itemId,
        guestLabel: 'Тестовый Безместный',
        arrivalDate: from,
        departureDate: to,
        status: 'CONFIRMED',
      });
      expect(await db.reservation.findFirst({ where: { confirmationNumber: number } })).toBeNull();
    });
  },
);
