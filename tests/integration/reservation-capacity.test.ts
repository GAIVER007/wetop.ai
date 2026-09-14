import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { ConflictException } from '@nestjs/common';
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

/**
 * Овербукинг через места без ячейки (plans/wetop-domain-2026-09-14.md, Б2): вместимость категории проверялась по
 * каждому месту брони отдельно — места того же запроса ещё не записаны и в подсчёт не попадали.
 */
loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;
const FIXTURES = resolve(import.meta.dirname, '../../scripts/imports/src/exely/__fixtures__');
/** Вымышленный объект; всё откатывается */
const TEST_PROPERTY = {
  name: 'Тестовый хостел (capacity)',
  legalName: 'ИП «Тест»',
  bin: '000000000000',
  address: 'нигде',
  timezone: 'Asia/Almaty',
  currency: 'KZT',
  checkInTime: '14:00',
  checkOutTime: '12:00',
};
class Rollback extends Error {}

async function expectConflictInsideTx(tx: DbTx, name: string, fn: () => Promise<unknown>) {
  await tx.$executeRawUnsafe(`SAVEPOINT ${name}`);
  try {
    await fn();
    throw new Error(`${name}: ожидался ConflictException — категория продана сверх вместимости`);
  } catch (e) {
    expect(e, name).toBeInstanceOf(ConflictException);
  } finally {
    await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${name}`);
  }
}

describe.skipIf(!url)(
  'category capacity across the places of one booking (integration, rolled back)',
  () => {
    let db: Db;
    beforeAll(() => {
      db = createPrismaClient(url);
    });
    afterAll(async () => {
      await db.$disconnect();
    });

    it('refuses more places without a unit than the category has, counting all places of the booking together', async () => {
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
            // «Тестовая одиночная» в фикстуре — две ячейки (9001, 9003): вместимость категории 2
            expect(
              await tx.inventoryUnit.count({
                where: { accommodationType: { code: 'exely-900001', propertyId: property.id } },
              }),
            ).toBe(2);
            const repo = () => new PrismaReservationsRepository(tx, TEST_PROPERTY.name);
            const service = new ReservationsService(
              { run: (fn) => fn(repo()), read: (fn) => fn(repo()) },
              new NoopAriPublisher(),
            );
            const place = {
              accommodationTypeCode: 'exely-900001',
              ratePlanCode: 'exely-800001',
              adults: 1,
            };
            const booking = (items: Array<Record<string, unknown>>) => ({
              source: 'WALK_IN',
              arrivalDate: '2026-01-01',
              departureDate: '2026-01-03',
              guest: { firstName: 'Гость', lastName: 'Тест-вместимость' },
              items,
            });

            // три места «назначить позже» на две койки — третье продано бы сверх вместимости
            await expectConflictInsideTx(tx, 'three_unassigned', () =>
              service.create(booking([place, place, place])),
            );
            // группа на два места плюс одно место без ячейки — тоже три на две
            await expectConflictInsideTx(tx, 'group_plus_single', () =>
              service.create(booking([{ ...place, quantity: 2 }, place])),
            );
            // ровно вместимость — проходит: одно место с ячейкой и одно без
            const ok = await service.create(booking([{ ...place, unitCode: '9001' }, place]));
            expect(ok.items).toHaveLength(2);
            // категория полностью продана — ещё одно место без ячейки не продаётся
            await expectConflictInsideTx(tx, 'sold_out', () => service.create(booking([place])));
            throw new Rollback();
          },
          { timeout: 180_000, maxWait: 30_000 },
        ),
      ).rejects.toSatisfy((e: unknown) => {
        if (!(e instanceof Rollback)) console.error('НЕ ОТКАТ:', e);
        return e instanceof Rollback;
      });
    }, 240_000);
  },
);
