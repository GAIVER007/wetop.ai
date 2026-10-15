import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isLocalDatabase } from '../tools/seed-local';

/**
 * MKT7, база (DATA_MODEL §29.4, §29.6, §29.11): журнал публикаций, домены сайта и канонический сайт брони филиала
 * (Q-275) держит сама база, а не только API. Каждая проверка идёт прямым SQL внутри транзакции, которая откатывается.
 */
const url = process.env.DATABASE_URL;
const schema = process.env.DATABASE_SCHEMA || 'public';
const SPEC = JSON.parse(readFileSync(resolve(__dirname, '../../docs/marketing/sitespec-v0.example.json'), 'utf8'));

describe.skipIf(!url)('MKT7 публикации, домены и сайт брони: инварианты базы', () => {
  let sql: pg.Client;
  const orgA = randomUUID(),
    orgB = randomUUID(),
    hotelA = randomUUID(),
    hotelB = randomUUID(),
    locA1 = randomUUID(),
    locA2 = randomUUID(),
    locB = randomUUID(),
    propA1 = randomUUID(),
    propA2 = randomUUID(),
    propB = randomUUID(),
    siteA1 = randomUUID(),
    siteA2 = randomUUID(),
    siteB = randomUUID(),
    rateA1 = randomUUID(),
    user = randomUUID();

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

  const insertVersion = (attempt: Attempt, siteId: string, revision = 1, parent: string | null = null) => {
    const id = randomUUID();
    return attempt(
      `INSERT INTO marketing_site_versions (id, site_id, revision, parent_version_id, schema_version, spec, spec_hash, source)
       VALUES ($1, $2, $3, $4, 'site-spec/0', $5::jsonb, repeat('a', 64), 'MANUAL')`,
      [id, siteId, revision, parent, JSON.stringify(SPEC)],
    ).then(() => id);
  };
  const publication = (attempt: Attempt, siteId: string, action: string, versionId: string | null, previous: string | null = null, actor: string | null = null) => {
    const id = randomUUID();
    return attempt(
      `INSERT INTO marketing_site_publications (id, site_id, action, version_id, previous_version_id, actor_id) VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, siteId, action, versionId, previous, actor],
    ).then(() => id);
  };
  const domain = (attempt: Attempt, siteId: string, host: string, extra: Record<string, unknown> = {}) => {
    const id = randomUUID();
    const row: Record<string, unknown> = {
      id,
      site_id: siteId,
      host,
      kind: 'PLATFORM_SUBDOMAIN',
      is_primary: true,
      status: 'PENDING',
      updated_at: new Date(),
      ...extra,
    };
    const keys = Object.keys(row);
    return attempt(
      `INSERT INTO site_domains (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')})`,
      keys.map((k) => row[k]),
    ).then(() => id);
  };
  const trackedSite = (attempt: Attempt, propertyId: string, extra: { status?: string; booking?: boolean; rate?: string | null } = {}) => {
    const id = randomUUID();
    return attempt(
      `INSERT INTO tracked_sites (id, property_id, name, hosts, public_key, status, booking_enabled, booking_rate_plan_id, updated_at)
       VALUES ($1, $2, 'Site', '{}', $3, $4, $5, $6, now())`,
      [id, propertyId, `pms_${id.replace(/-/g, '').slice(0, 12)}`, extra.status ?? 'ACTIVE', extra.booking ?? true, extra.rate === undefined ? rateA1 : extra.rate],
    ).then(() => id);
  };

  beforeAll(async () => {
    if (!isLocalDatabase(url!)) throw new Error('Requires isolated localhost PostgreSQL');
    sql = new pg.Client({ connectionString: url, options: `-c search_path=${schema},public` });
    await sql.connect();
    await sql.query(`INSERT INTO organizations (id, name) VALUES ($1, 'MKT7 A (synthetic)'), ($2, 'MKT7 B (synthetic)')`, [orgA, orgB]);
    await sql.query(`INSERT INTO users (id, email) VALUES ($1, $2)`, [user, `mkt7-db-${user}@example.invalid`]);
    await sql.query(
      `INSERT INTO businesses (id, organization_id, name, vertical, updated_at) VALUES ($1, $2, 'Hotel A', 'HOSPITALITY', now()), ($3, $4, 'Hotel B', 'HOSPITALITY', now())`,
      [hotelA, orgA, hotelB, orgB],
    );
    for (const [id, business] of [[locA1, hotelA], [locA2, hotelA], [locB, hotelB]] as const)
      await sql.query(
        `INSERT INTO locations (id, business_id, name, timezone, currency, updated_at) VALUES ($1, $2, 'Loc', 'Asia/Almaty', 'KZT', now())`,
        [id, business],
      );
    for (const [id, org, loc] of [[propA1, orgA, locA1], [propA2, orgA, locA2], [propB, orgB, locB]] as const)
      await sql.query(
        `INSERT INTO properties (id, organization_id, location_id, name, timezone, currency, check_in_time, check_out_time, updated_at)
         VALUES ($1, $2, $3, 'Hotel', 'Asia/Almaty', 'KZT', '14:00', '12:00', now())`,
        [id, org, loc],
      );
    await sql.query(
      `INSERT INTO rate_plans (id, property_id, code, name, currency, updated_at) VALUES ($1, $2, 'MKT7', 'MKT7', 'KZT', now())`,
      [rateA1, propA1],
    );
    for (const [id, location] of [[siteA1, locA1], [siteA2, locA2], [siteB, locB]] as const)
      await sql.query(
        `INSERT INTO marketing_sites (id, location_id, name, slug, updated_at) VALUES ($1, $2, 'Site', $3, now())`,
        [id, location, `mkt7-${id.slice(0, 8)}`],
      );
  });

  afterAll(async () => {
    if (!sql) return;
    await sql.query(`DELETE FROM marketing_sites WHERE id = ANY($1::uuid[])`, [[siteA1, siteA2, siteB]]);
    await sql.query(`DELETE FROM rate_plans WHERE id = $1`, [rateA1]);
    await sql.query(`DELETE FROM properties WHERE id = ANY($1::uuid[])`, [[propA1, propA2, propB]]);
    await sql.query(`DELETE FROM locations WHERE id = ANY($1::uuid[])`, [[locA1, locA2, locB]]);
    await sql.query(`DELETE FROM businesses WHERE id = ANY($1::uuid[])`, [[hotelA, hotelB]]);
    await sql.query(`DELETE FROM users WHERE id = $1`, [user]);
    await sql.query(`DELETE FROM organizations WHERE id = ANY($1::uuid[])`, [[orgA, orgB]]);
    const left = await sql.query(`SELECT count(*)::int AS n FROM organizations WHERE id = ANY($1::uuid[])`, [[orgA, orgB]]);
    expect(left.rows[0].n).toBe(0);
    await sql.end();
  });

  it('журнал: форма действия, версии только своего сайта', async () => {
    await probe(async (attempt) => {
      const v1 = await insertVersion(attempt, siteA1);
      const foreign = await insertVersion(attempt, siteA2);
      await publication(attempt, siteA1, 'PUBLISH', v1);
      await publication(attempt, siteA1, 'PAUSE', null, v1);
      await publication(attempt, siteA1, 'RESUME', v1);
      await publication(attempt, siteA1, 'ARCHIVE', null, v1);
      await expect(publication(attempt, siteA1, 'PUBLISH', null)).rejects.toThrow(/marketing_site_publications_shape/);
      await expect(publication(attempt, siteA1, 'ROLLBACK', null)).rejects.toThrow(/marketing_site_publications_shape/);
      await expect(publication(attempt, siteA1, 'RESUME', null)).rejects.toThrow(/marketing_site_publications_shape/);
      await expect(publication(attempt, siteA1, 'PAUSE', v1)).rejects.toThrow(/marketing_site_publications_shape/);
      await expect(publication(attempt, siteA1, 'ARCHIVE', v1)).rejects.toThrow(/marketing_site_publications_shape/);
      await expect(publication(attempt, siteA1, 'PUBLISH', foreign)).rejects.toThrow(/версия другого сайта/);
      await expect(publication(attempt, siteA1, 'PUBLISH', v1, foreign)).rejects.toThrow(/версия другого сайта/);
    });
  });

  it('журнал только дописывается; удаление сотрудника обнуляет автора', async () => {
    await probe(async (attempt) => {
      const v1 = await insertVersion(attempt, siteA1);
      const id = await publication(attempt, siteA1, 'PUBLISH', v1, null, user);
      await expect(attempt(`UPDATE marketing_site_publications SET action = 'ROLLBACK' WHERE id = $1`, [id])).rejects.toThrow(/только дописывается/);
      await expect(attempt(`UPDATE marketing_site_publications SET version_id = NULL, action = 'PAUSE' WHERE id = $1`, [id])).rejects.toThrow(/только дописывается/);
      await expect(attempt(`DELETE FROM marketing_site_publications WHERE id = $1`, [id])).rejects.toThrow(/только дописывается/);
      await attempt(`DELETE FROM users WHERE id = $1`, [user]);
      const row = await attempt(`SELECT actor_id FROM marketing_site_publications WHERE id = $1`, [id]);
      expect(row.rows[0].actor_id).toBeNull();
    });
  });

  it('домен: принадлежит своему сайту, хост и вид не меняются, переходы по §29.8', async () => {
    await probe(async (attempt) => {
      const d = await domain(attempt, siteA1, 'mkt7-a.sites.test');
      await expect(attempt(`UPDATE site_domains SET site_id = $1 WHERE id = $2`, [siteA2, d])).rejects.toThrow(/не меняются/);
      await expect(attempt(`UPDATE site_domains SET host = 'other.sites.test' WHERE id = $1`, [d])).rejects.toThrow(/не меняются/);
      await expect(attempt(`UPDATE site_domains SET kind = 'CUSTOM' WHERE id = $1`, [d])).rejects.toThrow(/не меняются/);
      // платформенный поддомен не проверяется: только PENDING → ACTIVE
      await expect(attempt(`UPDATE site_domains SET status = 'VERIFYING' WHERE id = $1`, [d])).rejects.toThrow(/переход/);
      await expect(attempt(`UPDATE site_domains SET status = 'ACTIVE' WHERE id = $1`, [d])).rejects.toThrow(/site_domains_activated_at/);
      await attempt(`UPDATE site_domains SET status = 'ACTIVE', activated_at = now() WHERE id = $1`, [d]);
      await attempt(`UPDATE site_domains SET status = 'REMOVED', removed_at = now(), is_primary = false WHERE id = $1`, [d]);
      await expect(attempt(`UPDATE site_domains SET status = 'ACTIVE' WHERE id = $1`, [d])).rejects.toThrow(/переход/);
    });
  });

  it('домен: хост в нормальном виде, у платформы нет проверки владения', async () => {
    await probe(async (attempt) => {
      for (const bad of ['MKT7.Sites.Test', 'mkt7.sites.test.', 'mkt7.sites.test:443', 'https://mkt7.sites.test', 'mkt7 .sites.test'])
        await expect(domain(attempt, siteA1, bad)).rejects.toThrow(/site_domains_host_format/);
      await expect(domain(attempt, siteA1, 'mkt7-v.sites.test', { verification_method: 'DNS_TXT', verification_token: 'x' })).rejects.toThrow(
        /site_domains_platform_unverified/,
      );
    });
  });

  it('домен: один живой владелец хоста, REMOVED освобождает; один основной на сайт', async () => {
    await probe(async (attempt) => {
      const a = await domain(attempt, siteA1, 'mkt7-same.sites.test');
      await expect(domain(attempt, siteB, 'mkt7-same.sites.test', { is_primary: true })).rejects.toThrow(/site_domains_host_live_key/);
      await expect(domain(attempt, siteA1, 'mkt7-second.sites.test')).rejects.toThrow(/site_domains_primary_key/);
      await domain(attempt, siteA1, 'mkt7-second.sites.test', { is_primary: false });
      await attempt(`UPDATE site_domains SET status = 'REMOVED', removed_at = now(), is_primary = false WHERE id = $1`, [a]);
      await domain(attempt, siteB, 'mkt7-same.sites.test');
    });
  });

  it('сайт брони филиала: только сайт объекта этого филиала', async () => {
    await probe(async (attempt) => {
      const own = await trackedSite(attempt, propA1);
      const foreign = await trackedSite(attempt, propA2);
      await expect(attempt(`UPDATE locations SET booking_tracked_site_id = $1 WHERE id = $2`, [foreign, locA1])).rejects.toThrow(
        /объекту другого филиала/,
      );
      await attempt(`UPDATE locations SET booking_tracked_site_id = $1 WHERE id = $2`, [own, locA1]);
      // удаление сайта снимает указатель, а не ломает филиал
      await attempt(`DELETE FROM tracked_sites WHERE id = $1`, [own]);
      const loc = await attempt(`SELECT booking_tracked_site_id FROM locations WHERE id = $1`, [locA1]);
      expect(loc.rows[0].booking_tracked_site_id).toBeNull();
    });
  });

  it('перенос Q-275: ровно один подходящий сайт ставится, ноль или два оставляют NULL', async () => {
    await probe(async (attempt) => {
      const single = await trackedSite(attempt, propA1);
      await trackedSite(attempt, propA1, { status: 'PAUSED' });
      await trackedSite(attempt, propA1, { booking: false });
      await trackedSite(attempt, propA1, { rate: null });
      await trackedSite(attempt, propA2, { rate: null });
      // у филиала B два подходящих: неоднозначно, «самый ранний» не выбирается
      const rateB = randomUUID();
      await attempt(`INSERT INTO rate_plans (id, property_id, code, name, currency, updated_at) VALUES ($1, $2, 'B', 'B', 'KZT', now())`, [rateB, propB]);
      await trackedSite(attempt, propB, { rate: rateB });
      await trackedSite(attempt, propB, { rate: rateB });
      await attempt(`SELECT location_booking_backfill()`);
      const rows = await attempt(`SELECT id, booking_tracked_site_id FROM locations WHERE id = ANY($1::uuid[])`, [[locA1, locA2, locB]]);
      const pointer = new Map(rows.rows.map((r) => [r.id, r.booking_tracked_site_id]));
      expect(pointer.get(locA1)).toBe(single);
      expect(pointer.get(locA2)).toBeNull();
      expect(pointer.get(locB)).toBeNull();
    });
  });

  it('перенос не трогает уже выбранный указатель', async () => {
    await probe(async (attempt) => {
      const chosen = await trackedSite(attempt, propA1, { booking: false });
      await attempt(`UPDATE locations SET booking_tracked_site_id = $1 WHERE id = $2`, [chosen, locA1]);
      await trackedSite(attempt, propA1);
      await attempt(`SELECT location_booking_backfill()`);
      const loc = await attempt(`SELECT booking_tracked_site_id FROM locations WHERE id = $1`, [locA1]);
      expect(loc.rows[0].booking_tracked_site_id).toBe(chosen);
    });
  });

  it('RLS: организация видит только свои публикации и домены; права приложения', async () => {
    await probe(async (attempt) => {
      const vA = await insertVersion(attempt, siteA1);
      const vB = await insertVersion(attempt, siteB);
      const pubA = await publication(attempt, siteA1, 'PUBLISH', vA);
      await publication(attempt, siteB, 'PUBLISH', vB);
      const dA = await domain(attempt, siteA1, 'mkt7-rls-a.sites.test');
      await domain(attempt, siteB, 'mkt7-rls-b.sites.test');
      await attempt('SET LOCAL ROLE wetop_app');
      await attempt(`SELECT set_config('app.org_id', $1, true)`, [orgA]);
      const pubs = await attempt(`SELECT site_id FROM marketing_site_publications WHERE site_id = ANY($1::uuid[])`, [[siteA1, siteB]]);
      expect(pubs.rows.map((r) => r.site_id)).toEqual([siteA1]);
      const domains = await attempt(`SELECT host FROM site_domains WHERE site_id = ANY($1::uuid[])`, [[siteA1, siteB]]);
      expect(domains.rows.map((r) => r.host)).toEqual(['mkt7-rls-a.sites.test']);
      await expect(attempt(`UPDATE marketing_site_publications SET actor_id = NULL WHERE id = $1`, [pubA])).rejects.toThrow(/permission denied/);
      await expect(attempt(`DELETE FROM marketing_site_publications WHERE id = $1`, [pubA])).rejects.toThrow(/permission denied/);
      await expect(attempt(`DELETE FROM site_domains WHERE id = $1`, [dA])).rejects.toThrow(/permission denied/);
      await attempt(`UPDATE site_domains SET status = 'ACTIVE', activated_at = now() WHERE id = $1`, [dA]);
      // чужой сайт: вставку режет политика (у паузы версии нет, сторож версий не участвует)
      await expect(publication(attempt, siteB, 'PAUSE', null)).rejects.toThrow(/row-level security/);
    });
  });
});
