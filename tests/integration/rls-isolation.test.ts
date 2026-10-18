import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RLS_NO_TENANT_TABLES, RLS_TENANT_TABLES } from '@pms/database';
import { isLocalDatabase } from '../tools/seed-local';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;
class Rollback extends Error {}

// Explicit tenant inventory for the locally installed held package, not RLS exceptions.
const HELD_TENANT_TABLES = [
  'expense_categories', 'expense_documents', 'expense_settlements', 'payment_write_intents',
  'table_occupancy_sessions', 'table_occupancy_commands',
  'workload_tracking_coverage', 'resource_capacity_revisions', 'resource_capacity_intervals', 'workload_coverage_segments',
  'restaurant_opening_schedules', 'restaurant_opening_intervals', 'restaurant_opening_closures',
  'beauty_schedule_versions', 'beauty_capacity_intervals', 'appointment_workload_revisions',
  'appointment_lines', 'employee_service_prices',
  'hospitality_workload_versions', 'hospitality_workload_sources',
] as const;
let TENANT_TABLES: readonly string[] = RLS_TENANT_TABLES;

/**
 * Row Level Security (план `plans/rls-2026-09-27.md` шаг 1, DATA_MODEL §17, ADR-103). Замок в приложении (ADR-061)
 * обходится любым запросом мимо резолвера объекта; здесь проверяется замок в самой базе.
 *
 * Как: в транзакции, которая откатывается, заводятся две организации — «своя» получает новый объект с номером,
 * бронью, гостем и счётом, «чужая» — свой пустой объект и одного гостя. Seed/history не перепривязываются. Затем под ролью `wetop_app` с переменной
 * `app.org_id`:
 * - чужая организация видит 0 строк объекта в КАЖДОЙ таблице арендатора;
 * - своя — видит свои строки и не видит гостя чужой;
 * - без переменной — ни одной строки;
 * - записать бронь в чужой объект нельзя.
 * Отдельно: каждая таблица схемы названа либо арендаторской, либо осознанно без RLS — новая таблица не проскочит.
 */
