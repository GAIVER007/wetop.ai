import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { LUXX_APARTS_PROPERTY, periodBoundsUtc, siteReservations } from '@pms/domain';
import { PrismaAnalyticsRepository } from '../../apps/api/src/analytics/analytics.repository';
import { forgetPropertyRef } from '../../apps/api/src/database/property-ref';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

/**
 * «Сайт и онлайн-бронирование», WEB4 (ADR-117, Q-212): брони с сайта в отчёте — брони объекта с источником
 * «Сайт», созданные в сутках объекта, с действующими начислениями их счетов. Здесь доказывается то, чего не видит
 * юнит-тест с подделкой репозитория: отбор по источнику и по `created_at` на границах суток Алматы и то, что
 * аннулированное начисление в «начислено» не входит. Брони вымышленные (ADR-010), в транзакции с откатом; дата
 * создания — январь 2025, куда не попадает ничего другого.
 */
describe.skipIf(!url)('брони с сайта для отчёта сайта (integration, rolled back)', () => {
  let db: Db;
  beforeAll(() => {
    db = createPrismaClient(url);
  });
  afterAll(async () => {
    if (db) await db.$disconnect();
  });

  it('источник «Сайт», сутки создания по поясу объекта, начислено без аннулированного', async () => {
    const prefix = `WEB4IT${Date.now().toString(36).toUpperCase()}`;
    let rows: Awaited<ReturnType<PrismaAnalyticsRepository['siteReservations']>> = [];
    class Rollback extends Error {}

    await db
      .$transaction(
        async (tx) => {
          forgetPropertyRef();
          const property = await tx.property.findFirstOrThrow({
            where: { name: LUXX_APARTS_PROPERTY.name },
            orderBy: { createdAt: 'asc' },
            select: { id: true, currency: true },
          });
          const type = await tx.accommodationType.findFirstOrThrow({
            where: { propertyId: property.id },
            select: { id: true },
          });
          const seed = async (
            key: string,
            source: 'WEBSITE' | 'OTA',
            status: 'CONFIRMED' | 'CANCELLED',
            createdAt: string,
            charges: Array<{ amount: bigint; voided?: boolean }>,
          ) => {
            const reservation = await tx.reservation.create({
              data: {
                propertyId: property.id,
                confirmationNumber: `${prefix}-${key}`,
                source,
                status,
                arrivalDate: new Date('2025-02-01T00:00:00Z'),
                departureDate: new Date('2025-02-02T00:00:00Z'),
                adults: 1,
                currency: property.currency,
                totalAmount: 45_000_00n,
                createdAt: new Date(createdAt),
              },
              select: { id: true },
            });
            const item = await tx.reservationItem.create({
              data: {
                reservationId: reservation.id,
                accommodationTypeId: type.id,
                arrivalDate: new Date('2025-02-01T00:00:00Z'),
                departureDate: new Date('2025-02-02T00:00:00Z'),
                price: 45_000_00n,
                status,
              },
              select: { id: true },
            });
            const folio = await tx.folio.create({
              data: { reservationItemId: item.id, currency: property.currency },
              select: { id: true },
            });
            for (const c of charges)
              await tx.charge.create({
                data: {
                  folioId: folio.id,
                  kind: 'ACCOMMODATION',
                  description: 'Проживание (integration)',
                  unitPrice: c.amount,
                  amount: c.amount,
                  ...(c.voided ? { voidedAt: new Date() } : {}),
                },
              });
          };

          // сутки 10.01.2025 по Алматы (UTC+5) — [09.01 19:00Z, 10.01 19:00Z)
          await seed('START', 'WEBSITE', 'CONFIRMED', '2025-01-09T19:00:00Z', [
            { amount: 45_000_00n },
          ]);
          await seed('CANCELLED', 'WEBSITE', 'CANCELLED', '2025-01-10T12:00:00Z', [
            { amount: 20_000_00n, voided: true },
            { amount: 10_000_00n },
          ]);
          await seed('BEFORE', 'WEBSITE', 'CONFIRMED', '2025-01-09T18:59:59Z', [
            { amount: 1_00n },
          ]);
          await seed('END', 'WEBSITE', 'CONFIRMED', '2025-01-10T19:00:00Z', [{ amount: 1_00n }]);
          await seed('OTA', 'OTA', 'CONFIRMED', '2025-01-10T10:00:00Z', [{ amount: 1_00n }]);

          const repo = new PrismaAnalyticsRepository({ db: tx } as never);
          const { startUtc, endUtcExclusive } = periodBoundsUtc(
            '2025-01-10',
            '2025-01-10',
            'Asia/Almaty',
          );
          rows = await repo.siteReservations(startUtc, endUtcExclusive);
          throw new Rollback();
        },
        { timeout: 60_000 },
      )
      .catch((e) => {
        if (!(e instanceof Rollback)) throw e;
      });

    expect(siteReservations(rows)).toEqual({
      count: 2,
      cancelled: 1,
      noShow: 0,
      charged: [{ currency: 'KZT', chargedMinor: '5500000' }],
    });
  });
});
