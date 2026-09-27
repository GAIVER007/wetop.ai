import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RLS_NO_TENANT_TABLES, RLS_TENANT_TABLES } from '@pms/database';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;
class Rollback extends Error {}

/**
 * Row Level Security (план `plans/rls-2026-09-27.md` шаг 1, DATA_MODEL §17, ADR-103). Замок в приложении (ADR-061)
 * обходится любым запросом мимо резолвера объекта; здесь проверяется замок в самой базе.
 *
 * Как: в транзакции, которая откатывается, заводятся две организации — «своя» получает объект тестовой базы со всеми
 * его бронями, гостями и счетами, «чужая» — свой пустой объект и одного гостя. Затем под ролью `wetop_app` с переменной
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
    client = new pg.Client({ connectionString: url });
    await client.connect();
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
    const property = (await client.query<{ id: string }>(`SELECT id FROM properties ORDER BY created_at LIMIT 1`)).rows[0]!.id;
    await client.query(`INSERT INTO organizations (id, name) VALUES ($1, 'RLS own'), ($2, 'RLS other')`, [own, other]);
    await client.query(`UPDATE properties SET organization_id = $1 WHERE id = $2`, [own, property]);
    // все гости и записи журнала тестовой базы — объекта «своей» организации
    await client.query(`SELECT set_config('wetop.audit_purge', 'on', true)`);
    await client.query(`UPDATE guests SET organization_id = $1`, [own]);
    await client.query(`UPDATE audit_logs SET organization_id = $1`, [own]);
    await client.query(`SELECT set_config('wetop.audit_purge', '', true)`);
    await client.query(
      `INSERT INTO properties (id, organization_id, name, timezone, currency, check_in_time, check_out_time, updated_at)
       VALUES ($1, $2, 'Чужой объект (RLS)', 'Asia/Almaty', 'KZT', '14:00', '12:00', now())`,
      [randomUUID(), other],
    );
    const otherGuest = randomUUID();
    await client.query(
      `INSERT INTO guests (id, organization_id, first_name, last_name, updated_at) VALUES ($1, $2, 'Тест', 'Чужой', now())`,
      [otherGuest, other],
    );
    return { own, other, otherGuest, property };
  }

  it('каждая таблица схемы названа: арендаторская под RLS или осознанно без него', async () => {
    const res = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = current_schema() AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations'`,
    );
    const known = new Set([...RLS_TENANT_TABLES, ...RLS_NO_TENANT_TABLES]);
    expect(res.rows.map((r) => r.table_name).filter((t) => !known.has(t)).sort()).toEqual([]);
    const rls = await client.query<{ relname: string }>(
      `SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = current_schema() AND c.relkind = 'r' AND c.relrowsecurity`,
    );
    expect(rls.rows.map((r) => r.relname).sort()).toEqual([...RLS_TENANT_TABLES].sort());
  });

  it('чужая организация не видит ни одной строки объекта ни в одной таблице; своя — видит свои', async () => {
    await inRollback(async () => {
      const { own, other } = await seedTwoOrganizations();
      const leaks: string[] = [];
      let ownSeen = 0;
      for (const table of RLS_TENANT_TABLES) {
        const all = Number((await client.query(`SELECT count(*) FROM "${table}"`)).rows[0].count);
        const asOther = await visible(table, other);
        const asOwn = await visible(table, own);
        // у «чужой» — только её объект, её организация, её гость; строки тестовой базы ей не видны
        const otherOwn = table === 'organizations' || table === 'properties' || table === 'guests' ? 1 : 0;
        if (asOther !== otherOwn) leaks.push(`${table}: чужой видно ${asOther} из ${all}`);
        if (asOwn > 0) ownSeen += 1;
      }
      expect(leaks).toEqual([]);
      // у своей организации строки есть хотя бы в брони, объекте, гостях и счетах тестовой базы
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
      for (const table of ['reservations', 'guests', 'properties', 'folios', 'audit_logs']) {
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
 */
describe.skipIf(!url)('RLS: служебный доступ внутри запроса организации', () => {
  it('withServiceDatabase уводит запрос со служебной роли: чужой объект виден, в обычном запросе — нет', async () => {
    const { createPrismaClient } = await import('@pms/database');
    const ctx = await import('../../apps/api/src/auth/request-context');
    const appUrl = url!.replace(/\/\/[^@/]*@/, '//wetop_app@');
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
