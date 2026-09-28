import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, isOverlapViolation, type Db } from '@pms/database';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;
class Rollback extends Error {}

/**
 * PLAN.md риск №3/№6: овербукинг запрещает БАЗА, не код. Две брони на одну ячейку в одну
 * секунду из двух каналов должна остановить сама PostgreSQL (exclusion constraint).
 * Тест работает на реальной единице «1» и вымышленных бронях; всё откатывается.
 */
describe.skipIf(!url)('DB-level overbooking guard (integration)', () => {
  let db: Db;
  beforeAll(() => {
    db = createPrismaClient(url);
  });
  afterAll(async () => {
    await db.$disconnect();
  });

  it('rejects a second allocation overlapping the same unit with an exclusion violation (23P01)', async () => {
    await expect(
      db.$transaction(
        async (tx) => {
          const property = await tx.property.findFirstOrThrow({ select: { id: true } });
          const unit = await tx.inventoryUnit.findFirstOrThrow({
            where: { code: 'L1' },
            select: { id: true, accommodationTypeId: true },
          });
          const mk = async (n: string, from: string, to: string) => {
            const r = await tx.reservation.create({
              data: {
                propertyId: property.id,
                confirmationNumber: n,
                source: 'DESK',
                status: 'CONFIRMED',
                arrivalDate: new Date(from),
                departureDate: new Date(to),
                adults: 1,
                currency: 'KZT',
                totalAmount: 0n,
              },
            });
            const it = await tx.reservationItem.create({
              data: {
                reservationId: r.id,
                accommodationTypeId: unit.accommodationTypeId,
                arrivalDate: new Date(from),
                departureDate: new Date(to),
                price: 0n,
                status: 'CONFIRMED',
              },
            });
            return tx.allocation.create({
              data: {
                reservationItemId: it.id,
                inventoryUnitId: unit.id,
                startDate: new Date(from),
                endDate: new Date(to),
              },
            });
          };
          await mk('TEST-OVB-1', '2031-01-10', '2031-01-13');
          // соседние периоды [10,13) и [13,15) НЕ пересекаются — это должно пройти
          await mk('TEST-OVB-2', '2031-01-13', '2031-01-15');
          // а [12,14) пересекает первый — база обязана отказать
          let overlapRejected = false;
          try {
            await mk('TEST-OVB-3', '2031-01-12', '2031-01-14');
          } catch (e) {
            overlapRejected = isOverlapViolation(e);
          }
          expect(overlapRejected, 'ожидался отказ базы: 23P01 exclusion_violation').toBe(true);
          throw new Rollback();
        },
        { timeout: 120_000, maxWait: 30_000 },
      ),
    ).rejects.toBeInstanceOf(Rollback);
  }, 180_000);
});
