import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { NotFoundException } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import {
  buildInventoryImportPlan,
  buildRatePlanImportPlan,
  importInventoryPlan,
  importPriceCalendar,
  importRatePlans,
  parseExelyAccommodationTypes,
  parseExelyInventory,
  parseExelyPriceCalendar,
  parseExelyRatePlans,
} from '@pms/imports';
import { PrismaReservationsRepository } from '../../apps/api/src/reservations/reservations.repository';
import { ReservationsService } from '../../apps/api/src/reservations/reservations.service';
import { NoopAriPublisher } from '../../apps/api/src/channels/ari-publisher';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;
const FIXTURES = resolve(import.meta.dirname, '../../scripts/imports/src/exely/__fixtures__');
/** Вымышленный объект; репозиторию имя передаётся явно. Всё откатывается. */
const TEST_PROPERTY = {
  name: 'Тестовый хостел (integration G6)',
  legalName: 'ИП «Тест»',
  bin: '000000000000',
  address: 'нигде',
  timezone: 'Asia/Almaty',
  currency: 'KZT',
  checkInTime: '14:00',
  checkOutTime: '12:00',
};
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
    const spravochniki = readFileSync(resolve(FIXTURES, 'spravochniki.md'), 'utf-8');
    const inventory = buildInventoryImportPlan(
      parseExelyInventory(readFileSync(resolve(FIXTURES, 'inventory.md'), 'utf-8')),
      parseExelyAccommodationTypes(spravochniki),
    );
    const calendar = parseExelyPriceCalendar(
      JSON.parse(readFileSync(resolve(FIXTURES, 'price-calendar.json'), 'utf-8')),
    );
    await expect(
      db.$transaction(
        async (tx) => {
          await importInventoryPlan(tx, inventory, TEST_PROPERTY);
          const property = await tx.property.findFirstOrThrow({
            where: { name: TEST_PROPERTY.name },
            select: { id: true, organizationId: true },
          });
          const types = await tx.accommodationType.findMany({
            where: { propertyId: property.id },
            select: { code: true },
          });
          await importRatePlans(
            tx,
            buildRatePlanImportPlan(
              parseExelyRatePlans(spravochniki),
              types.map((t) => t.code),
              'KZT',
            ),
            property.id,
          );
          await importPriceCalendar(tx, calendar, property.id);
          const service = new ReservationsService(
            {
              run: (fn) => fn(new PrismaReservationsRepository(tx, TEST_PROPERTY.name)),
              read: (fn) => fn(new PrismaReservationsRepository(tx, TEST_PROPERTY.name)),
            },
            new NoopAriPublisher(),
          );
          const item = {
            accommodationTypeCode: 'exely-900001',
            ratePlanCode: 'exely-800001',
            adults: 1,
            unitCode: '9001',
          };
          const guestsOfOrg = () =>
            tx.guest.count({ where: { organizationId: property.organizationId } });

          const first = await service.create({
            source: 'WALK_IN',
            arrivalDate: '2026-01-01',
            departureDate: '2026-01-03',
            guest: { firstName: 'Гость', lastName: 'Тест-G6' },
            items: [item],
          });
          const { primaryGuestId: guestId } = await tx.reservation.findFirstOrThrow({
            where: { propertyId: property.id, confirmationNumber: first.confirmationNumber },
            select: { primaryGuestId: true },
          });
          if (!guestId) throw new Error('у первой брони нет главного гостя');
          const before = await guestsOfOrg();

          // в ценовом календаре фикстуры пять ночей (01.01–05.01): вторая бронь — сразу после первой
          const second = await service.create({
            source: 'PHONE',
            arrivalDate: '2026-01-03',
            departureDate: '2026-01-05',
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
              arrivalDate: '2026-01-03',
              departureDate: '2026-01-04',
              guestId: foreign.id,
              // без ячейки: отказ может дать только гость, не занятая ячейка
              items: [{ ...item, unitCode: null }],
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
