import { submitServerAction } from './action';
import { test, expect } from '@playwright/test';
import pg from 'pg';

test('T09 real API 503 and expired SessionGuard retain intent across login', async ({ page, context, request }, testInfo) => {
  const data = await (await request.get('http://127.0.0.1:55994/__test/data')).json();
  expect((await context.request.post('http://127.0.0.1:55994/__test/login')).ok()).toBe(true);
  await context.addCookies([{ name: 'wetop_onboarding_later', value: '1', url: 'http://127.0.0.1:55993' }, { name: 'wetop_scope', value: encodeURIComponent(`business=${data.side.business};location=${data.side.location}`), url: 'http://127.0.0.1:55993' }]);
  const session = (await context.cookies()).find(cookie => cookie.name === 'wetop_session')!.value;
  const headers = { 'x-wetop-session': session, 'x-wetop-scope': `business=${data.side.business};location=${data.side.location}` };
  const receipts = await (await request.get('http://127.0.0.1:55994/bar/receipts', { headers })).json();
  for (const receipt of receipts) if (receipt.status === 'DRAFT') expect((await request.post(`http://127.0.0.1:55994/bar/receipts/${receipt.id}/post`, { headers, data: {} })).status()).toBe(201);
  const url = process.env.DATABASE_URL;
  if (!url || !['localhost','127.0.0.1'].includes(new URL(url).hostname)) throw new Error('Own localhost database required');
  const db = new pg.Client({ connectionString: url, options: '-c search_path=pms_test,public' });
  await db.connect();
  try {
    await page.goto('/bar');
    const form = page.locator('.bar-sale-form').filter({ has: page.locator('select[name="method"]') });
    await form.locator('[name="productId"]').selectOption(data.b.id);
    await form.locator('[name="quantityUnits"]').fill('1');
    await db.query('BEGIN');
    await db.query('SELECT id FROM bar_stock_lots WHERE product_id=$1 FOR UPDATE', [data.b.id]);
    const failedAction = page.waitForResponse(response => response.request().method() === 'POST' && !!response.request().headers()['next-action']);
    await form.locator('button[type="submit"]').click();
    await expect.poll(async () => {
      await db.query('SELECT pg_stat_clear_snapshot()');
      return (await db.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%bar_stock_lots%FOR UPDATE%'")).rows[0].n;
    }).toBeGreaterThan(0);
    // Existing transaction expiry is 5 seconds. Release after expiry, without changing it.
    await new Promise(resolve => setTimeout(resolve, 5500));
    await db.query('COMMIT');
    const completedFailure = await failedAction;
    expect(completedFailure.status()).toBe(200);
    expect(await completedFailure.finished()).toBeNull();
    await expect(form.getByRole('alert')).toContainText('Результат операции пока неизвестен');
    const storageKey = `wetop.bar.intent.v1:${data.userId}:${data.side.business}:${data.side.location}:RETAIL:`;
    const persisted = await page.evaluate(key => localStorage.getItem(key), storageKey);
    expect(persisted).not.toBeNull();
    const intent = JSON.parse(persisted!) as { key: string };
    expect((await db.query('SELECT count(*)::int AS n FROM bar_operation_intents WHERE key=$1', [intent.key])).rows[0].n).toBe(0);
    await page.screenshot({ path: testInfo.outputPath('503-preserved-intent.png'), fullPage: true });
    expect((await request.post('http://127.0.0.1:55994/auth/logout', { headers: { 'x-wetop-session': session } })).ok()).toBe(true);
    await form.getByRole('button', { name: 'Проверить результат', exact: true }).click();
    await expect(page).toHaveURL(/127\.0\.0\.1:55995\/\?next=.*#login/);
    const savedBrowser = await context.storageState();
    expect(savedBrowser.origins.find(origin => origin.origin === 'http://127.0.0.1:55993')?.localStorage.find(row => row.name === storageKey)?.value).toBe(persisted);
    await page.screenshot({ path: testInfo.outputPath('401-login-preserved-intent.png'), fullPage: true });
    expect((await context.request.post('http://127.0.0.1:55994/__test/login')).ok()).toBe(true);
    await page.goto('/bar');
    expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBe(persisted);
    await submitServerAction(page, form.getByRole('button', { name: 'Проверить результат', exact: true }));
    await expect.poll(() => page.evaluate(key => localStorage.getItem(key), storageKey)).toBeNull();
    expect((await db.query('SELECT count(*)::int AS n FROM bar_operation_intents WHERE key=$1', [intent.key])).rows[0].n).toBe(1);
    await page.screenshot({ path: testInfo.outputPath('relogin-original-intent-confirmed.png'), fullPage: true });
  } finally { await db.query('ROLLBACK'); await db.end(); }
});