describe.skipIf(!url)('RLS: организации разделены в самой базе (integration, DATABASE_URL required)', () => {
  let client: pg.Client;
  beforeAll(async () => {
    // Схема набора integration (DATABASE_SCHEMA = pms_test, ADR-042), как у Prisma-клиента: на чистой базе CI
    // в public таблиц нет, а на стенде разработчика public это рабочие данные
    const schema = process.env.DATABASE_SCHEMA?.trim() || 'public';
    client = new pg.Client({ connectionString: url, options: `-c search_path=${schema},public` });
    await client.connect();
    const installedHeld = await client.query<{ tablename: string }>(
      'SELECT tablename FROM pg_tables WHERE schemaname=current_schema() AND tablename=ANY($1::text[])',
      [HELD_TENANT_TABLES],
    );
    // Baseline CI has none of this opt-in package. Partial installation must fail, not waive any table.
    expect([0, HELD_TENANT_TABLES.length], 'held tenant schema must be wholly absent or wholly installed').toContain(installedHeld.rows.length);
    TENANT_TABLES = [...RLS_TENANT_TABLES, ...(installedHeld.rows.length ? HELD_TENANT_TABLES : [])];
  });
  afterAll(async () => {
    await client?.end();
  });

  /** Всё внутри транзакции, которая откатывается: тестовая база не меняется */
  async function inRollback(fn: () => Promise<void>): Promise<void> {
    await client.query('BEGIN');
    try {
      await fn();
      throw new Rollback();
    } catch (e) {
      await client.query('ROLLBACK');
      if (!(e instanceof Rollback)) throw e;
    }
  }

  /** Сколько строк таблицы видно роли `wetop_app` с этой организацией (пусто — переменная не задана) */
  async function visible(table: string, organizationId: string): Promise<number> {
    await client.query('SAVEPOINT look');
    try {
      await client.query('SET LOCAL ROLE wetop_app');
      await client.query(`SELECT set_config('app.org_id', $1, true)`, [organizationId]);
      const res = await client.query<{ n: string }>(`SELECT count(*)::text AS n FROM "${table}"`);
      return Number(res.rows[0]!.n);
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT look');
    }
  }

  async function seedTwoOrganizations(): Promise<{ own: string; other: string; otherGuest: string; property: string }> {
    const own = randomUUID();
    const other = randomUUID();
    const property = randomUUID(), business = randomUUID(), location = randomUUID();
    const building = randomUUID(), floor = randomUUID(), room = randomUUID(), category = randomUUID();
    const unit = randomUUID(), guest = randomUUID(), reservation = randomUUID(), item = randomUUID();
    await client.query(`INSERT INTO organizations (id, name) VALUES ($1, 'RLS own'), ($2, 'RLS other')`, [own, other]);
    // Never reparent seeded rows: retained occupancy/workload history pins its parents.
    // Build a fresh complete chain, leaving every existing tenant and audit row untouched.
    await client.query(`INSERT INTO businesses(id,organization_id,name,vertical,updated_at) VALUES($1,$2,'RLS own','HOSPITALITY',now())`, [business,own]);
    await client.query(`INSERT INTO locations(id,business_id,name,timezone,currency,updated_at) VALUES($1,$2,'RLS own','Asia/Almaty','KZT',now())`, [location,business]);
    await client.query(`INSERT INTO properties(id,organization_id,location_id,name,timezone,currency,check_in_time,check_out_time,updated_at) VALUES($1,$2,$3,'RLS own','Asia/Almaty','KZT','14:00','12:00',now())`, [property,own,location]);
    await client.query(`INSERT INTO buildings(id,property_id,name) VALUES($1,$2,'RLS own')`, [building,property]);
    await client.query(`INSERT INTO floors(id,building_id,name) VALUES($1,$2,'RLS own')`, [floor,building]);
    await client.query(`INSERT INTO physical_rooms(id,floor_id,room_number,capacity,updated_at) VALUES($1,$2,'RLS own',1,now())`, [room,floor]);
    await client.query(`INSERT INTO accommodation_types(id,property_id,code,name,kind,capacity_adults,updated_at) VALUES($1,$2,'RLS','RLS own','PRIVATE_ROOM',1,now())`, [category,property]);
    await client.query(`INSERT INTO inventory_units(id,property_id,physical_room_id,accommodation_type_id,kind,code,updated_at) VALUES($1,$2,$3,$4,'ROOM','RLS',now())`, [unit,property,room,category]);
    await client.query(`INSERT INTO guests(id,organization_id,first_name,last_name,updated_at) VALUES($1,$2,'Synthetic','RLS own',now())`, [guest,own]);
    await client.query(`INSERT INTO reservations(id,property_id,confirmation_number,status,source,arrival_date,departure_date,adults,currency,total_amount,updated_at) VALUES($1::uuid,$2,$1::text,'CONFIRMED','DESK','2040-01-01','2040-01-02',1,'KZT',100,now())`, [reservation,property]);
    await client.query(`INSERT INTO reservation_items(id,reservation_id,accommodation_type_id,arrival_date,departure_date,price,status,updated_at) VALUES($1,$2,$3,'2040-01-01','2040-01-02',100,'CONFIRMED',now())`, [item,reservation,category]);
    await client.query(`INSERT INTO allocations(id,reservation_item_id,inventory_unit_id,start_date,end_date) VALUES($1,$2,$3,'2040-01-01','2040-01-02')`, [randomUUID(),item,unit]);
    await client.query(`INSERT INTO folios(id,reservation_item_id,currency) VALUES($1,$2,'KZT')`, [randomUUID(),item]);
    // у чужого объекта своя цепочка Business → Location (Platform P1, DATA_MODEL v2.6: location_id NOT NULL)
    const otherBusiness = randomUUID();
    const otherLocation = randomUUID();
    await client.query(
      `INSERT INTO businesses (id, organization_id, name, vertical, updated_at) VALUES ($1, $2, 'RLS other', 'HOSPITALITY', now())`,
      [otherBusiness, other],
    );
    await client.query(
      `INSERT INTO locations (id, business_id, name, timezone, currency, updated_at)
       VALUES ($1, $2, 'Чужой объект (RLS)', 'Asia/Almaty', 'KZT', now())`,
      [otherLocation, otherBusiness],
    );
    await client.query(
      `INSERT INTO properties (id, organization_id, location_id, name, timezone, currency, check_in_time, check_out_time, updated_at)
       VALUES ($1, $2, $3, 'Чужой объект (RLS)', 'Asia/Almaty', 'KZT', '14:00', '12:00', now())`,
      [randomUUID(), other, otherLocation],
    );
    const otherGuest = randomUUID();
    await client.query(
      `INSERT INTO guests (id, organization_id, first_name, last_name, updated_at) VALUES ($1, $2, 'Тест', 'Чужой', now())`,
      [otherGuest, other],
    );
    return { own, other, otherGuest, property };
  }

  it('каждая таблица схемы названа: арендаторская под RLS или осознанно без него', async () => {
    // служебные таблицы миграций: Prisma и схемы автотестов pms_test (tests/tools/test-schema.ts)
    const res = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'
          AND table_name NOT IN ('_prisma_migrations', '_test_migrations', '_test_meta')`,
    );
    const known = new Set([...TENANT_TABLES, ...RLS_NO_TENANT_TABLES]);
    expect(res.rows.map((r) => r.table_name).filter((t) => !known.has(t)).sort()).toEqual([]);
    const rls = await client.query<{ relname: string; relforcerowsecurity: boolean }>(
      `SELECT c.relname, c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = current_schema() AND c.relkind = 'r' AND c.relrowsecurity`,
    );
    expect(rls.rows.map((r) => r.relname).sort()).toEqual([...TENANT_TABLES].sort());
    expect(rls.rows.filter((r) => (HELD_TENANT_TABLES as readonly string[]).includes(r.relname) && !r.relforcerowsecurity).map((r) => r.relname), 'held tenant tables require FORCE RLS').toEqual([]);
    const barTables = RLS_TENANT_TABLES.filter((table) => table.startsWith('bar_'));
    expect(
      rls.rows.filter((row) => barTables.includes(row.relname) && !row.relforcerowsecurity).map((row) => row.relname).sort(),
      'таблицы бара без FORCE ROW LEVEL SECURITY',
    ).toEqual([]);
  });

  it('чужая организация не видит ни одной строки объекта ни в одной таблице; своя — видит свои', async () => {
    await inRollback(async () => {
      const { own, other } = await seedTwoOrganizations();
      const leaks: string[] = [];
      let ownSeen = 0;
      for (const table of TENANT_TABLES) {
        const all = Number((await client.query(`SELECT count(*) FROM "${table}"`)).rows[0].count);
        const asOther = await visible(table, other);
        const asOwn = await visible(table, own);
        // у «чужой» — только её организация, её бизнес, филиал, объект и гость; строки тестовой базы ей не видны
        const otherOwn = ['organizations', 'businesses', 'locations', 'properties', 'guests'].includes(table) ? 1 : 0;
        if (asOther !== otherOwn) leaks.push(`${table}: чужой видно ${asOther} из ${all}`);
        if (['organizations', 'businesses', 'locations', 'properties', 'buildings', 'floors', 'physical_rooms', 'accommodation_types', 'inventory_units', 'guests', 'reservations', 'reservation_items', 'allocations', 'folios'].includes(table)) expect(asOwn, `own fixture: ${table}`).toBe(1);
        if (asOwn > 0) ownSeen += 1;
      }
      expect(leaks).toEqual([]);
      // Свежая цепочка гарантирует положительный контроль, не изменяя строки тестовой базы.
      expect(ownSeen).toBeGreaterThanOrEqual(5);
    });
  });

  it('гость чужой организации не виден своей; без переменной не видно ничего', async () => {
    await inRollback(async () => {
      const { own, otherGuest } = await seedTwoOrganizations();
      await client.query('SAVEPOINT look');
      await client.query('SET LOCAL ROLE wetop_app');
      await client.query(`SELECT set_config('app.org_id', $1, true)`, [own]);
      const found = await client.query(`SELECT id FROM guests WHERE id = $1`, [otherGuest]);
      expect(found.rowCount).toBe(0);
      await client.query('ROLLBACK TO SAVEPOINT look');
      for (const table of TENANT_TABLES) {
        expect(await visible(table, '')).toBe(0);
      }
    });
  });

  it('записать бронь в объект чужой организации нельзя — отказ базы', async () => {
    await inRollback(async () => {
      const { other, property } = await seedTwoOrganizations();
      await client.query('SAVEPOINT write');
      await client.query('SET LOCAL ROLE wetop_app');
      await client.query(`SELECT set_config('app.org_id', $1, true)`, [other]);
      await expect(
        client.query(
          `INSERT INTO reservations (id, property_id, confirmation_number, status, source, arrival_date, departure_date,
                                     adults, currency, total_amount, updated_at)
           VALUES ($1, $2, 'RLS-1', 'CONFIRMED', 'DESK', '2026-10-01', '2026-10-02', 1, 'KZT', 0, now())`,
          [randomUUID(), property],
        ),
      ).rejects.toThrow(/row-level security/);
      await client.query('ROLLBACK TO SAVEPOINT write');
    });
  });

  it('служебная роль видит объект целиком — фоновые циклы и вебхуки работают как раньше', async () => {
    await inRollback(async () => {
      await seedTwoOrganizations();
      await client.query('SAVEPOINT svc');
      await client.query('SET LOCAL ROLE wetop_service');
      const all = await client.query(`SELECT count(*)::int AS n FROM properties`);
      expect(all.rows[0].n).toBeGreaterThanOrEqual(2);
      await client.query('ROLLBACK TO SAVEPOINT svc');
    });
  });
});

/**
 * Проверки «на всю установку» внутри запроса организации (RLS, DATA_MODEL §17): кто оператор Channex — ответ не должен
 * зависеть от того, кто спросил. Под ролью организации объект Luxx другой гостинице не виден; служебная роль видит.
 *
 * Пул организации входит в базу отдельным пользователем. Сама `wetop_app` — без входа (`NOLOGIN`: вход на сервере
 * включает владелец, `docs/ops/rls.md` этап 1), поэтому тест на время прогона заводит свою роль — члена `wetop_app` со
 * случайным паролем: права и политики `TO wetop_app` действуют на члена роли так же. `wetop_app` не меняется. Только на
 * локальной базе — свой кластер или служба PostgreSQL в CI: на общей базе роли не заводим.
 */
describe.skipIf(!url || !isLocalDatabase(url))('RLS: служебный доступ внутри запроса организации', () => {
  const probe = `rls_probe_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const password = randomUUID().replace(/-/g, '');
  let admin: pg.Client;
  beforeAll(async () => {
    admin = new pg.Client({ connectionString: url });
    await admin.connect();
    await admin.query(`CREATE ROLE "${probe}" LOGIN PASSWORD '${password}' IN ROLE wetop_app`);
  });
  afterAll(async () => {
    await admin?.query(`DROP ROLE IF EXISTS "${probe}"`);
    await admin?.end();
  });

  it('withServiceDatabase уводит запрос со служебной роли: чужой объект виден, в обычном запросе — нет', async () => {
    const { createPrismaClient } = await import('@pms/database');
    const ctx = await import('../../apps/api/src/auth/request-context');
    const app = new URL(url!);
    app.username = probe;
    app.password = password;
    const appUrl = app.toString();
    const db = createPrismaClient(url, undefined, { of: ctx.databaseTenant, appConnectionString: appUrl });
    try {
      const property = await db.property.findFirstOrThrow({ orderBy: { createdAt: 'asc' } });
      const stranger = '9e9e9e9e-8c7b-4e3a-a1f0-6b9c2d4e8f00';
      const actor = { userId: 'u', organizationId: stranger };
      const asStranger = await ctx.withSignedInUser(actor, () => db.property.findFirst({ where: { id: property.id } }));
      expect(asStranger).toBeNull();
      const viaService = await ctx.withSignedInUser(actor, () =>
        ctx.withServiceDatabase(() => db.property.findFirst({ where: { id: property.id } })),
      );
      expect(viaService?.id).toBe(property.id);
    } finally {
      await db.$disconnect();
    }
  });
});
