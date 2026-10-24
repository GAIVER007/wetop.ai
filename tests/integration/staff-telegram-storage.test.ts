import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * STAFF-TG-20261020 (DATA_MODEL, миграция 20261024000154_staff_telegram_notifications): привязка Telegram, коды и
 * очередь уведомлений. Держит FORCE RLS, права ролей, уникальность события на сотрудника и отказ отката с данными.
 * Все данные вымышленные и живут в откатываемой транзакции.
 */
const url = process.env.DATABASE_URL;
const MIGRATION = resolve(
  import.meta.dirname,
  '../../packages/database/prisma/migrations/20261024000154_staff_telegram_notifications',
);
const TABLES = ['staff_notifications', 'staff_telegram_link_codes', 'staff_telegram_links'];
class Rollback extends Error {}

describe.skipIf(!url)('STAFF-TG: хранение привязок и очереди уведомлений (integration)', () => {
  let db: pg.Client;
  const id = {
    own: randomUUID(),
    other: randomUUID(),
    business: randomUUID(),
    location: randomUUID(),
    otherBusiness: randomUUID(),
    otherLocation: randomUUID(),
    user: randomUUID(),
    stranger: randomUUID(),
    source: randomUUID(),
  };

  beforeAll(async () => {
    const schema = process.env.DATABASE_SCHEMA?.trim() || 'public';
    db = new pg.Client({ connectionString: url, options: `-c search_path=${schema},public` });
    await db.connect();
  });
  afterAll(async () => {
    await db?.end();
  });

  async function inRollback(fn: () => Promise<void>): Promise<void> {
    await db.query('BEGIN');
    try {
      await fn();
      throw new Rollback();
    } catch (e) {
      await db.query('ROLLBACK');
      if (!(e instanceof Rollback)) throw e;
    }
  }

  async function seed(): Promise<void> {
    await db.query(`INSERT INTO organizations(id,name,status) VALUES($1,'STG own','ACTIVE'),($2,'STG other','ACTIVE')`, [id.own, id.other]);
    await db.query(
      `INSERT INTO businesses(id,organization_id,name,vertical,updated_at) VALUES($1,$2,'STG salon','BEAUTY',now()),($3,$4,'STG other','BEAUTY',now())`,
      [id.business, id.own, id.otherBusiness, id.other],
    );
    await db.query(
      `INSERT INTO locations(id,business_id,name,timezone,currency,updated_at) VALUES($1,$2,'STG branch','Asia/Almaty','KZT',now()),($3,$4,'STG other','Asia/Almaty','KZT',now())`,
      [id.location, id.business, id.otherLocation, id.otherBusiness],
    );
    await db.query(`INSERT INTO users(id,email,name) VALUES($1,$2,'Synthetic staff'),($3,$4,'Synthetic stranger')`, [
      id.user,
      `stg-${id.user}@example.invalid`,
      id.stranger,
      `stg-${id.stranger}@example.invalid`,
    ]);
    await db.query(`INSERT INTO memberships(user_id,organization_id,role) VALUES($1,$2,'STAFF'),($3,$4,'STAFF')`, [
      id.user,
      id.own,
      id.stranger,
      id.other,
    ]);
    await db.query(`INSERT INTO staff_telegram_links(user_id,chat_id,username) VALUES($1,700000001,'synthetic_staff'),($2,700000002,NULL)`, [
      id.user,
      id.stranger,
    ]);
    await db.query(`INSERT INTO staff_telegram_link_codes(code_hash,user_id,expires_at) VALUES($1,$2,now()+interval '15 minutes'),($3,$4,now()+interval '15 minutes')`, [
      'a'.repeat(64),
      id.user,
      'b'.repeat(64),
      id.stranger,
    ]);
    await db.query(
      `INSERT INTO staff_notifications(organization_id,location_id,kind,source_id,recipient_user_id) VALUES($1,$2,'SITE_APPOINTMENT',$3,$4),($5,$6,'SITE_APPOINTMENT',$7,$8)`,
      [id.own, id.location, id.source, id.user, id.other, id.otherLocation, randomUUID(), id.stranger],
    );
  }

  async function asTenant<T>(organizationId: string, fn: () => Promise<T>): Promise<T> {
    await db.query('SAVEPOINT tenant');
    try {
      await db.query('SET LOCAL ROLE wetop_app');
      await db.query(`SELECT set_config('app.org_id',$1,true)`, [organizationId]);
      return await fn();
    } finally {
      await db.query('ROLLBACK TO SAVEPOINT tenant');
    }
  }

  it('три таблицы под FORCE RLS с политикой rls_tenant', async () => {
    const rows = (
      await db.query(
        `SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity,
                EXISTS (SELECT 1 FROM pg_policies p WHERE p.tablename = c.relname AND p.schemaname = current_schema() AND p.policyname = 'rls_tenant') AS policy
           FROM pg_class c WHERE c.relnamespace = current_schema()::regnamespace AND c.relname = ANY($1::text[]) ORDER BY c.relname`,
        [TABLES],
      )
    ).rows;
    expect(rows).toEqual(
      [...TABLES].sort().map((relname) => ({ relname, relrowsecurity: true, relforcerowsecurity: true, policy: true })),
    );
  });

  it('права: организация не удаляет и не заводит привязку, служебная роль не удаляет', async () => {
    const r = (
      await db.query(`SELECT
        has_table_privilege('wetop_app','staff_telegram_links','INSERT') AS app_link_insert,
        has_table_privilege('wetop_app','staff_telegram_links','UPDATE') AS app_link_update,
        has_table_privilege('wetop_app','staff_telegram_link_codes','INSERT') AS app_code_insert,
        has_table_privilege('wetop_app','staff_notifications','INSERT') AS app_queue_insert,
        has_table_privilege('wetop_app','staff_notifications','UPDATE') AS app_queue_update,
        has_table_privilege('wetop_app','staff_notifications','DELETE') OR has_table_privilege('wetop_app','staff_telegram_links','DELETE')
          OR has_table_privilege('wetop_app','staff_telegram_link_codes','DELETE') AS app_delete,
        has_table_privilege('wetop_service','staff_notifications','UPDATE') AS service_queue_update,
        has_table_privilege('wetop_service','staff_notifications','DELETE') OR has_table_privilege('wetop_service','staff_telegram_links','DELETE') AS service_delete`)
    ).rows[0];
    expect(r).toEqual({
      app_link_insert: false,
      app_link_update: true,
      app_code_insert: true,
      app_queue_insert: true,
      app_queue_update: false,
      app_delete: false,
      service_queue_update: true,
      service_delete: false,
    });
  });

  it('своя организация видит только своих сотрудников и свою очередь, чужая и пустая ничего', async () => {
    await inRollback(async () => {
      await seed();
      const count = (table: string) => db.query(`SELECT count(*)::int AS n FROM ${table}`).then((r) => r.rows[0].n as number);
      for (const table of TABLES) {
        expect(await asTenant(id.own, () => count(table)), table).toBe(1);
        expect(await asTenant(randomUUID(), () => count(table)), table).toBe(0);
        expect(await asTenant('', () => count(table)), table).toBe(0);
      }
      expect(
        await asTenant(id.own, () => db.query('SELECT user_id FROM staff_telegram_links').then((r) => r.rows.map((x) => x.user_id))),
      ).toEqual([id.user]);
    });
  });

  it('организация не пишет очередь в чужую организацию или чужой филиал', async () => {
    await inRollback(async () => {
      await seed();
      await asTenant(id.own, async () => {
        await expect(
          db.query(
            `INSERT INTO staff_notifications(organization_id,location_id,kind,source_id,recipient_user_id) VALUES($1,$2,'SITE_LEAD',$3,$4)`,
            [id.own, id.otherLocation, randomUUID(), id.user],
          ),
        ).rejects.toThrow(/row-level security/);
      });
      await asTenant(id.own, async () => {
        await expect(
          db.query(
            `INSERT INTO staff_notifications(organization_id,location_id,kind,source_id,recipient_user_id) VALUES($1,$2,'SITE_LEAD',$3,$4)`,
            [id.other, id.otherLocation, randomUUID(), id.user],
          ),
        ).rejects.toThrow(/row-level security/);
      });
    });
  });

  it('повтор события тому же сотруднику отклоняется уникальностью (kind, source_id, recipient)', async () => {
    await inRollback(async () => {
      await seed();
      await db.query('SAVEPOINT u');
      await expect(
        db.query(
          `INSERT INTO staff_notifications(organization_id,location_id,kind,source_id,recipient_user_id) VALUES($1,$2,'SITE_APPOINTMENT',$3,$4)`,
          [id.own, id.location, id.source, id.user],
        ),
      ).rejects.toMatchObject({ code: '23505' });
      await db.query('ROLLBACK TO SAVEPOINT u');
      const skipped = await db.query(
        `INSERT INTO staff_notifications(organization_id,location_id,kind,source_id,recipient_user_id) VALUES($1,$2,'SITE_APPOINTMENT',$3,$4) ON CONFLICT DO NOTHING`,
        [id.own, id.location, id.source, id.user],
      );
      expect(skipped.rowCount).toBe(0);
    });
  });

  it('CHECK: чат положительный, хэш кода 64 hex, SENT только со временем отправки', async () => {
    await inRollback(async () => {
      await seed();
      for (const [sql, params] of [
        [`UPDATE staff_telegram_links SET chat_id = -5 WHERE user_id = $1`, [id.user]],
        [`UPDATE staff_telegram_link_codes SET code_hash = $2 WHERE user_id = $1`, [id.user, 'Z'.repeat(64)]],
        [`UPDATE staff_notifications SET status = 'SENT' WHERE recipient_user_id = $1`, [id.user]],
      ] as const) {
        await db.query('SAVEPOINT c');
        await expect(db.query(sql, [...params])).rejects.toMatchObject({ code: '23514' });
        await db.query('ROLLBACK TO SAVEPOINT c');
      }
    });
  });

  it('откат отказывает, пока есть привязка или журнал уведомлений', async () => {
    const down = readFileSync(resolve(MIGRATION, 'down.sql'), 'utf8')
      .replace(/^[\s\S]*?BEGIN;\s*/, '')
      .replace(/\s*COMMIT;\s*$/, '');
    await inRollback(async () => {
      await seed();
      await db.query('SAVEPOINT d');
      await expect(db.query(down)).rejects.toThrow(/Rollback blocked: staff notifications exist/);
      await db.query('ROLLBACK TO SAVEPOINT d');
      await db.query('DELETE FROM staff_notifications');
      await expect(db.query(down)).rejects.toThrow(/Rollback blocked: staff Telegram links exist/);
    });
  });
});
