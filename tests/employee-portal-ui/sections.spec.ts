import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import { mkdirSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { formatMoney } from '../../apps/web/src/lib/money';
const api = process.env.PORTAL_API_URL || `http://127.0.0.1:${process.env.BEAUTY_UI_API_PORT || '27037'}`;
const out = process.env.PORTAL_EVIDENCE_DIR || fileURLToPath(new URL('../../test-results/employee-portal-evidence', import.meta.url));
const stage = process.env.SECTIONS_STAGE || 'before';
async function seed(page: Page, request: APIRequestContext) {
  const reset = await request.post(`${api}/__test/reset`); expect(reset.ok()).toBeTruthy();
  const f = await reset.json() as { business: string; locations: string[] };
  const scope = `business=${f.business};location=${f.locations[0]}`;
  const headers = { 'x-wetop-scope': scope };
  await page.context().addCookies([{ name: 'wetop_scope', value: encodeURIComponent(scope), domain: '127.0.0.1', path: '/' }]);
  const call = async (path: string, data?: Record<string, unknown>, method: 'post' | 'put' | 'patch' | 'get' = 'post') => {
    const res = await request[method](api + path, { headers, ...(data ? { data } : {}) });
    expect(res.ok(), `${method} ${path}: ${await res.text()}`).toBeTruthy(); return res.json();
  };
  const services: { id: string; name: string }[] = [];
  for (const [name, category, priceMinor] of [['Стрижка', 'Волосы', '450000'], ['Маникюр', 'Ногти', '350000'], ['Окрашивание', 'Волосы', '900000']]) {
    const service = await call('/beauty/services', { name, category, durationMinutes: 60, priceMinor, currency: 'KZT' });
    await call(`/beauty/services/${service.id}/location`, { enabled: true }, 'put'); services.push(service);
  }
  const employees: { id: string; name: string }[] = [];
  for (const name of ['Анна Демонстрационная', 'Дарья Демонстрационная']) {
    const employee = await call('/beauty/employees', { name });
    await call(`/beauty/employees/${employee.id}/services`, { serviceIds: services.map(s => s.id) }, 'put');
    await call(`/beauty/employees/${employee.id}/working-hours`, { expectedRevision: (await call(`/beauty/schedule?employee=${employee.id}`, undefined, 'get')).weekRevision, intervals: Array.from({ length: 7 }, (_, weekday) => ({ weekday, timeFrom: '09:00', timeTo: '18:00' })) }, 'put'); employees.push(employee);
  }
  const today = await call('/beauty/appointments', undefined, 'get'); const date = today.date as string;
  const at = (hour: number) => { const [y, m, d] = date.split('-').map(Number); return new Date(Date.UTC(y!, m! - 1, d!, hour - 5)).toISOString(); };
  for (const [i, hour, status] of [[0, 9, 'DONE'], [1, 11, 'DONE'], [2, 15, 'CONFIRMED'], [2, 17, 'CANCELLED']] as const) {
    const firstName = `Тестовая клиентка ${hour}`;
    const day = await call('/beauty/appointments', { employeeId: employees[0]!.id, serviceId: services[i]!.id, startsAt: at(hour), firstName });
    const row = day.appointments.find((a: { customer: { name: string } }) => a.customer.name === firstName);
    expect(row).toBeTruthy(); await call(`/beauty/appointments/${row.id}/status`, { status }, 'post');
  }
  const day = await call(`/beauty/appointments?date=${date}`, undefined, 'get');
  const completedMinor = (day.appointments as { status: string; priceMinor: string }[]).filter(a => a.status === 'DONE').reduce((sum, a) => sum + BigInt(a.priceMinor), 0n);
  return { ...f, call, date, services, employee: employees[0]!, completedMinor };
}
async function openCard(page: Page, employeeId: string, tab: RegExp) {
  await page.goto(`/employees?employee=${employeeId}`);
  const card = page.getByRole('dialog').filter({ visible: true }); await expect(card).toBeVisible();
  await card.getByRole('tab', { name: tab }).click(); return card;
}
async function capture(page: Page, section: string) {
  mkdirSync(`${out}/images`, { recursive: true });
  for (const width of [1440, 390]) for (const theme of ['light', 'dark'] as const) {
    await page.setViewportSize({ width, height: 1000 }); await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.evaluate(async t => { document.documentElement.dataset.theme = t; localStorage.setItem('theme', t); await document.fonts.ready; }, theme);
    const measure = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
    appendFileSync(`${out}/measurements.ndjson`, JSON.stringify({ section, stage, width, theme, ...measure }) + '\n');
    await page.screenshot({ path: `${out}/images/${section}-${stage}-${width}-${theme}.png`, fullPage: true });
    expect(measure.scrollWidth).toBeLessThanOrEqual(measure.clientWidth);
  }
}
test('services: real saved catalog and clear searchable prices', async ({ page, request }) => {
  const f = await seed(page, request); await page.goto('/services');
  const catalog = page.locator('[data-service-list="catalog"]');
  await catalog.locator('.beauty-service-item').filter({ has: catalog.getByText('Маникюр', { exact: true }) }).getByRole('button', { name: 'Изменить', exact: true }).click();
  const card = page.getByRole('dialog'); await card.getByLabel('Название', { exact: true }).fill('Маникюр классический');
  await card.getByRole('button', { name: 'Сохранить услугу', exact: true }).click(); await expect(card.getByRole('status')).toContainText('Услуга');
  await page.reload(); await expect(catalog).toContainText('Маникюр классический');
  await capture(page, 'services');
  const search = page.getByLabel('Поиск услуг', { exact: true }); await expect(search).toBeVisible();
  await search.fill('Маникюр'); await expect(catalog).toContainText('Маникюр классический'); await expect(catalog.getByText('Окрашивание', { exact: true })).toHaveCount(0);
  expect(f.services).toHaveLength(3);
});
test('schedule: persist weekly hours with clear routine and intervals', async ({ page, request }) => {
  const f = await seed(page, request); const card = await openCard(page, f.employee.id, /^График$/);
  await card.getByLabel('Понедельник: начало', { exact: true }).fill('10:00'); await card.getByLabel('Понедельник: конец', { exact: true }).fill('19:00');
  await card.getByRole('button', { name: 'Сохранить график', exact: true }).click(); await expect(card.getByRole('status')).toContainText('График');
  const saved = await f.call(`/beauty/schedule?employee=${f.employee.id}`, undefined, 'get');
  expect(saved.week.find((d: { weekday: number }) => d.weekday === 1).intervals).toEqual([{ timeFrom: '10:00', timeTo: '19:00' }]);
  await openCard(page, f.employee.id, /^График$/); await expect(page.getByLabel('Понедельник: начало', { exact: true })).toHaveValue('10:00');
  await capture(page, 'schedule'); await expect(page.getByRole('dialog')).toContainText(/еженедельн|повторя.*недел|обычн.*недел/i);
});
test('nonworking: persisted exception does not cancel existing appointments', async ({ page, request }) => {
  const f = await seed(page, request); const card = await openCard(page, f.employee.id, /Отсутствия|Нерабочие дни/);
  const end = new Date(`${f.date}T00:00:00Z`); end.setUTCDate(end.getUTCDate() + 2);
  await card.getByLabel('С какого дня', { exact: true }).fill(f.date); await card.getByLabel('По какой день включительно', { exact: true }).fill(end.toISOString().slice(0, 10));
  await card.getByLabel(/Причина/).fill('Обучение: тестовый нерабочий период');
  await card.getByRole('button', { name: /Добавить отсутствие|Добавить период/ }).click(); await expect(card.getByRole('table')).toContainText('Обучение: тестовый нерабочий период');
  await openCard(page, f.employee.id, /Отсутствия|Нерабочие дни/);
  const current = await f.call(`/beauty/appointments?date=${f.date}`, undefined, 'get');
  expect(current.appointments.filter((a: { status: string }) => a.status === 'CONFIRMED')).toHaveLength(1);
  await capture(page, 'nonworking'); await expect(page.getByRole('tab', { name: 'Нерабочие дни', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText(/не отменяются|не отменяет/i);
});
test('finance: actual appointment amounts are not mislabeled as cash', async ({ page, request }) => {
  const f = await seed(page, request); await page.goto('/finance'); await expect(page.getByTestId('beauty-finance')).toBeVisible();
  await expect(page.getByTestId('beauty-revenue')).toContainText(formatMoney(f.completedMinor, 'KZT'));
  await capture(page, 'finance'); await expect(page.getByTestId('beauty-finance')).toContainText('Стоимость оказанных услуг');
  await expect(page.getByRole('link', { name: /касс/i }).first()).toHaveAttribute('href', '/cashbox');
});
