import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { ConflictException, UnprocessableEntityException } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db, type DbTx } from '@pms/database';
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
  name: 'Тестовый хостел (integration)',
  legalName: 'ИП «Тест»',
  bin: '000000000000',
  address: 'нигде',
  timezone: 'Asia/Almaty',
  currency: 'KZT',
  checkInTime: '14:00',
  checkOutTime: '12:00',
};
class Rollback extends Error {}

/** Ожидаемая ошибка внутри транзакции: savepoint, чтобы 23P01 не убил всю транзакцию теста. */
async function expectInsideTx<T>(
  tx: DbTx,
  name: string,
  fn: () => Promise<T>,
  klass: new (...a: never[]) => Error,
) {
  await tx.$executeRawUnsafe(`SAVEPOINT ${name}`);
  try {
    await fn();
    throw new Error(`ожидалась ${klass.name}`);
  } catch (e) {
    expect(e).toBeInstanceOf(klass);
  } finally {
    await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${name}`);
  }
}

describe.skipIf(!url)('manual reservation against the database (integration, rolled back)', () => {
  let db: Db;
  beforeAll(() => {
    db = createPrismaClient(url);
  });
  afterAll(async () => {
    await db.$disconnect();
  });

  it('creates, refuses a second booking on the same unit (DB exclusion), frees on cancel, moves on assign', async () => {
    const startedAt = new Date();
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
            select: { id: true },
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
          // вторая одноместная ячейка для переселения: в фикстуре одноместная только 9001
          const u9001 = await tx.inventoryUnit.findUniqueOrThrow({
            where: { code: '9001' },
            select: { physicalRoomId: true, accommodationTypeId: true, kind: true },
          });
          await tx.inventoryUnit.create({
            data: {
              code: '9901',
              kind: u9001.kind,
              physicalRoomId: u9001.physicalRoomId,
              accommodationTypeId: u9001.accommodationTypeId,
            },
          });

          const service = new ReservationsService(
            { run: (fn) => fn(new PrismaReservationsRepository(tx, TEST_PROPERTY.name)) },
            new NoopAriPublisher(),
          );
          const body = (over: Record<string, unknown> = {}) => ({
            source: 'WALK_IN',
            arrivalDate: '2026-01-01',
            departureDate: '2026-01-03',
            guest: { firstName: 'Гость', lastName: 'Тест-интеграция' },
            items: [
              {
                accommodationTypeCode: 'exely-900001',
                ratePlanCode: 'exely-800001',
                adults: 1,
                unitCode: '9001',
              },
            ],
            ...over,
          });
          const first = await service.create(body());
          expect(first.status).toBe('CONFIRMED');
          expect(first.totalAmountMinor).toBe('2200000');
          expect(first.items[0]!.unitCode).toBe('9001');

          await expectInsideTx(
            tx,
            'overlap',
            () => service.create(body({ arrivalDate: '2026-01-02', departureDate: '2026-01-04' })),
            ConflictException,
          );
          await expectInsideTx(
            tx,
            'noprice',
            () =>
              service.create(
                body({
                  arrivalDate: '2026-01-04',
                  departureDate: '2026-01-06',
                  items: [
                    {
                      accommodationTypeCode: 'exely-900001',
                      ratePlanCode: 'exely-800002',
                      adults: 1,
                    },
                  ],
                }),
              ),
            UnprocessableEntityException,
          );

          const cancelled = await service.cancel(first.confirmationNumber);
          expect(cancelled.status).toBe('CANCELLED');
          expect(
            await tx.allocation.count({
              where: { reservationItem: { reservation: { propertyId: property.id } } },
            }),
          ).toBe(0);

          const second = await service.create(
            body({ arrivalDate: '2026-01-02', departureDate: '2026-01-04' }),
          );
          expect(second.items[0]!.unitCode).toBe('9001');

          const moved = await service.assign(second.confirmationNumber, second.items[0]!.id, {
            unitCode: '9901',
            fromDate: '2026-01-03',
          });
          void moved;
          const allocs = await tx.allocation.findMany({
            where: { reservationItemId: second.items[0]!.id },
            orderBy: { startDate: 'asc' },
            include: { inventoryUnit: { select: { code: true } } },
          });
          expect(
            allocs.map((a) => [
              a.inventoryUnit.code,
              a.startDate.toISOString().slice(0, 10),
              a.endDate.toISOString().slice(0, 10),
            ]),
          ).toEqual([
            ['9001', '2026-01-02', '2026-01-03'],
            ['9901', '2026-01-03', '2026-01-04'],
          ]);
          const audits = await tx.auditLog.findMany({
            where: { entityType: 'Reservation', createdAt: { gte: startedAt } },
            orderBy: { createdAt: 'asc' },
          });
          expect(audits.map((a) => a.action)).toEqual([
            'reservation.create',
            'reservation.cancel',
            'reservation.create',
            'reservation.assign',
          ]);
          throw new Rollback();
        },
        { timeout: 180_000, maxWait: 30_000 },
      ),
    ).rejects.toSatisfy((e: unknown) => {
      if (!(e instanceof Rollback)) console.error('НЕ ОТКАТ:', e);
      return e instanceof Rollback;
    });
  }, 240_000);
});
