/**
 * Вход роли `wetop_app` на локальном стенде (TESTING.md §4, грабли 27.09.2026).
 *
 * Миграция `20260927000026_rls_roles` заводит `wetop_app` без входа (NOLOGIN): на рабочей базе вход и пароль
 * включает владелец этапом 2 выкладки (`docs/ops/rls.md`). Тест `rls-isolation` подключается этой ролью напрямую,
 * поэтому на свежем стенде он падал P1010, пока вход не включали руками. Здесь это делается само — и только на
 * локальной базе: роль общая на весь кластер, и чужой сервер этим шагом не трогаем.
 */
import pg from 'pg';
import { isLocalDatabase } from './seed-local';

export type AppLoginResult = 'enabled' | 'already' | 'no-role' | 'not-local';

export async function enableLocalAppLogin(url: string): Promise<AppLoginResult> {
  if (!isLocalDatabase(url)) return 'not-local';
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const role = await client.query<{ login: boolean }>(
      `SELECT rolcanlogin AS login FROM pg_roles WHERE rolname = 'wetop_app'`,
    );
    if (!role.rowCount) return 'no-role';
    if (role.rows[0]!.login) return 'already';
    await client.query('ALTER ROLE wetop_app LOGIN');
    return 'enabled';
  } finally {
    await client.end();
  }
}

if (import.meta.filename === process.argv[1]) {
  const url = process.env.DATABASE_URL ?? '';
  if (!isLocalDatabase(url)) {
    console.error('local-app-login: DATABASE_URL должен указывать на localhost — чужую базу не трогаем');
    process.exit(2);
  }
  console.log(`wetop_app: ${await enableLocalAppLogin(url)}`);
}
