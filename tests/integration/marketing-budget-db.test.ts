import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isLocalDatabase } from '../tools/seed-local';

/**
 * МКТ-В1/В2, база (DATA_MODEL §32, миграции 075 и 076): журнал расходов маркетинга и план месяца.
 * Проверяется то, что держит сама база: CHECK на суммы, курс, валюту и первое число месяца,
 * UNIQUE «один план на месяц филиала», RLS через цепочку филиал → бизнес → организация и права
 * ролей. Прямой SQL в транзакции, которая откатывается; данные вымышленные (ADR-010).
 */
const url = process.env.DATABASE_URL;
const schema = process.env.DATABASE_SCHEMA || 'public';

describe.skipIf(!url)('МКТ-В1/В2 marketing accounting: инварианты базы', () => {
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

  const expense = (attempt: Attempt, location: string, over: Record<string, unknown> = {}) => {
    const row: Record<string, unknown> = {
      id: randomUUID(),
      location_id: location,
      date: '2026-10-08',
      platform: 'META',
      category: 'Реклама',
      amount: '12000',
      currency: 'KZT',
      fx_rate: '1',
      base_amount: '12000',
      updated_at: new Date(),
      ...over,
    };
    const keys = Object.keys(row);
    return attempt(
      `INSERT INTO marketing_expenses (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')})`,
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
    await sql.query(`INSERT INTO organizations (id, name) VALUES ($1, 'МКТ A (synthetic)'), ($2, 'МКТ B (synthetic)')`, [orgA, orgB]);
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

  it('CHECK: суммы и курс больше нуля, валюта кодом, статья не пустая', async () => {
    await probe(async (attempt) => {
      await expense(attempt, locA); // здоровая строка проходит
      await expect(expense(attempt, locA, { amount: '0' })).rejects.toThrow(/marketing_expenses_amount/);
      await expect(expense(attempt, locA, { base_amount: '-5' })).rejects.toThrow(/marketing_expenses_base_amount/);
      await expect(expense(attempt, locA, { fx_rate: '0' })).rejects.toThrow(/marketing_expenses_fx_rate/);
      await expect(expense(attempt, locA, { currency: 'kz1' })).rejects.toThrow(/marketing_expenses_currency/);
      await expect(expense(attempt, locA, { category: '   ' })).rejects.toThrow(/marketing_expenses_category/);
    });
  });

  it('план: только первое число месяца и один план на месяц филиала', async () => {
    await probe(async (attempt) => {
      const plan = (month: string, id = randomUUID()) =>
        attempt(
          `INSERT INTO marketing_budgets (id, location_id, month, amount, updated_at) VALUES ($1, $2, $3, '300000', now())`,
          [id, locA, month],
        );
      await plan('2026-10-01');
      await expect(plan('2026-11-15')).rejects.toThrow(/marketing_budgets_month/);
      await expect(plan('2026-10-01')).rejects.toThrow(/marketing_budgets_location_id_month_key/);
      // тот же месяц у другого филиала: можно
      await attempt(
        `INSERT INTO marketing_budgets (id, location_id, month, amount, updated_at) VALUES ($1, $2, '2026-10-01', '100', now())`,
        [randomUUID(), locB],
      );
    });
  });

  it('RLS: чужая организация не видит расходы и планы и не может писать в чужой филиал', async () => {
    await probe(async (attempt) => {
      await expense(attempt, locA);
      await attempt(
        `INSERT INTO marketing_budgets (id, location_id, month, amount, updated_at) VALUES ($1, $2, '2026-10-01', '300000', now())`,
        [randomUUID(), locA],
      );
      await asApp(attempt, orgB);
      for (const table of ['marketing_expenses', 'marketing_budgets']) {
        const seen = await attempt(`SELECT count(*)::int AS n FROM ${table}`);
        expect(seen.rows[0].n).toBe(0);
      }
      await expect(expense(attempt, locA, { id: randomUUID() })).rejects.toThrow(/violates row-level security/);
      await attempt('RESET ROLE');
      await asApp(attempt, orgA);
      const own = await attempt(`SELECT count(*)::int AS n FROM marketing_expenses`);
      expect(own.rows[0].n).toBe(1);
    });
  });

  it('права ролей: у плана месяца нет DELETE, он меняется правкой', async () => {
    await probe(async (attempt) => {
      await attempt(
        `INSERT INTO marketing_budgets (id, location_id, month, amount, updated_at) VALUES ($1, $2, '2026-10-01', '300000', now())`,
        [randomUUID(), locA],
      );
      await asApp(attempt, orgA);
      await expect(attempt(`DELETE FROM marketing_budgets`)).rejects.toThrow(/permission denied/);
      await attempt(`UPDATE marketing_budgets SET amount = '500000', updated_at = now()`);
      // расход роль удалить может: это учётная запись, удаление пишется в журнал приложением
      await expense(attempt, locA, { id: randomUUID() });
      await attempt(`DELETE FROM marketing_expenses`);
    });
  });
});
