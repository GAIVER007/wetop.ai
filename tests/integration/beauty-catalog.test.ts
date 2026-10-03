import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { BeautyCatalogService } from '../../apps/api/src/beauty/beauty.module';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

/**
 * Каталог салона на настоящей схеме (DATA_MODEL §19.1, срез B3, ADR-139): услуги сети с ценой филиала,
 * мастера с умениями, права по решению Q-253 и чужое не трогается. Данные вымышленные (ADR-010).
 */
describe.skipIf(!url)('каталог салона (integration, DATA_MODEL §19.1)', () => {
  let db: Db;
  let service: BeautyCatalogService;

  const own = { org: randomUUID(), business: randomUUID(), location: randomUUID(), user: randomUUID() };
  const other = { org: randomUUID(), business: randomUUID(), location: randomUUID() };

  const as = <T>(role: 'OWNER' | 'STAFF', fn: () => Promise<T>) =>
    withSignedInUser(
      {
        userId: own.user,
        organizationId: own.org,
        role,
        scope: 'LOCATION',
        businessId: own.business,
        locationId: own.location,
      },
      fn,
    );

  async function seed(o: { org: string; business: string; location: string }, currency = 'KZT') {
    await db.$executeRawUnsafe(
      `INSERT INTO "organizations" ("id", "name") VALUES ('${o.org}', 'Сеть ${o.org.slice(0, 8)}')`,
    );
    await db.$executeRawUnsafe(
      `INSERT INTO "businesses" ("id", "organization_id", "name", "vertical", "updated_at")
       VALUES ('${o.business}', '${o.org}', 'Салон', 'BEAUTY', now())`,
    );
    await db.$executeRawUnsafe(
      `INSERT INTO "locations" ("id", "business_id", "name", "timezone", "currency", "updated_at")
       VALUES ('${o.location}', '${o.business}', 'Филиал', 'Asia/Almaty', '${currency}', now())`,
    );
  }

  async function cleanup() {
    const orgs = [own.org, other.org].map((v) => `'${v}'`).join(', ');
    const businesses = `SELECT "id" FROM "businesses" WHERE "organization_id" IN (${orgs})`;
    for (const stmt of [
      `DELETE FROM "employee_services" WHERE "employee_id" IN (SELECT "id" FROM "employees" WHERE "business_id" IN (${businesses}))`,
      `DELETE FROM "employee_locations" WHERE "employee_id" IN (SELECT "id" FROM "employees" WHERE "business_id" IN (${businesses}))`,
      `DELETE FROM "location_services" WHERE "service_id" IN (SELECT "id" FROM "beauty_services" WHERE "business_id" IN (${businesses}))`,
      `DELETE FROM "employees" WHERE "business_id" IN (${businesses})`,
      `DELETE FROM "beauty_services" WHERE "business_id" IN (${businesses})`,
      `DELETE FROM "audit_logs" WHERE "organization_id" IN (${orgs})`,
      `DELETE FROM "locations" WHERE "business_id" IN (${businesses})`,
      `DELETE FROM "businesses" WHERE "organization_id" IN (${orgs})`,
      `DELETE FROM "organizations" WHERE "id" IN (${orgs})`,
      `DELETE FROM "users" WHERE "id" = '${own.user}'`,
    ])
      await db.$executeRawUnsafe(stmt).catch(() => undefined);
  }

  beforeAll(async () => {
    db = createPrismaClient(url);
    service = new BeautyCatalogService({ db } as unknown as PrismaService);
    await cleanup();
    await seed(own);
    await seed(other, 'AED');
    await db.$executeRawUnsafe(
      `INSERT INTO "users" ("id", "email", "name") VALUES ('${own.user}', 'owner-${own.user}@example.invalid', 'Владелец')`,
    );
  });

  afterAll(async () => {
    if (!db) return;
    await cleanup();
    await db.$disconnect();
  });

  let serviceId = '';
  let employeeId = '';

  it('услуга каталога создаётся и попадает в список своего бизнеса', async () => {
    const created = await as('OWNER', () =>
      service.createService({
        name: 'Маникюр',
        category: 'Ногти',
        durationMinutes: 60,
        priceMinor: '800000',
        currency: 'KZT',
      }),
    );
    serviceId = created.id;
    expect(created.priceMinor).toBe('800000');
    const { items } = await as('STAFF', () => service.services());
    expect(items.map((i) => i.name)).toEqual(['Маникюр']);
    // услуга не включена филиалом: действующей цены нет
    expect(items[0]?.effective).toEqual({ sellable: false, reason: 'NOT_ENABLED' });
  });

  it('филиал включает услугу: появляется действующая цена каталога', async () => {
    const { items } = await as('OWNER', () =>
      service.setLocationService(serviceId, { enabled: true }),
    );
    expect(items[0]?.effective).toEqual({
      sellable: true,
      priceMinor: '800000',
      currency: 'KZT',
      durationMinutes: 60,
      overridden: false,
    });
  });

  it('филиал ставит свою цену и длительность', async () => {
    const { items } = await as('OWNER', () =>
      service.setLocationService(serviceId, {
        enabled: true,
        priceOverrideMinor: '950000',
        durationOverrideMinutes: 90,
      }),
    );
    expect(items[0]?.effective).toMatchObject({
      sellable: true,
      priceMinor: '950000',
      durationMinutes: 90,
      overridden: true,
    });
  });

  it('администратор смены каталог читает, но не правит (Q-253)', async () => {
    await expect(
      as('STAFF', () => service.createService({ name: 'Стрижка', durationMinutes: 30, priceMinor: '1', currency: 'KZT' })),
    ).rejects.toThrow(/доступ|владелец|управляющ/i);
    await expect(as('STAFF', () => service.services())).resolves.toBeTruthy();
  });

  it('мастер создаётся и сразу работает в выбранном филиале', async () => {
    const created = await as('OWNER', () => service.createEmployee({ name: 'Дина', phone: '+7 701 000 00 00' }));
    employeeId = created.id;
    expect(created.locationIds).toEqual([own.location]);
    expect(created.active).toBe(true);
  });

  it('умения мастера ставятся списком, чужая услуга отклоняется', async () => {
    const updated = await as('OWNER', () =>
      service.setEmployeeServices(employeeId, { serviceIds: [serviceId] }),
    );
    expect(updated.serviceIds).toEqual([serviceId]);
    const foreign = await db.beautyService.create({
      data: {
        id: randomUUID(),
        businessId: other.business,
        name: 'Чужая услуга',
        durationMinutes: 30,
        price: 1n,
        currency: 'AED',
        updatedAt: new Date(),
      },
      select: { id: true },
    });
    await expect(
      as('OWNER', () => service.setEmployeeServices(employeeId, { serviceIds: [foreign.id] })),
    ).rejects.toThrow(/чужая/i);
  });

  it('мастер уходит в архив правкой, не удалением', async () => {
    const archived = await as('OWNER', () => service.updateEmployee(employeeId, { active: false }));
    expect(archived.active).toBe(false);
    expect(await db.employee.count({ where: { id: employeeId } })).toBe(1);
  });

  it('чужая услуга и чужой мастер не находятся по id', async () => {
    const foreign = await db.beautyService.findFirstOrThrow({
      where: { businessId: other.business },
      select: { id: true },
    });
    await expect(as('OWNER', () => service.updateService(foreign.id, { name: 'Переименую' }))).rejects.toThrow(
      /не найдена/i,
    );
  });

  it('создание и правка пишутся в журнал', async () => {
    const actions = await db.auditLog.findMany({
      where: { organizationId: own.org },
      select: { action: true },
    });
    expect(new Set(actions.map((a) => a.action))).toEqual(
      new Set([
        'beauty.service.created',
        'beauty.location_service.set',
        'beauty.employee.created',
        'beauty.employee.services.set',
        'beauty.employee.updated',
      ]),
    );
  });
});
