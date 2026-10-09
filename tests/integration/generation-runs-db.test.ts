import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isLocalDatabase } from '../tools/seed-local';

/**
 * MKT6, база (DATA_MODEL §29.3, §29.7, §29.9): инварианты `generation_runs` и связи версии с задачей ИИ держит сама
 * база, а не только API. Каждая проверка идёт прямым SQL внутри транзакции, которая откатывается.
 */
const url = process.env.DATABASE_URL;
const schema = process.env.DATABASE_SCHEMA || 'public';
const SPEC = JSON.parse(readFileSync(resolve(__dirname, '../../docs/marketing/sitespec-v0.example.json'), 'utf8'));

describe.skipIf(!url)('MKT6 generation_runs: инварианты базы', () => {
  let sql: pg.Client;
  const orgA = randomUUID(),
    orgB = randomUUID(),
    hotelA = randomUUID(),
    hotelB = randomUUID(),
    locA1 = randomUUID(),
    locA2 = randomUUID(),
    locB = randomUUID(),
    siteA1 = randomUUID(),
    siteA2 = randomUUID(),
    siteB = randomUUID();

  type Attempt = (q: string, params?: unknown[]) => Promise<pg.QueryResult>;
  async function probe(fn: (attempt: Attempt) => Promise<void>) {
    await sql.query('BEGIN');
    try {
      await fn(async (q, params = []) => {
        await sql.query('SAVEPOINT probe');
        try {
          const r = await sql.query(q, params);
          await sql.query('RELEASE SAVEPOINT probe');
          return r;
        } catch (error) {
          await sql.query('ROLLBACK TO SAVEPOINT probe');
          throw error;
        }
      });
    } finally {
      await sql.query('ROLLBACK');
    }
  }

  const insertRun = (attempt: Attempt, siteId: string, extra: Record<string, unknown> = {}) => {
    const id = randomUUID();
    const row: Record<string, unknown> = {
      id,
      site_id: siteId,
      type: 'INITIAL',
      status: 'QUEUED',
      request_key: randomUUID(),
      brief_hash: 'a'.repeat(64),
      ...extra,
    };
    const keys = Object.keys(row);
    return attempt(
      `INSERT INTO generation_runs (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')})`,
      keys.map((k) => row[k]),
    ).then(() => id);
  };
  const insertVersion = (attempt: Attempt, siteId: string, source: string, runId: string | null, revision = 1, parent: string | null = null) => {
    const id = randomUUID();
    return attempt(
      `INSERT INTO marketing_site_versions (id, site_id, revision, parent_version_id, schema_version, spec, spec_hash, source, generation_run_id)
       VALUES ($1, $2, $3, $4, 'site-spec/0', $5::jsonb, repeat('a', 64), $6, $7)`,
      [id, siteId, revision, parent, JSON.stringify(SPEC), source, runId],
    ).then(() => id);
  };
  const setRun = (attempt: Attempt, id: string, set: string, params: unknown[] = []) =>
    attempt(`UPDATE generation_runs SET ${set} WHERE id = $${params.length + 1}`, [...params, id]);
  /** Задача, доведённая до RUNNING, как её берёт воркер */
  async function running(attempt: Attempt, siteId: string): Promise<string> {
    const id = await insertRun(attempt, siteId);
    await setRun(attempt, id, `status = 'RUNNING', attempts = 1, started_at = now(), next_attempt_at = now() - interval '1 second'`);
    return id;
  }

  beforeAll(async () => {
    if (!isLocalDatabase(url!)) throw new Error('Requires isolated localhost PostgreSQL');
    sql = new pg.Client({ connectionString: url, options: `-c search_path=${schema},public` });
    await sql.connect();
    await sql.query(`INSERT INTO organizations (id, name) VALUES ($1, 'MKT6 A (synthetic)'), ($2, 'MKT6 B (synthetic)')`, [orgA, orgB]);
    await sql.query(
      `INSERT INTO businesses (id, organization_id, name, vertical, updated_at) VALUES ($1, $2, 'Hotel A', 'HOSPITALITY', now()), ($3, $4, 'Hotel B', 'HOSPITALITY', now())`,
      [hotelA, orgA, hotelB, orgB],
    );
    for (const [id, business] of [[locA1, hotelA], [locA2, hotelA], [locB, hotelB]] as const)
      await sql.query(
        `INSERT INTO locations (id, business_id, name, timezone, currency, updated_at) VALUES ($1, $2, 'Loc', 'Asia/Almaty', 'KZT', now())`,
        [id, business],
      );
    for (const [id, location] of [[siteA1, locA1], [siteA2, locA2], [siteB, locB]] as const)
      await sql.query(
        `INSERT INTO marketing_sites (id, location_id, name, slug, updated_at) VALUES ($1, $2, 'Site', $3, now())`,
        [id, location, `mkt6-${id.slice(0, 8)}`],
      );
  });

  afterAll(async () => {
    if (!sql) return;
    await sql.query(`DELETE FROM marketing_sites WHERE id = ANY($1::uuid[])`, [[siteA1, siteA2, siteB]]);
    await sql.query(`DELETE FROM locations WHERE id = ANY($1::uuid[])`, [[locA1, locA2, locB]]);
    await sql.query(`DELETE FROM businesses WHERE id = ANY($1::uuid[])`, [[hotelA, hotelB]]);
    await sql.query(`DELETE FROM organizations WHERE id = ANY($1::uuid[])`, [[orgA, orgB]]);
    const left = await sql.query(`SELECT count(*)::int AS n FROM organizations WHERE id = ANY($1::uuid[])`, [[orgA, orgB]]);
    expect(left.rows[0].n).toBe(0);
    await sql.end();
  });

  it('источник версии: MANUAL без задачи, AI только с задачей, IMPORT закрыт', async () => {
    await probe(async (attempt) => {
      const run = await running(attempt, siteA1);
      await expect(insertVersion(attempt, siteA1, 'AI', null)).rejects.toThrow(/marketing_site_versions_source_provenance/);
      await expect(insertVersion(attempt, siteA1, 'MANUAL', run)).rejects.toThrow(/marketing_site_versions_source_provenance/);
      await expect(insertVersion(attempt, siteA1, 'IMPORT', null)).rejects.toThrow(/marketing_site_versions_source_provenance/);
      await expect(insertVersion(attempt, siteA1, 'IMPORT', run)).rejects.toThrow(/marketing_site_versions_source_provenance/);
      await insertVersion(attempt, siteA1, 'AI', run);
    });
    await probe(async (attempt) => {
      await insertVersion(attempt, siteA1, 'MANUAL', null);
    });
  });

  it('AI-версия только от задачи своего сайта; одна задача, одна версия', async () => {
    await probe(async (attempt) => {
      const foreign = await running(attempt, siteB);
      await expect(insertVersion(attempt, siteA1, 'AI', foreign)).rejects.toThrow(/generation_run_id/);
      const own = await running(attempt, siteA1);
      await insertVersion(attempt, siteA1, 'AI', own);
    });
    await probe(async (attempt) => {
      const own = await running(attempt, siteA1);
      const first = await insertVersion(attempt, siteA1, 'AI', own);
      await expect(insertVersion(attempt, siteA1, 'AI', own, 2, first)).rejects.toThrow(/generation_run_id/);
    });
  });

  it('новая задача только в QUEUED; запрос повторяется ключом, а не второй строкой', async () => {
    await probe(async (attempt) => {
      await expect(insertRun(attempt, siteA1, { status: 'RUNNING', started_at: new Date(), attempts: 1 })).rejects.toThrow(/QUEUED/);
      const key = randomUUID();
      await insertRun(attempt, siteA1, { request_key: key });
      await expect(insertRun(attempt, siteA1, { request_key: key })).rejects.toThrow(/generation_runs_site_id_request_key_key/);
      await insertRun(attempt, siteA2, { request_key: key });
    });
  });

  it('форма состояния: конечное время, версия и ошибка там, где положено', async () => {
    await probe(async (attempt) => {
      const run = await running(attempt, siteA1);
      await expect(setRun(attempt, run, `status = 'SUCCEEDED', finished_at = now()`)).rejects.toThrow(/generation_runs_status_shape/);
      await expect(setRun(attempt, run, `status = 'FAILED', finished_at = now()`)).rejects.toThrow(/generation_runs_status_shape/);
      await expect(setRun(attempt, run, `status = 'FAILED', error_code = 'TIMEOUT'`)).rejects.toThrow(/generation_runs_status_shape/);
      await expect(setRun(attempt, run, `finished_at = now()`)).rejects.toThrow(/generation_runs_status_shape/);
      await expect(setRun(attempt, run, `error_code = 'NOT_IN_DICTIONARY'`)).rejects.toThrow(/generation_runs_error_code/);
      await setRun(attempt, run, `status = 'FAILED', error_code = 'TIMEOUT', finished_at = now()`);
    });
    await probe(async (attempt) => {
      const queued = await insertRun(attempt, siteA1);
      await expect(setRun(attempt, queued, `status = 'RUNNING'`)).rejects.toThrow(/generation_runs_status_shape/);
      await expect(setRun(attempt, queued, `finished_at = now()`)).rejects.toThrow(/generation_runs_status_shape/);
      await setRun(attempt, queued, `status = 'CANCELLED', finished_at = now()`);
    });
  });

  it('переходы: из конечного состояния назад нельзя, мимо RUNNING к успеху нельзя', async () => {
    await probe(async (attempt) => {
      const queued = await insertRun(attempt, siteA1);
      await expect(setRun(attempt, queued, `status = 'SUCCEEDED', finished_at = now()`)).rejects.toThrow(/generation_runs/);
      const run = await running(attempt, siteA1);
      await setRun(attempt, run, `status = 'QUEUED', next_attempt_at = now() - interval '1 second'`);
      await setRun(attempt, run, `status = 'RUNNING', attempts = 2`);
      await expect(setRun(attempt, run, `status = 'CANCELLED', finished_at = now()`)).rejects.toThrow(/переход/);
      const version = await insertVersion(attempt, siteA1, 'AI', run);
      await setRun(attempt, run, `status = 'SUCCEEDED', output_version_id = $1, finished_at = now()`, [version]);
      await expect(setRun(attempt, run, `status = 'RUNNING', output_version_id = NULL, finished_at = NULL`)).rejects.toThrow(/конечн/);
      await expect(setRun(attempt, run, `model = 'other/model'`)).rejects.toThrow(/конечн/);
    });
    await probe(async (attempt) => {
      const run = await running(attempt, siteA1);
      await setRun(attempt, run, `status = 'FAILED', error_code = 'BUDGET_EXCEEDED', finished_at = now()`);
      await expect(setRun(attempt, run, `status = 'QUEUED', finished_at = NULL, error_code = NULL`)).rejects.toThrow(/конечн/);
    });
  });

  it('версия-результат и базовая версия только своего сайта и своей задачи', async () => {
    await probe(async (attempt) => {
      const runB = await running(attempt, siteB);
      const versionB = await insertVersion(attempt, siteB, 'AI', runB);
      const runA = await running(attempt, siteA1);
      await expect(
        setRun(attempt, runA, `status = 'SUCCEEDED', output_version_id = $1, finished_at = now()`, [versionB]),
      ).rejects.toThrow(/output_version_id/);
      const otherRun = await running(attempt, siteA1);
      const versionOfOther = await insertVersion(attempt, siteA1, 'AI', otherRun);
      await expect(
        setRun(attempt, runA, `status = 'SUCCEEDED', output_version_id = $1, finished_at = now()`, [versionOfOther]),
      ).rejects.toThrow(/output_version_id/);
      const manual = await insertVersion(attempt, siteA2, 'MANUAL', null);
      await expect(insertRun(attempt, siteA1, { base_version_id: manual })).rejects.toThrow(/base_version_id/);
      await insertRun(attempt, siteA2, { base_version_id: manual });
    });
  });

  it('токены: целые, не меньше нуля, кэш внутри входа, сумма только растёт; попыток не больше трёх', async () => {
    await probe(async (attempt) => {
      const run = await running(attempt, siteA1);
      await expect(setRun(attempt, run, `tokens_input = -1`)).rejects.toThrow(/generation_runs_tokens/);
      await expect(setRun(attempt, run, `tokens_input = 10, tokens_cached = 11`)).rejects.toThrow(/generation_runs_tokens/);
      await setRun(attempt, run, `tokens_input = 1000, tokens_cached = 600, tokens_output = 100`);
      await expect(setRun(attempt, run, `tokens_input = 999`)).rejects.toThrow(/токен/);
      await expect(setRun(attempt, run, `tokens_output = NULL`)).rejects.toThrow(/токен/);
      await setRun(attempt, run, `tokens_input = 3000, tokens_cached = 1600, tokens_output = 300`);
      await expect(setRun(attempt, run, `attempts = 4`)).rejects.toThrow(/generation_runs_attempts/);
      await expect(setRun(attempt, run, `attempts = 0`)).rejects.toThrow(/попыт/);
    });
  });

  it('у задачи не меняются сайт, ключ, бриф и автор', async () => {
    await probe(async (attempt) => {
      const run = await running(attempt, siteA1);
      for (const [set, params] of [
        [`site_id = $1`, [siteA2]],
        [`request_key = $1`, [randomUUID()]],
        [`brief_hash = repeat('b', 64)`, []],
        [`type = 'SEO'`, []],
      ] as const)
        await expect(setRun(attempt, run, set, [...params])).rejects.toThrow(/не меняется/);
    });
  });

  it('RLS и права: wetop_app видит и ставит задачи только своих сайтов, менять и удалять не может', async () => {
    await probe(async (attempt) => {
      const runA = await insertRun(attempt, siteA1);
      const runB = await insertRun(attempt, siteB);
      await attempt('SET LOCAL ROLE wetop_app');
      await attempt(`SELECT set_config('app.org_id', $1, true)`, [orgA]);
      const seen = await attempt(`SELECT id FROM generation_runs WHERE id = ANY($1::uuid[])`, [[runA, runB]]);
      expect(seen.rows.map((r) => r.id)).toEqual([runA]);
      await insertRun(attempt, siteA2);
      await expect(insertRun(attempt, siteB)).rejects.toThrow(/row-level security/);
      await expect(attempt(`UPDATE generation_runs SET model = 'x' WHERE id = $1`, [runA])).rejects.toThrow(/permission denied/);
      await expect(attempt(`DELETE FROM generation_runs WHERE id = $1`, [runA])).rejects.toThrow(/permission denied/);
    });
    const privileges = await sql.query(
      `SELECT has_table_privilege('wetop_service', 'generation_runs', 'UPDATE') AS service_update,
              has_table_privilege('wetop_service', 'generation_runs', 'DELETE') AS service_delete,
              has_table_privilege('wetop_app', 'generation_runs', 'INSERT') AS app_insert,
              has_table_privilege('wetop_app', 'generation_runs', 'UPDATE') AS app_update`,
    );
    expect(privileges.rows[0]).toEqual({ service_update: true, service_delete: false, app_insert: true, app_update: false });
  });
});
