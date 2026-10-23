import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isLocalDatabase } from '../tools/seed-local';

/**
 * Черновики постов «Контента» (CONTENT-DRAFTS-20261022, миграция 147; 146 занята голосом #772): что держит сама база. Словари и длины,
 * «опубликован ⇔ есть время», место/автор/происхождение неизменны, архив окончателен, одна строка на creationId
 * филиала, RLS через филиал → организацию и права без DELETE. Прямой SQL в откатываемой транзакции; данные
 * вымышленные (ADR-010).
 */
const url = process.env.DATABASE_URL;
const schema = process.env.DATABASE_SCHEMA || 'public';

describe.skipIf(!url)('content_drafts: инварианты базы', () => {
  let sql: pg.Client;
  const orgA = randomUUID(),
    orgB = randomUUID(),
    bizA = randomUUID(),
    bizB = randomUUID(),
    locA = randomUUID(),
    locA2 = randomUUID(),
    locB = randomUUID();

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

  const draft = (attempt: Attempt, location: string, over: Record<string, unknown> = {}) => {
    const row: Record<string, unknown> = {
      id: randomUUID(),
      location_id: location,
      creation_id: randomUUID(),
      channel: 'INSTAGRAM',
      topic: 'Осенний уход',
      body: 'Текст поста',
      origin: 'AI',
      ...over,
    };
    const keys = Object.keys(row);
    return attempt(
      `INSERT INTO content_drafts (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`,
      keys.map((k) => row[k]),
    );
  };
  const asApp = async (attempt: Attempt, org: string) => {
    await attempt('SET LOCAL ROLE wetop_app');
    await attempt(`SELECT set_config('app.org_id', $1, true)`, [org]);
  };

  beforeAll(async () => {
    if (!isLocalDatabase(url!)) throw new Error('Requires isolated localhost PostgreSQL');
    sql = new pg.Client({ connectionString: url, options: `-c search_path=${schema},public` });
    await sql.connect();
    await sql.query(`INSERT INTO organizations (id, name) VALUES ($1, 'CNT A (synthetic)'), ($2, 'CNT B (synthetic)')`, [orgA, orgB]);
    await sql.query(
      `INSERT INTO businesses (id, organization_id, name, vertical, updated_at)
       VALUES ($1, $2, 'Salon A', 'BEAUTY', now()), ($3, $4, 'Salon B', 'BEAUTY', now())`,
      [bizA, orgA, bizB, orgB],
    );
    for (const [id, business] of [[locA, bizA], [locA2, bizA], [locB, bizB]] as const)
      await sql.query(
        `INSERT INTO locations (id, business_id, name, timezone, currency, updated_at) VALUES ($1, $2, 'Loc', 'Asia/Almaty', 'KZT', now())`,
        [id, business],
      );
  });

  afterAll(async () => {
    if (!sql) return;
    await sql.query(`DELETE FROM locations WHERE id = ANY($1::uuid[])`, [[locA, locA2, locB]]);
    await sql.query(`DELETE FROM businesses WHERE id = ANY($1::uuid[])`, [[bizA, bizB]]);
    await sql.query(`DELETE FROM organizations WHERE id = ANY($1::uuid[])`, [[orgA, orgB]]);
    await sql.end();
  });

  it('словари, длины и «опубликован ⇔ есть время» держит база', async () => {
    await probe(async (attempt) => {
      await expect(draft(attempt, locA)).resolves.toBeTruthy();
      await expect(draft(attempt, locA, { channel: 'TIKTOK' })).rejects.toThrow(/content_drafts_channel/);
      await expect(draft(attempt, locA, { cta: 'PAY_NOW' })).rejects.toThrow(/content_drafts_cta/);
      await expect(draft(attempt, locA, { origin: 'BOT' })).rejects.toThrow(/content_drafts_origin/);
      await expect(draft(attempt, locA, { body: '   ' })).rejects.toThrow(/content_drafts_body/);
      await expect(draft(attempt, locA, { body: 'x'.repeat(2201) })).rejects.toThrow(/content_drafts_body/);
      await expect(draft(attempt, locA, { hashtags: Array(11).fill('a') })).rejects.toThrow(/content_drafts_hashtags/);
      await expect(draft(attempt, locA, { status: 'PUBLISHED' })).rejects.toThrow(/content_drafts_published/);
      await expect(draft(attempt, locA, { status: 'PUBLISHED', published_at: new Date() })).resolves.toBeTruthy();
    });
  });

  it('один creationId на филиал: повтор отклоняется, в другом филиале можно', async () => {
    await probe(async (attempt) => {
      const creation = randomUUID();
      await draft(attempt, locA, { creation_id: creation });
      await expect(draft(attempt, locA, { creation_id: creation })).rejects.toThrow(/content_drafts_location_id_creation_id_key/);
      await expect(draft(attempt, locA2, { creation_id: creation })).resolves.toBeTruthy();
    });
  });

  it('место, происхождение и автор неизменны; архив окончателен', async () => {
    await probe(async (attempt) => {
      const id = (await draft(attempt, locA)).rows[0].id as string;
      await expect(attempt(`UPDATE content_drafts SET location_id = $1 WHERE id = $2`, [locA2, id])).rejects.toThrow(/immutable/);
      await expect(attempt(`UPDATE content_drafts SET origin = 'MANUAL' WHERE id = $1`, [id])).rejects.toThrow(/immutable/);
      await attempt(`UPDATE content_drafts SET body = 'Новый текст', revision = revision + 1 WHERE id = $1`, [id]);
      await attempt(`UPDATE content_drafts SET status = 'ARCHIVED' WHERE id = $1`, [id]);
      await expect(attempt(`UPDATE content_drafts SET status = 'DRAFT' WHERE id = $1`, [id])).rejects.toThrow(/Archived/);
    });
  });

  it('RLS: организация видит и правит только свои черновики; удалять нельзя', async () => {
    await probe(async (attempt) => {
      const mine = (await draft(attempt, locA)).rows[0].id as string;
      const foreign = (await draft(attempt, locB)).rows[0].id as string;
      await asApp(attempt, orgA);
      const seen = await attempt(`SELECT id FROM content_drafts WHERE id = ANY($1::uuid[])`, [[mine, foreign]]);
      expect(seen.rows.map((r) => r.id)).toEqual([mine]);
      const touched = await attempt(`UPDATE content_drafts SET body = 'чужое' WHERE id = $1`, [foreign]);
      expect(touched.rowCount).toBe(0);
      await expect(draft(attempt, locB)).rejects.toThrow(/row-level security/);
      await expect(attempt(`DELETE FROM content_drafts WHERE id = $1`, [mine])).rejects.toThrow(/permission denied/);
    });
  });

  it('FORCE RLS включён, у ролей приложения нет DELETE', async () => {
    const force = await sql.query(
      `SELECT relforcerowsecurity FROM pg_class WHERE oid = to_regclass($1)`,
      [`${schema}.content_drafts`],
    );
    expect(force.rows[0]?.relforcerowsecurity).toBe(true);
    for (const role of ['wetop_app', 'wetop_service']) {
      const r = await sql.query(`SELECT has_table_privilege($1, to_regclass($2), 'DELETE') AS can`, [
        role,
        `${schema}.content_drafts`,
      ]);
      expect(r.rows[0].can).toBe(false);
    }
  });
});
