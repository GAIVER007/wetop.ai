/**
 * Схема pms_test в проекте Supabase «hotel» (ADR-042): здесь работают интеграционные и сквозные тесты, public не трогают.
 *   1. схема и служебные таблицы `_test_migrations`, `_test_meta`;
 *   2. миграции Prisma по порядку, каждая в транзакции с search_path = pms_test, public (btree_gist лежит в public);
 *   3. данные: копия всех таблиц public одной транзакцией — если схема пуста или запрошено обновление.
 * Копия содержит то же, что рабочая база (гости — псевдонимы, ADR-018), и остаётся в той же базе.
 * Строка подключения читается из .env программой; адрес и пароль не печатаются.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import pg from 'pg';
import { seedTestData, type SeedReport } from './test-seed';
import {
  TEST_SCHEMA,
  chooseTestDataSource,
  copyPlan,
  pendingMigrations,
  refreshPlan,
  seedIsStale,
  selectExpressions,
  testDatabaseRefusal,
  type ColumnInfo,
} from './test-schema-plan';

const ROOT = resolve(import.meta.dirname, '../..');
const MIGRATIONS = resolve(ROOT, 'packages/database/prisma/migrations');
const SERVICE_TABLES = new Set(['_test_migrations', '_test_meta', '_prisma_migrations']);
const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
const S = q(TEST_SCHEMA);

export interface TestSchemaReport {
  created: boolean;
  migrated: string[];
  totalMigrations: number;
  copied: Array<{ table: string; rows: number; live: number }> | null;
  /** Данные пришли из сида (plans/tests-without-live-db-2026-09-15.md), а не копией public */
  seeded: SeedReport | null;
  refreshedAt: string | null;
}

function connectionString(): string {
  loadEnv({ path: resolve(ROOT, '.env'), quiet: true });
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL не задан в .env — тестовую схему создать не к чему');
  const refusal = testDatabaseRefusal(url);
  if (refusal) throw new Error(refusal);
  return url;
}

export async function ensureTestSchema(
  opts: { refresh?: boolean; log?: (line: string) => void } = {},
): Promise<TestSchemaReport> {
  const log = opts.log ?? (() => undefined);
  const pool = new pg.Pool({ connectionString: connectionString(), max: 1 });
  const client = await pool.connect();
  try {
    const existed =
      (await client.query('SELECT 1 FROM pg_namespace WHERE nspname = $1', [TEST_SCHEMA])).rowCount === 1;
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${S}`);
    await client.query(
      `CREATE TABLE IF NOT EXISTS ${S}."_test_migrations" (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`,
    );
    await client.query(`CREATE TABLE IF NOT EXISTS ${S}."_test_meta" (key text PRIMARY KEY, value text NOT NULL)`);

    const all = readdirSync(MIGRATIONS).filter((d) => existsSync(resolve(MIGRATIONS, d, 'migration.sql')));
    const applied = new Set(
      (await client.query<{ name: string }>(`SELECT name FROM ${S}."_test_migrations"`)).rows.map((r) => r.name),
    );
    const pending = pendingMigrations(all, applied);
    for (const name of pending) {
      const sql = readFileSync(resolve(MIGRATIONS, name, 'migration.sql'), 'utf-8');
      try {
        await client.query('BEGIN');
        await client.query(`SET LOCAL search_path TO ${S}, public`);
        await client.query(sql);
        await client.query(`INSERT INTO ${S}."_test_migrations" (name) VALUES ($1)`, [name]);
        await client.query('COMMIT');
        log(`миграция ${name} — применена`);
      } catch (e) {
        await client.query('ROLLBACK');
        throw new Error(`миграция ${name} на схеме ${TEST_SCHEMA} не применилась: ${(e as Error).message}`, {
          cause: e,
        });
      }
    }

    const empty =
      Number((await client.query<{ n: string }>(`SELECT count(*) AS n FROM ${S}."properties"`)).rows[0]!.n) === 0;
    let copied: TestSchemaReport['copied'] = null;
    let seeded: TestSchemaReport['seeded'] = null;
    const stamp = (
      await client.query<{ value: string }>(`SELECT value FROM ${S}."_test_meta" WHERE key = 'refreshed_at'`)
    ).rows[0]?.value ?? null;
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' }).format(new Date());
    // сид живёт вокруг «сегодня»: вчерашний сид сегодня пуст, и спеки шахматки видели бы занято 0
    const stale = !empty && seedIsStale(stamp, today);
    if (stale) log(`сид от ${stamp} устарел к ${today} — засеваю заново`);
    const { refill, wipeFirst } = refreshPlan({ empty, stale, refresh: !!opts.refresh });
    if (refill) {
      const source = chooseTestDataSource(process.env.TEST_DATA, await liveHasData(client));
      if (source === 'copy') copied = await copyLiveData(client, log);
      else {
        // Поверх прежнего сида импорт упрётся в пересечение ячеек: даты сдвинулись, а строки ещё вчерашние
        if (wipeFirst) await wipeTestData(client, log);
        seeded = await seedTestData(connectionString(), TEST_SCHEMA, log);
        await client.query(
          `INSERT INTO ${S}."_test_meta" (key, value) VALUES ('refreshed_at', $1)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
          [`${new Date().toISOString()} (сид)`],
        );
      }
    }
    const meta = await client.query<{ value: string }>(`SELECT value FROM ${S}."_test_meta" WHERE key = 'refreshed_at'`);
    return {
      created: !existed,
      migrated: pending,
      totalMigrations: all.length,
      copied,
      seeded,
      refreshedAt: meta.rows[0]?.value ?? null,
    };
  } finally {
    client.release();
    await pool.end();
  }
}

