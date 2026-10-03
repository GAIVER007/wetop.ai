import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { BranchesService } from '../../apps/api/src/hotel/branches';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

/**
 * Филиал салона на настоящей схеме (DATA_MODEL §19, срез B2, решения Q-254 и Q-256, ADR-140):
 * цепочка Organization → Business (BEAUTY) → Location, объекта нет, повтор запроса салонов не плодит,
 * список отдаёт оба вида филиалов. Данные вымышленные (ADR-010), после прогона удаляются.
 */
describe.skipIf(!url)('филиал салона (integration, DATA_MODEL §19)', () => {
  let db: Db;
  let service: BranchesService;
  const organizationId = randomUUID();
  const salonId = randomUUID();
  // журнал ссылается на настоящего человека: нужен ряд в users (вымышленный, ADR-010)
  const userId = randomUUID();

  const asOwner = <T>(fn: () => Promise<T>) =>
    withSignedInUser({ userId, organizationId, role: 'OWNER' }, fn);

  const input = {
    id: salonId,
    name: 'Студия Айна',
    address: 'Алматы, Абая 1',
    currency: 'KZT',
    timezone: 'Asia/Almaty',
    vertical: 'BEAUTY',
  };

  async function cleanup() {
    for (const stmt of [
      `DELETE FROM "audit_logs" WHERE "organization_id" = '${organizationId}'`,
      `DELETE FROM "locations" WHERE "business_id" IN (SELECT "id" FROM "businesses" WHERE "organization_id" = '${organizationId}')`,
      `DELETE FROM "businesses" WHERE "organization_id" = '${organizationId}'`,
      `DELETE FROM "organizations" WHERE "id" = '${organizationId}'`,
      `DELETE FROM "users" WHERE "id" = '${userId}'`,
    ])
      await db.$executeRawUnsafe(stmt).catch(() => undefined);
  }

  beforeAll(async () => {
    db = createPrismaClient(url);
    service = new BranchesService({ db } as unknown as PrismaService);
    await cleanup();
    await db.$executeRawUnsafe(
      `INSERT INTO "organizations" ("id", "name") VALUES ('${organizationId}', 'Сеть салонов Тест')`,
    );
    await db.$executeRawUnsafe(
      `INSERT INTO "users" ("id", "email", "name") VALUES ('${userId}', 'salon-${userId}@example.invalid', 'Владелец сети')`,
    );
  });

  afterAll(async () => {
    if (!db) return;
    await cleanup();
    await db.$disconnect();
  });

  it('создаёт бизнес BEAUTY и филиал, объекта не создаёт', async () => {
    const created = await asOwner(() => service.create(input));
    expect(created.vertical).toBe('BEAUTY');
    expect(created.id).toBe(salonId);
    expect(created._count.inventoryUnits).toBe(0);

    const business = await db.business.findFirstOrThrow({
      where: { organizationId },
      select: { id: true, vertical: true, name: true },
    });
    expect(business.vertical).toBe('BEAUTY');
    expect(business.name).toBe('Сеть салонов Тест');

    const location = await db.location.findFirstOrThrow({
      where: { id: salonId },
      select: { businessId: true, name: true, currency: true, timezone: true, property: true },
    });
    expect(location.businessId).toBe(business.id);
    expect(location.name).toBe('Студия Айна');
    expect(location.property).toBeNull();

    expect(await db.property.count({ where: { organizationId } })).toBe(0);
  });

  it('повтор того же запроса возвращает тот же филиал и не плодит салоны', async () => {
    const again = await asOwner(() => service.create(input));
    expect(again.id).toBe(salonId);
    expect(await db.location.count({ where: { business: { organizationId } } })).toBe(1);
    expect(await db.business.count({ where: { organizationId } })).toBe(1);
  });

  it('тот же запрос с другими данными отклоняется, молча не перезаписывает', async () => {
    await expect(asOwner(() => service.create({ ...input, name: 'Другое имя' }))).rejects.toThrow(
      /уже сохранён/i,
    );
  });

  it('создание салона пишется в журнал', async () => {
    const log = await db.auditLog.findFirstOrThrow({
      where: { organizationId, action: 'location.salon_created' },
      select: { entityType: true, entityId: true },
    });
    expect(log.entityType).toBe('location');
    expect(log.entityId).toBe(salonId);
  });

  it('список филиалов отдаёт салон с его направлением', async () => {
    const { items } = await asOwner(() => service.list());
    const salon = items.find((item) => item.id === salonId);
    expect(salon?.vertical).toBe('BEAUTY');
    expect(salon?.locationId).toBe(salonId);
    expect(items.every((item) => item.vertical === 'BEAUTY' || item.vertical === 'HOSPITALITY')).toBe(
      true,
    );
  });

  it('второй салон той же организации берёт тот же бизнес', async () => {
    const second = randomUUID();
    await asOwner(() => service.create({ ...input, id: second, name: 'Студия Айна на Сайране' }));
    expect(await db.business.count({ where: { organizationId } })).toBe(1);
    expect(await db.location.count({ where: { business: { organizationId } } })).toBe(2);
  });
});
