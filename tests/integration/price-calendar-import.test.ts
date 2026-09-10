import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
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

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;
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

describe.skipIf(!url)('importPriceCalendar (integration, DATABASE_URL required)', () => {
  let db: Db;
  beforeAll(() => {
    db = createPrismaClient(url);
  });
  afterAll(async () => {
    await db.$disconnect();
  });

  it('writes daily_rates and restrictions idempotently, sets the tariff currency from the calendar, all rolled back', async () => {
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

          const first = await importPriceCalendar(tx, calendar, property.id);
          expect(first.dailyRates).toEqual({ created: 17, updated: 0, unchanged: 0 });
          expect(first.restrictions).toEqual({ created: 5, updated: 0, unchanged: 0 });
          expect(first.currencyChanged).toEqual([{ code: 'exely-800002', from: 'KZT', to: 'USD' }]);

          const second = await importPriceCalendar(tx, calendar, property.id);
          expect(second.dailyRates).toEqual({ created: 0, updated: 0, unchanged: 17 });
          expect(second.restrictions).toEqual({ created: 0, updated: 0, unchanged: 5 });
          expect(second.currencyChanged).toEqual([]);

          // изменённая цена → ровно одна строка обновлена, остальные без изменений
          const changed = structuredClone(calendar);
          changed.dailyRates[0]!.priceMinor = 1_234_500n;
          const third = await importPriceCalendar(tx, changed, property.id);
          expect(third.dailyRates).toEqual({ created: 0, updated: 1, unchanged: 16 });

          const usd = await tx.ratePlan.findUniqueOrThrow({
            where: { propertyId_code: { propertyId: property.id, code: 'exely-800002' } },
            select: { currency: true, id: true },
          });
          expect(usd.currency).toBe('USD');
          const usdRates = await tx.dailyRate.findMany({
            where: { ratePlanId: usd.id },
            orderBy: { date: 'asc' },
          });
          expect(usdRates.map((r) => [r.date.toISOString().slice(0, 10), r.price])).toEqual([
            ['2026-01-01', 3_700n],
            ['2026-01-02', 3_700n],
          ]);
          // только объект этого теста: в общей dev-БД есть stop sell и у боевого объекта (сертификация Channex)
          const stop = await tx.restriction.findMany({
            where: { stopSell: true, ratePlan: { propertyId: property.id } },
            orderBy: { date: 'asc' },
          });
          expect(stop.map((r) => r.date.toISOString().slice(0, 10))).toEqual([
            '2026-01-04',
            '2026-01-05',
          ]);
          throw new Rollback();
        },
        { timeout: 120_000, maxWait: 30_000 },
      ),
    ).rejects.toBeInstanceOf(Rollback);
    expect(await db.property.count({ where: { name: TEST_PROPERTY.name } })).toBe(0);
  }, 180_000);

  it('refuses a calendar whose tariff is unknown in the database', async () => {
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
          // тарифы не импортированы → календарь ссылается на неизвестный тариф
          await importPriceCalendar(tx, calendar, property.id);
        },
        { timeout: 120_000, maxWait: 30_000 },
      ),
    ).rejects.toThrow(/800001/);
  }, 180_000);
});
