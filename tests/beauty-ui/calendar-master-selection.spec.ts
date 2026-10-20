import { randomUUID } from 'node:crypto';
import { chooseCalendarEmployee } from './calendar-employee';
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
  const filter = page.locator('.employee-filter summary');
  await chooseCalendarEmployee(page, masters[1].name);
  await expect(filter).toContainText(masters[1].name);
  await expect(page.locator('.beauty-current-master')).toHaveText(masters[1].name);
  await page.locator('.beauty-mobile-calendar').getByRole('button', { name: `${masters[1].name}, 09:00, свободно`, exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('combobox', { name: 'Специалист', exact: true })).toHaveValue(masters[1].id);
  await page.keyboard.press('Escape');
  await chooseCalendarEmployee(page, masters[2].name);
  await expect(filter).toContainText(masters[2].name);
  await expect(page.locator('.beauty-current-master')).toHaveText(masters[2].name);
  await page.screenshot({ path: testInfo.outputPath('selected-master-mobile.png'), fullPage: true });
});
test('new appointment defaults to the master selected in the desktop filter', async ({ page, request }, testInfo) => {
  const masters = await prepare(page, request);
  await chooseCalendarEmployee(page, masters[1].name);
  await page.getByRole('button', { name: '+ Новая запись', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('combobox', { name: 'Специалист', exact: true })).toHaveValue(masters[1].id);
  await page.screenshot({ path: testInfo.outputPath('selected-master-new-appointment.png') });
});

test('quick report reads cash, card and refunds from actual stored operations', async ({ page, request }) => {
  const masters = await prepare(page, request);
  const scope = decodeURIComponent((await page.context().cookies()).find((c) => c.name === 'wetop_scope')!.value);
  const headers = { 'x-wetop-scope': scope };
  const call = async (path: string, data: object) => {
    const response = await request.post(api + path, { headers, data });
    expect(response.ok(), await response.text()).toBeTruthy();
    return response.json();
  };
  const services = await (await request.get(api + '/beauty/services', { headers })).json();
  const created = await call('/beauty/appointments', { employeeId: masters[1].id, serviceId: services.items[0].id,
    startsAt: '2026-10-19T10:00:00+05:00', firstName: 'Тест оплаты' });
  const id = created.appointments[0].id;
  await call(`/beauty/appointments/${id}/payments`, { amount: 300000, method: 'CASH', idempotencyKey: randomUUID() });
  await call(`/beauty/appointments/${id}/payments`, { amount: 700000, method: 'CARD_TERMINAL', idempotencyKey: randomUUID() });
  await call(`/beauty/appointments/${id}/status`, { status: 'CONFIRMED' });
  await call(`/beauty/appointments/${id}/status`, { status: 'DONE' });
  await call(`/beauty/appointments/${id}/refunds`, { amount: 200000, method: 'CASH', reason: 'Синтетический возврат', idempotencyKey: randomUUID() });
  await page.goto(`/calendar?date=2026-10-19&employee=${masters[1].id}`);
  await page.getByRole('button', { name: 'Быстрый отчёт', exact: true }).click();
  const report = page.getByRole('dialog', { name: /Статистика за/ });
  const finance = report.getByRole('region', { name: 'Финансы', exact: true });
  const row = (label: string) => finance.locator('dl > div').filter({ has: page.getByText(label, { exact: true }) });
  await expect(row('Оплата наличными')).toContainText('3 000 ₸');
  await expect(row('Оплата безналом')).toContainText('7 000 ₸');
  await expect(row('Возвраты')).toContainText('2 000 ₸');
  await expect(report).not.toContainText('Стоимость всех записей');
});
