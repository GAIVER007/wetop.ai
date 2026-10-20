import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, createPropertyInChain, type Db } from '@pms/database';
import { PrismaMarketingBudgetRepository } from '../../apps/api/src/marketing-budget/marketing-budget.repository';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { purgeAuditRows } from '../tools/audit-purge';
import { deleteOrganizationChain } from '../tools/property-owner';

const url = process.env.DATABASE_URL;

/**
 * План бюджета по каналам (DATA_MODEL §52, ADR-MKT-B7) на настоящей базе: разбивка месяца заменяется целиком
 * одной транзакцией вместе с записью журнала; соседний месяц не трогается; отвергнутая базой строка откатывает
 * замену, прежняя разбивка остаётся. Данные вымышленные (ADR-010).
 */
describe.skipIf(!url)('план по каналам (integration)', () => {
  let db: Db;
  let repo: PrismaMarketingBudgetRepository;
  const org = randomUUID();
  let locationId = '';
  const audit = (tag: string) => ({ entityType: 'marketing_budget', action: 'marketing_budget.lines_set', after: { org, tag } });
  const month = async (first: string, prevFirst = '2026-09-01') => {
    const next = `${first.slice(0, 5)}${String(Number(first.slice(5, 7)) + 1).padStart(2, '0')}-01`;
    return repo.monthData(locationId, first, next, prevFirst);
  };

  beforeAll(async () => {
    db = createPrismaClient(url);
    await db.organization.create({ data: { id: org, name: `План каналов ${org}` } });
    const property = await createPropertyInChain(db, org, {
      name: `План каналов ${org}`,
      timezone: 'Asia/Almaty',
      currency: 'KZT',
      checkInTime: '14:00',
      checkOutTime: '12:00',
    });
    locationId = (await db.property.findUniqueOrThrow({ where: { id: property.id }, select: { locationId: true } })).locationId;
    repo = new PrismaMarketingBudgetRepository({ db } as PrismaService);
  });

  afterAll(async () => {
    if (!db) return;
    await purgeAuditRows(db, { action: 'marketing_budget.lines_set', after: { path: ['org'], equals: org } });
    await db.marketingBudgetLine.deleteMany({ where: { locationId } });
    await db.property.deleteMany({ where: { organizationId: org } });
    await deleteOrganizationChain(db, [org]);
    await db.organization.deleteMany({ where: { id: org } });
    await db.$disconnect();
  });

  it('замена целиком, соседний месяц цел, прошлый месяц виден для копирования; сбой откатывает замену', async () => {
    await repo.setLines(locationId, '2026-09-01', [{ platform: 'GOOGLE', amount: 50000n }], audit('sep'));
    await repo.setLines(locationId, '2026-10-01', [{ platform: 'META', amount: 100000n }, { platform: 'SITE', amount: 300000n }], audit('oct-1'));
    await repo.setLines(locationId, '2026-10-01', [{ platform: 'META', amount: 200000n }], audit('oct-2'));
    const oct = await month('2026-10-01');
    expect(oct.lines).toEqual([{ platform: 'META', amount: 200000n }]);
    expect(oct.prevLines).toEqual([{ platform: 'GOOGLE', amount: 50000n }]);

    // сумма ноль нарушает CHECK: удаление прежней разбивки в той же транзакции откатывается
    await expect(
      repo.setLines(locationId, '2026-10-01', [{ platform: 'TIKTOK', amount: 0n }], audit('broken')),
    ).rejects.toThrow();
    expect((await month('2026-10-01')).lines).toEqual([{ platform: 'META', amount: 200000n }]);

    // пустая разбивка убирает каналы месяца
    await repo.setLines(locationId, '2026-10-01', [], audit('oct-3'));
    expect((await month('2026-10-01')).lines).toEqual([]);
    expect(await db.auditLog.count({ where: { action: 'marketing_budget.lines_set', after: { path: ['org'], equals: org } } })).toBe(4);
  });
});
