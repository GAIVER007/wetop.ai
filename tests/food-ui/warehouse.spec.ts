import { test, expect, type Page, type APIRequestContext } from './fixtures';

/** Склад ресторана (ADR-STOCK-ALL, 21.10.2026): «Докупить», блюда и порции из остатков, обзор склада; настоящие контроллеры и база */
const api = `http://127.0.0.1:${process.env.FOOD_UI_API_PORT ?? '55824'}`;
const shots = process.env.WAREHOUSE_SHOTS ?? '';
const pointer = (b: string, l: string) => `business=${b};location=${l}`;
async function reset(page: Page, request: APIRequestContext) {
  const res = await request.post(`${api}/__test/reset`);
  expect(res.ok()).toBe(true);
  const f: { business: string; locations: string[] } = await res.json();
  await page.context().addCookies([
    { name: 'wetop_scope', value: encodeURIComponent(pointer(f.business, f.locations[0]!)), domain: '127.0.0.1', path: '/' },
  ]);
  return { 'x-wetop-scope': pointer(f.business, f.locations[0]!) };
}
async function post(request: APIRequestContext, headers: Record<string, string>, path: string, data: unknown) {
  const res = await request.post(`${api}${path}`, { headers, data });
  expect(res.ok(), `${path}: ${res.status()}`).toBe(true);
  return res.json();
}
async function seed(request: APIRequestContext, headers: Record<string, string>) {
  const beef = await post(request, headers, '/food-service/stock/products', { name: 'Говядина Рибай', unit: 'г', minQty: '1000' });
  await post(request, headers, '/food-service/stock/receipts', {
    supplier: 'Тестовый поставщик',
    receivedOn: '2026-10-01',
    lines: [{ productId: beef.id, qty: '3000', unitCost: 600000 }],
  });
  // сливок на складе нет вовсе: продукт ниже минимума
  const cream = await post(request, headers, '/food-service/stock/products', { name: 'Сливки 20%', unit: 'мл', minQty: '3000' });
  const category = await post(request, headers, '/food-service/menu/categories', { name: 'Горячее' });
  const steak = await post(request, headers, '/food-service/menu/items', { categoryId: category.id, name: 'Стейк Рибай', price: 900000 });
  const cheap = await post(request, headers, '/food-service/menu/items', { categoryId: category.id, name: 'Стейк по акции', price: 150000 });
  for (const dish of [steak, cheap]) {
    const put = await request.put(`${api}/food-service/menu/items/${dish.id}/ingredients`, {
      headers,
      data: { ingredients: [{ name: 'Говядина Рибай', normQty: '300', unit: 'г', unitCost: 600000, productId: beef.id }] },
    });
    expect(put.ok()).toBe(true);
  }
  return { beef, cream };
}

test('склад ресторана: что докупить, невыгодные блюда и порции из остатков', async ({ page, request }) => {
  const headers = await reset(page, request);
  await seed(request, headers);
  await page.goto('/stock');
  const restock = page.getByTestId('stock-restock');
  await expect(restock).toContainText('Докупить:');
  await expect(restock).toContainText('Сливки 20%');
  await expect(restock).not.toContainText('Говядина');
  // 300 г на порцию стоят 1 800 ₸: у блюда по акции (1 500 ₸) это больше цены
  await expect(page.getByTestId('stock-expensive')).toContainText('Стейк по акции');
  await expect(page.getByTestId('stock-expensive')).not.toContainText('Стейк Рибай');
  const dishes = page.getByRole('table', { name: 'Блюда: себестоимость и порции из остатков' });
  await expect(dishes.getByRole('row', { name: /Стейк Рибай/ })).toContainText('10 порций');
  await expect(page.getByRole('link', { name: 'Меню и техкарты' })).toHaveAttribute('href', '/menu');
  if (shots) await page.screenshot({ path: `${shots}/restaurant-stock.png`, fullPage: true });
});

test('обзор склада ресторана: кухня просит закупку, ссылка ведёт на склад кухни', async ({ page, request }) => {
  const headers = await reset(page, request);
  await seed(request, headers);
  await page.goto('/warehouse');
  await expect(page.getByRole('heading', { level: 1, name: 'Склад' })).toBeVisible();
  const kitchen = page.locator('[data-warehouse="kitchen"]');
  await expect(kitchen).toContainText('Докупить: 1 продукт');
  await expect(kitchen).toContainText('Сливки 20%');
  await expect(kitchen).toHaveAttribute('href', '/stock');
  await expect(page.locator('[data-warehouse="bar"]')).toContainText('Пока пусто');
  await expect(page.getByRole('table', { name: 'Позиции, которые заканчиваются' }).getByRole('row', { name: /Сливки 20%/ })).toBeVisible();
  if (shots) await page.screenshot({ path: `${shots}/restaurant-warehouse.png`, fullPage: true });
});
