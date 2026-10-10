import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { LUXX_APARTS_PROPERTY } from '@pms/domain';
import { PrismaMarketRepository } from '../../apps/api/src/market/market.repository';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

/**
 * Уровень наличия у снимка (DATA_MODEL §23.1, миграция 20261010000080) на настоящей схеме: снимок только с уровнем
 * записывается, пустой (без процента и без уровня) отвергает CHECK, а расчёт «вы и рынок» по процентам такой снимок
 * не берёт. Данные вымышленные (ADR-010), после прогона удаляются.
 */
describe.skipIf(!url)('загрузка конкурентов: уровень наличия (integration, DATA_MODEL §23.1)', () => {
  let db: Db;
  let repo: PrismaMarketRepository;
  let propertyId: string;
  let competitorId: string;

  async function cleanup() {
    await db.competitorOccupancy.deleteMany({ where: { competitor: { name: 'Сосед с уровнем' } } });
    await db.competitor.deleteMany({ where: { name: 'Сосед с уровнем' } });
  }

  beforeAll(async () => {
    db = createPrismaClient(url);
    repo = new PrismaMarketRepository({ db } as unknown as PrismaService);
    const property = await db.property.findFirst({
      where: { name: LUXX_APARTS_PROPERTY.name },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    expect(property, 'в тестовой базе нужен объект').toBeTruthy();
    propertyId = property!.id;
    await cleanup();
    competitorId = (await db.competitor.create({ data: { propertyId, name: 'Сосед с уровнем' }, select: { id: true } })).id;
  });

  afterAll(async () => {
    if (!db) return;
    await cleanup();
    await db.$disconnect();
  });

  const snapshot = (stayDate: string, data: { occupancyBp?: number | null; availabilityLevel?: 'SOLD_OUT' | 'FEW_LEFT' | 'AVAILABLE' | null }) =>
    db.competitorOccupancy.create({
      data: {
        propertyId,
        competitorId,
        stayDate: new Date(`${stayDate}T00:00:00Z`),
        observedOn: new Date('2026-10-10T00:00:00Z'),
        source: 'AI_AGENT',
        ...data,
      },
    });

  it('снимок только с уровнем записывается; процент и уровень вместе тоже', async () => {
    await expect(snapshot('2026-10-20', { availabilityLevel: 'FEW_LEFT' })).resolves.toBeTruthy();
    await expect(snapshot('2026-10-21', { occupancyBp: 9000, availabilityLevel: 'FEW_LEFT' })).resolves.toBeTruthy();
  });

  it('пустой снимок, без процента и без уровня, база не принимает', async () => {
    await expect(snapshot('2026-10-22', {})).rejects.toThrow(/competitor_occupancy_has_value/);
  });

  it('расчёт «вы и рынок» берёт только снимки с процентом', async () => {
    const readings = (await repo.readings('2026-10-20', '2026-10-22', '2026-10-10')).filter(
      (r) => r.competitorId === competitorId,
    );
    expect(readings.map((r) => [r.stayDate, r.occupancyBp])).toEqual([['2026-10-21', 9000]]);
  });
});
