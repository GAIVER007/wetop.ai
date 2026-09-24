import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { PrismaRatesRepository } from '../../apps/api/src/rates/rates.repository';
import type { RateChangeBefore } from '../../apps/api/src/rates/rate-history';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

/**
 * SECURITY.md §6: правка цены и ограничений пишется в журнал с `before`. Прежние строки удаляются в той же транзакции,
 * поэтому прочитать их можно только там — до удаления; проверка на живом PostgreSQL. Даты — 2029 год, за окном сида;
 * тест убирает за собой свои строки.
 */
describe.skipIf(!url)('правка цен: журнал получает прежние значения (integration, DATABASE_URL required)', () => {
  let db: Db;
  let repo: PrismaRatesRepository;
  const from = '2029-02-10';
  const to = '2029-02-12';
  let key: {
    accommodationTypeId: string;
    ratePlanId: string;
    capacityAdults: number;
    accommodationTypeCode: string;
    ratePlanCode: string;
  };
  const range = () => ({
    accommodationTypeId: key.accommodationTypeId,
    ratePlanId: key.ratePlanId,
    date: { gte: new Date(`${from}T00:00:00Z`), lte: new Date(`${to}T00:00:00Z`) },
  });

  beforeAll(async () => {
    db = createPrismaClient(url);
    repo = new PrismaRatesRepository({ db } as PrismaService);
    const [category] = await repo.categories();
    const [plan] = await repo.ratePlans();
    key = {
      accommodationTypeId: category!.id,
      ratePlanId: plan!.id,
      capacityAdults: category!.capacityAdults,
      accommodationTypeCode: category!.code,
      ratePlanCode: plan!.code,
    };
    await db.dailyRate.deleteMany({ where: range() });
    await db.restriction.deleteMany({ where: range() });
  });

  afterAll(async () => {
    if (!db) return;
    await db.dailyRate.deleteMany({ where: range() });
    await db.restriction.deleteMany({ where: range() });
    await db.$disconnect();
  });

  it('before — цены и ограничения тех же дат до правки, диапазонами; первая правка — пустой before', async () => {
    const change = { ...key, dateFrom: from, dateTo: to };
    let first: RateChangeBefore[] | undefined;
    await repo.applyChanges([{ ...change, priceMinor: 1_110_000n, minStay: 2 }], async (_tx, _c, before) => {
      first = before;
    });
    expect(first).toEqual([{ ...pick(key), prices: [], restrictions: [] }]);

    let second: RateChangeBefore[] | undefined;
    await repo.applyChanges([{ ...change, priceMinor: 2_220_000n, minStay: 3 }], async (_tx, _c, before) => {
      second = before;
    });
    expect(second).toEqual([
      {
        ...pick(key),
        prices: Array.from({ length: key.capacityAdults }, (_, i) => ({
          occupancy: i + 1,
          from,
          to,
          priceMinor: '1110000',
        })),
        restrictions: [
          { from, to, minStay: 2, maxStay: null, stopSell: false, closedToArrival: false, closedToDeparture: false },
        ],
      },
    ]);
  });
});

const pick = (k: { accommodationTypeId: string; ratePlanId: string }) => ({
  accommodationTypeId: k.accommodationTypeId,
  ratePlanId: k.ratePlanId,
});