/** В рабочей схеме public есть объект — значит, есть что копировать; нет таблицы или строк — сид */
async function liveHasData(client: pg.PoolClient): Promise<boolean> {
  const table = await client.query(
    "SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'properties'",
  );
  if (table.rowCount === 0) return false;
  return Number((await client.query<{ n: string }>('SELECT count(*) AS n FROM public."properties"')).rows[0]!.n) > 0;
}

/** Все таблицы public → pms_test одной транзакцией: либо полная согласованная копия, либо ничего. */
/**
 * Прежние данные схемы прочь: служебные таблицы (миграции, отметка `refreshed_at`) остаются — они не
 * данные. Нужно перед повторным засевом; копия рабочих данных чистит за собой сама, внутри транзакции.
 */
async function wipeTestData(client: pg.PoolClient, log: (line: string) => void): Promise<void> {
  const tables = (
    await client.query<{ tablename: string }>('SELECT tablename FROM pg_tables WHERE schemaname = $1', [TEST_SCHEMA])
  ).rows
    .map((r) => r.tablename)
    .filter((t) => !SERVICE_TABLES.has(t));
  if (!tables.length) return;
  await client.query(`TRUNCATE ${tables.map((t) => `${S}.${q(t)}`).join(', ')} CASCADE`);
  log(`прежние данные схемы сняты: таблиц ${tables.length}`);
}

