import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** Кухня FS1 (DATA_MODEL §33, ADR-KITCHEN-FS): меню, категории, стоп-лист на настоящем API и базе */
const api = 'http://127.0.0.1:55824';
const shots = 'reports/kitchen-fs1-2026-10-09/screenshots';
type Fixture = { business: string; locations: string[] };
const pointer = (b: string, l: string) => `business=${b};location=${l}`;
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
async function reset(page: Page, request: APIRequestContext) {
  const res = await request.post(`${api}/__test/reset`);
  expect(res.ok()).toBe(true);
  const f: Fixture = await res.json();
  await page.context().addCookies([
    {
      name: 'wetop_scope',
      value: encodeURIComponent(pointer(f.business, f.locations[0]!)),
      domain: '127.0.0.1',
      path: '/',
    },
  ]);
  return { f, headers: { 'x-wetop-scope': pointer(f.business, f.locations[0]!) } };
}
async function createDish(page: Page, name: string, price: string, hit = false) {
  await page.getByRole('button', { name: '+ Добавить блюдо', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Название', { exact: true }).fill(name);
  await dialog.getByLabel('Цена продажи, ₸').fill(price);
  if (hit) await dialog.getByLabel('Хит', { exact: true }).check();
  await dialog.getByRole('button', { name: 'Создать', exact: true }).click();
  await expect(dialog).not.toBeVisible();
}

test('пустая кухня, категория из подсказки, блюдо с ценой и пометкой', async ({
  page,
  request,
}) => {
  await reset(page, request);
  await page.goto('/kitchen');
  await expect(page.getByRole('heading', { level: 1, name: 'Кухня' })).toBeVisible();
  await expect(page.getByText('Добавьте первое блюдо')).toBeVisible();
  await page.getByRole('button', { name: 'Категории', exact: true }).click();
  await page.getByRole('button', { name: '+ Добавить категорию', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Супы', exact: true }).click();
  await expect(dialog.getByLabel('Название', { exact: true })).toHaveValue('Супы');
  await dialog.getByRole('button', { name: 'Создать', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('heading', { name: 'Супы', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Меню', exact: true }).click();
  await page.getByRole('button', { name: '+ Добавить блюдо', exact: true }).click();
  await dialog.getByLabel('Название', { exact: true }).fill('Томатный суп');
  await dialog.getByLabel('Категория').selectOption({ label: 'Супы' });
  await dialog.getByLabel('Цена продажи, ₸').fill('2200');
  await dialog.getByLabel('Выход, г').fill('300');
  await dialog.getByLabel('Хит', { exact: true }).check();
  await dialog.getByRole('button', { name: 'Создать', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const card = page.getByRole('heading', { name: 'Томатный суп' }).locator('..').locator('..').locator('..');
  await expect(card.getByText('2 200 ₸')).toBeVisible();
  await expect(card.getByText('В наличии', { exact: true })).toBeVisible();
  await expect(card.getByText('Хит', { exact: true })).toBeVisible();
  await expect(card.getByText('Супы, 300 г')).toBeVisible();
  await page.getByRole('button', { name: 'Супы (1)', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Томатный суп' })).toBeVisible();
  await page.getByLabel('Поиск по блюдам').fill('стейк');
  await expect(page.getByText('Ничего не найдено')).toBeVisible();
});

test('стоп-лист, цена филиала и архив блюда переживают перезагрузку', async ({
  page,
  request,
}) => {
  await reset(page, request);
  await page.goto('/kitchen');
  await createDish(page, 'Стейк Рибай', '5900');
  await page.getByRole('button', { name: 'В стоп-лист: Стейк Рибай' }).click();
  await expect(page.getByText('Стоп-лист', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Стоп-лист', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Вернуть в продажу: Стейк Рибай' }).click();
  await expect(page.getByText('В наличии', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Изменить', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Цена филиала, ₸ (пусто: цена каталога)').fill('4900');
  await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText('4 900 ₸')).toBeVisible();
  await expect(page.getByText('цена филиала')).toBeVisible();
  await page.getByRole('button', { name: 'Изменить', exact: true }).click();
  await dialog.getByRole('button', { name: 'Архивировать', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText('В архиве', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /стоп-лист/i })).toHaveCount(0);
});

test('повтор названия блюда отвечает понятной ошибкой в форме', async ({ page, request }) => {
  await reset(page, request);
  await page.goto('/kitchen');
  await createDish(page, 'Паста Карбонара', '3600');
  await page.getByRole('button', { name: '+ Добавить блюдо', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Название', { exact: true }).fill('Паста Карбонара');
  await dialog.getByLabel('Цена продажи, ₸').fill('3700');
  await dialog.getByRole('button', { name: 'Создать', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('уже существует');
});

test('снимки и axe в двух темах на 1440 и 390', async ({ page, request }) => {
  await reset(page, request);
  await page.goto('/kitchen');
  await createDish(page, 'Лосось на гриле', '4900', true);
  for (const width of [1440, 390])
    for (const theme of ['light', 'dark'] as const) {
      await page.setViewportSize({ width, height: 1000 });
      await page.emulateMedia({ colorScheme: theme });
      await page.goto('/kitchen');
      const themeButton = page.getByRole('button', { name: 'Переключить тему', exact: true });
      const initial = await page.locator('html').getAttribute('data-theme');
      await themeButton.click();
      await expect(page.locator('html')).toHaveAttribute(
        'data-theme',
        initial === 'dark' ? 'light' : 'dark',
      );
      if ((await page.locator('html').getAttribute('data-theme')) !== theme)
        await themeButton.click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible();
      await settled(page);
      await page.screenshot({ path: `${shots}/kitchen-${theme}-${width}.png`, fullPage: true });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.getByRole('button', { name: 'Изменить', exact: true }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await settled(page);
      await page.screenshot({ path: `${shots}/kitchen-form-${theme}-${width}.png`, fullPage: true });
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).not.toBeVisible();
    }
});

test('STAFF и READ_ONLY: кнопок записи нет, API отказывает', async ({ page, request }) => {
  const { headers } = await reset(page, request);
  await page.goto('/kitchen');
  await createDish(page, 'Цезарь', '2800');
  await request.post(`${api}/__test/control`, { data: { role: 'STAFF' } });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Цезарь' })).toBeVisible();
  await expect(page.getByRole('button', { name: '+ Добавить блюдо', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /стоп-лист/i })).toHaveCount(0);
  expect(
    (
      await request.post(`${api}/food-service/menu/items`, {
        headers,
        data: { name: 'Denied', price: 100, currency: 'KZT' },
      })
    ).status(),
  ).toBe(403);
  await request.post(`${api}/__test/control`, { data: { readOnly: true } });
  await page.reload();
  await expect(page.getByTestId('read-only-banner')).toContainText('Режим только для чтения');
  await expect(page.getByRole('button', { name: '+ Добавить блюдо', exact: true })).toHaveCount(0);
  expect(
    (
      await request.put(`${api}/food-service/menu/items/00000000-0000-0000-0000-000000000000/location`, {
        headers,
        data: { available: false },
      })
    ).status(),
  ).toBe(403);
  await request.post(`${api}/__test/control`, { data: {} });
});
