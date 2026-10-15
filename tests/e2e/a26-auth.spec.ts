import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import pg from 'pg';
const parent = process.env.A28_WORK_DIR ?? process.env.A25_WORK_DIR ?? '';
test.skip(!parent, 'Requires the isolated A26 HTTP runtime');
const data = parent ? JSON.parse(readFileSync(`${parent}/a26-private.json`, 'utf8')) : {};
const web = (process.env.A28_WEB_URL ?? 'http://127.0.0.1:3137').replace(/\/$/, '');
const site = (process.env.A28_SITE_URL ?? 'http://127.0.0.1:3037').replace(/\/$/, '');
const regex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const databaseHost = process.env.A28_PG_HOST ?? '127.0.0.1';
const databasePort = Number(process.env.A28_PG_PORT ?? '55601');
const migratorRole = process.env.A28_PG_MIGRATOR_ROLE ?? 'a24_migrator';
const databaseName = process.env.A28_PG_DATABASE ?? 'a26_auth';
test('real browser login, protected page, logout and expired session with LA database', async ({
  page,
  context,
}) => {
  const login = async () => {
    await page.goto('/login');
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Почта').fill(data.email);
    await dialog.getByLabel('Пароль', { exact: true }).fill(data.password);
    const destination = new RegExp(`^${regex(web)}/(today|branches)`);
    await Promise.all([
      page.waitForURL(destination, { waitUntil: 'domcontentloaded' }),
      dialog.getByRole('button', { name: 'Войти', exact: true }).click(),
    ]);
    await expect(page).toHaveURL(destination);
  };
  await login();
  await page.goto('/profile/access');
  await expect(
    page.getByRole('heading', { name: 'Управление доступом', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Завершить все сеансы' }).click();
  await expect(page).toHaveURL(new RegExp(`^${regex(site)}/.*#login`));
  await page.goto('/profile/access');
  await expect(page).toHaveURL(new RegExp(`^${regex(site)}/.*#login`));
  await login();
  const token = (await context.cookies()).find((c) => c.name === 'wetop_session')?.value;
  expect(token).toBeTruthy();
  const observer = new pg.Client({
    host: databaseHost,
    port: databasePort,
    user: migratorRole,
    database: databaseName,
    options: '-c search_path=pms_test,public',
  });
  await observer.connect();
  try {
    await observer.query(
      "UPDATE sessions SET expires_at=clock_timestamp()-interval '60 seconds' WHERE token_hash=$1",
      [createHash('sha256').update(token!).digest('hex')],
    );
  } finally {
    await observer.end();
  }
  await page.goto('/profile/access');
  await expect(page).toHaveURL(new RegExp(`^${regex(site)}/.*#login`));
});
