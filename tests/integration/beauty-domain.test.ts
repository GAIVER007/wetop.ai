import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

/**
 * Beauty-домен на настоящей схеме (DATA_MODEL §19.1, срез B1): что держит база, а не код.
 * Пересечение записей одного мастера, принадлежность филиала, услуги и клиента, окно записи, RLS.
 * Данные вымышленные (ADR-010), после прогона удаляются.
 */
describe.skipIf(!url)('Beauty: ограничения и триггеры базы (integration, DATA_MODEL §19.1)', () => {
  let db: Db;

  // две организации: своя и соседняя, у каждой бизнес BEAUTY с филиалом
  const own = { org: randomUUID(), business: randomUUID(), location: randomUUID(), other: randomUUID() };
  const neighbour = { org: randomUUID(), business: randomUUID(), location: randomUUID() };
  const ids = {
    customer: randomUUID(),
    neighbourCustomer: randomUUID(),
    employee: randomUUID(),
    otherEmployee: randomUUID(),
    service: randomUUID(),
    neighbourService: randomUUID(),
  };

  async function sql(text: string): Promise<void> {
    await db.$executeRawUnsafe(text);
  }

  async function rejects(text: string, match: RegExp): Promise<void> {
    await expect(sql(text)).rejects.toThrow(match);
  }

  beforeAll(async () => {
    db = createPrismaClient(url);
    await cleanup();
    for (const o of [own, neighbour]) {
      await sql(`INSERT INTO "organizations" ("id", "name") VALUES ('${o.org}', 'Тест Beauty ${o.org.slice(0, 8)}')`);
      await sql(
        `INSERT INTO "businesses" ("id", "organization_id", "name", "vertical", "updated_at")
         VALUES ('${o.business}', '${o.org}', 'Салон ${o.org.slice(0, 8)}', 'BEAUTY', now())`,
      );
      await sql(
        `INSERT INTO "locations" ("id", "business_id", "name", "timezone", "currency", "updated_at")
         VALUES ('${o.location}', '${o.business}', 'Филиал ${o.org.slice(0, 8)}', 'Asia/Almaty', 'KZT', now())`,
      );
    }
    // второй бизнес своей организации: его филиал чужой для мастеров первого
    await sql(
      `INSERT INTO "businesses" ("id", "organization_id", "name", "vertical", "updated_at")
       VALUES ('${own.other}', '${own.org}', 'Второй салон', 'BEAUTY', now())`,
    );

    await sql(
      `INSERT INTO "customers" ("id", "organization_id", "first_name", "updated_at")
       VALUES ('${ids.customer}', '${own.org}', 'Айгуль', now())`,
    );
    await sql(
      `INSERT INTO "customers" ("id", "organization_id", "first_name", "updated_at")
       VALUES ('${ids.neighbourCustomer}', '${neighbour.org}', 'Соседка', now())`,
    );
    await sql(
      `INSERT INTO "employees" ("id", "business_id", "name", "updated_at")
       VALUES ('${ids.employee}', '${own.business}', 'Мастер Дина', now())`,
    );
    await sql(
      `INSERT INTO "employees" ("id", "business_id", "name", "updated_at")
       VALUES ('${ids.otherEmployee}', '${own.business}', 'Мастер Жанна', now())`,
    );
    await sql(
      `INSERT INTO "beauty_services" ("id", "business_id", "name", "duration_minutes", "price", "currency", "updated_at")
       VALUES ('${ids.service}', '${own.business}', 'Маникюр', 60, 800000, 'KZT', now())`,
    );
    await sql(
      `INSERT INTO "beauty_services" ("id", "business_id", "name", "duration_minutes", "price", "currency", "updated_at")
       VALUES ('${ids.neighbourService}', '${neighbour.business}', 'Стрижка', 45, 500000, 'KZT', now())`,
    );
    // мастера работают в своём филиале, услуга в нём включена
    await sql(
      `INSERT INTO "employee_locations" ("employee_id", "location_id") VALUES ('${ids.employee}', '${own.location}')`,
    );
    await sql(
      `INSERT INTO "employee_locations" ("employee_id", "location_id") VALUES ('${ids.otherEmployee}', '${own.location}')`,
    );
    await sql(
      `INSERT INTO "location_services" ("location_id", "service_id", "updated_at")
       VALUES ('${own.location}', '${ids.service}', now())`,
    );
  });

  async function cleanup() {
    const orgs = [own.org, neighbour.org].map((v) => `'${v}'`).join(', ');
    for (const stmt of [
      `DELETE FROM "appointments" WHERE "location_id" IN (SELECT "id" FROM "locations" WHERE "business_id" IN (SELECT "id" FROM "businesses" WHERE "organization_id" IN (${orgs})))`,
      `DELETE FROM "working_hours" WHERE "employee_id" IN (SELECT "id" FROM "employees" WHERE "business_id" IN (SELECT "id" FROM "businesses" WHERE "organization_id" IN (${orgs})))`,
      `DELETE FROM "time_offs" WHERE "employee_id" IN (SELECT "id" FROM "employees" WHERE "business_id" IN (SELECT "id" FROM "businesses" WHERE "organization_id" IN (${orgs})))`,
      `DELETE FROM "employee_services" WHERE "employee_id" IN (SELECT "id" FROM "employees" WHERE "business_id" IN (SELECT "id" FROM "businesses" WHERE "organization_id" IN (${orgs})))`,
      `DELETE FROM "employee_locations" WHERE "employee_id" IN (SELECT "id" FROM "employees" WHERE "business_id" IN (SELECT "id" FROM "businesses" WHERE "organization_id" IN (${orgs})))`,
      `DELETE FROM "location_services" WHERE "service_id" IN (SELECT "id" FROM "beauty_services" WHERE "business_id" IN (SELECT "id" FROM "businesses" WHERE "organization_id" IN (${orgs})))`,
      `DELETE FROM "customer_businesses" WHERE "customer_id" IN (SELECT "id" FROM "customers" WHERE "organization_id" IN (${orgs}))`,
      `DELETE FROM "beauty_services" WHERE "business_id" IN (SELECT "id" FROM "businesses" WHERE "organization_id" IN (${orgs}))`,
      `DELETE FROM "employees" WHERE "business_id" IN (SELECT "id" FROM "businesses" WHERE "organization_id" IN (${orgs}))`,
      `DELETE FROM "customers" WHERE "organization_id" IN (${orgs})`,
      `DELETE FROM "locations" WHERE "business_id" IN (SELECT "id" FROM "businesses" WHERE "organization_id" IN (${orgs}))`,
      `DELETE FROM "businesses" WHERE "organization_id" IN (${orgs})`,
      `DELETE FROM "organizations" WHERE "id" IN (${orgs})`,
    ]) {
      await db.$executeRawUnsafe(stmt).catch(() => undefined);
    }
  }

  afterAll(async () => {
    if (!db) return;
    await cleanup();
    await db.$disconnect();
  });

  function appointment(opts: {
    id?: string;
    employee?: string;
    service?: string;
    customer?: string;
    location?: string;
    from: string;
    to: string;
    status?: string;
  }): string {
    return `INSERT INTO "appointments"
      ("id", "location_id", "customer_id", "employee_id", "service_id", "starts_at", "ends_at", "status", "price", "currency", "updated_at")
      VALUES ('${opts.id ?? randomUUID()}', '${opts.location ?? own.location}', '${opts.customer ?? ids.customer}',
        '${opts.employee ?? ids.employee}', '${opts.service ?? ids.service}',
        '${opts.from}', '${opts.to}', '${opts.status ?? 'BOOKED'}', 800000, 'KZT', now())`;
  }

  it('связка клиента с бизнесом: свой бизнес можно, чужая организация нет', async () => {
    await sql(
      `INSERT INTO "customer_businesses" ("customer_id", "business_id") VALUES ('${ids.customer}', '${own.business}')`,
    );
    await rejects(
      `INSERT INTO "customer_businesses" ("customer_id", "business_id") VALUES ('${ids.customer}', '${neighbour.business}')`,
      /организац/i,
    );
  });

  it('мастер в филиале чужого бизнеса не работает', async () => {
    await rejects(
      `INSERT INTO "employee_locations" ("employee_id", "location_id") VALUES ('${ids.employee}', '${neighbour.location}')`,
      /бизнес/i,
    );
  });

  it('филиал включает только услуги своего бизнеса', async () => {
    await rejects(
      `INSERT INTO "location_services" ("location_id", "service_id", "updated_at")
       VALUES ('${own.location}', '${ids.neighbourService}', now())`,
      /бизнес/i,
    );
  });

  it('мастер умеет только услуги своего бизнеса', async () => {
    await sql(
      `INSERT INTO "employee_services" ("employee_id", "service_id") VALUES ('${ids.employee}', '${ids.service}')`,
    );
    await rejects(
      `INSERT INTO "employee_services" ("employee_id", "service_id") VALUES ('${ids.employee}', '${ids.neighbourService}')`,
      /бизнес/i,
    );
  });

  it('график ставится только там, где мастер работает; конец позже начала', async () => {
    await sql(
      `INSERT INTO "working_hours" ("id", "employee_id", "location_id", "weekday", "time_from", "time_to", "updated_at")
       VALUES ('${randomUUID()}', '${ids.employee}', '${own.location}', 1, '10:00', '19:00', now())`,
    );
    await rejects(
      `INSERT INTO "working_hours" ("id", "employee_id", "location_id", "weekday", "time_from", "time_to", "updated_at")
       VALUES ('${randomUUID()}', '${ids.employee}', '${neighbour.location}', 1, '10:00', '19:00', now())`,
      /филиал/i,
    );
    await rejects(
      `INSERT INTO "working_hours" ("id", "employee_id", "location_id", "weekday", "time_from", "time_to", "updated_at")
       VALUES ('${randomUUID()}', '${ids.employee}', '${own.location}', 1, '19:00', '10:00', now())`,
      /working_hours_span|check/i,
    );
  });

  it('отсутствие: конец не раньше начала', async () => {
    await sql(
      `INSERT INTO "time_offs" ("id", "employee_id", "date_from", "date_to", "updated_at")
       VALUES ('${randomUUID()}', '${ids.employee}', '2026-10-05', '2026-10-07', now())`,
    );
    await rejects(
      `INSERT INTO "time_offs" ("id", "employee_id", "date_from", "date_to", "updated_at")
       VALUES ('${randomUUID()}', '${ids.employee}', '2026-10-07', '2026-10-05', now())`,
      /time_offs_range|check/i,
    );
  });

  it('записи одного мастера не пересекаются: это запрещает база', async () => {
    await sql(appointment({ from: '2026-10-05T05:00:00Z', to: '2026-10-05T06:00:00Z' }));
    // пересечение
    await rejects(
      appointment({ from: '2026-10-05T05:30:00Z', to: '2026-10-05T06:30:00Z' }),
      /appointments_no_overlap|conflict/i,
    );
    // встык разрешено: граница правая открытая
    await sql(appointment({ from: '2026-10-05T06:00:00Z', to: '2026-10-05T07:00:00Z' }));
    // другой мастер в то же время можно
    await sql(
      appointment({ employee: ids.otherEmployee, from: '2026-10-05T05:00:00Z', to: '2026-10-05T06:00:00Z' }),
    );
  });

  it('отменённая и незаезд место не держат', async () => {
    const cancelled = randomUUID();
    await sql(
      appointment({ id: cancelled, from: '2026-10-06T05:00:00Z', to: '2026-10-06T06:00:00Z', status: 'CANCELLED' }),
    );
    await sql(
      appointment({ from: '2026-10-06T05:00:00Z', to: '2026-10-06T06:00:00Z', status: 'NO_SHOW' }),
    );
    // живая запись на то же время встаёт поверх отменённой
    await sql(appointment({ from: '2026-10-06T05:00:00Z', to: '2026-10-06T06:00:00Z' }));
  });

  it('окно записи: конец позже начала', async () => {
    await rejects(
      appointment({ from: '2026-10-07T06:00:00Z', to: '2026-10-07T05:00:00Z' }),
      /appointments_span|check/i,
    );
  });

  it('запись сходится по мастеру, услуге и клиенту с филиалом', async () => {
    // мастер не работает в этом филиале
    await rejects(
      appointment({ location: neighbour.location, from: '2026-10-08T05:00:00Z', to: '2026-10-08T06:00:00Z' }),
      /филиал/i,
    );
    // услуга в филиале не включена
    await rejects(
      appointment({ service: ids.neighbourService, from: '2026-10-08T05:00:00Z', to: '2026-10-08T06:00:00Z' }),
      /услуг/i,
    );
    // клиент другой организации
    await rejects(
      appointment({ customer: ids.neighbourCustomer, from: '2026-10-08T05:00:00Z', to: '2026-10-08T06:00:00Z' }),
      /организац/i,
    );
  });

  it('все десять таблиц под RLS с политикой rls_tenant', async () => {
    const tables = [
      'appointments',
      'beauty_services',
      'customer_businesses',
      'customers',
      'employee_locations',
      'employee_services',
      'employees',
      'location_services',
      'time_offs',
      'working_hours',
    ];
    const rows = await db.$queryRawUnsafe<{ tablename: string; policyname: string }[]>(
      `SELECT tablename, policyname FROM pg_policies
       WHERE schemaname = current_schema() AND tablename IN (${tables.map((t) => `'${t}'`).join(', ')})
       ORDER BY tablename`,
    );
    expect(rows.map((r) => r.tablename)).toEqual(tables);
    expect([...new Set(rows.map((r) => r.policyname))]).toEqual(['rls_tenant']);
  });
});
