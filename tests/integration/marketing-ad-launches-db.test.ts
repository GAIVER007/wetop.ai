import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isLocalDatabase } from '../tools/seed-local';

/**
 * ИИ-таргетолог, база (DATA_MODEL §57, ADR-MKT-LAUNCH, миграции 126 и 127): креатив, запуск и журнал шагов в Meta.
 * Проверяется то, что держит сама база: ключ объекта креатива, пары цели и назначения, исход запуска, триггер
 * «тот же филиал, номера Meta и настройки не переписываются, завершённый неизменен», RLS и права ролей.
 * Прямой SQL в транзакции, которая откатывается; данные вымышленные (ADR-010).
 */
const url = process.env.DATABASE_URL;
const schema = process.env.DATABASE_SCHEMA || 'public';

describe.skipIf(!url)('§57 запуск рекламы: инварианты базы', () => {
  let sql: pg.Client;
  const orgA = randomUUID(),
    orgB = randomUUID(),
    bizA = randomUUID(),
    bizB = randomUUID(),
    locA = randomUUID(),
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

  const insert = (attempt: Attempt, table: string, row: Record<string, unknown>) => {
    const keys = Object.keys(row);
    return attempt(
      `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`,
      keys.map((k) => row[k]),
    );
  };
  const connection = async (attempt: Attempt, location: string) =>
    (
      await insert(attempt, 'marketing_ad_connections', {
        id: randomUUID(),
        location_id: location,
        platform: 'META',
        ad_account_id: '1234567890',
        currency: 'USD',
        timezone: 'Asia/Almaty',
        token_ciphertext: 'v1:a:b:c',
        updated_at: new Date(),
      })
    ).rows[0].id as string;
  const creative = (attempt: Attempt, location: string, over: Record<string, unknown> = {}) => {
    const id = (over.id as string) ?? randomUUID();
    const sha = (over.sha256 as string) ?? 'a'.repeat(64);
    return insert(attempt, 'marketing_ad_creatives', {
      id,
      location_id: location,
      kind: 'IMAGE',
      file_name: 'offer.jpg',
      mime_type: 'image/jpeg',
      storage_ref: `marketing-ad-creatives/${location}/${id}/${sha}.jpg`,
      byte_size: 1000,
      sha256: sha,
      ...over,
    });
  };
  const launch = (attempt: Attempt, location: string, conn: string, over: Record<string, unknown> = {}) =>
    insert(attempt, 'marketing_ad_launches', {
      id: randomUUID(),
      location_id: location,
      connection_id: conn,
      request_key: randomUUID(),
      source: 'SCREEN',
      goal: 'MESSAGES',
      destination: 'WHATSAPP',
      daily_budget_minor: '500',
      currency: 'USD',
      fx_rate: '480',
      daily_budget_base_minor: '240000',
      settings: JSON.stringify({ headline: 'Тестовый оффер' }),
      ...over,
    });
  const campaign = async (attempt: Attempt, location: string) =>
    (
      await insert(attempt, 'marketing_campaigns', {
        id: randomUUID(),
        location_id: location,
        platform: 'META',
        name: 'ИИ кампания',
        external_id: '120000000000001',
        updated_at: new Date(),
      })
    ).rows[0].id as string;
  const asApp = async (attempt: Attempt, org: string) => {
    await attempt('SET LOCAL ROLE wetop_app');
    await attempt(`SELECT set_config('app.org_id', $1, true)`, [org]);
  };

  beforeAll(async () => {
    if (!isLocalDatabase(url!)) throw new Error('Requires isolated localhost PostgreSQL');
    sql = new pg.Client({ connectionString: url, options: `-c search_path=${schema},public` });
    await sql.connect();
    await sql.query(`INSERT INTO organizations (id, name) VALUES ($1, 'ADS A (synthetic)'), ($2, 'ADS B (synthetic)')`, [orgA, orgB]);
    await sql.query(
      `INSERT INTO businesses (id, organization_id, name, vertical, updated_at)
       VALUES ($1, $2, 'Hotel A', 'HOSPITALITY', now()), ($3, $4, 'Hotel B', 'HOSPITALITY', now())`,
      [bizA, orgA, bizB, orgB],
    );
    for (const [id, business] of [[locA, bizA], [locB, bizB]] as const)
      await sql.query(
        `INSERT INTO locations (id, business_id, name, timezone, currency, updated_at) VALUES ($1, $2, 'Loc', 'Asia/Almaty', 'KZT', now())`,
        [id, business],
      );
  });

  afterAll(async () => {
    if (!sql) return;
    await sql.query(`DELETE FROM locations WHERE id = ANY($1::uuid[])`, [[locA, locB]]);
    await sql.query(`DELETE FROM businesses WHERE id = ANY($1::uuid[])`, [[bizA, bizB]]);
    await sql.query(`DELETE FROM organizations WHERE id = ANY($1::uuid[])`, [[orgA, orgB]]);
    await sql.end();
  });

  it('креатив: ключ объекта выводится из строки, тип по виду, предел размера, тот же файл один раз', async () => {
    await probe(async (attempt) => {
      await creative(attempt, locA);
      await expect(creative(attempt, locA, { sha256: 'b'.repeat(64), storage_ref: 'marketing-ad-creatives/x.jpg' })).rejects.toThrow(
        /marketing_ad_creatives_ref/,
      );
      await expect(creative(attempt, locA, { sha256: 'c'.repeat(64), mime_type: 'video/mp4' })).rejects.toThrow(
        /marketing_ad_creatives_mime/,
      );
      await expect(creative(attempt, locA, { sha256: 'd'.repeat(64), byte_size: 9_000_000 })).rejects.toThrow(
        /marketing_ad_creatives_size/,
      );
      await expect(creative(attempt, locA)).rejects.toThrow(/marketing_ad_creatives_location_id_sha256_key/);
    });
  });

  it('запуск: пара цели и назначения, деньги, ключ повтора, исход со всеми номерами', async () => {
    await probe(async (attempt) => {
      const conn = await connection(attempt, locA);
      await expect(launch(attempt, locA, conn, { goal: 'LEADS', destination: 'WHATSAPP' })).rejects.toThrow(
        /marketing_ad_launches_destination/,
      );
      await expect(launch(attempt, locA, conn, { daily_budget_minor: '0' })).rejects.toThrow(/marketing_ad_launches_money/);
      const key = randomUUID();
      const id = (await launch(attempt, locA, conn, { request_key: key })).rows[0].id as string;
      await expect(launch(attempt, locA, conn, { request_key: key })).rejects.toThrow(/marketing_ad_launches_request_key_key/);
      // успех без номеров и кампании WETOP невозможен
      await expect(
        attempt(`UPDATE marketing_ad_launches SET status = 'SUCCEEDED', step = 'DONE', finished_at = now() WHERE id = $1`, [id]),
      ).rejects.toThrow(/marketing_ad_launches_outcome/);
      await expect(
        attempt(`UPDATE marketing_ad_launches SET status = 'FAILED', finished_at = now() WHERE id = $1`, [id]),
      ).rejects.toThrow(/marketing_ad_launches_outcome/);
      await expect(
        attempt(`UPDATE marketing_ad_launches SET external_campaign_id = 'act_1' WHERE id = $1`, [id]),
      ).rejects.toThrow(/marketing_ad_launches_external/);
      const camp = await campaign(attempt, locA);
      await attempt(
        `UPDATE marketing_ad_launches SET status = 'SUCCEEDED', step = 'DONE', finished_at = now(), campaign_id = $2,
           external_campaign_id = '1', external_adset_id = '2', external_creative_id = '3', external_ad_id = '4' WHERE id = $1`,
        [id, camp],
      );
    });
  });

  it('триггер: чужой филиал, переписанные настройки и номера, изменение завершённого', async () => {
    await probe(async (attempt) => {
      const connA = await connection(attempt, locA);
      const connB = await connection(attempt, locB);
      await expect(launch(attempt, locA, connB)).rejects.toThrow(/Launch connection belongs to another location/);
      const creativeB = (await creative(attempt, locB)).rows[0].id as string;
      await expect(launch(attempt, locA, connA, { creative_id: creativeB })).rejects.toThrow(
        /Launch creative belongs to another location/,
      );
      const id = (await launch(attempt, locA, connA)).rows[0].id as string;
      const campB = await campaign(attempt, locB);
      await expect(attempt(`UPDATE marketing_ad_launches SET campaign_id = $2 WHERE id = $1`, [id, campB])).rejects.toThrow(
        /Launch campaign belongs to another location/,
      );
      await expect(
        attempt(`UPDATE marketing_ad_launches SET daily_budget_minor = 900 WHERE id = $1`, [id]),
      ).rejects.toThrow(/Launch settings are immutable/);
      await attempt(`UPDATE marketing_ad_launches SET step = 'CAMPAIGN', external_campaign_id = '11' WHERE id = $1`, [id]);
      await expect(
        attempt(`UPDATE marketing_ad_launches SET external_campaign_id = '12' WHERE id = $1`, [id]),
      ).rejects.toThrow(/Launch external ids are immutable/);
      await attempt(
        `UPDATE marketing_ad_launches SET status = 'FAILED', finished_at = now(), error = 'Нет способа оплаты' WHERE id = $1`,
        [id],
      );
      await expect(
        attempt(`UPDATE marketing_ad_launches SET error = 'другое' WHERE id = $1`, [id]),
      ).rejects.toThrow(/Finished launch is immutable/);
    });
  });

  it('RLS и права: чужая организация не видит, шаги только дописываются, ничего не удаляется', async () => {
    await probe(async (attempt) => {
      const conn = await connection(attempt, locA);
      await creative(attempt, locA);
      const id = (await launch(attempt, locA, conn)).rows[0].id as string;
      await expect(
        insert(attempt, 'marketing_ad_launch_steps', { id: randomUUID(), launch_id: id, step: 'MEDIA', attempt: 6, status: 'OK' }),
      ).rejects.toThrow(/marketing_ad_launch_steps_attempt/);
      await insert(attempt, 'marketing_ad_launch_steps', {
        id: randomUUID(),
        launch_id: id,
        step: 'MEDIA',
        attempt: 1,
        status: 'OK',
        external_id: 'abc123hash',
      });
      await asApp(attempt, orgB);
      for (const table of ['marketing_ad_creatives', 'marketing_ad_launches', 'marketing_ad_launch_steps'])
        expect((await attempt(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n).toBe(0);
      await attempt('RESET ROLE');
      await asApp(attempt, orgA);
      expect((await attempt(`SELECT count(*)::int AS n FROM marketing_ad_launch_steps`)).rows[0].n).toBe(1);
      await expect(attempt(`UPDATE marketing_ad_launch_steps SET status = 'FAILED'`)).rejects.toThrow(/permission denied/);
      await expect(attempt(`UPDATE marketing_ad_creatives SET file_name = 'x.jpg'`)).rejects.toThrow(/permission denied/);
      for (const table of ['marketing_ad_creatives', 'marketing_ad_launches', 'marketing_ad_launch_steps'])
        await expect(attempt(`DELETE FROM ${table}`)).rejects.toThrow(/permission denied/);
    });
  });
});
