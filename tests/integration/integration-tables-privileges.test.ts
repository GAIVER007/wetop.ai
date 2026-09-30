import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;
const SRC = (process.env.DATABASE_SCHEMA?.trim() || 'public').replace(/[^a-z0-9_]/gi, '');
const PROBE = 'pms_priv_probe';
const TABLES = ['external_events', 'system_incidents', 'channel_outbox'] as const;
/** Числовая колонка для проверки права UPDATE «в чистом виде»: `SET col = 1` без WHERE не читает колонок, то есть SELECT не нужен */
const COUNTER: Record<(typeof TABLES)[number], string> = {
  external_events: 'attempt_count',
  system_incidents: 'occurrences',
  channel_outbox: 'attempts',
};

/**
 * SEC-1b, стадия B (Q-222, решение владельца 30.09.2026): права базы на данные интеграции — настоящий тест уровня PostgreSQL.
 *
 * Целевое состояние (его выдаёт миграция `…035_rls_integration_grants`, B2):
 *   wetop_app:  external_events — ничего; system_incidents — ничего; channel_outbox — только INSERT (без SELECT, UPDATE, DELETE);
 *   wetop_service: всё нужное проходит.
 *
 * Как: в ОДНОЙ транзакции, которая в конце откатывается, каждая операция выполняется настоящим запросом под `SET LOCAL ROLE`,
 * каждая внутри SAVEPOINT (отказ базы — не исключение теста, а результат). Следов не остаётся. Матрица `wetop_app` идёт дважды:
 * на копиях таблиц во временной схеме с целевыми правами (доказательство самой матрицы: что даёт INSERT без RETURNING и чего
 * нельзя) и на НАСТОЯЩЕЙ схеме `SRC` — это проверка самой миграции B2. Права `wetop_service` проверяются на настоящих таблицах:
 * миграция их не трогает, и они не должны потеряться.
 */
