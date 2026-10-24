import { expect, test, type APIRequestContext } from '@playwright/test';

/** Склад салона (ADR-STOCK-ALL, 21.10.2026; названия 24.10.2026): «Бар» и «Кухня» в обзоре склада и «Докупить»; настоящие контроллеры и база */
const api = `http://127.0.0.1:${process.env.BEAUTY_UI_API_PORT || '26814'}`;
const shots = process.env.WAREHOUSE_SHOTS ?? '';
type Fixture = { business: string; locations: string[] };

test.afterEach(async ({ request }) => {
  const cleanup = await request.post(`${api}/__test/cleanup`);
  expect(cleanup.ok(), await cleanup.text()).toBe(true);
});

async function post(request: APIRequestContext, headers: Record<string, string>, path: string, data: unknown) {
  const res = await request.post(`${api}${path}`, { headers, data });
  const text = await res.text();
  expect(res.ok(), `${path}: ${text}`).toBe(true);
  return JSON.parse(text);
}

test('салон: обзор склада показывает «Бар» и «Кухню», кухня ниже минимума просит закупку', async ({ page, request }) => {
  const reset = await request.post(`${api}/__test/reset`);
  const fixture = JSON.parse(await reset.text()) as Fixture;
  const pointer = `business=${fixture.business};location=${fixture.locations[0]}`;
  const headers = { 'x-wetop-scope': pointer };
  await page.context().addCookies([
    { name: 'wetop_scope', value: encodeURIComponent(pointer), domain: '127.0.0.1', path: '/' },
  ]);
  await post(request, headers, '/food-service/stock/products', { name: 'Шампунь профессиональный', unit: 'мл', minQty: '500' });

  await page.goto('/warehouse');
  await expect(page.getByRole('heading', { level: 1, name: 'Склад' })).toBeVisible();
  const materials = page.locator('[data-warehouse="kitchen"]');
  await expect(materials).toContainText('Кухня');
  // у салона расходники считаются «позициями», не «продуктами» (аудит салона 22.10.2026, слова склада)
  await expect(materials).toContainText('Докупить: 1 позиция');
  await expect(materials).toContainText('Шампунь профессиональный');
  await expect(materials).toHaveAttribute('href', '/bar/consumables');
  // в этом стенде модуль бара не подключён (404): карточка бара говорит об этом словами и не прячет «Кухню»
  await expect(page.locator('[data-warehouse="bar"]')).toContainText('Остатки не загрузились');
  // у салона склад товаров на продажу называется «Бар», как у гостиницы и ресторана (решение владельца 24.10.2026)
  await expect(page.getByText('Остатки склада «Бар» не загрузились.', { exact: false })).toBeVisible();
  if (shots) await page.screenshot({ path: `${shots}/salon-warehouse.png`, fullPage: true });

  await materials.click();
  await expect(page).toHaveURL(/\/bar\/consumables$/);
  await expect(page.getByTestId('stock-restock')).toContainText('Шампунь профессиональный');
  // у салона блюд нет: таблицы порций нет
  await expect(page.getByRole('table', { name: /Блюда/ })).toHaveCount(0);
  if (shots) await page.screenshot({ path: `${shots}/salon-consumables.png`, fullPage: true });
});
