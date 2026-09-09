/**
 * Диагностика БД без данных гостей: активные сессии — состояние, ожидание, возраст транзакции, начало текста запроса.
 * Запуск: npx tsx scripts/reconciliation/src/cli-db-activity.ts
 */
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { createPrismaClient } from '@pms/database';

loadEnv({ path: resolve(import.meta.dirname, '../../../.env'), quiet: true });
const db = createPrismaClient();
try {
  const rows = await db.$queryRaw<
    Array<{
      pid: number;
      state: string | null;
      wait: string | null;
      xact_age: string | null;
      q: string;
    }>
  >`select pid, state, coalesce(wait_event_type || '/' || wait_event, '') as wait,
      (now() - xact_start)::text as xact_age,
      left(regexp_replace(query, '\s+', ' ', 'g'), 80) as q
    from pg_stat_activity
    where datname = current_database() and pid <> pg_backend_pid()
    order by xact_start nulls last`;
  console.table(rows);
} finally {
  await db.$disconnect();
}
