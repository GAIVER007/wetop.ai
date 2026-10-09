import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isLocalDatabase } from '../tools/seed-local';

/**
 * MKT9.2, база (DATA_MODEL §29.12–§29.15): один филиал, один сайт навсегда; лицензия конструктора на филиал; разговорные
 * задачи ИИ без версий; закладки версий. Всё держит сама база: CHECK, триггеры, RLS и права ролей. Каждая проверка идёт
 * прямым SQL внутри транзакции, которая откатывается.
 */
const url = process.env.DATABASE_URL;
const schema = process.env.DATABASE_SCHEMA || 'public';
const SPEC = JSON.parse(readFileSync(resolve(__dirname, '../../docs/marketing/sitespec-v0.example.json'), 'utf8'));

describe.skipIf(!url)('MKT9.2 licensed site builder: инварианты базы', () => {
  let sql: pg.Client;
  const orgA = randomUUID(),
    orgB = randomUUID(),
    hotelA = randomUUID(),
    salonA = randomUUID(),
    hotelB = randomUUID(),
    locA1 = randomUUID(),
    locA2 = randomUUID(),
    locSalon = randomUUID(),
    locB = randomUUID(),
    siteA1 = randomUUID(),
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

  const insert = (attempt: Attempt, table: string, row: Record<string, unknown>) => {
    const keys = Object.keys(row);
    return attempt(
      `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')})`,
      keys.map((k) => row[k]),
    );
  };
  const aiRun = async (attempt: Attempt, siteId: string, extra: Record<string, unknown> = {}) => {
    const id = randomUUID();
    await insert(attempt, 'site_ai_runs', { id, site_id: siteId, mode: 'CHAT', status: 'QUEUED', request_key: randomUUID(), user_text: 'Что поменять?', ...extra });
    return id;
  };
  const setAi = (attempt: Attempt, id: string, set: string, params: unknown[] = []) =>
    attempt(`UPDATE site_ai_runs SET ${set} WHERE id = $${params.length + 1}`, [...params, id]);
  const version = async (attempt: Attempt, siteId: string, revision = 1, parent: string | null = null) => {
    const id = randomUUID();
    await attempt(
      `INSERT INTO marketing_site_versions (id, site_id, revision, parent_version_id, schema_version, spec, spec_hash, source)
       VALUES ($1, $2, $3, $4, 'site-spec/0', $5::jsonb, repeat('a', 64), 'MANUAL')`,
      [id, siteId, revision, parent, JSON.stringify(SPEC)],
    );
    return id;
  };
  const asApp = async (attempt: Attempt, org: string) => {
    await attempt('SET LOCAL ROLE wetop_app');
    await attempt(`SELECT set_config('app.org_id', $1, true)`, [org]);
  };

  beforeAll(async () => {
    if (!isLocalDatabase(url!)) throw new Error('Requires isolated localhost PostgreSQL');
    sql = new pg.Client({ connectionString: url, options: `-c search_path=${schema},public` });
    await sql.connect();
    await sql.query(`INSERT INTO organizations (id, name) VALUES ($1, 'MKT9.2 A (synthetic)'), ($2, 'MKT9.2 B (synthetic)')`, [orgA, orgB]);
    await sql.query(
      `INSERT INTO businesses (id, organization_id, name, vertical, updated_at)
       VALUES ($1, $2, 'Hotel A', 'HOSPITALITY', now()), ($3, $2, 'Salon A', 'BEAUTY', now()), ($4, $5, 'Hotel B', 'HOSPITALITY', now())`,
      [hotelA, orgA, salonA, hotelB, orgB],
    );
    for (const [id, business] of [[locA1, hotelA], [locA2, hotelA], [locSalon, salonA], [locB, hotelB]] as const)
      await sql.query(
        `INSERT INTO locations (id, business_id, name, timezone, currency, updated_at) VALUES ($1, $2, 'Loc', 'Asia/Almaty', 'KZT', now())`,
        [id, business],
      );
    for (const [id, location] of [[siteA1, locA1], [siteB, locB]] as const)
      await sql.query(`INSERT INTO marketing_sites (id, location_id, name, slug, updated_at) VALUES ($1, $2, 'Site', $3, now())`, [
        id,
        location,
        `mkt92-${id.slice(0, 8)}`,
      ]);
  });

  afterAll(async () => {
    if (!sql) return;
    await sql.query(`DELETE FROM site_builder_entitlements WHERE location_id = ANY($1::uuid[])`, [[locA1, locA2, locSalon, locB]]);
    await sql.query(`DELETE FROM marketing_sites WHERE id = ANY($1::uuid[])`, [[siteA1, siteB]]);
    await sql.query(`DELETE FROM locations WHERE id = ANY($1::uuid[])`, [[locA1, locA2, locSalon, locB]]);
    await sql.query(`DELETE FROM businesses WHERE id = ANY($1::uuid[])`, [[hotelA, salonA, hotelB]]);
    await sql.query(`DELETE FROM organizations WHERE id = ANY($1::uuid[])`, [[orgA, orgB]]);
    const left = await sql.query(`SELECT count(*)::int AS n FROM organizations WHERE id = ANY($1::uuid[])`, [[orgA, orgB]]);
    expect(left.rows[0].n).toBe(0);
    await sql.end();
  });

  it('один филиал, один сайт навсегда: второй сайт нельзя даже после архива первого', async () => {
    await probe(async (attempt) => {
      await attempt(`UPDATE marketing_sites SET state = 'ARCHIVED', archived_at = now() WHERE id = $1`, [siteA1]);
      await expect(
        insert(attempt, 'marketing_sites', { id: randomUUID(), location_id: locA1, name: 'Второй', slug: `mkt92-x-${randomUUID().slice(0, 6)}`, updated_at: new Date() }),
      ).rejects.toThrow(/marketing_sites_location_id_key/);
    });
    const index = await sql.query(
      `SELECT indexdef FROM pg_indexes WHERE schemaname = $1 AND indexname = 'marketing_sites_location_id_key'`,
      [schema],
    );
    expect(index.rows[0]?.indexdef ?? '').toMatch(/UNIQUE/);
    expect(index.rows[0]?.indexdef ?? '').not.toMatch(/WHERE/);
  });

  it('знания проекта: до 5000 знаков', async () => {
    await probe(async (attempt) => {
      await attempt(`UPDATE marketing_sites SET builder_instructions = repeat('я', 5000) WHERE id = $1`, [siteA1]);
      await expect(attempt(`UPDATE marketing_sites SET builder_instructions = repeat('я', 5001) WHERE id = $1`, [siteA1])).rejects.toThrow(/value too long/);
    });
  });

  it('лицензия: у пробной нужен срок, только гостиничный филиал, одна строка на филиал', async () => {
    await probe(async (attempt) => {
      await expect(insert(attempt, 'site_builder_entitlements', { location_id: locA2, status: 'TRIAL', updated_at: new Date() })).rejects.toThrow(
        /site_builder_entitlements_trial_until/,
      );
      await expect(insert(attempt, 'site_builder_entitlements', { location_id: locSalon, status: 'ACTIVE', updated_at: new Date() })).rejects.toThrow(
        /гостинич/,
      );
      await insert(attempt, 'site_builder_entitlements', { location_id: locA2, status: 'ACTIVE', updated_at: new Date() });
      await expect(insert(attempt, 'site_builder_entitlements', { location_id: locA2, status: 'OFF', updated_at: new Date() })).rejects.toThrow(
        /site_builder_entitlements_pkey/,
      );
      await expect(
        insert(attempt, 'site_builder_entitlements', { location_id: locA1, status: 'ACTIVE', note: 'я'.repeat(301), updated_at: new Date() }),
      ).rejects.toThrow(/value too long/);
    });
  });

  it('лицензию приложение только читает и только своей организации; служба пишет, удалять не может никто', async () => {
    await probe(async (attempt) => {
      await insert(attempt, 'site_builder_entitlements', { location_id: locA2, status: 'ACTIVE', updated_at: new Date() });
      await insert(attempt, 'site_builder_entitlements', { location_id: locB, status: 'ACTIVE', updated_at: new Date() });
      await asApp(attempt, orgA);
      const seen = await attempt(`SELECT location_id FROM site_builder_entitlements WHERE location_id = ANY($1::uuid[])`, [[locA2, locB]]);
      expect(seen.rows.map((r) => r.location_id)).toEqual([locA2]);
      await expect(attempt(`UPDATE site_builder_entitlements SET status = 'OFF' WHERE location_id = $1`, [locA2])).rejects.toThrow(/permission denied/);
      await expect(
        insert(attempt, 'site_builder_entitlements', { location_id: locA1, status: 'ACTIVE', updated_at: new Date() }),
      ).rejects.toThrow(/permission denied/);
    });
    const p = await sql.query(
      `SELECT has_table_privilege('wetop_app', 'site_builder_entitlements', 'INSERT') AS app_insert,
              has_table_privilege('wetop_app', 'site_builder_entitlements', 'UPDATE') AS app_update,
              has_table_privilege('wetop_app', 'site_builder_entitlements', 'DELETE') AS app_delete,
              has_table_privilege('wetop_service', 'site_builder_entitlements', 'UPDATE') AS service_update,
              has_table_privilege('wetop_service', 'site_builder_entitlements', 'DELETE') AS service_delete`,
    );
    expect(p.rows[0]).toEqual({ app_insert: false, app_update: false, app_delete: false, service_update: true, service_delete: false });
  });

  it('разговор ИИ: новая задача только в QUEUED, режим из словаря, ключ запроса один раз на сайт', async () => {
    await probe(async (attempt) => {
      await expect(aiRun(attempt, siteA1, { status: 'RUNNING', started_at: new Date(), attempts: 1 })).rejects.toThrow(/QUEUED/);
      await expect(aiRun(attempt, siteA1, { mode: 'BUILD' })).rejects.toThrow(/invalid input value/);
      const key = randomUUID();
      await aiRun(attempt, siteA1, { request_key: key });
      await expect(aiRun(attempt, siteA1, { request_key: key })).rejects.toThrow(/site_ai_runs_site_id_request_key_key/);
      await aiRun(attempt, siteB, { request_key: key });
      await expect(aiRun(attempt, siteA1, { user_text: 'я'.repeat(4001) })).rejects.toThrow(/value too long/);
    });
  });

  it('разговор ИИ: форма состояния, переходы, конечное состояние не меняется, LICENSE_UNAVAILABLE в словаре', async () => {
    await probe(async (attempt) => {
      const run = await aiRun(attempt, siteA1);
      await expect(setAi(attempt, run, `status = 'SUCCEEDED', finished_at = now(), assistant_text = 'x'`)).rejects.toThrow(/site_ai_runs/);
      await setAi(attempt, run, `status = 'RUNNING', attempts = 1, started_at = now()`);
      await expect(setAi(attempt, run, `status = 'SUCCEEDED', finished_at = now()`)).rejects.toThrow(/site_ai_runs_status_shape/);
      await expect(setAi(attempt, run, `status = 'FAILED', finished_at = now()`)).rejects.toThrow(/site_ai_runs_status_shape/);
      await expect(setAi(attempt, run, `error_code = 'NOT_IN_DICTIONARY'`)).rejects.toThrow(/site_ai_runs_error_code/);
      await expect(setAi(attempt, run, `user_text = 'другое'`)).rejects.toThrow(/не меняется/);
      await expect(setAi(attempt, run, `tokens_input = 10, tokens_cached = 20`)).rejects.toThrow(/site_ai_runs_tokens/);
      await setAi(attempt, run, `status = 'SUCCEEDED', finished_at = now(), assistant_text = 'Готово', tokens_input = 10, tokens_output = 5`);
      await expect(setAi(attempt, run, `assistant_text = 'Другое'`)).rejects.toThrow(/конечн/);
      const failed = await aiRun(attempt, siteA1);
      await setAi(attempt, failed, `status = 'FAILED', finished_at = now(), error_code = 'LICENSE_UNAVAILABLE'`);
    });
  });

  it('разговор ИИ: ограничение ответа по размеру, база только своего сайта, версий не создаёт', async () => {
    await probe(async (attempt) => {
      const own = await version(attempt, siteA1);
      const foreign = await version(attempt, siteB);
      await expect(aiRun(attempt, siteA1, { base_version_id: foreign })).rejects.toThrow(/другого сайта/);
      const run = await aiRun(attempt, siteA1, { base_version_id: own, mode: 'PLAN' });
      await setAi(attempt, run, `status = 'RUNNING', attempts = 1, started_at = now()`);
      await expect(
        setAi(attempt, run, `status = 'SUCCEEDED', finished_at = now(), payload = jsonb_build_object('x', repeat('я', 20000))`),
      ).rejects.toThrow(/site_ai_runs_payload_size/);
      await expect(setAi(attempt, run, `assistant_text = repeat('я', 12001)`)).rejects.toThrow(/value too long/);
      const cols = await attempt(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'site_ai_runs' AND column_name LIKE '%version%'`,
        [schema],
      );
      expect(cols.rows.map((r) => r.column_name)).toEqual(['base_version_id']);
    });
  });

  it('разговор ИИ: RLS и права (приложение ставит и читает своё, менять и удалять не может)', async () => {
    await probe(async (attempt) => {
      const a = await aiRun(attempt, siteA1);
      const b = await aiRun(attempt, siteB);
      await asApp(attempt, orgA);
      const seen = await attempt(`SELECT id FROM site_ai_runs WHERE id = ANY($1::uuid[])`, [[a, b]]);
      expect(seen.rows.map((r) => r.id)).toEqual([a]);
      await aiRun(attempt, siteA1);
      await expect(aiRun(attempt, siteB)).rejects.toThrow(/row-level security/);
      await expect(setAi(attempt, a, `model = 'x'`)).rejects.toThrow(/permission denied/);
      await expect(attempt(`DELETE FROM site_ai_runs WHERE id = $1`, [a])).rejects.toThrow(/permission denied/);
    });
    const p = await sql.query(
      `SELECT has_table_privilege('wetop_service', 'site_ai_runs', 'UPDATE') AS service_update,
              has_table_privilege('wetop_service', 'site_ai_runs', 'DELETE') AS service_delete`,
    );
    expect(p.rows[0]).toEqual({ service_update: true, service_delete: false });
  });

  it('LICENSE_UNAVAILABLE есть и у задач сборки', async () => {
    await probe(async (attempt) => {
      const id = randomUUID();
      await insert(attempt, 'generation_runs', { id, site_id: siteA1, type: 'INITIAL', status: 'QUEUED', request_key: randomUUID(), brief_hash: 'a'.repeat(64) });
      await attempt(`UPDATE generation_runs SET status = 'FAILED', finished_at = now(), error_code = 'LICENSE_UNAVAILABLE' WHERE id = $1`, [id]);
    });
  });

  it('закладки: только версия своего сайта, одна на версию, не больше 20 на сайт, подпись до 120', async () => {
    await probe(async (attempt) => {
      const foreign = await version(attempt, siteB);
      await expect(insert(attempt, 'marketing_site_version_bookmarks', { id: randomUUID(), site_id: siteA1, version_id: foreign, label: 'Чужая' })).rejects.toThrow(
        /другого сайта/,
      );
      let parent: string | null = null;
      const ids: string[] = [];
      for (let i = 1; i <= 21; i += 1) {
        parent = await version(attempt, siteA1, i, parent);
        ids.push(parent);
      }
      await insert(attempt, 'marketing_site_version_bookmarks', { id: randomUUID(), site_id: siteA1, version_id: ids[0], label: 'Первая' });
      await expect(insert(attempt, 'marketing_site_version_bookmarks', { id: randomUUID(), site_id: siteA1, version_id: ids[0], label: 'Ещё' })).rejects.toThrow(
        /marketing_site_version_bookmarks_site_id_version_id_key/,
      );
      await expect(
        insert(attempt, 'marketing_site_version_bookmarks', { id: randomUUID(), site_id: siteA1, version_id: ids[1], label: 'я'.repeat(121) }),
      ).rejects.toThrow(/value too long/);
      for (let i = 1; i < 20; i += 1)
        await insert(attempt, 'marketing_site_version_bookmarks', { id: randomUUID(), site_id: siteA1, version_id: ids[i], label: `Закладка ${i}` });
      await expect(insert(attempt, 'marketing_site_version_bookmarks', { id: randomUUID(), site_id: siteA1, version_id: ids[20], label: 'Лишняя' })).rejects.toThrow(
        /20/,
      );
    });
  });

  it('закладки: RLS (своё ставит и снимает, чужое не видит)', async () => {
    await probe(async (attempt) => {
      const a = await version(attempt, siteA1);
      const b = await version(attempt, siteB);
      const bookmarkB = randomUUID();
      await insert(attempt, 'marketing_site_version_bookmarks', { id: bookmarkB, site_id: siteB, version_id: b, label: 'B' });
      await asApp(attempt, orgA);
      const mine = randomUUID();
      await insert(attempt, 'marketing_site_version_bookmarks', { id: mine, site_id: siteA1, version_id: a, label: 'A' });
      const seen = await attempt(`SELECT id FROM marketing_site_version_bookmarks WHERE id = ANY($1::uuid[])`, [[mine, bookmarkB]]);
      expect(seen.rows.map((r) => r.id)).toEqual([mine]);
      // чужая версия невидима под RLS, поэтому отказ даёт уже триггер принадлежности; запись не проходит в любом случае
      await expect(insert(attempt, 'marketing_site_version_bookmarks', { id: randomUUID(), site_id: siteB, version_id: b, label: 'x' })).rejects.toThrow(
        /row-level security|другого сайта/,
      );
      await attempt(`UPDATE marketing_site_version_bookmarks SET label = 'A2' WHERE id = $1`, [mine]);
      const gone = await attempt(`DELETE FROM marketing_site_version_bookmarks WHERE id = ANY($1::uuid[])`, [[mine, bookmarkB]]);
      expect(gone.rowCount).toBe(1);
    });
  });
});
