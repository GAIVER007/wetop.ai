import { test, expect } from '@playwright/test';
import pg from 'pg';

test('D4 STAFF keeps desk controls without settings or refunds', async ({ page, context, request }, testInfo) => {
  const data = await (await request.get('http://127.0.0.1:55994/__test/data')).json();
  expect((await context.request.post('http://127.0.0.1:55994/__test/login')).ok()).toBe(true);
  const session = (await context.cookies()).find(cookie => cookie.name === 'wetop_session')!.value;
  const headers = { 'x-wetop-session': session, 'x-wetop-scope': `business=${data.side.business};location=${data.side.location}` };
  const receipts = await (await request.get('http://127.0.0.1:55994/bar/receipts', { headers })).json();
  for (const receipt of receipts) if (receipt.status === 'DRAFT') expect((await request.post(`http://127.0.0.1:55994/bar/receipts/${receipt.id}/post`, { headers, data: {} })).status()).toBe(201);
  expect((await context.request.post('http://127.0.0.1:55994/__test/login', { headers: { 'x-bar-fixture-role': 'STAFF' } })).ok()).toBe(true);
  await context.addCookies([{ name: 'wetop_onboarding_later', value: '1', url: 'http://127.0.0.1:55993' }, { name: 'wetop_scope', value: encodeURIComponent(`business=${data.side.business};location=${data.side.location}`), url: 'http://127.0.0.1:55993' }]);
  await page.goto('/bar');
  await expect(page.getByRole('heading', { name: 'Бар', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Продать', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Сохранить приход', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Вернуть на склад', exact: true })).toHaveCount(0);
  for (const button of await page.locator('.bar-catalogs button[type="submit"]').all()) await expect(button).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath('staff-desk-only.png'), fullPage: true });
});

test('D4 READ_ONLY disables every BAR edit under a real OWNER session', async ({ page, context, request }, testInfo) => {
  const data = await (await request.get('http://127.0.0.1:55994/__test/data')).json();
  expect((await context.request.post('http://127.0.0.1:55994/__test/login')).ok()).toBe(true);
  await context.addCookies([{ name: 'wetop_onboarding_later', value: '1', url: 'http://127.0.0.1:55993' }, { name: 'wetop_scope', value: encodeURIComponent(`business=${data.side.business};location=${data.side.location}`), url: 'http://127.0.0.1:55993' }]);
  await page.goto('/bar');
  const url = process.env.DATABASE_URL;
  if (!url || !['localhost','127.0.0.1'].includes(new URL(url).hostname)) throw new Error('Own localhost database required');
  const db = new pg.Client({ connectionString: url, options: '-c search_path=pms_test,public' });
  await db.connect();
  try {
    await db.query("UPDATE organizations SET status='READ_ONLY' WHERE id=$1", [data.side.org]);
    expect((await context.request.post('http://127.0.0.1:55994/__test/login')).ok()).toBe(true);
    await page.reload();
    for (const button of await page.locator('.bar-catalogs button, .bar-receipt-form button, .bar-sale-form button[type="submit"], .bar-folio-form button[type="submit"], .bar-inventory-form button[type="submit"], .bar-price-form button[type="submit"]').all()) await expect(button).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Сохранить приход', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Зафиксировать', exact: true })).toBeDisabled();
    await page.screenshot({ path: testInfo.outputPath('read-only-no-edits.png'), fullPage: true });
  } finally { await db.query("UPDATE organizations SET status='ACTIVE' WHERE id=$1", [data.side.org]); await db.end(); }
});