async function copyLiveData(
  client: pg.PoolClient,
  log: (line: string) => void,
): Promise<NonNullable<TestSchemaReport['copied']>> {
  const tablesIn = async (schema: string) =>
    new Set(
      (await client.query<{ tablename: string }>('SELECT tablename FROM pg_tables WHERE schemaname = $1', [schema])).rows
        .map((r) => r.tablename)
        .filter((t) => !SERVICE_TABLES.has(t)),
    );
  const [live, test] = await Promise.all([tablesIn('public'), tablesIn(TEST_SCHEMA)]);
  const missing = [...live].filter((t) => !test.has(t));
  if (missing.length) throw new Error(`в ${TEST_SCHEMA} нет таблиц рабочей базы: ${missing.join(', ')} — сначала миграции`);
  const tables = [...test].filter((t) => live.has(t));
  const fks = (
    await client.query<{ table: string; references: string; nullable: boolean }>(
      `SELECT tc.relname AS table, rc.relname AS references,
              NOT EXISTS (SELECT 1 FROM pg_attribute a
                           WHERE a.attrelid = k.conrelid AND a.attnum = ANY(k.conkey) AND a.attnotnull) AS nullable
         FROM pg_constraint k
         JOIN pg_class tc ON tc.oid = k.conrelid
         JOIN pg_class rc ON rc.oid = k.confrelid
         JOIN pg_namespace n ON n.oid = tc.relnamespace
        WHERE k.contype = 'f' AND n.nspname = $1`,
      [TEST_SCHEMA],
    )
  ).rows;
  const { order, relaxed } = copyPlan(tables, fks);
  const out: NonNullable<TestSchemaReport['copied']> = [];
  await client.query('BEGIN');
  try {
    if (relaxed.length) {
      // цикл через ссылку с NULL (сайт ↔ версии, MKT3): порядком его не обойти, ссылки на время копии не проверяются
      log(`копия без построчной проверки ссылок: ${relaxed.map((r) => `${r.table} → ${r.references}`).join(', ')}`);
      await client.query('SET LOCAL session_replication_role = replica');
    }
    await client.query(`TRUNCATE ${order.map((t) => `${S}.${q(t)}`).join(', ')} CASCADE`);
    for (const table of order) {
      const cols = (
        await client.query<{ column_name: string; data_type: string; udt_schema: string; udt_name: string; is_generated: string }>(
          `SELECT column_name, data_type, udt_schema, udt_name, is_generated
             FROM information_schema.columns
            WHERE table_schema = $1 AND table_name = $2
            ORDER BY ordinal_position`,
          [TEST_SCHEMA, table],
        )
      ).rows.map(
        (c): ColumnInfo => ({
          name: c.column_name,
          dataType: c.data_type,
          udtSchema: c.udt_schema,
          udtName: c.udt_name,
          generated: c.is_generated === 'ALWAYS',
        }),
      );
      const { insertColumns, selectList } = selectExpressions(cols, TEST_SCHEMA);
      const res = await client.query(
        `INSERT INTO ${S}.${q(table)} (${insertColumns.join(', ')}) SELECT ${selectList.join(', ')} FROM public.${q(table)}`,
      );
      out.push({ table, rows: res.rowCount ?? 0, live: 0 });
    }
    await client.query(
      `INSERT INTO ${S}."_test_meta" (key, value) VALUES ('refreshed_at', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [new Date().toISOString()],
    );
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw new Error(`копия данных в ${TEST_SCHEMA} не сделана, схема не изменена: ${(e as Error).message}`, {
      cause: e,
    });
  }
  // Сверка после записи: сколько строк в рабочей таблице сейчас (рабочая база живёт — расхождение в единицы нормально)
  for (const row of out)
    row.live = Number((await client.query<{ n: string }>(`SELECT count(*) AS n FROM public.${q(row.table)}`)).rows[0]!.n);
  log(`данные скопированы: таблиц ${out.length}, строк ${out.reduce((a, r) => a + r.rows, 0)}`);
  return out;
}

/** Готова ли схема: все миграции применены и данные есть. Для проверок перед прогоном. */
export async function testSchemaReady(): Promise<{ ready: boolean; reason: string }> {
  const pool = new pg.Pool({ connectionString: connectionString(), max: 1 });
  try {
    const exists = (await pool.query('SELECT 1 FROM pg_namespace WHERE nspname = $1', [TEST_SCHEMA])).rowCount === 1;
    if (!exists) return { ready: false, reason: `схемы ${TEST_SCHEMA} нет` };
    const all = readdirSync(MIGRATIONS).filter((d) => existsSync(resolve(MIGRATIONS, d, 'migration.sql')));
    const applied = new Set(
      (await pool.query<{ name: string }>(`SELECT name FROM ${S}."_test_migrations"`)).rows.map((r) => r.name),
    );
    const pending = pendingMigrations(all, applied);
    if (pending.length) return { ready: false, reason: `не применены миграции: ${pending.join(', ')}` };
    const units = Number((await pool.query<{ n: string }>(`SELECT count(*) AS n FROM ${S}."inventory_units"`)).rows[0]!.n);
    if (!units) return { ready: false, reason: `в ${TEST_SCHEMA} нет данных` };
    return { ready: true, reason: 'ok' };
  } finally {
    await pool.end();
  }
}
