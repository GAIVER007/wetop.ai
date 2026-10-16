import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isLocalDatabase } from '../tools/seed-local';

/**
 * МКТ-В1/В2, база (DATA_MODEL §41, миграции 097 и 098): журнал расходов маркетинга и план месяца.
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

  it('план по каналам (§52): первое число, один канал на месяц филиала, сумма больше нуля, RLS, DELETE есть', async () => {
    await probe(async (attempt) => {
      const line = (month: string, platform = 'META', amount = '100000', location = locA) =>
        attempt(
          `INSERT INTO marketing_budget_lines (id, location_id, month, platform, amount, updated_at)
           VALUES ($1, $2, $3, $4, $5, now())`,
          [randomUUID(), location, month, platform, amount],
        );
      await line('2026-10-01');
      await line('2026-10-01', 'GOOGLE');
      await expect(line('2026-10-15', 'SITE')).rejects.toThrow(/marketing_budget_lines_month/);
      await expect(line('2026-10-01', 'TIKTOK', '0')).rejects.toThrow(/marketing_budget_lines_amount/);
      await expect(line('2026-10-01')).rejects.toThrow(/marketing_budget_lines_location_id_month_platform_key/);
      await line('2026-10-01', 'META', '5', locB);
      await asApp(attempt, orgB);
      const seen = await attempt(`SELECT count(*)::int AS n FROM marketing_budget_lines`);
      expect(seen.rows[0].n).toBe(1);
      await expect(line('2026-11-01', 'META', '1', locA)).rejects.toThrow(/violates row-level security/);
      await attempt('RESET ROLE');
      await asApp(attempt, orgA);
      // канал убирается из плана удалением строки: у роли DELETE есть
      const gone = await attempt(`DELETE FROM marketing_budget_lines WHERE platform = 'GOOGLE'`);
      expect(gone.rowCount).toBe(1);
    });
  });

  it('чеки (§51): ключ хранилища выводится из строки, только WebP и PDF, RLS, без UPDATE, уходят с расходом', async () => {
    await probe(async (attempt) => {
      const expenseId = randomUUID();
      await expense(attempt, locA, { id: expenseId });
      const sha = 'a'.repeat(64);
      const file = (over: Record<string, unknown> = {}) => {
        const id = (over.id as string | undefined) ?? randomUUID();
        const hash = (over.sha256 as string | undefined) ?? sha;
        const row: Record<string, unknown> = {
          id,
          expense_id: expenseId,
          location_id: locA,
          file_name: 'чек.pdf',
          mime_type: 'application/pdf',
          storage_ref: `marketing-expense-files/${locA}/${id}/${hash}.pdf`,
          byte_size: 100,
          sha256: hash,
          ...over,
        };
        const keys = Object.keys(row);
        return attempt(
          `INSERT INTO marketing_expense_files (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')})`,
          keys.map((k) => row[k]),
        );
      };
      await file();
      await expect(file({ storage_ref: `marketing-expense-files/${locB}/x/${sha}.pdf` })).rejects.toThrow(/marketing_expense_files_ref/);
      await expect(file({ mime_type: 'image/svg+xml', sha256: 'b'.repeat(64) })).rejects.toThrow(/marketing_expense_files_mime/);
      await expect(file({ sha256: 'b'.repeat(64), byte_size: 0 })).rejects.toThrow(/marketing_expense_files_size/);
      await expect(file()).rejects.toThrow(/marketing_expense_files_expense_id_sha256_key/);
      await asApp(attempt, orgB);
      expect((await attempt(`SELECT count(*)::int AS n FROM marketing_expense_files`)).rows[0].n).toBe(0);
      await attempt('RESET ROLE');
      await asApp(attempt, orgA);
      await expect(attempt(`UPDATE marketing_expense_files SET file_name = 'другое'`)).rejects.toThrow(/permission denied/);
      await attempt('RESET ROLE');
      await attempt(`DELETE FROM marketing_expenses WHERE id = $1`, [expenseId]);
      expect((await attempt(`SELECT count(*)::int AS n FROM marketing_expense_files`)).rows[0].n).toBe(0);
    });
  });

  it('кампании (§53): клики не больше показов, даты по порядку, статистика за кампанией в RLS, кампанию не удалить', async () => {
    await probe(async (attempt) => {
      const campaign = randomUUID();
      await attempt(
        `INSERT INTO marketing_campaigns (id, location_id, platform, name, updated_at) VALUES ($1, $2, 'META', 'Осень', now())`,
        [campaign, locA],
      );
      await expect(
        attempt(
          `INSERT INTO marketing_campaigns (id, location_id, platform, name, starts_on, ends_on, updated_at)
           VALUES ($1, $2, 'META', 'Зима', '2026-12-10', '2026-12-01', now())`,
          [randomUUID(), locA],
        ),
      ).rejects.toThrow(/marketing_campaigns_dates/);
      const day = (date: string, impressions: number, clicks: number) =>
        attempt(
          `INSERT INTO marketing_campaign_stats (id, campaign_id, date, impressions, clicks, leads, updated_at)
           VALUES ($1, $2, $3, $4, $5, 0, now())`,
          [randomUUID(), campaign, date, impressions, clicks],
        );
      await day('2026-10-05', 100, 10);
      await expect(day('2026-10-06', 10, 11)).rejects.toThrow(/marketing_campaign_stats_clicks/);
      await expect(day('2026-10-05', 1, 1)).rejects.toThrow(/marketing_campaign_stats_campaign_id_date_key/);
      await asApp(attempt, orgB);
      expect((await attempt(`SELECT count(*)::int AS n FROM marketing_campaign_stats`)).rows[0].n).toBe(0);
      expect((await attempt(`SELECT count(*)::int AS n FROM marketing_campaigns`)).rows[0].n).toBe(0);
      await attempt('RESET ROLE');
      await asApp(attempt, orgA);
      expect((await attempt(`SELECT count(*)::int AS n FROM marketing_campaign_stats`)).rows[0].n).toBe(1);
      await expect(attempt(`DELETE FROM marketing_campaigns`)).rejects.toThrow(/permission denied/);
    });
  });

  it('кабинет (§55): имя уникально только у ручных, расход только у дней кабинета, ключ только шифром, сверки без DELETE', async () => {
    await probe(async (attempt) => {
      const campaign = (name: string, external: string | null) =>
        attempt(
          `INSERT INTO marketing_campaigns (id, location_id, platform, name, external_id, updated_at)
           VALUES ($1, $2, 'META', $3, $4, now()) RETURNING id`,
          [randomUUID(), locA, name, external],
        );
      await campaign('Осень', null);
      await expect(campaign('Осень', null)).rejects.toThrow(/marketing_campaigns_manual_name_key/);
      // площадка разрешает одинаковые имена: у кампаний кабинета уникален номер
      const meta = (await campaign('Осень', '120200000000001')).rows[0].id as string;
      await campaign('Осень', '120200000000002');
      await expect(campaign('Другое', '120200000000001')).rejects.toThrow(/marketing_campaigns_location_id_platform_external_id_key/);

      const day = (date: string, source: string, spend: string | null, currency: string | null) =>
        attempt(
          `INSERT INTO marketing_campaign_stats (id, campaign_id, date, impressions, clicks, leads, source, spend_minor, spend_currency, updated_at)
           VALUES ($1, $2, $3, 10, 1, 0, $4::"MarketingStatSource", $5, $6, now())`,
          [randomUUID(), meta, date, source, spend, currency],
        );
      await day('2026-10-05', 'META', '533950', 'USD');
      await expect(day('2026-10-06', 'META', null, null)).rejects.toThrow(/marketing_campaign_stats_spend/);
      await expect(day('2026-10-07', 'MANUAL', '100', 'KZT')).rejects.toThrow(/marketing_campaign_stats_spend/);

      const connection = (token: string, status = 'ACTIVE', account = '1234567890') =>
        attempt(
          `INSERT INTO marketing_ad_connections (id, location_id, platform, ad_account_id, currency, timezone, token_ciphertext, status, updated_at)
           VALUES ($1, $2, 'META', $3, 'USD', 'Asia/Almaty', $4, $5::"MarketingConnectionStatus", now()) RETURNING id`,
          [randomUUID(), locA, account, token, status],
        );
      await expect(connection('EAAB-plain-token')).rejects.toThrow(/marketing_ad_connections_token/);
      await expect(connection('v1:a:b:c', 'ACTIVE', 'act_123')).rejects.toThrow(/marketing_ad_connections_account/);
      const conn = (await connection('v1:a:b:c')).rows[0].id as string;
      await expect(connection('v1:a:b:c')).rejects.toThrow(/marketing_ad_connections_location_id_platform_key/);
      await attempt(
        `INSERT INTO marketing_sync_runs (id, connection_id, trigger, since, until, status) VALUES ($1, $2, 'MANUAL', '2026-10-01', '2026-10-07', 'RUNNING')`,
        [randomUUID(), conn],
      );
      await asApp(attempt, orgB);
      expect((await attempt(`SELECT count(*)::int AS n FROM marketing_ad_connections`)).rows[0].n).toBe(0);
      expect((await attempt(`SELECT count(*)::int AS n FROM marketing_sync_runs`)).rows[0].n).toBe(0);
      await attempt('RESET ROLE');
      await asApp(attempt, orgA);
      await expect(attempt(`DELETE FROM marketing_sync_runs`)).rejects.toThrow(/permission denied/);
      await expect(attempt(`DELETE FROM marketing_ad_connections`)).rejects.toThrow(/permission denied/);
    });
  });
});

