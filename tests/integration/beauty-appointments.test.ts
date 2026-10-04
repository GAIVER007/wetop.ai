import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { ConflictException } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { BeautyCatalogService } from '../../apps/api/src/beauty/beauty.module';
import { BeautyScheduleService } from '../../apps/api/src/beauty/schedule';
import { BeautyAppointmentsService } from '../../apps/api/src/beauty/appointments';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

/**
 * Журнал записей на настоящей схеме (DATA_MODEL §19.1, срез B5): день филиала, создание записи с новым и
 * выбранным клиентом, занятость мастера, график и отсутствие, перенос и состояния.
 * Данные вымышленные (ADR-010).
 */
describe.skipIf(!url)('журнал записей салона (integration, DATA_MODEL §19.1)', () => {
  let db: Db;
  let catalog: BeautyCatalogService;
  let schedule: BeautyScheduleService;
  let service: BeautyAppointmentsService;

  const own = { org: randomUUID(), business: randomUUID(), location: randomUUID(), user: randomUUID() };
  const other = { org: randomUUID(), business: randomUUID(), location: randomUUID(), customer: randomUUID() };

  // понедельник 12 октября 2026; 10:00 по Алматы это 05:00 UTC
  const DATE = '2026-10-12';
  const at = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    return new Date(Date.UTC(2026, 9, 12, (h as number) - 5, m)).toISOString();
  };

  const as = <T>(role: 'OWNER' | 'STAFF', fn: () => Promise<T>) =>
    withSignedInUser(
      {
        userId: own.user,
        organizationId: own.org,
        role,
        scope: 'LOCATION',
        vertical: 'BEAUTY',
        businessId: own.business,
        locationId: own.location,
      },
      fn,
    );

  async function seedOrg(o: { org: string; business: string; location: string }) {
    await db.$executeRawUnsafe(
      `INSERT INTO "organizations" ("id", "name", "status") VALUES ('${o.org}', 'Сеть ${o.org.slice(0, 8)}', 'ACTIVE')`,
    );
    await db.$executeRawUnsafe(
      `INSERT INTO "businesses" ("id", "organization_id", "name", "vertical", "updated_at")
       VALUES ('${o.business}', '${o.org}', 'Салон', 'BEAUTY', now())`,
    );
    await db.$executeRawUnsafe(
      `INSERT INTO "locations" ("id", "business_id", "name", "timezone", "currency", "updated_at")
       VALUES ('${o.location}', '${o.business}', 'Филиал', 'Asia/Almaty', 'KZT', now())`,
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

  beforeAll(async () => {
    db = createPrismaClient(url);
    const prisma = { db } as unknown as PrismaService;
    catalog = new BeautyCatalogService(prisma);
    schedule = new BeautyScheduleService(prisma);
    service = new BeautyAppointmentsService(prisma);
    await cleanup();
    await seedOrg(own);
    await seedOrg(other);
    await db.$executeRawUnsafe(
      `INSERT INTO "users" ("id", "email", "name") VALUES ('${own.user}', 'owner-${own.user}@example.invalid', 'Владелец')`,
    );
    await db.$executeRawUnsafe(
      `INSERT INTO "customers" ("id", "organization_id", "first_name", "updated_at")
       VALUES ('${other.customer}', '${other.org}', 'Чужая', now())`,
    );

    const master = await as('OWNER', () => catalog.createEmployee({ name: 'Дина' }));
    employeeId = master.id;
    const svc = await as('OWNER', () =>
      catalog.createService({ name: 'Маникюр', durationMinutes: 60, priceMinor: '800000', currency: 'KZT' }),
    );
    serviceId = svc.id;
    await as('OWNER', () => catalog.setEmployeeServices(employeeId, { serviceIds: [serviceId] }));
    await as('OWNER', () => catalog.setLocationService(serviceId, { enabled: true }));
    // понедельник с 09:00 до 18:00
    await as('OWNER', () =>
      schedule.setWorkingHours(employeeId, { intervals: [{ weekday: 1, timeFrom: '09:00', timeTo: '18:00' }] }),
    );
  });

  afterAll(async () => {
    if (!db) return;
    await cleanup();
    await db.$disconnect();
  });

  it('день пустой: мастер в столбцах, его часы и услуги для формы', async () => {
    const day = await as('STAFF', () => service.day(DATE));
    expect(day.date).toBe(DATE);
    expect(day.columns).toEqual([
      expect.objectContaining({
        name: 'Дина',
        intervals: [{ timeFrom: '09:00', timeTo: '18:00' }],
        timeOff: false,
      }),
    ]);
    expect(day.appointments).toEqual([]);
    expect(day.services).toEqual([expect.objectContaining({ name: 'Маникюр', sellable: true })]);
    expect(day.bounds).toEqual({ fromMinutes: 480, toMinutes: 1200 });
  });

  it('запись новому клиенту: клиент заводится, цена снимается с каталога', async () => {
    const day = await as('STAFF', () =>
      service.create({
        employeeId,
        serviceId,
        startsAt: at('10:00'),
        firstName: 'Айгуль',
        phone: '+7 701 000 00 00',
        notes: 'первый визит',
      }),
    );
    expect(day.appointments).toEqual([
      expect.objectContaining({
        customer: expect.objectContaining({ name: 'Айгуль' }),
        serviceName: 'Маникюр',
        status: 'BOOKED',
        priceMinor: '800000',
        currency: 'KZT',
        startMinutes: 600,
        endMinutes: 660,
      }),
    ]);
    const counted = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT count(*) AS count FROM "customer_businesses" WHERE "business_id" = '${own.business}'`,
    );
    expect(Number(counted[0]?.count), 'клиент стал виден бизнесу').toBe(1);
  });

  it('в занятое время того же мастера второй записи нет', async () => {
    const call = as('STAFF', () =>
      service.create({ employeeId, serviceId, startsAt: at('10:30'), firstName: 'Сауле' }),
    );
    await expect(call).rejects.toThrow(ConflictException);
    await expect(call).rejects.toThrow(/уже занят/i);
  });

  it('вплотную записать можно', async () => {
    const day = await as('STAFF', () =>
      service.create({ employeeId, serviceId, startsAt: at('11:00'), firstName: 'Сауле' }),
    );
    expect(day.appointments).toHaveLength(2);
  });

  it('мимо графика мастера записи нет', async () => {
    await expect(
      as('STAFF', () => service.create({ employeeId, serviceId, startsAt: at('19:00'), firstName: 'Жанна' })),
    ).rejects.toThrow(/не работает/i);
  });

  it('в день отсутствия записи нет, а уже созданные остаются', async () => {
    await as('OWNER', () => schedule.addTimeOff(employeeId, { dateFrom: DATE, dateTo: DATE, reason: 'учёба' }));
    await expect(
      as('STAFF', () => service.create({ employeeId, serviceId, startsAt: at('14:00'), firstName: 'Жанна' })),
    ).rejects.toThrow(/отсутствие/i);
    const day = await as('STAFF', () => service.day(DATE));
    expect(day.appointments).toHaveLength(2);
    expect(day.columns[0]?.timeOff).toBe(true);
    // отсутствие снимаем, дальше оно мешает
    const view = await as('OWNER', () => schedule.overview(employeeId));
    await as('OWNER', () => schedule.removeTimeOff(employeeId, view.timeOffs[0]?.id ?? ''));
  });

  it('чужой клиент к записи не привязывается', async () => {
    await expect(
      as('STAFF', () =>
        service.create({ employeeId, serviceId, startsAt: at('15:00'), customerId: other.customer }),
      ),
    ).rejects.toThrow(/Клиент не найден/i);
  });

  it('повторная запись выбранному клиенту второго клиента не плодит', async () => {
    const before = await as('STAFF', () => service.day(DATE));
    const customerId = before.appointments[0]?.customer.id ?? '';
    await as('STAFF', () => service.create({ employeeId, serviceId, startsAt: at('16:00'), customerId }));
    const counted = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT count(*) AS count FROM "customers" WHERE "organization_id" = '${own.org}'`,
    );
    expect(Number(counted[0]?.count)).toBe(2);
  });

  it('тот же телефон это тот же клиент, второго не заводим', async () => {
    const before = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT count(*) AS count FROM "customers" WHERE "organization_id" = '${own.org}'`,
    );
    await as('STAFF', () =>
      service.create({
        employeeId,
        serviceId,
        startsAt: at('17:00'),
        firstName: 'Айгуль',
        phone: '+7 701 000 00 00',
      }),
    );
    const after = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT count(*) AS count FROM "customers" WHERE "organization_id" = '${own.org}'`,
    );
    expect(Number(after[0]?.count)).toBe(Number(before[0]?.count));
  });

  it('перенос меняет время и пишется в журнал', async () => {
    const before = await as('STAFF', () => service.day(DATE));
    const id = before.appointments.find((a) => a.startMinutes === 960)?.id ?? '';
    const day = await as('STAFF', () => service.move(id, { startsAt: at('13:00') }));
    expect(day.appointments.find((a) => a.id === id)?.startMinutes).toBe(780);
    const counted = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT count(*) AS count FROM "audit_logs" WHERE "organization_id" = '${own.org}' AND "action" = 'beauty.appointment.moved'`,
    );
    expect(Number(counted[0]?.count)).toBe(1);
  });

  it('перенос в занятое время не проходит', async () => {
    const before = await as('STAFF', () => service.day(DATE));
    const id = before.appointments.find((a) => a.startMinutes === 780)?.id ?? '';
    await expect(as('STAFF', () => service.move(id, { startsAt: at('10:15') }))).rejects.toThrow(/уже занят/i);
  });

  it('состояния идут по жизни записи, из выполненной дороги нет', async () => {
    const before = await as('STAFF', () => service.day(DATE));
    const id = before.appointments[0]?.id ?? '';
    await as('STAFF', () => service.setStatus(id, { status: 'CONFIRMED' }));
    const done = await as('STAFF', () => service.setStatus(id, { status: 'DONE' }));
    expect(done.appointments.find((a) => a.id === id)?.status).toBe('DONE');
    expect(done.appointments.find((a) => a.id === id)?.next).toEqual([]);
    await expect(as('STAFF', () => service.setStatus(id, { status: 'CANCELLED' }))).rejects.toThrow(
      /дороги нет|так не меняют/i,
    );
  });

  it('отменённая запись место мастера больше не держит', async () => {
    const before = await as('STAFF', () => service.day(DATE));
    const id = before.appointments.find((a) => a.startMinutes === 660)?.id ?? '';
    await as('STAFF', () => service.setStatus(id, { status: 'CANCELLED' }));
    const day = await as('STAFF', () =>
      service.create({ employeeId, serviceId, startsAt: at('11:00'), firstName: 'Асем' }),
    );
    expect(day.appointments.filter((a) => a.startMinutes === 660)).toHaveLength(2);
  });

  it('чужая запись не найдена', async () => {
    await expect(as('STAFF', () => service.move(randomUUID(), { startsAt: at('12:00') }))).rejects.toThrow(
      /не найдена/i,
    );
  });
});
