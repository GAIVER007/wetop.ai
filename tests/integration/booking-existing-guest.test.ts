import 'reflect-metadata';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { NotFoundException } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { PrismaReservationsRepository } from '../../apps/api/src/reservations/reservations.repository';
import { ReservationsService } from '../../apps/api/src/reservations/reservations.service';
import { NoopAriPublisher } from '../../apps/api/src/channels/ari-publisher';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;
/** Даты от сегодняшнего дня: цены сида лежат на 400 дней вперёд от засева (tests/tools/seed-local.ts) */
const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
class Rollback extends Error {}

/**
 * «Гости v2», G6 (ТЗ §33, §52 п. 9–10): бронь из карточки гостя не заводит второго гостя. Проверяется
 * на базе: главный гость брони, гость проживания и число гостей организации до и после.
 */
describe.skipIf(!url)('бронь существующему гостю (integration, rolled back)', () => {
  let db: Db;
  beforeAll(() => {
    db = createPrismaClient(url);
  });
  afterAll(async () => {
    await db.$disconnect();
  });

  it('вторая бронь по guestId — тот же гость, новых строк в guests нет; чужой гость — 404', async () => {
    const seen: Record<string, unknown> = {};
    await expect(
      db.$transaction(
        async (tx) => {
          // засеянный объект стенда (seed-local): служебный путь находит его по имени, как репозиторий по умолчанию
          const property = await tx.property.findFirstOrThrow({
            where: { inventoryUnits: { some: { code: 'L1' } } },
            select: { id: true, name: true, organizationId: true },
          });
          const service = new ReservationsService(
            {
              run: (fn) => fn(new PrismaReservationsRepository(tx, property.name)),
              read: (fn) => fn(new PrismaReservationsRepository(tx, property.name)),
            },
            new NoopAriPublisher(),
          );
          // без ячейки: засеянные брони стенда не мешают, отказ может дать только гость
          const item = {
            accommodationTypeCode: 'L-DOUBLE',
            ratePlanCode: 'L-BASE',
            adults: 1,
            unitCode: null,
          };
          const guestsOfOrg = () =>
            tx.guest.count({ where: { organizationId: property.organizationId } });

          const first = await service.create({
            source: 'WALK_IN',
            arrivalDate: day(200),
            departureDate: day(202),
            guest: { firstName: 'Гость', lastName: 'Тест-G6' },
            items: [item],
          });
          const { primaryGuestId: guestId } = await tx.reservation.findFirstOrThrow({
            where: { propertyId: property.id, confirmationNumber: first.confirmationNumber },
            select: { primaryGuestId: true },
          });
          if (!guestId) throw new Error('у первой брони нет главного гостя');
          const before = await guestsOfOrg();

          const second = await service.create({
            source: 'PHONE',
            arrivalDate: day(202),
            departureDate: day(204),
            guestId,
            items: [item],
          });
          const stored = await tx.reservation.findFirstOrThrow({
            where: { propertyId: property.id, confirmationNumber: second.confirmationNumber },
            select: {
              primaryGuestId: true,
              items: { select: { stayGuests: { select: { guestId: true, isPrimary: true } } } },
            },
          });
          seen['primary'] = stored.primaryGuestId === guestId;
          seen['stayGuests'] = stored.items.flatMap((i) => i.stayGuests);
          seen['guestId'] = guestId;
          seen['guestsAdded'] = (await guestsOfOrg()) - before;
          seen['staysOfGuest'] = await tx.stayGuest.count({ where: { guestId } });

          // Гость другой организации: объект его не видит — 404, брони и гостя не прибавилось
          const orgB = await tx.organization.create({
            data: { name: 'Integration G6 B' },
            select: { id: true },
          });
          const foreign = await tx.guest.create({
            data: { organizationId: orgB.id, firstName: 'Фикстура', lastName: 'Чужая' },
            select: { id: true },
          });
          const reservationsBefore = await tx.reservation.count({
            where: { propertyId: property.id },
          });
          await tx.$executeRawUnsafe('SAVEPOINT foreign_guest');
          seen['foreign'] = await service
            .create({
              source: 'PHONE',
              arrivalDate: day(204),
              departureDate: day(205),
              guestId: foreign.id,
              items: [item],
            })
            .then(
              () => 'created',
              (e: unknown) => (e instanceof NotFoundException ? 'not-found' : String(e)),
            );
          await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT foreign_guest');
          seen['reservationsAfterForeign'] =
            (await tx.reservation.count({ where: { propertyId: property.id } })) -
            reservationsBefore;
          throw new Rollback();
        },
        { timeout: 180_000, maxWait: 30_000 },
      ),
    ).rejects.toBeInstanceOf(Rollback);

    expect(seen['primary']).toBe(true);
    expect(seen['stayGuests']).toEqual([{ guestId: seen['guestId'], isPrimary: true }]);
    expect(seen['guestsAdded']).toBe(0);
    expect(seen['staysOfGuest']).toBe(2);
    expect(seen['foreign']).toBe('not-found');
    expect(seen['reservationsAfterForeign']).toBe(0);
  });
});
