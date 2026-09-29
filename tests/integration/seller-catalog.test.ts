import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, createPropertyInChain, type Db } from '@pms/database';
import { deleteOrganizationChain } from '../tools/property-owner';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { PrismaSellerCatalogRepository } from '../../apps/api/src/ai-seller/seller.repository';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

/**
 * Каталог AI-агентов (SA1, plans/business-ai-seller-v2-2026-09-29.md §8): проверяются сами запросы Prisma, которые
 * подставное хранилище не ловит. Расположение — Business и Location самого раннего объекта организации (то же правило,
 * что у фактов продавца); черновики — только своей организации. Всё вымышленное (ADR-010), тест убирает за собой.
 */
describe.skipIf(!url)('каталог AI-агентов (integration, DATABASE_URL required)', () => {
  let db: Db;
  let repo: PrismaSellerCatalogRepository;
  const mark = Date.now().toString(36);
  const orgA = randomUUID();
  const orgB = randomUUID();
  const orgEmpty = randomUUID();
  const userId = randomUUID();
  const firstProperty = randomUUID();
  const secondProperty = randomUUID();
  const propertyB = randomUUID();
  const base = {
    timezone: 'Asia/Almaty',
    currency: 'KZT',
    checkInTime: '14:00',
    checkOutTime: '12:00',
  };

  beforeAll(async () => {
    db = createPrismaClient(url);
    repo = new PrismaSellerCatalogRepository({ db } as PrismaService);
    await db.organization.createMany({
      data: [
        { id: orgA, name: `Каталог-сеть А ${mark}` },
        { id: orgB, name: `Каталог-сеть Б ${mark}` },
        { id: orgEmpty, name: `Каталог без объекта ${mark}` },
      ],
    });
    await createPropertyInChain(db, orgA, { id: firstProperty, name: `Первый филиал ${mark}`, ...base });
    // второй объект позже первого: продавец пользуется самым ранним
    await new Promise((done) => setTimeout(done, 20));
    await createPropertyInChain(db, orgA, { id: secondProperty, name: `Второй филиал ${mark}`, ...base });
    await createPropertyInChain(db, orgB, { id: propertyB, name: `Филиал Б ${mark}`, ...base });
    await db.user.create({ data: { id: userId, email: `seller-catalog-${mark}@example.invalid` } });
    await db.sellerAgent.createMany({
      data: [
        { organizationId: orgA, createdBy: userId, name: `Черновик А1 ${mark}` },
        { organizationId: orgA, createdBy: userId, name: `Черновик А2 ${mark}` },
        { organizationId: orgB, createdBy: userId, name: `Черновик Б1 ${mark}` },
      ],
    });
  });

  afterAll(async () => {
    if (!db) return;
    await db.sellerAgent.deleteMany({ where: { createdBy: userId } });
    await db.user.deleteMany({ where: { id: userId } });
    await db.property.deleteMany({ where: { id: { in: [firstProperty, secondProperty, propertyB] } } });
    await deleteOrganizationChain(db, [orgA, orgB]);
    await db.organization.deleteMany({ where: { id: { in: [orgA, orgB, orgEmpty] } } });
    await db.$disconnect();
  });

  it('placement: Business и Location самого раннего объекта организации', async () => {
    const place = await repo.placement(orgA);
    expect(place?.location.name).toBe(`Первый филиал ${mark}`);
    expect(place?.business.name).toBe(`Каталог-сеть А ${mark}`);
    const location = await db.location.findUniqueOrThrow({ where: { id: place!.location.id } });
    expect(location.businessId).toBe(place!.business.id);
  });

  it('placement: чужой объект не попадает, у организации без объекта — null', async () => {
    const place = await repo.placement(orgB);
    expect(place?.location.name).toBe(`Филиал Б ${mark}`);
    expect(place?.business.name).toBe(`Каталог-сеть Б ${mark}`);
    expect(await repo.placement(orgEmpty)).toBeNull();
    expect(await repo.placement(randomUUID())).toBeNull();
  });

  it('drafts: только своей организации, предел работает', async () => {
    const own = await repo.drafts(orgA, 50);
    expect(own.map((d) => d.name).sort()).toEqual([`Черновик А1 ${mark}`, `Черновик А2 ${mark}`]);
    expect((await repo.drafts(orgA, 1)).length).toBe(1);
    expect((await repo.drafts(orgB, 50)).map((d) => d.name)).toEqual([`Черновик Б1 ${mark}`]);
    expect(await repo.drafts(orgEmpty, 50)).toEqual([]);
  });
});
