import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { PrismaCabinetRepository } from '../../apps/api/src/platform/cabinet.repository';
import { PrismaGrowthRepository } from '../../apps/api/src/platform/growth.controller';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

/**
 * Один кабинет руководителя у всех главных администраторов (владелец 29.10.2026). На настоящей базе: запись
 * компании «WETOP (сайт)» с сайтом wetop.ai не клиент, а организация смотрящего (бизнес Вячеслава) клиент.
 * Без записи компании по-старому: своя организация смотрящего не клиент. Всё вымышленное, убирается за собой.
 */
describe.skipIf(!url)('кабинет руководителя: кто клиент (integration, DATABASE_URL required)', () => {
  let db: Db;
  const mark = Date.now().toString(36);
  const ids: { org: string[]; biz: string[]; loc: string[]; site: string[] } = { org: [], biz: [], loc: [], site: [] };
  const prisma = () => ({ db }) as unknown as PrismaService;

  async function org(name: string) {
    const o = await db.organization.create({ data: { name: `${name} ${mark}`, status: 'ACTIVE', reportingCurrency: 'USD' } });
    ids.org.push(o.id);
    return o.id;
  }
  async function companySite(organizationId: string) {
    // так же, как миграция 170: бизнес, филиал wetop.ai и сайт счётчика с адресами wetop.ai
    const b = await db.business.create({ data: { organizationId, name: `WETOP site ${mark}`, vertical: 'HOSPITALITY' } });
    ids.biz.push(b.id);
    const l = await db.location.create({ data: { businessId: b.id, name: `wetop.ai ${mark}`, timezone: 'UTC', currency: 'USD' } });
    ids.loc.push(l.id);
    const s = await db.trackedSite.create({ data: { locationId: l.id, name: 'wetop.ai', hosts: ['wetop.ai', 'www.wetop.ai'], publicKey: `pms_${mark.padStart(12, '0').slice(-12)}` } });
    ids.site.push(s.id);
  }

  beforeAll(async () => {
    db = createPrismaClient(url!);
    // в тестовой базе могла остаться настоящая запись wetop.ai другой проверки: тест про её наличие и отсутствие
    const other = await db.trackedSite.count({ where: { hosts: { hasSome: ['wetop.ai', 'www.wetop.ai'] } } });
    if (other > 0) throw new Error('в тестовой базе уже есть сайт wetop.ai: тест его не трогает, нужна чистая база');
  });
  afterAll(async () => {
    if (!db) return;
    await db.trackedSite.deleteMany({ where: { id: { in: ids.site } } });
    await db.location.deleteMany({ where: { id: { in: ids.loc } } });
    await db.business.deleteMany({ where: { id: { in: ids.biz } } });
    await db.organization.deleteMany({ where: { id: { in: ids.org } } });
    await db.$disconnect();
  });

  it('без записи компании своя организация смотрящего не клиент; с записью клиент, а запись компании нет', async () => {
    const luxx = await org('Luxx');
    const kyial = await org('Kyial');
    const cabinet = new PrismaCabinetRepository(prisma());
    const growth = new PrismaGrowthRepository(prisma());
    const before = await cabinet.source({ since30d: new Date(Date.now() - 30 * 86_400_000), ownOrganizationId: luxx });
    expect(before.ownOrganizationId).toBe(luxx);

    const wetop = await org('WETOP (сайт)');
    await companySite(wetop);
    const after = await cabinet.source({ since30d: new Date(Date.now() - 30 * 86_400_000), ownOrganizationId: luxx });
    expect(after.ownOrganizationId).toBeNull();
    const names = after.organizations.map((o) => o.id);
    expect(names).toContain(luxx);
    expect(names).toContain(kyial);
    expect(names).not.toContain(wetop);
    const g = await growth.source(luxx, new Date(Date.now() - 200 * 86_400_000));
    expect(g.ownOrganizationId).toBeNull();
    expect(g.organizations.map((o) => o.id)).toContain(luxx);
    expect(g.organizations.map((o) => o.id)).not.toContain(wetop);
  });
});
