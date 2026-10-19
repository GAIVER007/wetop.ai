import { test, expect } from '@playwright/test';
import type { Page, APIRequestContext } from '@playwright/test';

const api = `http://127.0.0.1:${process.env.BEAUTY_UI_API_PORT || '26814'}`;
async function prepare(page: Page, request: APIRequestContext) {
  const reset = await request.post(`${api}/__test/reset`);
  expect(reset.ok()).toBeTruthy();
  const fixture = await reset.json();
  const scope = `business=${fixture.business};location=${fixture.locations[0]}`;
  const headers = { 'x-wetop-scope': scope };
  await page.context().addCookies([{ name: 'wetop_scope', value: encodeURIComponent(scope), domain: '127.0.0.1', path: '/' }]);
  const call = async (path: string, data: object, method: 'post' | 'put' | 'get' = 'post') => {
    const response = await request[method](api + path, { headers, data });
    expect(response.ok(), await response.text()).toBeTruthy();
    return response.json();
  };
  const service = await call('/beauty/services', { name: 'Синтетическая услуга', durationMinutes: 60, priceMinor: '1200000', currency: 'KZT' });
  await call(`/beauty/services/${service.id}/location`, { enabled: true }, 'put');
  const master = await call('/beauty/employees', { name: 'Александра Синтетическая' });
  await call(`/beauty/employees/${master.id}/services`, { serviceIds: [service.id] }, 'put');
  return master;
}

for (const width of [360, 390, 430]) {
  for (const theme of ['light', 'dark'] as const) {
    test.describe(`${width} ${theme}`, () => {
      test.use({ viewport: { width, height: 844 }, colorScheme: theme });
      test('selected master name is visible above mobile calendar', async ({ page, request }, info) => {
        const master = await prepare(page, request);
        await page.goto(`/calendar?date=2026-10-19&employee=${master.id}`);
        const name = page.locator('.beauty-current-master');
        await expect(name).toHaveText(master.name);
        await page.screenshot({ path: info.outputPath('calendar-before-assert.png') });
        await expect(name).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      });
      test('week range has its own readable row and navigation still works', async ({ page, request }, info) => {
        await prepare(page, request);
        await page.goto('/beauty/schedule?week=2026-10-26');
        const range = page.getByTestId('beauty-week-range');
        const previous = page.getByRole('link', { name: 'Прошлая неделя', exact: true });
        const next = page.getByRole('link', { name: 'Следующая неделя', exact: true });
        await expect(range).toBeVisible();
        await page.screenshot({ path: info.outputPath('week-before-assert.png') });
        const r = await range.boundingBox();
        const p = await previous.boundingBox();
        const n = await next.boundingBox();
        expect(r).not.toBeNull(); expect(p).not.toBeNull(); expect(n).not.toBeNull();
        expect(r!.y + r!.height).toBeLessThanOrEqual(p!.y + 1);
        expect(r!.y + r!.height).toBeLessThanOrEqual(n!.y + 1);
        expect(r!.height).toBeLessThanOrEqual(32);
        const initial = await range.innerText();
        await next.click();
        await expect(range).not.toHaveText(initial);
        await previous.click();
        await expect(range).toHaveText(initial);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      });
    });
  }
}
