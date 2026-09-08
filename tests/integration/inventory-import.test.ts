import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { summarizeInventoryPlan } from '@pms/domain';
import {
  buildInventoryImportPlan,
  importInventoryPlan,
  parseExelyAccommodationTypes,
  parseExelyInventory,
  readInventoryPlanFromDb,
} from '@pms/imports';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

/** Вымышленный объект и единицы 9xxx: не пересекаются с реальными 1…88. Всё откатывается. */
const FIXTURES = resolve(import.meta.dirname, '../../scripts/imports/src/exely/__fixtures__');
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

describe.skipIf(!url)('importInventoryPlan (integration, DATABASE_URL required)', () => {
  let db: Db;
  beforeAll(() => {
    db = createPrismaClient(url);
  });
  afterAll(async () => {
    await db.$disconnect();
  });

  it('imports the synthetic plan idempotently: second run creates nothing, count stays 7', async () => {
    const plan = buildInventoryImportPlan(
      parseExelyInventory(readFileSync(resolve(FIXTURES, 'inventory.md'), 'utf-8')),
      parseExelyAccommodationTypes(readFileSync(resolve(FIXTURES, 'spravochniki.md'), 'utf-8')),
    );
    await expect(
      db.$transaction(
        async (tx) => {
          const first = await importInventoryPlan(tx, plan, TEST_PROPERTY);
          expect(first.units).toEqual({ created: 7, updated: 0 });
          expect(first.physicalRooms).toEqual({ created: 7, updated: 0 });
          expect(first.accommodationTypes).toEqual({ created: 3, updated: 0 });
          expect(first.unitsInDb).toBe(7);

          const second = await importInventoryPlan(tx, plan, TEST_PROPERTY);
          expect(second.units).toEqual({ created: 0, updated: 7 });
          expect(second.physicalRooms).toEqual({ created: 0, updated: 7 });
          expect(second.unitsInDb).toBe(7);

          const back = await readInventoryPlanFromDb(tx, TEST_PROPERTY.name);
          expect(back).not.toBeNull();
          const s = summarizeInventoryPlan(back!.plan);
          expect(s).toMatchObject({
            totalUnits: 7,
            rooms: 4,
            beds: 3,
            maxGuests: 9,
            physicalRooms: 7,
          });
          expect(back!.plan.units.map((u) => u.exelyRoomNumber).sort()).toEqual(
            plan.units.map((u) => u.exelyRoomNumber).sort(),
          );
          throw new Rollback('rollback test data');
        },
        { timeout: 120_000, maxWait: 30_000 },
      ),
    ).rejects.toBeInstanceOf(Rollback);

    // после отката тестового объекта в БД нет
    expect(await db.property.findFirst({ where: { name: TEST_PROPERTY.name } })).toBeNull();
  }, 180_000); // БД удалённая (Supabase, Сингапур): десятки последовательных запросов
});
