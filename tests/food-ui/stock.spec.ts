import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** Склад кухни FS2 (DATA_MODEL §34, ADR-KITCHEN-FS): настоящие контроллеры и база (pms_test) */
const api = `http://127.0.0.1:${process.env.FOOD_UI_API_PORT ?? '55824'}`;
const shots = 'reports/kitchen-fs2-stock-2026-10-10/screenshots';
type Fixture = { business: string; locations: string[] };
const pointer = (b: string, l: string) => `business=${b};location=${l}`;
async function reset(page: Page, request: APIRequestContext) {
  const res = await request.post(`${api}/__test/reset`);
  expect(res.ok()).toBe(true);
  const f: Fixture = await res.json();
  await page.context().addCookies([
    { name: 'wetop_scope', value: encodeURIComponent(pointer(f.business, f.locations[0]!)), domain: '127.0.0.1', path: '/' },
  ]);
  return { f, headers: { 'x-wetop-scope': pointer(f.business, f.locations[0]!) } };
}
async function post(request: APIRequestContext, headers: Record<string, string>, path: string, data: unknown) {
  const res = await request.post(`${api}${path}`, { headers, data });
  expect(res.ok(), `${path}: ${res.status()}`).toBe(true);
  return res.json();
}
async function settled(page: Page) {
  await page.evaluate(async () => {
    await Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => {})),
    );
  });
}
/** Говядина двумя партиями: 2 кг по 6 000 ₸/кг (раньше) и 1 кг по 7 000 ₸/кг */
async function seedBeef(request: APIRequestContext, headers: Record<string, string>) {
  const beef = await post(request, headers, '/food-service/stock/products', { name: 'Говядина Рибай', unit: 'г', minQty: '1000' });
  await post(request, headers, '/food-service/stock/receipts', {
    supplier: 'Тестовый поставщик',
    receivedOn: '2026-10-01',
    lines: [{ productId: beef.id, qty: '2000', unitCost: 600000 }],
  });
  await post(request, headers, '/food-service/stock/receipts', {
    receivedOn: '2026-10-05',
    lines: [{ productId: beef.id, qty: '1000', unitCost: 700000 }],
  });
  return beef;
}
const row = (page: Page, name: string) => page.getByRole('row', { name: new RegExp(name) });

