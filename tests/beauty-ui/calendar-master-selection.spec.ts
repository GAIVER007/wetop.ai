import { test, expect } from '@playwright/test';
import type { Page, APIRequestContext } from '@playwright/test';
const api = `http://127.0.0.1:${process.env.BEAUTY_UI_API_PORT || '26814'}`;
async function prepare(page: Page, request: APIRequestContext) {
  const reset = await request.post(`${api}/__test/reset`);
  expect(reset.ok()).toBeTruthy();
  const f = await reset.json();
  const scope = `business=${f.business};location=${f.locations[0]}`;
  const headers = { 'x-wetop-scope': scope };
  await page.context().addCookies([{ name: 'wetop_scope', value: encodeURIComponent(scope), domain: '127.0.0.1', path: '/' }]);
  const call = async (path: string, data: Record<string, unknown>, method: 'post' | 'put' | 'get' = 'post') => {
    const response = await request[method](api + path, { headers, data });
    expect(response.ok(), await response.text()).toBeTruthy();
    return response.json();
  };
  const service = await call('/beauty/services', { name: 'Тестовая стрижка', durationMinutes: 60, priceMinor: '1200000', currency: 'KZT' });
  await call(`/beauty/services/${service.id}/location`, { enabled: true }, 'put');
  const masters: { id: string; name: string }[] = [];
  for (const name of ['Александра Тестовая', 'Дарья Тестовая', 'Мария Пример']) {
    const master = await call('/beauty/employees', { name });
    await call(`/beauty/employees/${master.id}/services`, { serviceIds: [service.id] }, 'put');
    await call(`/beauty/employees/${master.id}/working-hours`, { expectedRevision: (await call(`/beauty/schedule?employee=${master.id}`, {}, 'get')).weekRevision, intervals: [{ weekday: 1, timeFrom: '09:00', timeTo: '18:00' }] }, 'put');
    masters.push(master);
  }
  await page.goto('/calendar?date=2026-10-19');
  expect(masters).toHaveLength(3);
  return [masters[0]!, masters[1]!, masters[2]!] as const;
}
test('mobile master filter and visible calendar select the same master', async ({ page, request }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const masters = await prepare(page, request);
  const filter = page.locator('.beauty-filters').getByRole('combobox', { name: 'Мастер', exact: true });
  const calendar = page.getByRole('combobox', { name: 'Мастер календаря', exact: true });
  await filter.selectOption(masters[1].id);
  await expect(calendar).toHaveValue(masters[1].id);
  await expect(page.locator('.beauty-current-master')).toHaveText(masters[1].name);
  await page.locator('.beauty-mobile-calendar').getByRole('button', { name: `${masters[1].name}, 09:00, свободно`, exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('combobox', { name: 'Мастер', exact: true })).toHaveValue(masters[1].id);
  await page.keyboard.press('Escape');
  await calendar.selectOption(masters[2].id);
  await expect(filter).toHaveValue(masters[2].id);
  await expect(page.locator('.beauty-current-master')).toHaveText(masters[2].name);
  await page.screenshot({ path: testInfo.outputPath('selected-master-mobile.png'), fullPage: true });
});
test('new appointment defaults to the master selected in the desktop filter', async ({ page, request }, testInfo) => {
  const masters = await prepare(page, request);
  await page.locator('.beauty-filters').getByRole('combobox', { name: 'Мастер', exact: true }).selectOption(masters[1].id);
  await page.getByRole('button', { name: '+ Новая запись', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('combobox', { name: 'Мастер', exact: true })).toHaveValue(masters[1].id);
  await page.screenshot({ path: testInfo.outputPath('selected-master-new-appointment.png') });
});
