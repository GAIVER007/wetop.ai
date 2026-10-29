import { test, expect, type Page, type APIRequestContext } from './fixtures';

/**
 * Единая система направлений (14.10.2026): «Продажи» и «Маркетинг» ресторана на настоящем Food API и базе стенда.
 * Заказ проводится до оплаты: хаб продаж берёт выручку, блюда и официантов из отчёта периода.
 */
const api = `http://127.0.0.1:${process.env.FOOD_UI_API_PORT ?? '55824'}`;
const shots = 'reports/unified-growth-2026-10-14';
const pointer = (b: string, l: string) => `business=${b};location=${l}`;

async function post(request: APIRequestContext, headers: Record<string, string>, path: string, data: unknown) {
  const res = await request.post(`${api}${path}`, { headers, data });
  expect(res.ok(), `${path}: ${res.status()} ${await res.text()}`).toBe(true);
  return res.json();
}

async function seed(page: Page, request: APIRequestContext) {
  const res = await request.post(`${api}/__test/reset`);
  expect(res.ok()).toBe(true);
  const f = await res.json();
  await page.context().addCookies([
    { name: 'wetop_scope', value: encodeURIComponent(pointer(f.business, f.locations[0])), domain: '127.0.0.1', path: '/' },
  ]);
  const headers = { 'x-wetop-scope': pointer(f.business, f.locations[0]) };
  const area = await post(request, headers, '/food-service/areas', { name: 'Основной зал', sortOrder: 0, active: true });
  const table = await post(request, headers, '/food-service/tables', {
    areaId: area.id,
    name: '7',
    capacity: 4,
    sortOrder: 0,
    active: true,
  });
  const category = await post(request, headers, '/food-service/menu/categories', { name: 'Горячее' });
  const plov = await post(request, headers, '/food-service/menu/items', {
    categoryId: category.id,
    name: 'Плов по-ташкентски',
    price: 350000,
  });
  const steak = await post(request, headers, '/food-service/menu/items', {
    categoryId: category.id,
    name: 'Стейк рибай',
    price: 1490000,
  });
  await post(request, headers, '/food-service/employees', { name: 'Иванова Анна', phone: '+7 700 000-00-01' });
  for (const items of [
    [{ menuItemId: plov.id, qty: 2 }],
    [
      { menuItemId: steak.id, qty: 1 },
      { menuItemId: plov.id, qty: 1 },
    ],
  ]) {
    const order = await post(request, headers, '/food-service/orders', { tableId: table.id, guestCount: 2, items });
    let current = order;
    for (const status of ['COOKING', 'READY', 'SERVED'])
      current = await post(request, headers, `/food-service/orders/${order.id}/status`, {
        expectedStatus: current.status,
        expectedUpdatedAt: current.updatedAt,
        status,
      });
    await post(request, headers, `/food-service/orders/${order.id}/payments`, {
      method: 'CASH',
      amount: Number(order.totalMinor),
      idempotencyKey: `pay-${order.id}`,
    });
  }
  return f;
}

test.afterAll(async ({ request }) => {
  await request.post(`${api}/__test/cleanup`);
});

test('ресторан: продажи и маркетинг на данных филиала', async ({ page, request }) => {
  await seed(page, request);
  await page.goto('/sales');
  const hub = page.getByTestId('business-sales');
  await expect(hub).toBeVisible();
  await expect(page.getByTestId('sales-kpi-sold')).toHaveText('2');
  await expect(page.getByTestId('sales-card-top')).toContainText('Плов по-ташкентски');
  await expect(page.getByTestId('sales-card-top')).toContainText('Стейк рибай');
  await expect(hub).not.toContainText('Нет данных рынка');
  await page.screenshot({ path: `${shots}/food-sales.png`, fullPage: true });

  await page.goto('/marketing');
  const marketing = page.getByTestId('business-marketing');
  await expect(marketing).toContainText('ресторана');
  await expect(marketing).not.toContainText('гостиниц');
  // владелец 29.10.2026: у всех инструментов «Продвижения» статус «В работе»
  await expect(page.getByTestId('marketing-budget-status')).toHaveText('В работе');
  await page.screenshot({ path: `${shots}/food-marketing.png`, fullPage: true });

  await page.goto('/marketing/content');
  await expect(page.getByTestId('marketing-content-formats')).toContainText('Фото блюда');
  await page.screenshot({ path: `${shots}/food-content.png`, fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/sales');
  const mobileSales = page.getByRole('main').filter({ visible: true }).getByTestId('business-sales').filter({ visible: true });
  await expect(mobileSales).toHaveCount(1);
  await expect(mobileSales).toBeVisible();
  await page.screenshot({ path: `${shots}/food-sales-mobile.png`, fullPage: true });
});
