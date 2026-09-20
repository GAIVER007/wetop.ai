import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';

const fixture = 'http://127.0.0.1:4311';
test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

test('каталог: поиск, тип, категория, сброс и сохранение фильтров', async ({ page }) => {
  await page.goto('/inventory');
  const main = page.getByRole('main');
  await expect(main.getByTestId('unit-row')).toHaveCount(88);
  await main.getByRole('button', { name: 'Койко-места', exact: true }).click();
  await expect(main.getByTestId('unit-row')).toHaveCount(72);
  await main.getByRole('searchbox', { name: 'Поиск по номерному фонду' }).fill('M01');
  await expect(main.getByTestId('unit-row')).toHaveCount(1);
  await expect(page).toHaveURL(/q=M01/);
  await page.reload();
  await expect(main.getByTestId('unit-row')).toHaveCount(1);
  await expect(main.getByRole('searchbox')).toHaveValue('M01');
  await main.getByRole('button', { name: 'Сбросить фильтры', exact: true }).click();
  await expect(main.getByTestId('unit-row')).toHaveCount(88);
  await main.getByTestId('category-row').filter({ hasText: 'Мужской' }).click();
  await expect(main.getByTestId('unit-row')).toHaveCount(36);
  await expect(page).toHaveURL(/category=MALE/);
  await page.goBack();
  await expect(main.getByTestId('unit-row')).toHaveCount(88);
});

test('прямая ссылка на категорию и вид списка сохраняются, карточка открывается', async ({
  page,
}) => {
  await page.goto('/inventory?category=ROOM');
  const main = page.getByRole('main');
  await expect(main.getByTestId('unit-row')).toHaveCount(16);
  await main.getByRole('button', { name: 'Список', exact: true }).click();
  await expect(main.getByRole('table', { name: 'Номера и койко-места' })).toBeVisible();
  await page.reload();
  await expect(main.getByRole('button', { name: 'Список', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await main.getByRole('link', { name: 'Открыть номер R01', exact: true }).click();
  await expect(page).toHaveURL(/\/units\/R01/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('R01');
});

test('пустой поиск объясняется, сброс возвращает фонд', async ({ page }) => {
  await page.goto('/inventory?q=несуществующий-номер');
  await expect(page.getByRole('heading', { name: 'Ничего не найдено' })).toBeVisible();
  await page
    .getByRole('main')
    .getByRole('button', { name: 'Сбросить фильтры', exact: true })
    .click();
  await expect(page.getByRole('main').getByTestId('unit-row')).toHaveCount(88);
});

for (const theme of ['light', 'dark'] as const) {
  test(`каталог адаптивен и доступен: ${theme}`, async ({ page }) => {
    test.setTimeout(120_000);
    mkdirSync('reports/inventory-design-2026-09-20', { recursive: true });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    for (const width of [320, 390, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto('/inventory');
      await expect(page.getByRole('searchbox', { name: 'Поиск по номерному фонду' })).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
      if (width === 390 || width === 1440) {
        const audit = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze();
        expect(audit.violations).toEqual([]);
        await page.screenshot({
          path: `reports/inventory-design-2026-09-20/catalog-${theme}-${width}.png`,
        });
      }
      if (width === 390) {
        await page.getByRole('combobox', { name: 'Категория размещения' }).selectOption('MALE');
        await expect(page.getByRole('main').getByTestId('unit-row')).toHaveCount(36);
      }
    }
    expect(errors).toEqual([]);
  });
}

test('пустой фонд отличается от пустого поиска', async ({ page, request }) => {
  await request.post(`${fixture}/__test/control`, { data: { empty: true } });
  await page.goto('/inventory');
  await expect(page.getByRole('heading', { name: 'Номерной фонд пока пуст' })).toBeVisible();
  await expect(page.getByRole('main').getByTestId('total-units')).toHaveText('0');
  await expect(page.getByRole('main').getByTestId('unit-row')).toHaveCount(0);
});

test('категория и тип пересекаются, фильтр доступен с клавиатуры без запроса страницы', async ({
  page,
}) => {
  await page.goto('/inventory?category=MALE');
  const main = page.getByRole('main');
  await expect(main.getByTestId('unit-row')).toHaveCount(36);
  const filterRequests: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname === '/inventory') filterRequests.push(r.url());
  });
  await main.getByRole('button', { name: 'Номера', exact: true }).focus();
  await page.keyboard.press('Space');
  await expect(main.getByRole('heading', { name: 'Ничего не найдено' })).toBeVisible();
  await main.getByRole('button', { name: 'Сбросить фильтры', exact: true }).click();
  await expect(main.getByTestId('unit-row')).toHaveCount(88);
  expect(filterRequests).toEqual([]);
  await main.getByRole('link', { name: 'Открыть номер R01', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/units\/R01/);
});
