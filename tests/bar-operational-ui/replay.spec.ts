import { submitServerAction } from './action';
import { test, expect } from '@playwright/test';
import pg from 'pg';

test.describe('BAR persistent browser intents with real SessionGuard', () => {
  for (const kind of ['RETAIL','FOLIO','WRITE_OFF','SUPPLIER_PAYMENT']) test(`${kind}: committed response loss, reload and relogin preserve one intent`, async ({ page, context, request }, testInfo) => {
    const data = await (await request.get('http://127.0.0.1:55994/__test/data')).json();
    expect((await context.request.post('http://127.0.0.1:55994/__test/login')).ok()).toBe(true);
    await context.addCookies([{ name: 'wetop_onboarding_later', value: '1', url: 'http://127.0.0.1:55993' }, { name: 'wetop_scope', value: encodeURIComponent(`business=${data.side.business};location=${data.side.location}`), url: 'http://127.0.0.1:55993' }]);
    const setupSession = (await context.cookies()).find(cookie => cookie.name === 'wetop_session')!.value;
    const headers = { 'x-wetop-session': setupSession, 'x-wetop-scope': `business=${data.side.business};location=${data.side.location}` };
    const receipts = await (await request.get('http://127.0.0.1:55994/bar/receipts', { headers })).json();
    for (const receipt of receipts) if (receipt.status === 'DRAFT') expect((await request.post(`http://127.0.0.1:55994/bar/receipts/${receipt.id}/post`, { headers, data: {} })).status()).toBe(201);
    await page.goto('/bar');
    await expect(page.getByRole('heading', { name: 'Бар', exact: true })).toBeVisible();
    const form = kind === 'FOLIO' ? page.locator('.bar-folio-form') : kind === 'SUPPLIER_PAYMENT'
      ? page.locator('.bar-payment-form').filter({ has: page.locator(`input[value="${data.r1.id}"]`) })
      : kind === 'WRITE_OFF' ? page.locator('.bar-sale-form').filter({ has: page.locator('select[name="reason"]') })
      : page.locator('.bar-sale-form').filter({ has: page.locator('select[name="method"]') });
    if (kind === 'SUPPLIER_PAYMENT') await form.locator('[name="amount"]').fill('10');
    else {
      await form.locator('[name="productId"]').selectOption(data.a.id);
      await form.locator('[name="quantityUnits"]').fill('1');
      if (kind === 'FOLIO') await form.locator('[name="folioId"]').selectOption(data.side.folio);
      if (kind === 'WRITE_OFF') await form.locator('[name="reason"]').selectOption({ label: 'Порча' });
    }
    const url = process.env.DATABASE_URL;
    if (!url || !['127.0.0.1','localhost'].includes(new URL(url).hostname)) throw new Error('BAR browser evidence requires own local PostgreSQL');
    const db = new pg.Client({ connectionString: url, options: '-c search_path=pms_test,public' });
    await db.connect();
    try {
      let lost = false;
      let responseLost!: () => void;
      const lostResponse = new Promise<void>(resolve => { responseLost = resolve; });
      await page.route('**/bar', async route => {
        if (!lost && route.request().method() === 'POST' && route.request().headers()['next-action']) {
          lost = true;
          await route.fetch(); // Wait for the real server commit, then lose only the client response.
          await route.abort('failed');
          responseLost();
        } else await route.continue();
      });
      await form.locator('button[type="submit"]').click();
      await expect.poll(async () => (await db.query('SELECT count(*)::int AS n FROM bar_operation_intents WHERE property_id=$1 AND kind=$2', [data.side.property,kind])).rows[0].n).toBeGreaterThan(0);
      // Commit precedes completion of the RSC response; wait for the actual injected loss.
      await lostResponse;
      await expect(form.getByRole('alert')).toBeVisible();
      const storageKey = `wetop.bar.intent.v1:${data.userId}:${data.side.business}:${data.side.location}:${kind}:${kind === 'SUPPLIER_PAYMENT' ? data.r1.id : ''}`;
      const persisted = await page.evaluate(key => localStorage.getItem(key), storageKey);
      expect(persisted).not.toBeNull();
      const intent = JSON.parse(persisted!) as { key: string };
      const original = (await db.query('SELECT operation_id FROM bar_operation_intents WHERE property_id=$1 AND kind=$2 AND key=$3', [data.side.property,kind,intent.key])).rows;
      expect(original).toHaveLength(1);
      const effects = async () => (await db.query(`SELECT (SELECT count(*) FROM cash_operations WHERE property_id=$1)::text AS cash, (SELECT count(*) FROM bar_sales WHERE property_id=$1)::text AS sales, (SELECT count(*) FROM bar_stock_movements WHERE property_id=$1)::text AS movements, (SELECT sum(remaining_units) FROM bar_stock_lots WHERE property_id=$1)::text AS stock`, [data.side.property])).rows[0];
      const before = await effects();
      await page.unroute('**/bar');
      await page.reload();
      await expect(form.getByRole('button', { name: 'Проверить результат', exact: true })).toBeVisible();
      expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBe(persisted);
      const session = (await context.cookies()).find(cookie => cookie.name === 'wetop_session')!.value;
      expect((await request.post('http://127.0.0.1:55994/auth/logout', { headers: { 'x-wetop-session': session } })).ok()).toBe(true);
      await context.clearCookies({ name: 'wetop_session' });
      expect((await context.request.post('http://127.0.0.1:55994/__test/login')).ok()).toBe(true);
      await page.reload();
      expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBe(persisted);
      await expect(form.getByRole('button', { name: 'Проверить результат', exact: true })).toBeEnabled();
      await page.screenshot({ path: testInfo.outputPath(`${kind}-recovered-before-replay.png`), fullPage: true });
      await submitServerAction(page, form.getByRole('button', { name: 'Проверить результат', exact: true }));
      await expect.poll(() => page.evaluate(key => localStorage.getItem(key), storageKey)).toBeNull();
      expect(await effects()).toEqual(before);
      expect((await db.query('SELECT operation_id FROM bar_operation_intents WHERE property_id=$1 AND kind=$2 AND key=$3', [data.side.property,kind,intent.key])).rows).toEqual(original);
      await page.screenshot({ path: testInfo.outputPath(`${kind}-replay-confirmed.png`), fullPage: true });
    } finally { await db.end(); }
  });
});
