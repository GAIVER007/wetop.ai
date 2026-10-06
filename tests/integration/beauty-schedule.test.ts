import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { ConflictException } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { BeautyCatalogService } from '../../apps/api/src/beauty/beauty.module';
import { BeautyScheduleService } from '../../apps/api/src/beauty/schedule';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

/**
 * График мастера и отсутствия на настоящей схеме (DATA_MODEL §19.1, Q-251, срез B4): недельный шаблон
 * на филиал, отсутствия на сеть, перестановка мастера между филиалами и права по Q-253.
 * Данные вымышленные (ADR-010).
 */
describe.skipIf(!url)('график мастера (integration, DATA_MODEL §19.1)', () => {
  let db: Db;
  let catalog: BeautyCatalogService;
  let service: BeautyScheduleService;

  const own = {
    org: randomUUID(),
    business: randomUUID(),
    location: randomUUID(),
    second: randomUUID(),
    user: randomUUID(),
  };
  const other = {
    org: randomUUID(),
    business: randomUUID(),
    location: randomUUID(),
    employee: randomUUID(),
  };

  const at = <T>(locationId: string, role: 'OWNER' | 'STAFF', fn: () => Promise<T>) =>
    withSignedInUser(
      {
        userId: own.user,
        organizationId: own.org,
        role,
        scope: 'LOCATION',
        vertical: 'BEAUTY',
        businessId: own.business,
        locationId,
      },
      fn,
    );
  const as = <T>(role: 'OWNER' | 'STAFF', fn: () => Promise<T>) => at(own.location, role, fn);

  async function seedOrg(o: { org: string; business: string; location: string }) {
    await db.$executeRawUnsafe(
      `INSERT INTO "organizations" ("id", "name", "status") VALUES ('${o.org}', 'Сеть ${o.org.slice(0, 8)}', 'ACTIVE')`,
    );
    await db.$executeRawUnsafe(
      `INSERT INTO "businesses" ("id", "organization_id", "name", "vertical", "updated_at")
       VALUES ('${o.business}', '${o.org}', 'Салон', 'BEAUTY', now())`,
    );
    await seedLocation(o.business, o.location, 'Первый');
  }

  async function seedLocation(business: string, id: string, name: string) {
    await db.$executeRawUnsafe(
      `INSERT INTO "locations" ("id", "business_id", "name", "timezone", "currency", "updated_at")
       VALUES ('${id}', '${business}', '${name}', 'Asia/Almaty', 'KZT', now())`,
    );
  }

  async function cleanup() {
    const orgs = [own.org, other.org].map((v) => `'${v}'`).join(', ');
    const businesses = `SELECT "id" FROM "businesses" WHERE "organization_id" IN (${orgs})`;
    const employees = `SELECT "id" FROM "employees" WHERE "business_id" IN (${businesses})`;
    for (const stmt of [
      `DELETE FROM "appointments" WHERE "employee_id" IN (${employees})`,
      `DELETE FROM "time_offs" WHERE "employee_id" IN (${employees})`,
      `DELETE FROM "working_hours" WHERE "employee_id" IN (${employees})`,
      `DELETE FROM "employee_services" WHERE "employee_id" IN (${employees})`,
      `DELETE FROM "employee_locations" WHERE "employee_id" IN (${employees})`,
      `DELETE FROM "location_services" WHERE "service_id" IN (SELECT "id" FROM "beauty_services" WHERE "business_id" IN (${businesses}))`,
      `DELETE FROM "customer_businesses" WHERE "business_id" IN (${businesses})`,
      `DELETE FROM "customers" WHERE "organization_id" IN (${orgs})`,
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

  let employeeId = '';
  let serviceId = '';
  const customerId = randomUUID();

  beforeAll(async () => {
    db = createPrismaClient(url);
    const prisma = { db } as unknown as PrismaService;
    catalog = new BeautyCatalogService(prisma);
    service = new BeautyScheduleService(prisma);
    await cleanup();
    await seedOrg(own);
    await seedLocation(own.business, own.second, 'Второй');
    await seedOrg(other);
    await db.$executeRawUnsafe(
      `INSERT INTO "users" ("id", "email", "name") VALUES ('${own.user}', 'owner-${own.user}@example.invalid', 'Владелец')`,
    );
    await db.$executeRawUnsafe(
      `INSERT INTO "customers" ("id", "organization_id", "first_name", "last_name", "updated_at")
       VALUES ('${customerId}', '${own.org}', 'Пробная', 'Клиентова', now())`,
    );
    // мастер соседней организации: проверяем, что его не видно и не тронуть
    await db.$executeRawUnsafe(
      `INSERT INTO "employees" ("id", "business_id", "name", "updated_at")
       VALUES ('${other.employee}', '${other.business}', 'Чужая Мастерица', now())`,
    );

    const created = await as('OWNER', () => catalog.createEmployee({ name: 'Дина' }));
    employeeId = created.id;
    const svc = await as('OWNER', () =>
      catalog.createService({ name: 'Маникюр', durationMinutes: 60, priceMinor: '800000', currency: 'KZT' }),
    );
    serviceId = svc.id;
    await as('OWNER', () => catalog.setLocationService(serviceId, { enabled: true }));
  });

  afterAll(async () => {
    if (!db) return;
    await cleanup();
    await db.$disconnect();
  });

  /** Запись мастера прямо в базу: срез B5 её ещё не умеет, а наложение проверять надо уже сейчас */
  async function seedAppointment(startsAt: string, locationId = own.location) {
    const id = randomUUID();
    await db.$executeRawUnsafe(
      `INSERT INTO "appointments"
         ("id", "location_id", "customer_id", "employee_id", "service_id", "starts_at", "ends_at",
          "price", "currency", "updated_at")
       VALUES ('${id}', '${locationId}', '${customerId}', '${employeeId}', '${serviceId}',
          '${startsAt}', ('${startsAt}'::timestamptz + interval '1 hour'), 800000, 'KZT', now())`,
    );
    return id;
  }

  it('неделя мастера сохраняется и читается по филиалу', async () => {
    const saved = await as('OWNER', () =>
      service.setWorkingHours(employeeId, {
        intervals: [
          { weekday: 1, timeFrom: '9:00', timeTo: '13:00' },
          { weekday: 1, timeFrom: '14:00', timeTo: '20:00' },
          { weekday: 3, timeFrom: '10:00', timeTo: '18:00' },
        ],
      }),
    );
    expect(saved.week.map((d) => d.weekday)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(saved.week[0]?.intervals).toEqual([
      { timeFrom: '09:00', timeTo: '13:00' },
      { timeFrom: '14:00', timeTo: '20:00' },
    ]);

    const view = await as('STAFF', () => service.overview(employeeId));
    expect(view.employee?.name).toBe('Дина');
    expect(view.location?.timezone).toBe('Asia/Almaty');
    expect(view.week[2]?.intervals).toEqual([{ timeFrom: '10:00', timeTo: '18:00' }]);
  });

  it('повторная отправка заменяет неделю, а не копит интервалы', async () => {
    const saved = await as('OWNER', () =>
      service.setWorkingHours(employeeId, { intervals: [{ weekday: 5, timeFrom: '11:00', timeTo: '19:00' }] }),
    );
    expect(saved.week.flatMap((d) => d.intervals)).toEqual([{ timeFrom: '11:00', timeTo: '19:00' }]);
  });

  it('наложение интервалов в одном дне не проходит', async () => {
    await expect(
      as('OWNER', () =>
        service.setWorkingHours(employeeId, {
          intervals: [
            { weekday: 2, timeFrom: '09:00', timeTo: '14:00' },
            { weekday: 2, timeFrom: '13:00', timeTo: '18:00' },
          ],
        }),
      ),
    ).rejects.toThrow(/накладываются/i);
  });

  it('в филиале, где мастер не работает, график не поставить', async () => {
    // отказ должен быть внятным 409 от сервиса, а не сырой ошибкой триггера базы: он тоже запрещает это,
    // но человеку в ответ уходит ошибка драйвера, а транзакция падает уже начатой
    const call = at(own.second, 'OWNER', () =>
      service.setWorkingHours(employeeId, { intervals: [{ weekday: 1, timeFrom: '09:00', timeTo: '18:00' }] }),
    );
    await expect(call).rejects.toThrow(ConflictException);
    await expect(call).rejects.toThrow(/не работает/i);
  });

  it('без права property график не меняется, а читается', async () => {
    await expect(
      as('STAFF', () =>
        service.setWorkingHours(employeeId, { intervals: [{ weekday: 1, timeFrom: '09:00', timeTo: '18:00' }] }),
      ),
    ).rejects.toThrow(/доступ|владелец|управляющ/i);
    await expect(as('STAFF', () => service.overview(employeeId))).resolves.toBeTruthy();
  });

  it('отсутствие считает наложенные записи, но их не отменяет', async () => {
    const appointment = await seedAppointment('2026-11-10T06:00:00Z');
    const added = await as('OWNER', () =>
      service.addTimeOff(employeeId, { dateFrom: '2026-11-10', dateTo: '2026-11-12', reason: 'отпуск' }),
    );
    expect(added.affected).toBe(1);
    expect(added.timeOffs).toEqual([
      expect.objectContaining({ dateFrom: '2026-11-10', dateTo: '2026-11-12', reason: 'отпуск', appointments: 1 }),
    ]);
    const [row] = await db.$queryRawUnsafe<Array<{ status: string }>>(
      `SELECT "status"::text AS status FROM "appointments" WHERE "id" = '${appointment}'`,
    );
    expect(row?.status).toBe('BOOKED');
  });

  it('отсутствие снимается', async () => {
    const list = await as('OWNER', () => service.overview(employeeId));
    const id = list.timeOffs[0]?.id ?? '';
    const after = await as('OWNER', () => service.removeTimeOff(employeeId, id));
    expect(after.timeOffs).toEqual([]);
  });

  it('прошлое отсутствие в списке не висит', async () => {
    await as('OWNER', () => service.addTimeOff(employeeId, { dateFrom: '2026-01-05', dateTo: '2026-01-06' }));
    const view = await as('OWNER', () => service.overview(employeeId));
    expect(view.timeOffs).toEqual([]);
  });

  it('мастер ставится во второй филиал и работает в обоих', async () => {
    const view = await as('OWNER', () =>
      service.setLocations(employeeId, { locationIds: [own.location, own.second] }),
    );
    expect(view.employee?.locationIds?.slice().sort()).toEqual([own.location, own.second].sort());
    expect(view.locations.filter((l) => l.assigned)).toHaveLength(2);
  });

  it('снятый филиал уносит свой график, график другого остаётся', async () => {
    await at(own.second, 'OWNER', () =>
      service.setWorkingHours(employeeId, { intervals: [{ weekday: 4, timeFrom: '12:00', timeTo: '16:00' }] }),
    );
    await as('OWNER', () => service.setLocations(employeeId, { locationIds: [own.location] }));
    const rows = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT count(*) AS count FROM "working_hours" WHERE "employee_id" = '${employeeId}' AND "location_id" = '${own.second}'`,
    );
    expect(Number(rows[0]?.count)).toBe(0);
    const stay = await as('OWNER', () => service.overview(employeeId));
    expect(stay.week.flatMap((d) => d.intervals)).toEqual([{ timeFrom: '11:00', timeTo: '19:00' }]);
  });

  it('филиал с будущими записями у мастера не снять', async () => {
    await as('OWNER', () => service.setLocations(employeeId, { locationIds: [own.location, own.second] }));
    // запись во втором филиале база примет только у включённой им услуги (триггер §19.1)
    await at(own.second, 'OWNER', () => catalog.setLocationService(serviceId, { enabled: true }));
    await seedAppointment('2027-03-01T06:00:00Z', own.second);
    await expect(
      as('OWNER', () => service.setLocations(employeeId, { locationIds: [own.location] })),
    ).rejects.toThrow(/Второй.*будущих записей/i);
  });

  it('чужой филиал и чужой мастер не проходят', async () => {
    await expect(
      as('OWNER', () => service.setLocations(employeeId, { locationIds: [other.location] })),
    ).rejects.toThrow(/чужой/i);
    // мастер соседней организации существует, но для нас его нет: тем же «не найден», без подробностей
    await expect(as('OWNER', () => service.overview(other.employee))).rejects.toThrow(/не найден/i);
    await expect(
      as('OWNER', () =>
        service.setWorkingHours(other.employee, { intervals: [{ weekday: 1, timeFrom: '09:00', timeTo: '18:00' }] }),
      ),
    ).rejects.toThrow(/не найден/i);
    await expect(as('OWNER', () => service.overview(randomUUID()))).rejects.toThrow(/не найден/i);
  });
});
