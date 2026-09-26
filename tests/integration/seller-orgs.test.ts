import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { PrismaSellerOrgsRepository } from '../../apps/api/src/ai-seller/seller.repository';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

/**
 * Гостиницы для сверки с продавцом (Э4, ADR-083): организации со строкой расширения «ИИ-продавец» — любым статусом
 * (погашенное тоже уходит продавцу, active=false гасит виджет, Q-183) — и домены действующих сайтов организации.
 * Проверяются сами запросы Prisma: подставные хранилища такое не ловят. Всё вымышленное (ADR-010), убирается за собой.
 */
describe.skipIf(!url)('гостиницы продавца (integration, DATABASE_URL required)', () => {
  let db: Db;
  let repo: PrismaSellerOrgsRepository;
  const mark = Date.now().toString(36);
  const orgA = randomUUID();
  const orgB = randomUUID();
  const orgNoExt = randomUUID();
  const propertyId = randomUUID();

  beforeAll(async () => {
    db = createPrismaClient(url);
    repo = new PrismaSellerOrgsRepository({ db } as PrismaService);
    await db.organization.createMany({
      data: [
        { id: orgA, name: `Продавец-гостиница А ${mark}` },
        { id: orgB, name: `Продавец-гостиница Б ${mark}` },
        { id: orgNoExt, name: `Без расширения ${mark}` },
      ],
    });
    const now = new Date('2026-09-25T09:00:00.000Z');
    await db.organizationExtension.createMany({
      data: [
        { organizationId: orgA, extension: 'AI_SELLER', status: 'ACTIVE', updatedAt: now },
        { organizationId: orgB, extension: 'AI_SELLER', status: 'OFF', updatedAt: now },
      ],
    });
    await db.property.create({
      data: {
        id: propertyId,
        organizationId: orgA,
        name: `TEST seller orgs ${mark}`,
        timezone: 'Asia/Almaty',
        currency: 'KZT',
        checkInTime: '14:00',
        checkOutTime: '12:00',
      },
    });
    await db.trackedSite.createMany({
      data: [
        {
          propertyId,
          name: 'Основной сайт',
          hosts: ['hotel-a.example.invalid', 'www.hotel-a.example.invalid'],
          publicKey: `pms_a${mark}`.slice(0, 16),
          status: 'ACTIVE',
        },
        {
          propertyId,
          name: 'Второй сайт',
          // повтор домена: список выходит без дублей
          hosts: ['hotel-a.example.invalid', 'promo.hotel-a.example.invalid'],
          publicKey: `pms_b${mark}`.slice(0, 16),
          status: 'ACTIVE',
        },
        {
          propertyId,
          name: 'Старый сайт',
          hosts: ['staryy.hotel-a.example.invalid'],
          publicKey: `pms_c${mark}`.slice(0, 16),
          // единственный не-ACTIVE статус сайта: с него виджет не открывают
          status: 'PAUSED',
        },
      ],
    });
  });

  afterAll(async () => {
    if (!db) return;
    await db.trackedSite.deleteMany({ where: { propertyId } });
    await db.property.deleteMany({ where: { id: propertyId } });
    await db.organizationExtension.deleteMany({
      where: { organizationId: { in: [orgA, orgB, orgNoExt] } },
    });
    await db.organization.deleteMany({ where: { id: { in: [orgA, orgB, orgNoExt] } } });
    await db.$disconnect();
  });

  it('withExtension: организации со строкой расширения любым статусом; без строки — не в списке', async () => {
    const rows = await repo.withExtension();
    // string[]: randomUUID типизирован шаблонной строкой, и без расширения includes(string) не сходится
    const ours: string[] = [orgA, orgB, orgNoExt];
    const mine = rows.filter((r) => ours.includes(r.organizationId));
    expect(mine.map((r) => r.organizationId).sort()).toEqual([orgA, orgB].sort());
    expect(mine.find((r) => r.organizationId === orgA)?.name).toBe(`Продавец-гостиница А ${mark}`);
  });

  it('one: организация по идентификатору, чужой — null', async () => {
    expect(await repo.one(orgA)).toEqual({
      organizationId: orgA,
      name: `Продавец-гостиница А ${mark}`,
    });
    expect(await repo.one(randomUUID())).toBeNull();
  });

  it('hosts: домены действующих сайтов организации, без дублей; приостановленный сайт не считается', async () => {
    expect(await repo.hosts(orgA)).toEqual([
      'hotel-a.example.invalid',
      'www.hotel-a.example.invalid',
      'promo.hotel-a.example.invalid',
    ]);
    expect(await repo.hosts(orgB)).toEqual([]);
  });
});
