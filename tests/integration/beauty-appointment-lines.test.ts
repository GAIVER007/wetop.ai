import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { config as loadEnv } from 'dotenv';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createPrismaClient, Prisma, type Db } from '@pms/database';
import { BeautyAppointmentsService } from '../../apps/api/src/beauty/appointments';
import { BeautyAppointmentHistoryService } from '../../apps/api/src/beauty/appointment-history';
import { BeautyCatalogService } from '../../apps/api/src/beauty/beauty.module';
import { BeautyLocationHoursService } from '../../apps/api/src/beauty/location-hours';
import { BeautyReviewsService } from '../../apps/api/src/beauty/reviews';
import { databaseTenant, withSignedInUser } from '../../apps/api/src/auth/request-context';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { EmployeePortalService } from '../../apps/api/src/employee-portal/employee-portal.service';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

/**
 * BEAUTY-ZAPIS-20261017 A1/A2/A3: один визит содержит последовательные строки услуг.
 * Проверка требует локальной схемы с held migration, внешние и production БД запрещены.
 */
describe.skipIf(!url)('Beauty: строки услуг записи и совместимость старых writers', () => {
  let db: Db;
  let appointments: BeautyAppointmentsService;
  let catalog: BeautyCatalogService;
  let portal: EmployeePortalService;
  let reviews: BeautyReviewsService;
  const own = {
    org: randomUUID(),
    business: randomUUID(),
    location: randomUUID(),
    user: randomUUID(),
    customer: randomUUID(),
    employeeA: randomUUID(),
    employeeB: randomUUID(),
    serviceA: randomUUID(),
    serviceB: randomUUID(),
    productA: randomUUID(),
  };
  const foreign = {
    org: randomUUID(),
    business: randomUUID(),
    location: randomUUID(),
    employee: randomUUID(),
    service: randomUUID(),
    customer: randomUUID(),
    appointment: randomUUID(),
  };
  const DATE = '2036-10-06'; // понедельник
  const at = (clock: string) => `${DATE}T${clock}:00+05:00`;

  const asOwner = <T>(fn: () => Promise<T>) =>
    withSignedInUser(
      {
        userId: own.user,
        organizationId: own.org,
        role: 'OWNER',
        scope: 'LOCATION',
        vertical: 'BEAUTY',
        businessId: own.business,
        locationId: own.location,
      },
      fn,
    );

  const asStaff = <T>(fn: () => Promise<T>) =>
    withSignedInUser(
      {
        userId: own.user,
        organizationId: own.org,
        role: 'STAFF',
        scope: 'LOCATION',
        vertical: 'BEAUTY',
        businessId: own.business,
        locationId: own.location,
      },
      fn,
    );

  const sql = (statement: string) => db.$executeRawUnsafe(statement);

  beforeAll(async () => {
    const database = new URL(url!);
    if (!['127.0.0.1', 'localhost', '::1'].includes(database.hostname))
      throw new Error('Beauty appointment line integration test requires a loopback database');
    db = createPrismaClient(url);
    appointments = new BeautyAppointmentsService({ db } as unknown as PrismaService);
    catalog = new BeautyCatalogService({ db } as unknown as PrismaService);
    portal = new EmployeePortalService({ db } as unknown as PrismaService, null);
    reviews = new BeautyReviewsService({ db } as unknown as PrismaService);
    await cleanup();
    for (const row of [own, foreign]) {
      await sql(
        `INSERT INTO "organizations" ("id", "name", "status") VALUES ('${row.org}', 'Test ${row.org.slice(0, 8)}', 'ACTIVE')`,
      );
      await sql(
        `INSERT INTO "businesses" ("id", "organization_id", "name", "vertical", "updated_at")
         VALUES ('${row.business}', '${row.org}', 'Salon', 'BEAUTY', now())`,
      );
      await sql(
        `INSERT INTO "locations" ("id", "business_id", "name", "timezone", "currency", "updated_at")
         VALUES ('${row.location}', '${row.business}', 'Branch', 'Asia/Almaty', 'KZT', now())`,
      );
    }
    await sql(
      `INSERT INTO "users" ("id", "email", "name", "email_verified_at")
       VALUES ('${own.user}', 'lines-${own.user}@example.invalid', 'Owner', now())`,
    );
    await sql(
      `INSERT INTO "memberships" ("user_id", "organization_id", "role")
       VALUES ('${own.user}', '${own.org}', 'OWNER')`,
    );
    await sql(
      `INSERT INTO "customers" ("id", "organization_id", "first_name", "updated_at")
       VALUES ('${own.customer}', '${own.org}', 'Aida', now())`,
    );
    await sql(
      `INSERT INTO "customers" ("id", "organization_id", "first_name", "updated_at")
       VALUES ('${foreign.customer}', '${foreign.org}', 'Foreign synthetic', now())`,
    );
    for (const [id, business, name] of [
      [own.employeeA, own.business, 'Master A'],
      [own.employeeB, own.business, 'Master B'],
      [foreign.employee, foreign.business, 'Foreign master'],
    ])
      await sql(
        `INSERT INTO "employees" ("id", "business_id", "name", "updated_at")
         VALUES ('${id}', '${business}', '${name}', now())`,
      );
    for (const [id, business, name, duration, price] of [
      [own.serviceA, own.business, 'Cut', 60, 800000],
      [own.serviceB, own.business, 'Color', 30, 400000],
      [foreign.service, foreign.business, 'Foreign service', 45, 500000],
    ])
      await sql(
        `INSERT INTO "beauty_services"
           ("id", "business_id", "name", "duration_minutes", "price", "currency", "updated_at")
         VALUES ('${id}', '${business}', '${name}', ${duration}, ${price}, 'KZT', now())`,
      );
    for (const employeeId of [own.employeeA, own.employeeB]) {
      await sql(
        `INSERT INTO "employee_locations" ("employee_id", "location_id") VALUES ('${employeeId}', '${own.location}')`,
      );
      for (const serviceId of [own.serviceA, own.serviceB])
        await sql(
          `INSERT INTO "employee_services" ("employee_id", "service_id") VALUES ('${employeeId}', '${serviceId}')`,
        );
      await sql(
        `INSERT INTO "working_hours"
           ("id", "employee_id", "location_id", "weekday", "time_from", "time_to", "updated_at")
         VALUES ('${randomUUID()}', '${employeeId}', '${own.location}', 1, '09:00', '18:00', now())`,
      );
    }
    for (const serviceId of [own.serviceA, own.serviceB])
      await sql(
        `INSERT INTO "location_services" ("location_id", "service_id", "updated_at")
         VALUES ('${own.location}', '${serviceId}', now())`,
      );
    await sql(
      `INSERT INTO "employee_locations" ("employee_id", "location_id")
       VALUES ('${foreign.employee}', '${foreign.location}')`,
    );
    await sql(
      `INSERT INTO "employee_services" ("employee_id", "service_id")
       VALUES ('${foreign.employee}', '${foreign.service}')`,
    );
    await sql(
      `INSERT INTO "location_services" ("location_id", "service_id", "updated_at")
       VALUES ('${foreign.location}', '${foreign.service}', now())`,
    );
    await sql(
      `INSERT INTO "appointments"
        ("id", "location_id", "customer_id", "employee_id", "service_id", "starts_at", "ends_at", "price", "currency", "updated_at")
       VALUES ('${foreign.appointment}', '${foreign.location}', '${foreign.customer}', '${foreign.employee}', '${foreign.service}',
         '2036-10-06T05:00:00Z', '2036-10-06T05:45:00Z', 500000, 'KZT', now())`,
    );
    await sql(
      `INSERT INTO "employee_service_prices"
        ("employee_id", "service_id", "location_id", "price_type", "price_min_minor", "price_max_minor", "currency")
       VALUES ('${foreign.employee}', '${foreign.service}', '${foreign.location}', 'FIXED', 500000, 500000, 'KZT')`,
    );
  });

  afterAll(async () => {
    if (!db) return;
    await cleanup();
    await db.$disconnect();
  });

  async function cleanup() {
    const orgs = `'${own.org}', '${foreign.org}'`;
    const businesses = `SELECT "id" FROM "businesses" WHERE "organization_id" IN (${orgs})`;
    const employees = `SELECT "id" FROM "employees" WHERE "business_id" IN (${businesses})`;
    const materialTables = await db.$queryRaw<Array<{ materials: string | null; revisions: string | null }>>`
      SELECT to_regclass('beauty_service_materials')::text AS materials,
        to_regclass('beauty_service_material_revisions')::text AS revisions`;
    const materialCleanup = materialTables[0]?.materials && materialTables[0]?.revisions ? [
      `DELETE FROM "beauty_service_materials" WHERE "service_id" IN (SELECT "id" FROM "beauty_services" WHERE "business_id" IN (${businesses}))`,
      `DELETE FROM "beauty_service_material_revisions" WHERE "service_id" IN (SELECT "id" FROM "beauty_services" WHERE "business_id" IN (${businesses}))`,
    ] : [];
    const statements = [
      ...materialCleanup,
      `DELETE FROM "kitchen_stock_movements" WHERE "location_id" IN (SELECT "id" FROM "locations" WHERE "business_id" IN (${businesses}))`,
      `DELETE FROM "kitchen_stock_lots" WHERE "location_id" IN (SELECT "id" FROM "locations" WHERE "business_id" IN (${businesses}))`,
      `DELETE FROM "appointment_lines" WHERE "appointment_id" IN (SELECT "id" FROM "appointments" WHERE "location_id" IN (SELECT "id" FROM "locations" WHERE "business_id" IN (${businesses})))`,
      `DELETE FROM "restaurant_cash_operations" WHERE "appointment_id" IN (SELECT "id" FROM "appointments" WHERE "location_id" IN (SELECT "id" FROM "locations" WHERE "business_id" IN (${businesses})))`,
      `DELETE FROM "appointments" WHERE "location_id" IN (SELECT "id" FROM "locations" WHERE "business_id" IN (${businesses}))`,
      `DELETE FROM "employee_public_profiles" WHERE "employee_id" IN (${employees})`,
      `DELETE FROM "working_hours" WHERE "employee_id" IN (${employees})`,
      `DELETE FROM "employee_service_prices" WHERE "employee_id" IN (${employees})`,
      `DELETE FROM "employee_services" WHERE "employee_id" IN (${employees})`,
      `DELETE FROM "employee_locations" WHERE "employee_id" IN (${employees})`,
      `DELETE FROM "location_services" WHERE "service_id" IN (SELECT "id" FROM "beauty_services" WHERE "business_id" IN (${businesses}))`,
      `DELETE FROM "customer_businesses" WHERE "business_id" IN (${businesses})`,
      `DELETE FROM "customers" WHERE "organization_id" IN (${orgs})`,
      `DELETE FROM "employees" WHERE "business_id" IN (${businesses})`,
      `DELETE FROM "beauty_services" WHERE "business_id" IN (${businesses})`,
      `DELETE FROM "kitchen_products" WHERE "business_id" IN (${businesses})`,
      `DELETE FROM "audit_logs" WHERE "organization_id" IN (${orgs})`,
      `DELETE FROM "locations" WHERE "business_id" IN (${businesses})`,
      `DELETE FROM "businesses" WHERE "organization_id" IN (${orgs})`,
      `DELETE FROM "memberships" WHERE "user_id" = '${own.user}'`,
      `DELETE FROM "organizations" WHERE "id" IN (${orgs})`,
      `DELETE FROM "users" WHERE "id" = '${own.user}'`,
    ];
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('wetop.audit_purge','on',true)`;
      for (const statement of statements) await tx.$executeRawUnsafe(statement);
    });
  }

  it('equal-total edits preserve complete immutable previous and next service-line snapshots', async () => {
    const startsAt = '2037-01-12T09:00:00+05:00'; // programmatically verified unused Monday
    const created = await asOwner(() => appointments.create({ startsAt, customerId: own.customer, items: [
      { employeeId: own.employeeA, serviceId: own.serviceA, durationMinutes: 60, discountMinor: '100000' },
      { employeeId: own.employeeB, serviceId: own.serviceB, durationMinutes: 30 },
    ] }));
    const id = created.appointments.find((row) => row.startsAt === new Date(startsAt).toISOString())!.id;
    const previous = await db.appointmentLine.findMany({ where: { appointmentId: id }, orderBy: { position: 'asc' } });
    const snapshot = (line: (typeof previous)[number]) => ({
      position: line.position, employeeId: line.employeeId, serviceId: line.serviceId,
      startsAt: line.startsAt.toISOString(), endsAt: line.endsAt.toISOString(),
      basePriceMinor: line.basePriceMinor.toString(), discountMinor: line.discountMinor.toString(),
      surchargeMinor: line.surchargeMinor.toString(), priceMinor: line.priceMinor.toString(),
      discountPercent: line.discountPercent, currency: line.currency,
    });
    const moved = await asOwner(() => appointments.move(id, { startsAt, items: [
      { employeeId: own.employeeA, serviceId: own.serviceA, durationMinutes: 45 },
      { employeeId: own.employeeA, serviceId: own.serviceB, durationMinutes: 45, discountMinor: '100000' },
    ] }));
    const next = await db.appointmentLine.findMany({ where: { appointmentId: id }, orderBy: { position: 'asc' } });
    const beforeVisit = created.appointments.find((row) => row.id === id)!;
    const afterVisit = moved.appointments.find((row) => row.id === id)!;
    expect(afterVisit.priceMinor).toBe(beforeVisit.priceMinor);
    expect(afterVisit.startsAt).toBe(beforeVisit.startsAt);
    expect(afterVisit.endsAt).toBe(beforeVisit.endsAt);
    expect(next.map(snapshot)).not.toEqual(previous.map(snapshot));
    const where = { organizationId: own.org, entityType: 'appointment', entityId: id };
    const audit = await db.auditLog.findFirstOrThrow({ where: { ...where, action: 'beauty.appointment.moved' } });
    expect(audit.before).toMatchObject({ priceMinor: beforeVisit.priceMinor, items: previous.map(snapshot) });
    expect(audit.after).toMatchObject({ priceMinor: afterVisit.priceMinor, items: next.map(snapshot) });
    const creation = await db.auditLog.findFirstOrThrow({ where: { ...where, action: 'beauty.appointment.created' } });
    expect(creation.after).toMatchObject({ items: previous.map(snapshot) });
    const history = new BeautyAppointmentHistoryService({ db } as unknown as PrismaService);
    const read = await asOwner(() => history.history(id));
    const event = read.items.find((row) => row.action === 'beauty.appointment.moved')!;
    expect(event.before.items?.map((row) => [row.employee.id, row.endsAt, row.discountMinor]))
      .toEqual(previous.map((row) => [row.employeeId, row.endsAt.toISOString(), row.discountMinor.toString()]));
    expect(event.after.items?.map((row) => [row.employee.id, row.endsAt, row.discountMinor]))
      .toEqual(next.map((row) => [row.employeeId, row.endsAt.toISOString(), row.discountMinor.toString()]));
    try {
      await db.beautyService.update({ where: { id: own.serviceB }, data: { name: 'Renamed synthetic catalog service' } });
      expect((await db.auditLog.findUniqueOrThrow({ where: { id: audit.id } })).before).toEqual(audit.before);
      expect((await db.auditLog.findUniqueOrThrow({ where: { id: audit.id } })).after).toEqual(audit.after);
    } finally {
      await db.beautyService.update({ where: { id: own.serviceB }, data: { name: 'Color' } });
    }
  });

  it('создаёт две последовательные строки, сумму визита и сегменты календаря по каждому мастеру', async () => {
    const day = await asOwner(() =>
      appointments.create({
        startsAt: at('10:00'),
        customerId: own.customer,
        items: [
          { employeeId: own.employeeA, serviceId: own.serviceA, durationMinutes: 45, discountPercent: 10 },
          { employeeId: own.employeeB, serviceId: own.serviceB, discountMinor: '50000' },
        ],
      }),
    );
    const row = day.appointments.find((item) => item.startMinutes === 600)!;
    expect(row).toMatchObject({
      employeeId: own.employeeA,
      serviceId: own.serviceA,
      startMinutes: 600,
      endMinutes: 675,
      priceMinor: '1070000',
    });
    expect(row.items).toEqual([
      expect.objectContaining({
        position: 0,
        employeeId: own.employeeA,
        serviceId: own.serviceA,
        startMinutes: 600,
        endMinutes: 645,
        basePriceMinor: '800000',
        discountMinor: '80000',
        priceMinor: '720000',
      }),
      expect.objectContaining({
        position: 1,
        employeeId: own.employeeB,
        serviceId: own.serviceB,
        startMinutes: 645,
        endMinutes: 675,
        basePriceMinor: '400000',
        discountMinor: '50000',
        priceMinor: '350000',
      }),
    ]);
  });

  it('читает период одним срезом филиала, включая пересечение границы в его часовом поясе', async () => {
    const crossing = await db.appointment.create({
      data: {
        locationId: own.location, customerId: own.customer, employeeId: own.employeeA, serviceId: own.serviceB,
        startsAt: new Date('2036-10-05T18:30:00Z'), endsAt: new Date('2036-10-05T19:30:00Z'),
        price: 400000n, currency: 'KZT',
      },
    });
    const outside = await db.appointment.create({
      data: {
        locationId: own.location, customerId: own.customer, employeeId: own.employeeA, serviceId: own.serviceB,
        startsAt: new Date('2036-10-07T19:00:00Z'), endsAt: new Date('2036-10-07T19:30:00Z'),
        price: 400000n, currency: 'KZT',
      },
    });
    const service = appointments as BeautyAppointmentsService & {
      period(from?: string, to?: string): Promise<{
        appointments: Array<{ id: string; localDate: string; startMinutes: number; endMinutes: number; items: unknown[] }>;
      }>;
    };
    const result = await asOwner(() => service.period(DATE, '2036-10-07'));
    expect(result.appointments.find((row) => row.id === crossing.id)).toMatchObject({
      localDate: '2036-10-05', startMinutes: 1410, endMinutes: 1470,
    });
    expect(result.appointments.find((row) => row.items.length === 2)).toBeDefined();
    expect(result.appointments.some((row) => row.id === outside.id)).toBe(false);
    expect(result.appointments.some((row) => row.id === foreign.appointment)).toBe(false);
  });

  it('RLS скрывает строки услуг и цены мастера другой организации', async () => {
    await db.employeeServicePrice.create({
      data: {
        employeeId: own.employeeB,
        serviceId: own.serviceA,
        locationId: own.location,
        priceType: 'FIXED',
        priceMinMinor: 800000n,
        priceMaxMinor: 800000n,
        currency: 'KZT',
      },
    });
    const schema = process.env.DATABASE_SCHEMA?.trim() || 'public';
    const client = new pg.Client({ connectionString: url, options: `-c search_path=${schema},public` });
    await client.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE wetop_app');
      await client.query(`SELECT set_config('app.org_id', $1, true)`, [own.org]);
      const lines = await client.query<{ appointment_id: string }>(
        `SELECT appointment_id::text FROM appointment_lines ORDER BY appointment_id`,
      );
      const prices = await client.query<{ location_id: string }>(
        `SELECT location_id::text FROM employee_service_prices ORDER BY location_id`,
      );
      expect(lines.rows.some((row) => row.appointment_id === foreign.appointment)).toBe(false);
      expect(lines.rows.length).toBeGreaterThan(0);
      expect(prices.rows).toEqual([{ location_id: own.location }]);
    } finally {
      await client.query('ROLLBACK').catch(() => undefined);
      await client.end();
      await db.employeeServicePrice.delete({
        where: { employeeId_serviceId_locationId: {
          employeeId: own.employeeB,
          serviceId: own.serviceA,
          locationId: own.location,
        } },
      });
    }
  });

  it('кабинет второго мастера показывает только его строку, цену и интервал', async () => {
    await db.workingHours.updateMany({
      where: { employeeId: own.employeeB, locationId: own.location, weekday: 1 },
      data: { timeTo: new Date('1970-01-01T11:00:00Z') },
    });
    try {
      const dto = await asOwner(() => portal.get(own.employeeB, { date: DATE }));
      expect(dto.appointments).toEqual([
        expect.objectContaining({
          startsAt: new Date(at('10:45')).toISOString(),
          endsAt: new Date(at('11:15')).toISOString(),
          serviceName: 'Color',
          priceMinor: '350000',
          currency: 'KZT',
        }),
      ]);
      expect(dto.scheduleConflicts.items).toContainEqual(expect.objectContaining({
        startsAt: new Date(at('10:45')).toISOString(),
        endsAt: new Date(at('11:15')).toISOString(),
        serviceName: 'Color',
        reason: 'OUTSIDE_WORKING_HOURS',
      }));
    } finally {
      await db.workingHours.updateMany({
        where: { employeeId: own.employeeB, locationId: own.location, weekday: 1 },
        data: { timeTo: new Date('1970-01-01T18:00:00Z') },
      });
    }
  });

  it('проверяет занятость каждого сегмента, но разрешает ту же услугу другому мастеру', async () => {
    await expect(
      asOwner(() =>
        appointments.create({
          startsAt: at('10:30'),
          customerId: own.customer,
          items: [{ employeeId: own.employeeA, serviceId: own.serviceB }],
        }),
      ),
    ).rejects.toThrow(ConflictException);
    const day = await asOwner(() =>
      appointments.create({
        startsAt: at('10:00'),
        customerId: own.customer,
        items: [{ employeeId: own.employeeB, serviceId: own.serviceA, durationMinutes: 30 }],
      }),
    );
    expect(day.appointments.some((row) => row.items?.[0]?.employeeId === own.employeeB)).toBe(true);
  });

  it('не принимает мастера или услугу другого бизнеса внутри строки', async () => {
    await expect(
      asOwner(() =>
        appointments.create({
          startsAt: at('13:00'),
          customerId: own.customer,
          items: [{ employeeId: foreign.employee, serviceId: own.serviceA }],
        }),
      ),
    ).rejects.toThrow(/Мастер.*не найден|не работает/i);
    await expect(
      asOwner(() =>
        appointments.create({
          startsAt: at('13:00'),
          customerId: own.customer,
          items: [{ employeeId: own.employeeA, serviceId: foreign.service }],
        }),
      ),
    ).rejects.toThrow(/Услуга не найдена|чуж|не оказывает/i);
  });

  it('гонка двух созданий одного слота оставляет ровно одну строку', async () => {
    const results = await Promise.allSettled([
      asOwner(() => appointments.create({
        startsAt: at('13:00'),
        firstName: 'Synthetic first',
        items: [{ employeeId: own.employeeA, serviceId: own.serviceB }],
      })),
      asOwner(() => appointments.create({
        startsAt: at('13:00'),
        firstName: 'Synthetic second',
        items: [{ employeeId: own.employeeA, serviceId: own.serviceB }],
      })),
    ]);
    expect(results.filter((row) => row.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((row) => row.status === 'rejected')).toHaveLength(1);
    expect(await db.appointmentLine.count({
      where: { employeeId: own.employeeA, startsAt: new Date(at('13:00')) },
    })).toBe(1);
  });

  it('старый INSERT и UPDATE поддерживают одну строку, а поля строк многострочного визита меняются только через API', async () => {
    const legacyId = randomUUID();
    await sql(
      `INSERT INTO "appointments"
        ("id", "location_id", "customer_id", "employee_id", "service_id", "starts_at", "ends_at", "price", "currency", "updated_at")
       VALUES ('${legacyId}', '${own.location}', '${own.customer}', '${own.employeeA}', '${own.serviceA}',
         '${at('15:00')}', '${at('16:00')}', 800000, 'KZT', now())`,
    );
    let lines = await db.$queryRawUnsafe<Array<{ employeeId: string; startsAt: Date }>>(
      `SELECT "employee_id" AS "employeeId", "starts_at" AS "startsAt"
       FROM "appointment_lines" WHERE "appointment_id" = '${legacyId}'`,
    );
    expect(lines).toHaveLength(1);
    await sql(`UPDATE "appointments" SET "starts_at" = '${at('16:00')}', "ends_at" = '${at('17:00')}' WHERE "id" = '${legacyId}'`);
    lines = await db.$queryRawUnsafe<Array<{ employeeId: string; startsAt: Date }>>(
      `SELECT "employee_id" AS "employeeId", "starts_at" AS "startsAt"
       FROM "appointment_lines" WHERE "appointment_id" = '${legacyId}'`,
    );
    expect(lines[0]!.startsAt.toISOString()).toBe(new Date(at('16:00')).toISOString());

    const multiId = (await asOwner(() =>
      appointments.create({
        startsAt: at('12:00'),
        customerId: own.customer,
        items: [
          { employeeId: own.employeeA, serviceId: own.serviceB },
          { employeeId: own.employeeB, serviceId: own.serviceB },
        ],
      }),
    )).appointments.find((row) => row.startMinutes === 720)!.id;
    await sql(`UPDATE "appointments" SET "notes" = 'legacy note' WHERE "id" = '${multiId}'`);
    const before = await db.$queryRawUnsafe<Array<{ priceMinor: bigint }>>(
      `SELECT "price_minor" AS "priceMinor" FROM "appointment_lines"
       WHERE "appointment_id" = '${multiId}' ORDER BY "position"`,
    );
    await expect(
      sql(`UPDATE "appointments" SET "price" = "price" + 1 WHERE "id" = '${multiId}'`),
    ).rejects.toThrow(/multi-line|строк.*API/i);
    const after = await db.$queryRawUnsafe<Array<{ priceMinor: bigint }>>(
      `SELECT "price_minor" AS "priceMinor" FROM "appointment_lines"
       WHERE "appointment_id" = '${multiId}' ORDER BY "position"`,
    );
    expect(after).toEqual(before);
  });

  it('legacy перенос первой строки сохраняет остальные строки и все снимки цены', async () => {
    const created = await asOwner(() =>
      appointments.create({
        startsAt: at('11:00'),
        customerId: own.customer,
        items: [
          { employeeId: own.employeeA, serviceId: own.serviceA, durationMinutes: 45, discountMinor: '100000' },
          { employeeId: own.employeeB, serviceId: own.serviceB, surchargeMinor: '25000' },
        ],
      }),
    );
    const before = created.appointments.find((row) => row.startMinutes === 660)!;
    const moved = await asOwner(() =>
      appointments.move(before.id, { startsAt: at('15:00'), employeeId: own.employeeB }),
    );
    const after = moved.appointments.find((row) => row.id === before.id)!;
    expect(after.items).toEqual([
      expect.objectContaining({
        position: 0,
        employeeId: own.employeeB,
        serviceId: own.serviceA,
        startMinutes: 900,
        endMinutes: 945,
        basePriceMinor: '800000',
        discountMinor: '100000',
        priceMinor: '700000',
      }),
      expect.objectContaining({
        position: 1,
        employeeId: own.employeeB,
        serviceId: own.serviceB,
        startMinutes: 945,
        endMinutes: 975,
        basePriceMinor: '400000',
        surchargeMinor: '25000',
        priceMinor: '425000',
      }),
    ]);
  });

  it('не даёт администратору сбросить скидку и ручную длительность заменой items без права rates', async () => {
    const startsAt = '2036-10-13T14:00:00+05:00';
    const created = await asOwner(() => appointments.create({
      startsAt,
      customerId: own.customer,
      items: [{
        employeeId: own.employeeA,
        serviceId: own.serviceA,
        durationMinutes: 45,
        discountMinor: '100000',
      }],
    }));
    const id = created.appointments.find((row) => row.startsAt === new Date(startsAt).toISOString())!.id;

    await expect(asStaff(() => appointments.move(id, {
      startsAt,
      items: [{ employeeId: own.employeeA, serviceId: own.serviceA }],
    }))).rejects.toMatchObject({ status: 403 });

    const row = await db.appointmentLine.findFirstOrThrow({ where: { appointmentId: id } });
    expect(row).toMatchObject({
      basePriceMinor: 800000n,
      discountMinor: 100000n,
      priceMinor: 700000n,
    });
    expect((row.endsAt.getTime() - row.startsAt.getTime()) / 60_000).toBe(45);
  });

  it('перечитывает цену услуги после получения транзакционных замков', async () => {
    const startsAt = '2036-10-13T10:00:00+05:00';
    type ServiceLookup = (args: object) => Promise<unknown>;
    const serviceDelegate = db.beautyService as unknown as { findFirst: ServiceLookup };
    const original = serviceDelegate.findFirst.bind(serviceDelegate);
    const find = vi.spyOn(serviceDelegate, 'findFirst').mockImplementationOnce(async (args) => {
      const snapshot = await original(args);
      await db.beautyService.update({ where: { id: own.serviceA }, data: { price: 810000n } });
      return snapshot;
    });
    try {
      const day = await asOwner(() => appointments.create({
        startsAt,
        customerId: own.customer,
        items: [{ employeeId: own.employeeA, serviceId: own.serviceA }],
      }));
      expect(day.appointments.find((row) => row.startsAt === new Date(startsAt).toISOString()))
        .toMatchObject({ priceMinor: '810000' });
    } finally {
      find.mockRestore();
      await db.beautyService.update({ where: { id: own.serviceA }, data: { price: 800000n } });
    }
  });

  it('не создаёт новую строку после архивации мастера между планом и транзакцией', async () => {
    const startsAt = '2036-10-13T11:00:00+05:00';
    type EmployeeLookup = (args: object) => Promise<unknown>;
    const employeeDelegate = db.employee as unknown as { findFirst: EmployeeLookup };
    const original = employeeDelegate.findFirst.bind(employeeDelegate);
    const find = vi.spyOn(employeeDelegate, 'findFirst').mockImplementationOnce(async (args) => {
      const snapshot = await original(args);
      await db.employee.update({ where: { id: own.employeeA }, data: { status: 'ARCHIVED' } });
      return snapshot;
    });
    try {
      await expect(asOwner(() => appointments.create({
        startsAt,
        customerId: own.customer,
        items: [{ employeeId: own.employeeA, serviceId: own.serviceA }],
      }))).rejects.toThrow(/архив/i);
      expect(await db.appointment.count({
        where: { locationId: own.location, startsAt: new Date(startsAt) },
      })).toBe(0);
    } finally {
      find.mockRestore();
      await db.employee.update({ where: { id: own.employeeA }, data: { status: 'ACTIVE' } });
    }
  });

  it('legacy writer не создаёт новую строку для архивного мастера или услуги', async () => {
    const insert = (id: string, employeeId: string, serviceId: string, startsAt: string, endsAt: string) => sql(
      `INSERT INTO "appointments"
        ("id", "location_id", "customer_id", "employee_id", "service_id", "starts_at", "ends_at", "price", "currency", "updated_at")
       VALUES ('${id}', '${own.location}', '${own.customer}', '${employeeId}', '${serviceId}',
         '${startsAt}', '${endsAt}', 800000, 'KZT', now())`,
    );
    await db.employee.update({ where: { id: own.employeeA }, data: { status: 'ARCHIVED' } });
    try {
      await expect(insert(
        randomUUID(), own.employeeA, own.serviceA,
        '2036-10-13T12:00:00+05:00', '2036-10-13T13:00:00+05:00',
      )).rejects.toThrow(/archiv|active|master|мастер/i);
    } finally {
      await db.employee.update({ where: { id: own.employeeA }, data: { status: 'ACTIVE' } });
    }

    await db.beautyService.update({ where: { id: own.serviceA }, data: { active: false } });
    try {
      await expect(insert(
        randomUUID(), own.employeeA, own.serviceA,
        '2036-10-13T12:00:00+05:00', '2036-10-13T13:00:00+05:00',
      )).rejects.toThrow(/archiv|active|service|услуг/i);
    } finally {
      await db.beautyService.update({ where: { id: own.serviceA }, data: { active: true } });
    }
  });

  it('явно отклоняет перенос старой записи в валюте, отличной от текущей валюты филиала', async () => {
    const startsAt = '2036-10-13T15:00:00+05:00';
    const created = await asOwner(() => appointments.create({
      startsAt,
      customerId: own.customer,
      items: [{ employeeId: own.employeeA, serviceId: own.serviceA }],
    }));
    const id = created.appointments.find((row) => row.startsAt === new Date(startsAt).toISOString())!.id;
    await db.location.update({ where: { id: own.location }, data: { currency: 'USD' } });
    await db.locationService.update({
      where: { locationId_serviceId: { locationId: own.location, serviceId: own.serviceA } },
      data: { priceOverride: 800000n },
    });
    try {
      await expect(asOwner(() => appointments.move(id, {
        startsAt: '2036-10-13T16:00:00+05:00',
      }))).rejects.toThrow('Валюта записи не совпадает с валютой филиала');
      const row = await db.appointment.findUniqueOrThrow({ where: { id } });
      expect(row).toMatchObject({ currency: 'KZT', startsAt: new Date(startsAt) });
    } finally {
      await db.locationService.update({
        where: { locationId_serviceId: { locationId: own.location, serviceId: own.serviceA } },
        data: { priceOverride: null },
      });
      await db.location.update({ where: { id: own.location }, data: { currency: 'KZT' } });
    }
  });

  it('отмена освобождает интервалы, но реактивация не создаёт пересечение', async () => {
    const first = (await asOwner(() =>
      appointments.create({
        startsAt: at('14:00'),
        customerId: own.customer,
        items: [{ employeeId: own.employeeA, serviceId: own.serviceB }],
      }),
    )).appointments.find((row) => row.startMinutes === 840)!;
    await asOwner(() => appointments.setStatus(first.id, { status: 'CANCELLED' }));
    await asOwner(() =>
      appointments.create({
        startsAt: at('14:00'),
        customerId: own.customer,
        items: [{ employeeId: own.employeeA, serviceId: own.serviceB }],
      }),
    );
    await expect(
      sql(`UPDATE "appointments" SET "status" = 'BOOKED' WHERE "id" = '${first.id}'`),
    ).rejects.toThrow(/overlap|занят|пересеч/i);
  });

  it('гонка двух правок принимает одну и отклоняет zero-row optimistic update', async () => {
    const created = await asOwner(() =>
      appointments.create({
        startsAt: at('17:00'),
        customerId: own.customer,
        items: [{ employeeId: own.employeeA, serviceId: own.serviceB }],
      }),
    );
    const id = created.appointments.find((row) => row.startMinutes === 1020)!.id;
    const results = await Promise.allSettled([
      asOwner(() => appointments.move(id, { startsAt: at('09:00') })),
      asOwner(() => appointments.move(id, { startsAt: at('09:30') })),
    ]);
    expect(results.filter((row) => row.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((row) => row.status === 'rejected')).toHaveLength(1);
    expect(String((results.find((row) => row.status === 'rejected') as PromiseRejectedResult).reason)).toMatch(
      /уже изменена|обновите данные/i,
    );
  });

  it('переиспользует канонический телефон без перезаписи имени и не восстанавливает архивную карточку', async () => {
    const first = await asOwner(() => appointments.create({
      startsAt: at('17:00'),
      firstName: 'Synthetic',
      lastName: 'Client',
      phone: '87001234567',
      items: [{ employeeId: own.employeeA, serviceId: own.serviceB }],
    }));
    const second = await asOwner(() => appointments.create({
      startsAt: at('17:30'),
      firstName: 'Synthetic',
      lastName: 'Client',
      phone: '+77001234567',
      items: [{ employeeId: own.employeeA, serviceId: own.serviceB }],
    }));
    expect(second.appointments.find((row) => row.startMinutes === 1050)?.customer.id)
      .toBe(first.appointments.find((row) => row.startMinutes === 1020)?.customer.id);
    // DATA_MODEL SL4-M4A: the organization phone identity is reused without rewriting names/contacts.
    const canonicalId = first.appointments.find((row) => row.startMinutes === 1020)!.customer.id;
    const canonical = await db.customer.findUniqueOrThrow({ where: { id: canonicalId },
      select: { firstName: true, lastName: true, phone: true, phoneNormalized: true } });
    // DECISIONS BEAUTY-APPOINTMENT-CUSTOMER-NAME-20261019 (owner-approved): the same phone under another full name
    // is a conflict; the user must pick the existing customer. Nothing is written and the card is not renamed.
    await expect(asOwner(() => appointments.create({
      startsAt: at('17:00'),
      firstName: 'Other',
      lastName: 'Client',
      phone: '+7 (700) 123-45-67',
      items: [{ employeeId: own.employeeB, serviceId: own.serviceB }],
    }))).rejects.toThrow(/другим именем/);
    expect(await db.appointment.count({
      where: { locationId: own.location, startsAt: new Date(at('17:00')), lines: { some: { employeeId: own.employeeB } } },
    })).toBe(0);
    // Picking the existing customer explicitly still books on the canonical card.
    const picked = await asOwner(() => appointments.create({
      startsAt: at('17:00'),
      customerId: canonicalId,
      items: [{ employeeId: own.employeeB, serviceId: own.serviceB }],
    }));
    expect(picked.appointments.find((row) => row.startMinutes === 1020 && row.employeeId === own.employeeB)?.customer.id)
      .toBe(canonicalId);
    expect(await db.customer.findUniqueOrThrow({ where: { id: canonicalId },
      select: { firstName: true, lastName: true, phone: true, phoneNormalized: true } })).toEqual(canonical);
    expect(await db.customer.count({ where: { organizationId: own.org, phoneNormalized: canonical.phoneNormalized } })).toBe(1);
    // Existing archive protection remains a negative acceptance case, not an assertion removed for green.
    await db.customer.update({ where: { id: canonicalId }, data: { status: 'ARCHIVED' } });
    try {
      await expect(asOwner(() => appointments.create({
        startsAt: at('17:30'), firstName: 'Other', lastName: 'Client', phone: '+7 (700) 123-45-67',
        items: [{ employeeId: own.employeeB, serviceId: own.serviceB }],
      }))).rejects.toThrow(/архив/i);
      expect(await db.customer.findUniqueOrThrow({ where: { id: canonicalId }, select: { status: true } }))
        .toEqual({ status: 'ARCHIVED' });
    } finally {
      await db.customer.update({ where: { id: canonicalId }, data: { status: 'ACTIVE' } });
    }
  });

  it('задаёт цену мастера в валюте филиала и отдаёт effective price форме записи', async () => {
    await expect(asOwner(() =>
      catalog.setEmployeeServicePrice(own.employeeB, own.serviceB, {
        priceType: 'FIXED', priceMinMinor: '450000', currency: 'KZT',
      }),
    )).rejects.toThrow(/верс|revision/i);
    const prices = await asOwner(() =>
      catalog.setEmployeeServicePrice(own.employeeB, own.serviceB, {
        priceType: 'FIXED',
        priceMinMinor: '450000',
        durationMinutes: 35,
        currency: 'KZT',
        expectedRevision: 0,
      }),
    );
    expect(prices).toContainEqual(expect.objectContaining({
      employeeId: own.employeeB,
      serviceId: own.serviceB,
      priceType: 'FIXED',
      priceMinMinor: '450000',
      priceMaxMinor: '450000',
      durationMinutes: 35,
      currency: 'KZT',
      source: 'MASTER',
      revision: 1,
      sellable: true,
    }));
    const day = await asOwner(() => appointments.day(DATE));
    expect(day.services.find((service) => service.id === own.serviceB)?.masterPrices).toContainEqual(
      expect.objectContaining({
        employeeId: own.employeeB,
        priceType: 'FIXED',
        priceMinMinor: '450000',
        priceMaxMinor: '450000',
        durationMinutes: 35,
        currency: 'KZT',
        source: 'MASTER',
        revision: 1,
      }),
    );
    const portalDto = await asOwner(() => portal.get(own.employeeB, { date: DATE }));
    expect(portalDto.services.find((service) => service.id === own.serviceB)).toMatchObject({
      durationMinutes: 35,
      priceMinor: '450000',
      currency: 'KZT',
      priceType: 'FIXED',
      priceMinMinor: '450000',
      priceMaxMinor: '450000',
      priceSource: 'MASTER',
      priceRevision: 1,
      available: true,
    });
    const remove = catalog.removeEmployeeServicePrice as unknown as (
      employeeId: string,
      serviceId: string,
      raw: unknown,
    ) => Promise<unknown>;
    await expect(asOwner(() => remove.call(catalog, own.employeeB, own.serviceB, { expectedRevision: 0 })))
      .rejects.toThrow(/изменена|верс|revision/i);
    await asOwner(() => remove.call(catalog, own.employeeB, own.serviceB, { expectedRevision: 1 }));
  });

  it('хранит один отзыв мастеру за DONE-визит и показывает только отзывы выбранного мастера', async () => {
    type ReviewsView = {
      averageStars: number | null;
      count: number;
      hasMore: boolean;
      items: Array<{ appointmentId: string; stars: number; comment: string | null; submittedAt: string }>;
    };
    const visitAt = (clock: string) => `2036-10-20T${clock}:00+05:00`;
    const firstDay = await asOwner(() => appointments.create({
      startsAt: visitAt('09:00'),
      customerId: own.customer,
      items: [
        { employeeId: own.employeeA, serviceId: own.serviceB },
        { employeeId: own.employeeB, serviceId: own.serviceB },
        { employeeId: own.employeeA, serviceId: own.serviceB },
      ],
    }));
    const first = firstDay.appointments.find((row) => row.startsAt === new Date(visitAt('09:00')).toISOString())!;
    const secondDay = await asOwner(() => appointments.create({
      startsAt: visitAt('11:00'),
      customerId: own.customer,
      items: [{ employeeId: own.employeeA, serviceId: own.serviceB }],
    }));
    const second = secondDay.appointments.find((row) => row.startsAt === new Date(visitAt('11:00')).toISOString())!;
    const pendingDay = await asOwner(() => appointments.create({
      startsAt: visitAt('12:00'),
      customerId: own.customer,
      items: [{ employeeId: own.employeeA, serviceId: own.serviceB }],
    }));
    const pending = pendingDay.appointments.find((row) => row.startsAt === new Date(visitAt('12:00')).toISOString())!;
    await asOwner(() => appointments.setStatus(first.id, { status: 'DONE' }));
    await asOwner(() => appointments.setStatus(second.id, { status: 'DONE' }));
    await db.appointment.update({ where: { id: foreign.appointment }, data: { status: 'DONE' } });

    const appointmentIds = [first.id, second.id, pending.id, foreign.appointment];
    let overflowAppointmentIds: string[] = [];
    try {
      await sql(
        `INSERT INTO "beauty_appointment_reviews"
          ("appointment_id", "employee_id", "stars", "comment", "submitted_at") VALUES
          ('${first.id}', '${own.employeeA}', 4, 'Synthetic careful work', now()),
          ('${first.id}', '${own.employeeB}', 5, 'Synthetic second master', now()),
          ('${second.id}', '${own.employeeA}', 5, NULL, now()),
          ('${foreign.appointment}', '${foreign.employee}', 3, 'Foreign synthetic review', now())`,
      );
      await expect(sql(
        `INSERT INTO "beauty_appointment_reviews"
          ("appointment_id", "employee_id", "stars", "submitted_at")
         VALUES ('${first.id}', '${own.employeeA}', 5, now())`,
      )).rejects.toThrow(/unique|duplicate|beauty_appointment_reviews/i);
      await expect(sql(
        `INSERT INTO "beauty_appointment_reviews"
          ("appointment_id", "employee_id", "stars", "submitted_at")
         VALUES ('${pending.id}', '${own.employeeA}', 5, now())`,
      )).rejects.toThrow(/done|completed|выполн/i);
      await expect(sql(
        `INSERT INTO "beauty_appointment_reviews"
          ("appointment_id", "employee_id", "stars", "submitted_at")
         VALUES ('${second.id}', '${foreign.employee}', 5, now())`,
      )).rejects.toThrow(/line|строк|master|мастер/i);
      for (const stars of [0, 6]) {
        await expect(sql(
          `INSERT INTO "beauty_appointment_reviews"
            ("appointment_id", "employee_id", "stars", "submitted_at")
           VALUES ('${second.id}', '${own.employeeB}', ${stars}, now())`,
        )).rejects.toThrow(/check|stars|оцен|line|строк/i);
      }

      await sql(
        `INSERT INTO "beauty_review_invitations"
          ("appointment_id", "token_hash", "expires_at") VALUES
          ('${first.id}', '${'a'.repeat(64)}', '2036-11-19T00:00:00Z'),
          ('${foreign.appointment}', '${'b'.repeat(64)}', '2036-11-19T00:00:00Z')`,
      );
      await expect(sql(
        `INSERT INTO "beauty_review_invitations"
          ("appointment_id", "token_hash", "expires_at")
         VALUES ('${second.id}', '${'a'.repeat(64)}', '2036-11-19T00:00:00Z')`,
      )).rejects.toThrow(/unique|duplicate|token/i);

      await db.employee.update({ where: { id: own.employeeA }, data: { userId: own.user } });
      try {
        const ownDto = await asOwner(() => portal.get(null, { date: '2036-10-20' })) as unknown as { reviews: ReviewsView };
        expect(ownDto.reviews).toMatchObject({ averageStars: 4.5, count: 2, hasMore: false });
        expect(ownDto.reviews.items.map((row) => row.stars).sort()).toEqual([4, 5]);

        const marker = `Synthetic review overflow ${randomUUID()}`;
        const base = Date.UTC(2040, 0, 1, 9);
        await db.appointment.createMany({
          data: Array.from({ length: 49 }, (_, index) => ({
            locationId: own.location,
            customerId: own.customer,
            employeeId: own.employeeA,
            serviceId: own.serviceB,
            startsAt: new Date(base + index * 86_400_000),
            endsAt: new Date(base + index * 86_400_000 + 30 * 60_000),
            status: 'DONE' as const,
            price: 300000n,
            currency: 'KZT',
            notes: marker,
          })),
        });
        overflowAppointmentIds = (await db.appointment.findMany({
          where: { locationId: own.location, notes: marker },
          select: { id: true },
        })).map((row) => row.id);
        expect(overflowAppointmentIds).toHaveLength(49);
        await db.beautyAppointmentReview.createMany({
          data: overflowAppointmentIds.map((appointmentId) => ({
            appointmentId,
            employeeId: own.employeeA,
            stars: 5,
            comment: 'Synthetic pagination review',
          })),
        });
        const pagedDto = await asOwner(() => portal.get(null, { date: '2036-10-20' })) as unknown as { reviews: ReviewsView };
        expect(pagedDto.reviews).toMatchObject({ count: 51, hasMore: true });
        expect(pagedDto.reviews.items).toHaveLength(50);
      } finally {
        await db.employee.update({ where: { id: own.employeeA }, data: { userId: null } });
      }

      const managerDto = await asOwner(() => portal.get(own.employeeB, { date: '2036-10-20' })) as unknown as { reviews: ReviewsView };
      expect(managerDto.reviews).toMatchObject({ averageStars: 5, count: 1, hasMore: false });
      expect(managerDto.reviews.items).toEqual([
        expect.objectContaining({ appointmentId: first.id, stars: 5, comment: 'Synthetic second master' }),
      ]);

      const schema = process.env.DATABASE_SCHEMA?.trim() || 'public';
      const client = new pg.Client({ connectionString: url, options: `-c search_path=${schema},public` });
      await client.connect();
      try {
        await client.query('BEGIN');
        await client.query('SET LOCAL ROLE wetop_app');
        await client.query(`SELECT set_config('app.org_id', $1, true)`, [own.org]);
        const reviews = await client.query<{ appointment_id: string }>(
          `SELECT appointment_id::text FROM beauty_appointment_reviews ORDER BY appointment_id`,
        );
        const invitations = await client.query<{ appointment_id: string }>(
          `SELECT appointment_id::text FROM beauty_review_invitations ORDER BY appointment_id`,
        );
        expect(reviews.rows.some((row) => row.appointment_id === foreign.appointment)).toBe(false);
        expect(reviews.rows).toHaveLength(52);
        expect(invitations.rows).toEqual([{ appointment_id: first.id }]);
      } finally {
        await client.query('ROLLBACK').catch(() => undefined);
        await client.end();
      }
    } finally {
      const table = await db.$queryRaw<Array<{ reviews: string | null }>>`
        SELECT to_regclass('beauty_appointment_reviews')::text AS reviews`;
      if (table[0]?.reviews) {
        const ids = [...appointmentIds, ...overflowAppointmentIds].map((appointmentId) => `'${appointmentId}'`).join(',');
        await db.$executeRawUnsafe(`DELETE FROM "beauty_review_invitations" WHERE "appointment_id" IN (${ids})`);
        await db.$executeRawUnsafe(`DELETE FROM "beauty_appointment_reviews" WHERE "appointment_id" IN (${ids})`);
      }
      if (overflowAppointmentIds.length) {
        await db.appointmentLine.deleteMany({ where: { appointmentId: { in: overflowAppointmentIds } } });
        await db.appointment.deleteMany({ where: { id: { in: overflowAppointmentIds } } });
      }
      await db.appointment.update({ where: { id: foreign.appointment }, data: { status: 'BOOKED' } });
    }
  });

  it('выдаёт ссылку на 30 дней от первого DONE, не хранит raw token и ротирует только неотправленную ссылку', async () => {
    const startsAt = '2036-12-01T09:00:00+05:00';
    const legacyAt = '2036-12-01T13:00:00+05:00';
    const day = await asOwner(() => appointments.create({
      startsAt,
      customerId: own.customer,
      items: [
        { employeeId: own.employeeA, serviceId: own.serviceB },
        { employeeId: own.employeeB, serviceId: own.serviceB },
        { employeeId: own.employeeA, serviceId: own.serviceB },
      ],
    }));
    const appointment = day.appointments.find((row) => row.startsAt === new Date(startsAt).toISOString())!;
    const legacyDay = await asOwner(() => appointments.create({
      startsAt: legacyAt,
      customerId: own.customer,
      items: [{ employeeId: own.employeeA, serviceId: own.serviceB }],
    }));
    const legacy = legacyDay.appointments.find((row) => row.startsAt === new Date(legacyAt).toISOString())!;
    await asOwner(() => appointments.setStatus(appointment.id, { status: 'DONE' }));
    await db.appointment.update({ where: { id: legacy.id }, data: { status: 'DONE' } });
    try {
      await expect(asStaff(() => reviews.issue(appointment.id))).rejects.toBeInstanceOf(ForbiddenException);
      await expect(asOwner(() => reviews.issue(foreign.appointment))).rejects.toThrow(/not found|не найден/i);
      await expect(asOwner(() => reviews.issue(legacy.id))).rejects.toThrow(/completion time|врем/i);

      const doneAudit = await db.auditLog.findFirstOrThrow({
        where: { entityId: appointment.id, action: 'beauty.appointment.status' },
        orderBy: { createdAt: 'asc' },
      });
      const first = await asOwner(() => reviews.issue(appointment.id));
      expect(first.masterCount).toBe(2);
      expect(new Date(first.expiresAt).getTime()).toBe(doneAudit.createdAt.getTime() + 30 * 86_400_000);
      expect(first.reviewPath).toMatch(/^\/reviews\/[A-Za-z0-9_-]{40,}$/);
      const firstToken = first.reviewPath.split('/').at(-1)!;
      const stored = await db.beautyReviewInvitation.findUniqueOrThrow({ where: { appointmentId: appointment.id } });
      expect(stored.tokenHash).toMatch(/^[a-f0-9]{64}$/);
      expect(stored.tokenHash).not.toBe(firstToken);

      const publicView = await reviews.read(firstToken, { ip: '203.0.113.40' });
      expect(publicView).toMatchObject({ status: 'OPEN', expiresAt: first.expiresAt });
      expect(publicView.status === 'OPEN' ? publicView.masters.map((master) => master.name) : []).toEqual([
        'Master A',
        'Master B',
      ]);
      expect(JSON.stringify(publicView)).not.toMatch(new RegExp([own.customer, appointment.id, own.employeeA, own.employeeB].join('|')));

      const rotated = await asOwner(() => reviews.issue(appointment.id));
      expect(rotated.expiresAt).toBe(first.expiresAt);
      expect(rotated.reviewPath).not.toBe(first.reviewPath);
      await expect(reviews.read(firstToken, { ip: '203.0.113.41' })).rejects.toBeInstanceOf(NotFoundException);
      await expect(reviews.read(rotated.reviewPath.split('/').at(-1)!, { ip: '203.0.113.42' }))
        .resolves.toMatchObject({ status: 'OPEN' });
    } finally {
      const ids = [appointment.id, legacy.id];
      await db.beautyReviewInvitation.deleteMany({ where: { appointmentId: { in: ids } } });
      await db.appointmentLine.deleteMany({ where: { appointmentId: { in: ids } } });
      await db.appointment.deleteMany({ where: { id: { in: ids } } });
    }
  });

  it('отклоняет истёкший DONE и атомарно принимает выбранных мастеров только один раз', async () => {
    const expiredAt = '2036-12-01T11:00:00+05:00';
    const openAt = '2036-12-08T09:00:00+05:00';
    const expiredDay = await asOwner(() => appointments.create({
      startsAt: expiredAt,
      customerId: own.customer,
      items: [{ employeeId: own.employeeA, serviceId: own.serviceB }],
    }));
    const openDay = await asOwner(() => appointments.create({
      startsAt: openAt,
      customerId: own.customer,
      items: [
        { employeeId: own.employeeA, serviceId: own.serviceB },
        { employeeId: own.employeeB, serviceId: own.serviceB },
      ],
    }));
    const expired = expiredDay.appointments.find((row) => row.startsAt === new Date(expiredAt).toISOString())!;
    const open = openDay.appointments.find((row) => row.startsAt === new Date(openAt).toISOString())!;
    await asOwner(() => appointments.setStatus(expired.id, { status: 'DONE' }));
    await asOwner(() => appointments.setStatus(open.id, { status: 'DONE' }));
    try {
      const expiredAudit = await db.auditLog.findFirstOrThrow({
        where: { entityId: expired.id, action: 'beauty.appointment.status' },
        orderBy: { createdAt: 'asc' },
      });
      const afterExpiry = new BeautyReviewsService(
        { db } as unknown as PrismaService,
        () => new Date(expiredAudit.createdAt.getTime() + 31 * 86_400_000),
      );
      await expect(asOwner(() => afterExpiry.issue(expired.id))).rejects.toThrow(/expired|истек/i);

      const invitation = await asOwner(() => reviews.issue(open.id));
      const token = invitation.reviewPath.split('/').at(-1)!;
      const publicView = await reviews.read(token, { ip: '203.0.113.50' });
      if (publicView.status !== 'OPEN') throw new Error('Expected an open synthetic review invitation');
      const selected = publicView.masters.find((master) => master.name === 'Master B')!;
      await expect(reviews.submit(token, { reviews: [] }, { ip: '203.0.113.51' })).rejects.toThrow(/one|одн|rating|оцен/i);
      await expect(reviews.submit(token, {
        reviews: [{ masterKey: selected.key, stars: 0 }],
      }, { ip: '203.0.113.56' })).rejects.toThrow(/1.*5|оцен/i);
      await expect(reviews.submit(token, {
        reviews: [{ masterKey: 'a'.repeat(64), stars: 5 }],
      }, { ip: '203.0.113.57' })).rejects.toThrow(/master|мастер/i);

      const payload = { reviews: [{ masterKey: selected.key, stars: 5, comment: 'Synthetic selected review' }] };
      const attempts = await Promise.allSettled([
        reviews.submit(token, payload, { ip: '203.0.113.52' }),
        reviews.submit(token, payload, { ip: '203.0.113.53' }),
      ]);
      expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1);
      expect(attempts.filter((attempt) => attempt.status === 'rejected')).toHaveLength(1);
      expect(attempts.find((attempt) => attempt.status === 'fulfilled')).toMatchObject({
        value: { status: 'SUBMITTED', submittedCount: 1 },
      });
      expect(await db.beautyAppointmentReview.findMany({ where: { appointmentId: open.id } })).toEqual([
        expect.objectContaining({ employeeId: own.employeeB, stars: 5, comment: 'Synthetic selected review' }),
      ]);
      await expect(reviews.submit(token, payload, { ip: '203.0.113.54' })).rejects.toThrow(/submitted|отправлен/i);
      await expect(asOwner(() => reviews.issue(open.id))).rejects.toThrow(/submitted|отправлен/i);
      await expect(reviews.read(token, { ip: '203.0.113.55' })).resolves.toEqual({ status: 'SUBMITTED' });
    } finally {
      const ids = [expired.id, open.id];
      await db.beautyReviewInvitation.deleteMany({ where: { appointmentId: { in: ids } } });
      await db.beautyAppointmentReview.deleteMany({ where: { appointmentId: { in: ids } } });
      await db.appointmentLine.deleteMany({ where: { appointmentId: { in: ids } } });
      await db.appointment.deleteMany({ where: { id: { in: ids } } });
    }
  });

  it('сохраняет техкарту по revision, считает FIFO и списывает материалы только при первом DONE', async () => {
    type MaterialView = {
      serviceId: string;
      revision: number;
      locationId: string;
      currency: string;
      totalCostMinor: string | null;
      missingCost: boolean;
      items: Array<{
        productId: string;
        productName: string;
        unit: string;
        normQty: string;
        onHand: string;
        costMinor: string | null;
        active: boolean;
      }>;
      products: Array<{ id: string; name: string; unit: string; onHand: string; active: boolean }>;
    };
    const materialApi = catalog as unknown as {
      serviceMaterials(serviceId: string): Promise<MaterialView>;
      setServiceMaterials(serviceId: string, raw: unknown): Promise<MaterialView>;
    };
    const lotA = randomUUID();
    const lotB = randomUUID();
    await db.kitchenProduct.create({
      data: { id: own.productA, businessId: own.business, name: 'Synthetic color cream', unit: 'г' },
    });
    await db.kitchenStockLot.createMany({
      data: [
        {
          id: lotA, locationId: own.location, productId: own.productA,
          receivedOn: new Date('2036-09-01T00:00:00Z'), receivedQty: '1', remainingQty: '1', unitCost: 100000n,
        },
        {
          id: lotB, locationId: own.location, productId: own.productA,
          receivedOn: new Date('2036-09-02T00:00:00Z'), receivedQty: '4', remainingQty: '4', unitCost: 200000n,
        },
      ],
    });

    await expect(db.$queryRaw`SELECT count(*)::int FROM beauty_service_materials`).resolves.toBeDefined();
    const empty = await asOwner(() => materialApi.serviceMaterials(own.serviceB));
    expect(empty).toMatchObject({
      serviceId: own.serviceB,
      revision: 0,
      locationId: own.location,
      currency: 'KZT',
      totalCostMinor: '0',
      missingCost: false,
      items: [],
      products: [expect.objectContaining({ id: own.productA, unit: 'г', onHand: '5', active: true })],
    });

    const saved = await asOwner(() => materialApi.setServiceMaterials(own.serviceB, {
      expectedRevision: 0,
      items: [{ productId: own.productA, normQty: '2', unit: 'г' }],
    }));
    expect(saved).toMatchObject({
      revision: 1,
      totalCostMinor: '300',
      missingCost: false,
      items: [expect.objectContaining({ productId: own.productA, normQty: '2', onHand: '5', costMinor: '300' })],
    });
    await expect(asOwner(() => materialApi.setServiceMaterials(own.serviceB, {
      expectedRevision: 0,
      items: [],
    }))).rejects.toThrow(/изменена|верс|revision/i);

    const consumeAt = '2036-11-03T14:00:00+05:00';
    const created = await asOwner(() => appointments.create({
      startsAt: consumeAt,
      customerId: own.customer,
      items: [
        { employeeId: own.employeeA, serviceId: own.serviceB },
        { employeeId: own.employeeA, serviceId: own.serviceB },
      ],
    }));
    const consumed = created.appointments.find((row) => row.startsAt === new Date(consumeAt).toISOString())!;
    await asOwner(() => appointments.setStatus(consumed.id, { status: 'DONE' }));
    const consumedLines = await db.appointmentLine.findMany({ where: { appointmentId: consumed.id } });
    const movementSummary = await db.$queryRaw<Array<{ count: number; qty: string; cost: string; order_links: number }>>`
      SELECT count(*)::int AS count, COALESCE(sum(qty), 0)::text AS qty,
        COALESCE(sum(cost), 0)::text AS cost, count(order_id)::int AS order_links
      FROM kitchen_stock_movements
      WHERE appointment_line_id IN (${Prisma.join(consumedLines.map((line) => Prisma.sql`${line.id}::uuid`))})
        AND kind = 'CONSUMPTION'`;
    expect(movementSummary[0]).toEqual({ count: 3, qty: '-4.000', cost: '-700', order_links: 0 });
    expect((await db.kitchenStockLot.findUniqueOrThrow({ where: { id: lotB } })).remainingQty.toString()).toBe('1');
    // Provenance: DONE audit names the exact recipe revision and the stored consumption per line
    const doneAudit = await db.auditLog.findFirstOrThrow({
      where: { organizationId: own.org, entityId: consumed.id, action: 'beauty.appointment.status' },
      orderBy: { createdAt: 'desc' },
    });
    const orderedLines = [...consumedLines].sort((a, b) => a.position - b.position);
    expect(doneAudit.after).toEqual({
      status: 'DONE',
      materials: orderedLines.map((line) => ({
        appointmentLineId: line.id,
        serviceId: own.serviceB,
        recipeRevision: 1,
        items: [{ productId: own.productA, normQty: '2', unit: 'г' }],
      })),
    });
    expect(JSON.stringify(doneAudit.after)).not.toMatch(/Synthetic color cream|unitCost|lot/i);

    const cleared = await asOwner(() => materialApi.setServiceMaterials(own.serviceB, {
      expectedRevision: 1,
      items: [],
    }));
    expect(cleared.revision).toBe(2);
    // Provenance: every recipe save stores the exact previous revision and items
    const recipeAudits = await db.auditLog.findMany({
      where: { organizationId: own.org, entityId: own.serviceB, action: 'beauty.service.materials' },
      orderBy: { createdAt: 'asc' },
    });
    expect(recipeAudits.map((row) => [row.before, row.after])).toEqual([
      [{ revision: 0, items: [] }, { revision: 1, items: [{ productId: own.productA, normQty: '2', unit: 'г' }] }],
      [{ revision: 1, items: [{ productId: own.productA, normQty: '2', unit: 'г' }] }, { revision: 2, items: [] }],
    ]);
    const emptyAt = '2036-11-03T15:30:00+05:00';
    const emptyVisit = await asOwner(() => appointments.create({
      startsAt: emptyAt,
      customerId: own.customer,
      items: [{ employeeId: own.employeeA, serviceId: own.serviceB }],
    }));
    const emptyAppointment = emptyVisit.appointments.find((row) => row.startsAt === new Date(emptyAt).toISOString())!;
    await asOwner(() => appointments.setStatus(emptyAppointment.id, { status: 'DONE' }));
    await asOwner(() => materialApi.setServiceMaterials(own.serviceB, {
      expectedRevision: 2,
      items: [{ productId: own.productA, normQty: '1', unit: 'г' }],
    }));
    await db.appointment.update({ where: { id: emptyAppointment.id }, data: { status: 'BOOKED' } });
    await asOwner(() => appointments.setStatus(emptyAppointment.id, { status: 'DONE' }));
    const emptyMovements = await db.$queryRaw<Array<{ count: number }>>`
      SELECT count(*)::int AS count FROM kitchen_stock_movements movement
      JOIN appointment_lines line ON line.id = movement.appointment_line_id
      WHERE line.appointment_id = ${emptyAppointment.id}::uuid`;
    expect(emptyMovements[0]?.count).toBe(0);
    expect((await db.kitchenStockLot.findUniqueOrThrow({ where: { id: lotB } })).remainingQty.toString()).toBe('1');

    const insufficientAt = '2036-11-03T16:30:00+05:00';
    await asOwner(() => materialApi.setServiceMaterials(own.serviceB, {
      expectedRevision: 3,
      items: [{ productId: own.productA, normQty: '2', unit: 'г' }],
    }));
    const insufficientVisit = await asOwner(() => appointments.create({
      startsAt: insufficientAt,
      customerId: own.customer,
      items: [{ employeeId: own.employeeA, serviceId: own.serviceB }],
    }));
    const insufficient = insufficientVisit.appointments.find((row) => row.startsAt === new Date(insufficientAt).toISOString())!;
    await expect(asOwner(() => appointments.setStatus(insufficient.id, { status: 'DONE' })))
      .rejects.toThrow(/недостаточно|склад|Synthetic color cream/i);
    expect((await db.appointment.findUniqueOrThrow({ where: { id: insufficient.id } })).status).toBe('BOOKED');
    expect((await db.kitchenStockLot.findUniqueOrThrow({ where: { id: lotB } })).remainingQty.toString()).toBe('1');
  });
  it('new bookings respect salon breaks while existing visits remain unchanged', async () => {
    const oldAt = '2037-01-05T12:00:00+05:00';
    const oldDay = await asOwner(() => appointments.create({ startsAt: oldAt, customerId: own.customer,
      items: [{ employeeId: own.employeeA, serviceId: own.serviceB }] }));
    const old = oldDay.appointments.find((row) => row.startsAt === new Date(oldAt).toISOString())!;
    try {
      await db.$executeRaw`INSERT INTO beauty_location_hours(location_id, intervals, revision, updated_at)
        VALUES (${own.location}::uuid, '[{"weekday":1,"timeFrom":"09:00","timeTo":"12:00"},{"weekday":1,"timeFrom":"13:00","timeTo":"17:00"}]'::jsonb, 1, now())`;
      await expect(asOwner(() => appointments.create({ startsAt: '2037-01-05T12:30:00+05:00', customerId: own.customer,
        items: [{ employeeId: own.employeeB, serviceId: own.serviceB }] }))).rejects.toThrow(/салон|график|рабоч/i);
      const saved = await asOwner(() => appointments.create({ startsAt: '2037-01-05T10:00:00+05:00', customerId: own.customer,
        items: [{ employeeId: own.employeeB, serviceId: own.serviceB }] }));
      expect(saved.columns.find((column) => column.id === own.employeeA)?.intervals).toEqual([
        { timeFrom: '09:00', timeTo: '12:00' }, { timeFrom: '13:00', timeTo: '17:00' },
      ]);
      expect((await db.appointment.findUniqueOrThrow({ where: { id: old.id } })).startsAt.toISOString()).toBe(new Date(oldAt).toISOString());
    } finally {
      await db.$executeRaw`DELETE FROM beauty_location_hours WHERE location_id = ${own.location}::uuid`;
    }
  });

  it('salon hours configuration rejects lost updates, checks rights and reports existing conflicts', async () => {
    const hours = new BeautyLocationHoursService({ db } as unknown as PrismaService);
    const initial = await asOwner(() => hours.get());
    expect(initial).toMatchObject({ configured: false, revision: 0 });
    const startsAt = '2037-02-02T12:00:00+05:00';
    const visits = await asOwner(() => appointments.create({ startsAt, customerId: own.customer,
      items: [{ employeeId: own.employeeA, serviceId: own.serviceB }] }));
    const visit = visits.appointments.find((row) => row.startsAt === new Date(startsAt).toISOString())!;
    try {
      const intervals = [{ weekday: 1, timeFrom: '09:00', timeTo: '12:00' }, { weekday: 1, timeFrom: '13:00', timeTo: '18:00' }];
      await expect(asStaff(() => hours.save({ expectedRevision: 0, intervals }))).rejects.toThrow();
      const saved = await asOwner(() => hours.save({ expectedRevision: 0, intervals }));
      expect(saved).toMatchObject({ configured: true, revision: 1, intervals });
      expect(saved.conflicts).toEqual(expect.arrayContaining([expect.objectContaining({ id: visit.id })]));
      await expect(asOwner(() => hours.save({ expectedRevision: 0, intervals: [] }))).rejects.toThrow(/измен|revision|верс/i);
      expect((await asOwner(() => hours.get())).revision).toBe(1);
      expect((await db.appointment.findUniqueOrThrow({ where: { id: visit.id } })).startsAt.toISOString()).toBe(new Date(startsAt).toISOString());
    } finally {
      await db.$executeRaw`DELETE FROM beauty_location_hours WHERE location_id=${own.location}::uuid`;
    }
  });

  it('salon hours RLS hides another organization and the rollback refuses saved configuration', async () => {
    await db.beautyLocationHours.createMany({ data: [
      { locationId: own.location, intervals: [] }, { locationId: foreign.location, intervals: [] },
    ] });
    const schema = process.env.DATABASE_SCHEMA?.trim() || 'public';
    const client = new pg.Client({ connectionString: url, options: `-c search_path=${schema},public` });
    await client.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE wetop_app');
      await client.query(`SELECT set_config('app.org_id', $1, true)`, [own.org]);
      const result = await client.query<{location_id:string}>('SELECT location_id::text FROM beauty_location_hours');
      expect(result.rows).toEqual([{ location_id: own.location }]);
      await client.query('ROLLBACK');
      await client.query('BEGIN');
      await client.query('SAVEPOINT hours_rollback');
      const { readFileSync } = await import('node:fs');
      const down = readFileSync(resolve(import.meta.dirname, '../../packages/database/prisma/migrations/20261018000137_beauty_location_hours/down.sql'),'utf8').replace(/^BEGIN;\s*/,'').replace(/COMMIT;\s*$/,'');
      await expect(client.query(down)).rejects.toThrow(/Export salon opening hours/);
      await client.query('ROLLBACK TO SAVEPOINT hours_rollback');
      await client.query('DELETE FROM beauty_location_hours');
      await client.query(down);
      expect((await client.query("SELECT to_regclass($1) AS table_name", [`${schema}.beauty_location_hours`])).rows[0].table_name).toBeNull();
      await client.query('ROLLBACK');
      expect(await db.beautyLocationHours.count()).toBeGreaterThanOrEqual(2);
    } finally {
      await client.query('ROLLBACK').catch(() => undefined);
      await client.end();
      await db.beautyLocationHours.deleteMany({where:{locationId:{in:[own.location,foreign.location]}}});
    }
  });

  it('authorized salon hours writes work through the real restricted application role', async () => {
    const appUrl = new URL(url!); appUrl.username = 'wetop_app'; appUrl.password = '';
    const tenantDb = createPrismaClient(url, process.env.DATABASE_SCHEMA, { of: databaseTenant, appConnectionString: appUrl.toString() });
    try {
      const service = new BeautyLocationHoursService({ db: tenantDb } as unknown as PrismaService);
      const result = await asOwner(() => service.save({ expectedRevision: 0, intervals: [] }));
      expect(result).toMatchObject({ configured: true, revision: 1, intervals: [] });
    } finally {
      await db.beautyLocationHours.deleteMany({ where: { locationId: own.location } });
      await tenantDb.$disconnect();
    }
  });

  it('authorized private review links work through the real restricted application role', async () => {
    const startsAt = '2037-03-02T10:00:00+05:00';
    const day = await asOwner(() => appointments.create({ startsAt, customerId: own.customer,
      items: [{ employeeId: own.employeeA, serviceId: own.serviceB }] }));
    const visit = day.appointments.find(row => row.startsAt === new Date(startsAt).toISOString())!;
    await db.appointment.update({ where: { id: visit.id }, data: { status: 'DONE' } });
    await db.auditLog.create({ data: { organizationId: own.org, userId: own.user, entityType: 'appointment', entityId: visit.id, action: 'beauty.appointment.status', after: { status: 'DONE' } } });
    const appUrl = new URL(url!); appUrl.username = 'wetop_app'; appUrl.password = '';
    const tenantDb = createPrismaClient(url, process.env.DATABASE_SCHEMA, { of: databaseTenant, appConnectionString: appUrl.toString() });
    try {
      const service = new BeautyReviewsService({ db: tenantDb } as unknown as PrismaService);
      expect(await asOwner(() => service.issue(visit.id))).toMatchObject({ reviewPath: expect.stringMatching(/^\/reviews\//), masterCount: 1 });
    } finally {
      await db.beautyReviewInvitation.deleteMany({where:{appointmentId:visit.id}});
      await tenantDb.$disconnect();
    }
  });

});