test('пустой склад, ингредиент и приход с экрана, остаток и стоимость', async ({ page, request }) => {
  await reset(page, request);
  await page.goto('/stock');
  await expect(page.getByRole('heading', { level: 1, name: 'Склад' })).toBeVisible();
  await expect(page.getByText('Добавьте первый ингредиент')).toBeVisible();
  await page.getByRole('button', { name: '+ Ингредиент', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Название').fill('Соль морская');
  await dialog.getByLabel('Минимальный остаток').fill('500');
  await dialog.getByRole('button', { name: 'Создать', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(row(page, 'Соль морская')).toContainText('Нет на складе');
  await page.getByRole('button', { name: '+ Приход', exact: true }).click();
  await dialog.getByLabel('Поставщик').fill('Тестовый поставщик');
  await dialog.getByLabel('Количество, г').fill('1500');
  await dialog.getByLabel('Цена за кг, ₸').fill('800');
  await dialog.getByRole('button', { name: 'Провести приход', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  // 1,5 кг по 800 ₸/кг = 1 200 ₸
  await expect(row(page, 'Соль морская')).toContainText('1500 г');
  await expect(row(page, 'Соль морская')).toContainText('1 200 ₸');
  await expect(row(page, 'Соль морская')).toContainText('В норме');
  await expect(page.getByTestId('stock-value')).toHaveText('1 200 ₸');
  await page.getByRole('tab', { name: 'Движения' }).click();
  await expect(page.getByRole('row', { name: /Соль морская.*Приход/ })).toContainText('1 200 ₸');
});

test('списание по FIFO: сначала ранняя партия, ниже нуля нельзя', async ({ page, request }) => {
  const { headers } = await reset(page, request);
  await seedBeef(request, headers);
  await page.goto('/stock');
  await expect(row(page, 'Говядина Рибай')).toContainText('3000 г');
  // 12 000 ₸ + 7 000 ₸
  await expect(row(page, 'Говядина Рибай')).toContainText('19 000 ₸');
  await page.getByRole('button', { name: 'Списать: Говядина Рибай' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Списать, г').fill('3500');
  await dialog.getByLabel('Причина').fill('Порча');
  await dialog.getByRole('button', { name: 'Списать', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Недостаточно на складе: есть 3000 г, нужно 3500 г');
  await dialog.getByLabel('Списать, г').fill('2500');
  await dialog.getByRole('button', { name: 'Списать', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  // осталось 500 г второй партии по 7 000 ₸/кг = 3 500 ₸; ниже минимума 1 кг
  await expect(row(page, 'Говядина Рибай')).toContainText('500 г');
  await expect(row(page, 'Говядина Рибай')).toContainText('3 500 ₸');
  await expect(row(page, 'Говядина Рибай')).toContainText('Мало');
  await expect(page.getByTestId('stock-low')).toHaveText('1');
  await page.getByRole('tab', { name: 'Движения' }).click();
  const writeOffs = page.getByRole('row', { name: /Говядина Рибай.*Списание/ });
  await expect(writeOffs).toHaveCount(2);
  await expect(page.getByRole('row', { name: /Списание.*-2000 г/ })).toContainText('−12 000 ₸');
  await expect(page.getByRole('row', { name: /Списание.*-500 г/ })).toContainText('−3 500 ₸');
});

test('инвентаризация: недостача списывается, излишек отклонён до решения Q-KITCHEN-9', async ({ page, request }) => {
  const { headers } = await reset(page, request);
  await seedBeef(request, headers);
  await page.goto('/stock');
  await page.getByRole('button', { name: 'Инвентаризация: Говядина Рибай' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Фактически на складе, г').fill('3200');
  await dialog.getByRole('button', { name: 'Сверить', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Факт больше учёта на 200 г');
  await dialog.getByLabel('Фактически на складе, г').fill('2800');
  await dialog.getByRole('button', { name: 'Сверить', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(row(page, 'Говядина Рибай')).toContainText('2800 г');
  await page.getByRole('tab', { name: 'Движения' }).click();
  // недостача 200 г из ранней партии по 6 000 ₸/кг
  await expect(page.getByRole('row', { name: /Инвентаризация.*-200 г/ })).toContainText('−1 200 ₸');
});

test('сторно: нетронутая партия сторнируется, начатая нет', async ({ page, request }) => {
  const { headers } = await reset(page, request);
  const beef = await seedBeef(request, headers);
  await post(request, headers, '/food-service/stock/write-offs', { productId: beef.id, qty: '100', reason: 'Проба' });
  await page.goto('/stock');
  await page.getByRole('button', { name: 'Партии: Говядина Рибай' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Сторнировать приход от 01.10.2026' })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Сторнировать приход от 05.10.2026' }).click();
  await expect(dialog.getByText('Сторнирован')).toBeVisible();
  await dialog.getByRole('button', { name: /Закрыть/ }).click();
  await expect(row(page, 'Говядина Рибай')).toContainText('1900 г');
});

test('роли: администратор работает со складом, но не правит справочник; только чтение', async ({ page, request }) => {
  const { headers } = await reset(page, request);
  const beef = await seedBeef(request, headers);
  await request.post(`${api}/__test/control`, { data: { role: 'STAFF' } });
  await page.goto('/stock');
  await expect(page.getByRole('button', { name: '+ Приход', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Списать: Говядина Рибай' })).toBeVisible();
  await expect(page.getByRole('button', { name: '+ Ингредиент', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Изменить: Говядина Рибай' })).toHaveCount(0);
  expect((await request.post(`${api}/food-service/stock/products`, { headers, data: { name: 'Нельзя', unit: 'г' } })).status()).toBe(403);
  await request.post(`${api}/__test/control`, { data: { readOnly: true } });
  await page.reload();
  await expect(page.getByTestId('read-only-banner')).toContainText('Режим только для чтения');
  await expect(page.getByRole('button', { name: '+ Приход', exact: true })).toHaveCount(0);
  expect(
    (await request.post(`${api}/food-service/stock/write-offs`, { headers, data: { productId: beef.id, qty: '1', reason: 'Нельзя' } })).status(),
  ).toBe(403);
  await request.post(`${api}/__test/control`, { data: {} });
});

test('снимки и axe в двух темах на 1440 и 390', async ({ page, request }) => {
  const { headers } = await reset(page, request);
  await seedBeef(request, headers);
  for (const width of [1440, 390])
    for (const theme of ['light', 'dark'] as const) {
      await page.setViewportSize({ width, height: 1000 });
      await page.emulateMedia({ colorScheme: theme });
      await page.goto('/stock');
      const themeButton = page.getByRole('button', { name: 'Переключить тему', exact: true });
      const initial = await page.locator('html').getAttribute('data-theme');
      await themeButton.click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', initial === 'dark' ? 'light' : 'dark');
      if ((await page.locator('html').getAttribute('data-theme')) !== theme) await themeButton.click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible();
      await settled(page);
      await page.screenshot({ path: `${shots}/stock-${theme}-${width}.png`, fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.getByRole('button', { name: '+ Приход', exact: true }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await settled(page);
      await page.screenshot({ path: `${shots}/stock-receipt-${theme}-${width}.png`, fullPage: true });
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).not.toBeVisible();
    }
});
