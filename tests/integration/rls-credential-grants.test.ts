import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;
class Rollback extends Error {}

/**
 * SEC-1b, стадия A (аудит 29.09.2026, DATA_MODEL §17.2–17.3): роль запросов организации `wetop_app` не читает и не
 * пишет учётные данные и отметки главного администратора. Раньше миграция `…026_rls_roles` выдала ей полный доступ ко
 * всем таблицам схемы: одна пропущенная проверка или инъекция под организацией отдавала хеши паролей, а запись в
 * `platform_admins` — права главного администратора.
 *
 * Как: под `SET LOCAL ROLE wetop_app` в откатываемой транзакции каждое обращение идёт через SAVEPOINT — отказ базы
 * («permission denied») не рвёт транзакцию. Внешний ключ проверяется отдельно: запись журнала с `user_id` должна
 * проходить без прав на `users` (проверки ключей Postgres идут от владельца таблицы).
 */
describe.skipIf(!url)(
  'RLS: гранты wetop_app на учётные данные (integration, DATABASE_URL required)',
  () => {
    let client: pg.Client;
    beforeAll(async () => {
      client = new pg.Client({ connectionString: url });
      await client.connect();
    });
    afterAll(async () => {
      await client?.end();
    });

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

    /** Выполнить запрос ролью `wetop_app`; отказ базы — не исключение, а `{ ok: false }` */
    async function asApp(
      sql: string,
      params: unknown[] = [],
      organizationId = '',
    ): Promise<{ ok: true; rows: unknown[] } | { ok: false; message: string }> {
      await client.query('SAVEPOINT attempt');
      try {
        await client.query(`SELECT set_config('app.org_id', $1, true)`, [organizationId]);
        await client.query('SET LOCAL ROLE wetop_app');
        const res = await client.query(sql, params);
        return { ok: true, rows: res.rows };
      } catch (e) {
        return { ok: false, message: (e as Error).message };
      } finally {
        await client.query('ROLLBACK TO SAVEPOINT attempt');
      }
    }

    const NO_ACCESS_AT_ALL = [
      'password_resets',
      'email_verifications',
      'wizard_sessions',
      'wizard_events',
      'wizard_surveys',
    ] as const;

    it.each(NO_ACCESS_AT_ALL)('%s: wetop_app не может ни читать, ни писать', async (table) => {
      await inRollback(async () => {
        for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
          const { rows } = await client.query<{ ok: boolean }>(
            `SELECT has_table_privilege('wetop_app', $1, $2) AS ok`,
            [table, privilege],
          );
          expect(rows[0]!.ok, `${table}: ${privilege}`).toBe(false);
        }
        const read = await asApp(`SELECT count(*) FROM "${table}"`);
        expect(read.ok).toBe(false);
        expect(!read.ok && read.message).toMatch(/permission denied/);
      });
    });

    it('users: только id, email, name, status, email_verified_at, last_login_at и только чтение', async () => {
      await inRollback(async () => {
        const id = randomUUID();
        await client.query(`INSERT INTO users (id, email, name) VALUES ($1, $2, 'Тест')`, [
          id,
          `sec1b-${id}@example.invalid`,
        ]);
        // нужное коду читается: имена авторов журнала, коллеги, статус для проверок прав
        const ok = await asApp(
          // last_login_at: «Был в системе» на экране «Сотрудники» (ADR-136, грант — миграция 042)
          `SELECT id, email, name, status, email_verified_at, last_login_at FROM users WHERE id = $1`,
          [id],
        );
        expect(ok).toMatchObject({ ok: true });
        expect(ok.ok && ok.rows).toHaveLength(1);
        // хеш пароля, счётчик попыток, блокировка и «выбрать всё» — нет
        for (const sql of [
          `SELECT password_hash FROM users`,
          `SELECT failed_attempts FROM users`,
          `SELECT locked_until FROM users`,
          `SELECT * FROM users`,
        ]) {
          const denied = await asApp(sql);
          expect(denied.ok, sql).toBe(false);
          expect(!denied.ok && denied.message, sql).toMatch(/permission denied/);
        }
        // писать нельзя ничего: ни пароль, ни имя, ни новых пользователей
        for (const sql of [
          `UPDATE users SET password_hash = 'x' WHERE id = '${id}'`,
          `UPDATE users SET name = 'x' WHERE id = '${id}'`,
          `INSERT INTO users (id, email) VALUES (gen_random_uuid(), 'x@example.invalid')`,
          `DELETE FROM users WHERE id = '${id}'`,
        ]) {
          const denied = await asApp(sql);
          expect(denied.ok, sql).toBe(false);
          expect(!denied.ok && denied.message, sql).toMatch(/permission denied/);
        }
      });
    });

    it('platform_admins: читаются только user_id и revoked_at; писать нельзя — выдать себе права главного администратора нечем', async () => {
      await inRollback(async () => {
        const read = await asApp(`SELECT user_id, revoked_at FROM platform_admins`);
        expect(read).toMatchObject({ ok: true });
        for (const sql of [
          `SELECT * FROM platform_admins`,
          `INSERT INTO platform_admins (user_id) VALUES (gen_random_uuid())`,
          `UPDATE platform_admins SET revoked_at = now()`,
          `DELETE FROM platform_admins`,
        ]) {
          const denied = await asApp(sql);
          expect(denied.ok, sql).toBe(false);
          expect(!denied.ok && denied.message, sql).toMatch(/permission denied/);
        }
      });
    });

    it('внешний ключ audit_logs.user_id проверяется и без прав на users: запись журнала под организацией проходит', async () => {
      await inRollback(async () => {
        const userId = randomUUID();
        await client.query(`INSERT INTO users (id, email, name) VALUES ($1, $2, 'Тест')`, [
          userId,
          `sec1b-fk-${userId}@example.invalid`,
        ]);
        const organizationId = (
          await client.query<{ id: string }>(`SELECT id FROM organizations LIMIT 1`)
        ).rows[0]!.id;
        const written = await asApp(
          `INSERT INTO audit_logs (id, user_id, entity_type, entity_id, action)
         VALUES (gen_random_uuid(), $1, 'Probe', 'sec1b', 'probe.sec1b')`,
          [userId],
          organizationId,
        );
        expect(written, JSON.stringify(written)).toMatchObject({ ok: true });
        // и несуществующий пользователь по-прежнему отвергается самим ключом
        const orphan = await asApp(
          `INSERT INTO audit_logs (id, user_id, entity_type, entity_id, action)
         VALUES (gen_random_uuid(), gen_random_uuid(), 'Probe', 'sec1b', 'probe.orphan')`,
          [],
          organizationId,
        );
        expect(orphan.ok).toBe(false);
        expect(!orphan.ok && orphan.message).toMatch(/foreign key|violates/);
      });
    });
  },
);
