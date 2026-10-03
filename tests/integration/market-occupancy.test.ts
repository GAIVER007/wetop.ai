import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NEW_PROPERTY_DEFAULTS, createPrismaClient, createPropertyInChain, type Db } from '@pms/database';
import { LUXX_APARTS_PROPERTY } from '@pms/domain';
import { PrismaMarketRepository } from '../../apps/api/src/market/market.repository';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

/**
 * Загрузка конкурентов (DATA_MODEL §23, ADR-142) на настоящей схеме: конкурент с журналом, снимок за день заменяется,
 * пустое снимает, вчерашний снимок остаётся для сравнения; снимок к конкуренту чужого объекта отвергает составной
 * ключ, загрузка вне 0…100 %: CHECK. Данные вымышленные (ADR-010), после прогона удаляются.
 */
describe.skipIf(!url)('загрузка конкурентов: конкуренты и снимки (integration, DATA_MODEL §23)', () => {
  let db: Db;
  let repo: PrismaMarketRepository;
  let propertyId: string;
  const audit = { entityType: 'Competitor', action: 'test', after: {} };

  async function cleanup() {
    await db.competitorOccupancy.deleteMany({});
    await db.competitor.deleteMany({});
    await db.auditLog.deleteMany({ where: { entityType: 'Competitor' } }).catch(() => undefined);
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
  });

  afterAll(async () => {
    if (!db) return;
    await cleanup();
    await db.$disconnect();
  });

  it('конкурент создаётся с журналом; имя уникально в объекте', async () => {
    const id = await repo.createCompetitor({ name: 'Тестовый Сосед', distanceM: 250 }, audit);
    const list = await repo.competitors();
    expect(list).toEqual([
      expect.objectContaining({ id, name: 'Тестовый Сосед', distanceM: 250, active: true }),
    ]);
    const log = await db.auditLog.findFirst({ where: { entityType: 'Competitor', entityId: id } });
    expect(log?.after).toMatchObject({ competitorId: id });
    await expect(repo.createCompetitor({ name: 'Тестовый Сосед' }, audit)).rejects.toThrow(/уже есть/);
  });

  it('снимок за день заменяется, пустое снимает; вчерашний остаётся; архивный конкурент не пишется', async () => {
    const [c] = await repo.competitors();
    // вчерашний снимок на ночь 2031-06-02: для сравнения
    expect(
      await repo.writeReadings(c!.id, '2031-06-01', [{ date: '2031-06-02', bp: 7000 }], 'MANUAL', audit),
    ).toBe(true);
    await repo.writeReadings(
      c!.id,
      '2031-06-02',
      [
        { date: '2031-06-02', bp: 8000 },
        { date: '2031-06-03', bp: 5000 },
      ],
      'AI_AGENT',
      audit,
    );
    await repo.writeReadings(c!.id, '2031-06-02', [{ date: '2031-06-02', bp: 8550 }], 'MANUAL', audit);
    await repo.writeReadings(c!.id, '2031-06-02', [{ date: '2031-06-03', bp: null }], 'MANUAL', audit);
    const rows = await repo.readings('2031-06-01', '2031-06-10', '2031-06-02');
    expect(rows.sort((a, b) => a.observedOn.localeCompare(b.observedOn))).toEqual([
      { competitorId: c!.id, stayDate: '2031-06-02', observedOn: '2031-06-01', occupancyBp: 7000, source: 'MANUAL' },
      { competitorId: c!.id, stayDate: '2031-06-02', observedOn: '2031-06-02', occupancyBp: 8550, source: 'MANUAL' },
    ]);
    // снимок «из будущего» относительно даты снимка не отдаётся
    expect(await repo.readings('2031-06-01', '2031-06-10', '2031-06-01')).toHaveLength(1);
    // история ночи: все дни снимка одной ночи по порядку (M1.2)
    expect((await repo.nightReadings('2031-06-02')).map((r) => [r.observedOn, r.occupancyBp])).toEqual([
      ['2031-06-01', 7000],
      ['2031-06-02', 8550],
    ]);

    expect(await repo.updateCompetitor(c!.id, { active: false }, audit)).toBe(true);
    expect(
      await repo.writeReadings(c!.id, '2031-06-02', [{ date: '2031-06-04', bp: 1 }], 'MANUAL', audit),
    ).toBe(false);
    // снимки архивного не попадают в таблицу, но остаются в базе
    expect(await repo.readings('2031-06-01', '2031-06-10', '2031-06-02')).toEqual([]);
    expect(await db.competitorOccupancy.count({ where: { competitorId: c!.id } })).toBe(2);
  });

  it('база отвергает: снимок к конкуренту чужого объекта (составной ключ) и загрузку вне 0…100 %', async () => {
    const org = await db.organization.create({ data: { name: 'Рынок чужие' }, select: { id: true } });
    const other = (
      await db.$transaction((tx) =>
        createPropertyInChain(tx, org.id, { name: 'Рынок чужие', ...NEW_PROPERTY_DEFAULTS }),
      )
    ).id;
    const foreign = await db.competitor.create({ data: { propertyId: other, name: 'Чужой сосед' } });
    await expect(
      db.competitorOccupancy.create({
        data: {
          propertyId,
          competitorId: foreign.id,
          stayDate: new Date('2031-06-02T00:00:00Z'),
          observedOn: new Date('2031-06-02T00:00:00Z'),
          occupancyBp: 5000,
        },
      }),
    ).rejects.toThrow();
    await expect(
      db.competitorOccupancy.create({
        data: {
          propertyId: other,
          competitorId: foreign.id,
          stayDate: new Date('2031-06-02T00:00:00Z'),
          observedOn: new Date('2031-06-02T00:00:00Z'),
          occupancyBp: 10001,
        },
      }),
    ).rejects.toThrow();
  });

  it('сборщик (M2a): видит конкурентов всех объектов, пишет AI_AGENT в объект конкурента, ручной ввод дня не трогает', async () => {
    const org = await db.organization.create({ data: { name: 'Рынок сборщик' }, select: { id: true } });
    const other = await db.$transaction((tx) =>
      createPropertyInChain(tx, org.id, { name: 'Рынок сборщик', ...NEW_PROPERTY_DEFAULTS }),
    );
    const mine = await repo.createCompetitor({ name: 'Сосед для сборщика' }, audit);
    const theirs = await db.competitor.create({ data: { propertyId: other.id, name: 'Сосед другого объекта' } });
    await db.competitor.create({ data: { propertyId: other.id, name: 'Убранный сосед', active: false } });

    const targets = await repo.collectorTargets();
    const names = targets.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(['Сосед для сборщика', 'Сосед другого объекта']));
    expect(names).not.toContain('Убранный сосед');
    const target = (await repo.collectorTarget(theirs.id))!;
    expect(target).toMatchObject({ propertyId: other.id, propertyName: 'Рынок сборщик' });
    expect(target.timezone).toBeTruthy();

    // человек сегодня уже внёс ночь 2031-07-02 у своего соседа
    await repo.writeReadings(mine, '2031-07-01', [{ date: '2031-07-02', bp: 9000 }], 'MANUAL', audit);
    const own = (await repo.collectorTarget(mine))!;
    const result = await repo.writeCollected(
      own,
      '2031-07-01',
      [
        { date: '2031-07-02', bp: 4000 },
        { date: '2031-07-03', bp: 6100 },
      ],
      { entityType: 'Competitor', entityId: mine, action: 'market.occupancy.collected', after: {} },
    );
    expect(result).toEqual({ saved: 1, kept: 1 });
    const rows = await db.competitorOccupancy.findMany({
      where: { competitorId: mine },
      orderBy: { stayDate: 'asc' },
      select: { propertyId: true, occupancyBp: true, source: true, createdById: true },
    });
    expect(rows).toEqual([
      { propertyId, occupancyBp: 9000, source: 'MANUAL', createdById: null },
      { propertyId, occupancyBp: 6100, source: 'AI_AGENT', createdById: null },
    ]);
    // повтор сборщика заменяет своё значение того же дня, а не добавляет второе
    await repo.writeCollected(own, '2031-07-01', [{ date: '2031-07-03', bp: 6300 }], {
      entityType: 'Competitor',
      entityId: mine,
      action: 'market.occupancy.collected',
      after: {},
    });
    expect(await db.competitorOccupancy.count({ where: { competitorId: mine } })).toBe(2);
    const log = await db.auditLog.findFirst({
      where: { entityType: 'Competitor', entityId: mine, action: 'market.occupancy.collected' },
      orderBy: { createdAt: 'asc' },
    });
    expect(log?.after).toMatchObject({ saved: 1, kept: 1 });

    // снимок другого объекта ложится в его объект
    await repo.writeCollected(target, '2031-07-01', [{ date: '2031-07-02', bp: 5000 }], {
      entityType: 'Competitor',
      entityId: theirs.id,
      action: 'market.occupancy.collected',
      after: {},
    });
    expect(
      await db.competitorOccupancy.findFirst({ where: { competitorId: theirs.id }, select: { propertyId: true } }),
    ).toEqual({ propertyId: other.id });
  });
});