describe.skipIf(!url)(
  'права на данные интеграции: целевая матрица wetop_app и права wetop_service (integration, PostgreSQL)',
  () => {
    let client: pg.Client;
    let propertyId = '';

    /** Выполнить запрос под ролью внутри SAVEPOINT; отказ базы возвращается кодом, а не бросается */
    async function as(
      role: string,
      sql: string,
      params: unknown[] = [],
    ): Promise<{ ok: true; rows: number } | { ok: false; code: string }> {
      await client.query('SAVEPOINT probe');
      try {
        await client.query(`SET LOCAL ROLE ${role}`);
        const r = await client.query(sql, params);
        await client.query('RESET ROLE');
        await client.query('RELEASE SAVEPOINT probe');
        return { ok: true, rows: r.rowCount ?? 0 };
      } catch (e) {
        await client.query('ROLLBACK TO SAVEPOINT probe');
        await client.query('RESET ROLE');
        return { ok: false, code: (e as { code?: string }).code ?? 'unknown' };
      }
    }
    const denied = { ok: false, code: '42501' } as const;

    const insertOutbox = (schema: string, returning = '') =>
      `INSERT INTO "${schema}".channel_outbox (id, provider, kind, payload, property_id) VALUES ($1, 'probe', 'AVAILABILITY', '[]'::jsonb, $2)${returning}`;

    beforeAll(async () => {
      client = new pg.Client({ connectionString: url });
      await client.connect();
      await client.query('BEGIN');
      propertyId = (await client.query(`SELECT id FROM "${SRC}".properties LIMIT 1`)).rows[0]?.id;
      expect(propertyId, 'нужен хотя бы один объект в базе').toBeTruthy();

      // Копии трёх таблиц во временной схеме + целевые права (то, что выдаст B2)
      await client.query(`CREATE SCHEMA ${PROBE}`);
      await client.query(`GRANT USAGE ON SCHEMA ${PROBE} TO wetop_app, wetop_service`);
      for (const t of TABLES) {
        await client.query(
          `CREATE TABLE ${PROBE}.${t} (LIKE "${SRC}".${t} INCLUDING DEFAULTS INCLUDING CONSTRAINTS)`,
        );
        await client.query(`REVOKE ALL ON ${PROBE}.${t} FROM PUBLIC, wetop_app`);
        await client.query(
          `GRANT SELECT, INSERT, UPDATE, DELETE ON ${PROBE}.${t} TO wetop_service`,
        );
      }
      await client.query(`GRANT INSERT ON ${PROBE}.channel_outbox TO wetop_app`);
    });
    afterAll(async () => {
      await client?.query('ROLLBACK').catch(() => undefined);
      await client?.end();
    });

    describe.each([
      ['копии таблиц с целевыми правами', PROBE],
      ['настоящая схема (миграция B2)', SRC],
    ] as const)('wetop_app: целевая матрица — %s, реальные запросы под ролью', (_label, schema) => {
      it.each(['external_events', 'system_incidents'] as const)(
        '%s: SELECT, INSERT, UPDATE, DELETE — отказ',
        async (t) => {
          expect(await as('wetop_app', `SELECT 1 FROM ${schema}.${t} LIMIT 1`)).toEqual(denied);
          expect(await as('wetop_app', `UPDATE ${schema}.${t} SET ${COUNTER[t]} = 1`)).toEqual(
            denied,
          );
          expect(await as('wetop_app', `DELETE FROM ${schema}.${t} WHERE false`)).toEqual(denied);
          // и вставка: без права INSERT отказывает раньше, чем проверяются значения
          expect(await as('wetop_app', `INSERT INTO ${schema}.${t} DEFAULT VALUES`)).toEqual(denied);
        },
      );

      it('channel_outbox: SELECT, UPDATE, DELETE — отказ', async () => {
        expect(await as('wetop_app', `SELECT 1 FROM ${schema}.channel_outbox LIMIT 1`)).toEqual(
          denied,
        );
        expect(
          await as('wetop_app', `UPDATE ${schema}.channel_outbox SET ${COUNTER.channel_outbox} = 1`),
        ).toEqual(denied);
        expect(await as('wetop_app', `DELETE FROM ${schema}.channel_outbox WHERE false`)).toEqual(
          denied,
        );
      });

      it('channel_outbox: INSERT без RETURNING — разрешён (так пишет createMany внутри транзакции команды)', async () => {
        expect(await as('wetop_app', insertOutbox(schema), [randomUUID(), propertyId])).toEqual({
          ok: true,
          rows: 1,
        });
      });

      it('channel_outbox: INSERT … RETURNING — отказ (поэтому create() заменён на createMany())', async () => {
        expect(
          await as('wetop_app', insertOutbox(schema, ' RETURNING id'), [randomUUID(), propertyId]),
        ).toEqual(denied);
      });

      it('has_table_privilege подтверждает ту же матрицу', async () => {
        const priv = async (role: string, t: string, p: string) =>
          (
            await client.query(`SELECT has_table_privilege($1, $2, $3) AS ok`, [
              role,
              `${schema}.${t}`,
              p,
            ])
          ).rows[0].ok as boolean;
        for (const t of TABLES)
          for (const p of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
            const expected = t === 'channel_outbox' && p === 'INSERT';
            expect(await priv('wetop_app', t, p), `wetop_app ${p} ${t}`).toBe(expected);
          }
      });
    });

    describe('wetop_service: настоящие права на настоящих таблицах (миграция B2 их не трогает)', () => {
      it.each(TABLES)('%s: SELECT, UPDATE, DELETE проходят', async (t) => {
        expect(await as('wetop_service', `SELECT 1 FROM "${SRC}".${t} LIMIT 1`)).toMatchObject({
          ok: true,
        });
        expect(
          await as(
            'wetop_service',
            `UPDATE "${SRC}".${t} SET ${COUNTER[t]} = ${COUNTER[t]} WHERE false`,
          ),
        ).toMatchObject({ ok: true });
        expect(await as('wetop_service', `DELETE FROM "${SRC}".${t} WHERE false`)).toMatchObject({
          ok: true,
        });
      });

      it('INSERT в очередь, в журнал событий и в инциденты проходит; после отката строк нет', async () => {
        const id = randomUUID();
        expect(await as('wetop_service', insertOutbox(SRC), [id, propertyId])).toEqual({
          ok: true,
          rows: 1,
        });
        expect(
          await as(
            'wetop_service',
            `INSERT INTO "${SRC}".external_events (id, provider, external_event_id, type, payload_hash, payload, status, received_via, property_id)
           VALUES ($1, 'probe', $2, 'booking_new', 'h', '{}'::jsonb, 'RECEIVED', 'WEBHOOK', $3)`,
            [randomUUID(), `priv-${id}`, propertyId],
          ),
        ).toEqual({ ok: true, rows: 1 });
        const label = async (type: string) =>
          (
            await client.query(
              `SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
              WHERE t.typname = $1 AND n.nspname = $2 ORDER BY e.enumsortorder LIMIT 1`,
              [type, SRC],
            )
          ).rows[0].enumlabel as string;
        expect(
          await as(
            'wetop_service',
            `INSERT INTO "${SRC}".system_incidents (id, kind, class, severity, fingerprint, title, first_seen_at, last_seen_at)
           VALUES ($1, 'probe', $2::"${SRC}"."IncidentClass", $3::"${SRC}"."IncidentSeverity", $4, 'probe', now(), now())`,
            [
              randomUUID(),
              await label('IncidentClass'),
              await label('IncidentSeverity'),
              `priv-${id}`,
            ],
          ),
        ).toEqual({ ok: true, rows: 1 });
      });
    });

    it('следов нет: временная схема живёт только внутри откатываемой транзакции', async () => {
      await client.query('ROLLBACK');
      const probe = await client.query(`SELECT 1 FROM pg_namespace WHERE nspname = $1`, [PROBE]);
      const rows = await client.query(
        `SELECT count(*)::int AS n FROM "${SRC}".channel_outbox WHERE provider = 'probe'`,
      );
      expect(probe.rowCount).toBe(0);
      expect(rows.rows[0].n).toBe(0);
      await client.query('BEGIN'); // afterAll откатывает и закрывает
    });
  },
);
