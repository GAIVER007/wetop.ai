import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isLocalDatabase } from '../tools/seed-local';

/**
 * MKT8, база (DATA_MODEL §29.5): библиотеку изображений сайта держит сама база, а не только API. Ключ объекта выводится
 * из строки, повтор картинки даёт один живой ассет, готовый ассет не меняет байты и владельца, удаления строки у ролей
 * приложения нет, чужая организация ассет не видит. Каждая проверка прямым SQL в транзакции, которая откатывается.
 */
const url = process.env.DATABASE_URL;
const schema = process.env.DATABASE_SCHEMA || 'public';
const SHA = 'a'.repeat(64);
const SHA2 = 'b'.repeat(64);

describe.skipIf(!url)('MKT8 site_assets: инварианты базы', () => {
  let sql: pg.Client;
  const orgA = randomUUID(),
    orgB = randomUUID(),
    hotelA = randomUUID(),
    hotelB = randomUUID(),
    locA = randomUUID(),
    locA2 = randomUUID(),
    locB = randomUUID(),
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

  type Row = Record<string, unknown>;
  /** Строка ассета по умолчанию: готовая картинка WebP; `extra` переопределяет любое поле, `id` можно задать */
  const asset = (attempt: Attempt, extra: Row = {}) => {
    const id = (extra['id'] as string | undefined) ?? randomUUID();
    const location = (extra['location_id'] as string | undefined) ?? locA;
    const kind = (extra['kind'] as string | undefined) ?? 'IMAGE';
    const sha = (extra['sha256'] as string | undefined) ?? SHA;
    const row: Row = {
      id,
      location_id: location,
      kind,
      status: 'READY',
      source: 'UPLOAD',
      mime_type: kind === 'FAVICON' ? 'image/png' : 'image/webp',
      storage_ref: `site-assets/${location}/${id}/${sha}.${kind === 'FAVICON' ? 'png' : 'webp'}`,
      byte_size: 1234,
      width: kind === 'FAVICON' ? 512 : 800,
      height: kind === 'FAVICON' ? 512 : 600,
      sha256: sha,
      created_by_id: user,
      updated_at: new Date(),
      ...extra,
    };
    const keys = Object.keys(row);
    return attempt(
      `INSERT INTO site_assets (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')})`,
      keys.map((k) => row[k]),
    ).then(() => id);
  };

  beforeAll(async () => {
    if (!isLocalDatabase(url!)) throw new Error('Requires isolated localhost PostgreSQL');
    sql = new pg.Client({ connectionString: url, options: `-c search_path=${schema},public` });
    await sql.connect();
    await sql.query(`INSERT INTO organizations (id, name) VALUES ($1, 'MKT8 A (synthetic)'), ($2, 'MKT8 B (synthetic)')`, [orgA, orgB]);
    await sql.query(`INSERT INTO users (id, email) VALUES ($1, $2)`, [user, `mkt8-db-${user}@example.invalid`]);
    await sql.query(
      `INSERT INTO businesses (id, organization_id, name, vertical, updated_at) VALUES ($1, $2, 'Hotel A', 'HOSPITALITY', now()), ($3, $4, 'Hotel B', 'HOSPITALITY', now())`,
      [hotelA, orgA, hotelB, orgB],
    );
    for (const [id, business] of [[locA, hotelA], [locA2, hotelA], [locB, hotelB]] as const)
      await sql.query(
        `INSERT INTO locations (id, business_id, name, timezone, currency, updated_at) VALUES ($1, $2, 'Loc', 'Asia/Almaty', 'KZT', now())`,
        [id, business],
      );
  });

  afterAll(async () => {
    if (!sql) return;
    await sql.query(`DELETE FROM locations WHERE id = ANY($1::uuid[])`, [[locA, locA2, locB]]);
    await sql.query(`DELETE FROM businesses WHERE id = ANY($1::uuid[])`, [[hotelA, hotelB]]);
    await sql.query(`DELETE FROM users WHERE id = $1`, [user]);
    await sql.query(`DELETE FROM organizations WHERE id = ANY($1::uuid[])`, [[orgA, orgB]]);
    const left = await sql.query(`SELECT count(*)::int AS n FROM organizations WHERE id = ANY($1::uuid[])`, [[orgA, orgB]]);
    expect(left.rows[0].n).toBe(0);
    await sql.end();
  });

  it('ключ объекта выводится из строки: филиал, id, sha256 и расширение по виду', async () => {
    await probe(async (attempt) => {
      await asset(attempt);
      await asset(attempt, { kind: 'FAVICON', sha256: SHA2 });
      const id = randomUUID();
      await expect(asset(attempt, { id, storage_ref: `site-assets/${locB}/${id}/${SHA2}.webp`, sha256: SHA2 })).rejects.toThrow(/site_assets_storage_ref/);
      await expect(asset(attempt, { storage_ref: `https://bucket.example/${SHA2}.webp`, sha256: SHA2 })).rejects.toThrow(/site_assets_storage_ref/);
      const id2 = randomUUID();
      await expect(asset(attempt, { id: id2, storage_ref: `site-assets/${locA}/${id2}/${SHA2}.png`, sha256: SHA2 })).rejects.toThrow(/site_assets_storage_ref/);
    });
  });

  it('тип, размер, стороны, sha256 и ALT по правилам вида', async () => {
    await probe(async (attempt) => {
      await expect(asset(attempt, { mime_type: 'image/jpeg' })).rejects.toThrow(/site_assets_mime/);
      await expect(asset(attempt, { kind: 'FAVICON', mime_type: 'image/webp', sha256: SHA2 })).rejects.toThrow(/site_assets_mime|site_assets_storage_ref/);
      await expect(asset(attempt, { mime_type: 'image/svg+xml' })).rejects.toThrow(/site_assets_mime/);
      await expect(asset(attempt, { byte_size: 0 })).rejects.toThrow(/site_assets_byte_size/);
      await expect(asset(attempt, { byte_size: 10 * 1024 * 1024 + 1 })).rejects.toThrow(/site_assets_byte_size/);
      await expect(asset(attempt, { width: 2401 })).rejects.toThrow(/site_assets_dimensions/);
      await expect(asset(attempt, { kind: 'LOGO', width: 1601, sha256: SHA2 })).rejects.toThrow(/site_assets_dimensions/);
      await expect(asset(attempt, { kind: 'FAVICON', width: 256, height: 256, sha256: SHA2 })).rejects.toThrow(/site_assets_dimensions/);
      await expect(asset(attempt, { sha256: 'A'.repeat(64) })).rejects.toThrow(/site_assets_sha256|site_assets_storage_ref/);
      await expect(asset(attempt, { default_alt: JSON.stringify(['ru']) })).rejects.toThrow(/site_assets_default_alt/);
      await asset(attempt, { default_alt: JSON.stringify({ ru: 'Фасад' }) });
    });
  });

  it('один живой ассет на филиал, вид и sha256; удалённый место освобождает; другой вид и филиал отдельно', async () => {
    await probe(async (attempt) => {
      const first = await asset(attempt);
      await expect(asset(attempt)).rejects.toThrow(/site_assets_live_key/);
      await asset(attempt, { kind: 'LOGO' });
      await asset(attempt, { location_id: locA2 });
      await attempt(`UPDATE site_assets SET status = 'DELETED', deleted_at = now() WHERE id = $1`, [first]);
      await asset(attempt);
    });
  });

  it('готовый ассет не меняет владельца, вид, байты и ключ; переходы; DELETED конечный и требует deleted_at', async () => {
    await probe(async (attempt) => {
      const id = await asset(attempt);
      await expect(attempt(`UPDATE site_assets SET location_id = $1 WHERE id = $2`, [locA2, id])).rejects.toThrow(/владелец|site_assets_storage_ref/);
      await expect(attempt(`UPDATE site_assets SET source = 'CHANNEX_IMPORT' WHERE id = $1`, [id])).rejects.toThrow(/не меняются/);
      await expect(attempt(`UPDATE site_assets SET kind = 'LOGO' WHERE id = $1`, [id])).rejects.toThrow(/не меняет/);
      await expect(attempt(`UPDATE site_assets SET byte_size = 99 WHERE id = $1`, [id])).rejects.toThrow(/не меняет/);
      await expect(attempt(`UPDATE site_assets SET width = 10 WHERE id = $1`, [id])).rejects.toThrow(/не меняет/);
      await attempt(`UPDATE site_assets SET default_alt = '{"ru":"Новый"}'::jsonb WHERE id = $1`, [id]);
      await expect(attempt(`UPDATE site_assets SET status = 'PROCESSING' WHERE id = $1`, [id])).rejects.toThrow(/переход/);
      await expect(attempt(`UPDATE site_assets SET status = 'DELETED' WHERE id = $1`, [id])).rejects.toThrow(/site_assets_deleted_at/);
      await attempt(`UPDATE site_assets SET status = 'DELETED', deleted_at = now() WHERE id = $1`, [id]);
      await expect(attempt(`UPDATE site_assets SET status = 'READY', deleted_at = NULL WHERE id = $1`, [id])).rejects.toThrow(/переход/);
      await expect(asset(attempt, { status: 'DELETED', deleted_at: new Date(), sha256: SHA2 })).rejects.toThrow(/не может быть удалённым/);
      // удаление сотрудника обнуляет автора
      await attempt(`DELETE FROM users WHERE id = $1`, [user]);
      const row = await attempt(`SELECT created_by_id FROM site_assets WHERE id = $1`, [id]);
      expect(row.rows[0].created_by_id).toBeNull();
    });
  });

  it('RLS: организация видит только свои ассеты; у ролей приложения нет DELETE', async () => {
    await probe(async (attempt) => {
      const mine = await asset(attempt);
      await asset(attempt, { location_id: locB });
      await attempt('SET LOCAL ROLE wetop_app');
      await attempt(`SELECT set_config('app.org_id', $1, true)`, [orgA]);
      const rows = await attempt(`SELECT id, location_id FROM site_assets WHERE location_id = ANY($1::uuid[])`, [[locA, locB]]);
      expect(rows.rows.map((r) => r.id)).toEqual([mine]);
      await expect(attempt(`DELETE FROM site_assets WHERE id = $1`, [mine])).rejects.toThrow(/permission denied/);
      await attempt(`UPDATE site_assets SET status = 'DELETED', deleted_at = now() WHERE id = $1`, [mine]);
      // вставка ассета в чужой филиал: политика режет
      await expect(asset(attempt, { location_id: locB, sha256: SHA2 })).rejects.toThrow(/row-level security/);
    });
    await probe(async (attempt) => {
      await attempt('SET LOCAL ROLE wetop_service');
      const id = await asset(attempt);
      await expect(attempt(`DELETE FROM site_assets WHERE id = $1`, [id])).rejects.toThrow(/permission denied/);
    });
  });
});
