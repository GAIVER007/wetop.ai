import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';

// Контракт меню: основные разделы доступны ровно по разу, настройки объекта — во внутренних вкладках.
const routes = [
  '/today',
  '/chessboard',
  '/reservations',
  '/guests',
  '/inventory',
  '/rooms/categories',
  '/rooms/availability',
  '/rooms',
  '/rates',
  '/channel-manager',
  '/channels',
  '/analytics',
  '/finance',
  '/management/statistics',
  '/hotel-settings',
  '/connections',
  '/analytics/setup',
  '/incidents',
  '/journal',
];

const fixture = 'http://127.0.0.1:4311';
test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

test('свёрнутая desktop-панель не скрывает подписи мобильного меню', async ({ page }) => {
  await page.goto('/today');
  await page.getByRole('button', { name: 'Свернуть панель', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Открыть меню', exact: true }).click();
  const menu = page.getByRole('dialog', { name: 'Навигация', exact: true });
  const board = menu.getByRole('link', { name: 'Шахматка', exact: true });
  await expect(board.locator('span')).toBeVisible();
  await board.click();
  await expect(page).toHaveURL(/\/chessboard$/);
  await expect(menu).not.toBeVisible();
});

test('разделы содержат основные ссылки без дублей; раскрываются с клавиатуры', async ({ page }) => {
  await page.goto('/today');
  const sidebar = page.locator('.workspace-sidebar');
  const groups = sidebar.locator('.sidebar-section-toggle');
  await expect(groups).toHaveText([
    'Работа с гостями',
    'Номерной фонд',
    'Продажи',
    'Финансы и отчёты',
    'Настройки',
    'Контроль',
  ]);
  const links = await sidebar
    .locator('.workspace-links a')
    .evaluateAll((items) => items.map((item) => item.getAttribute('href')));
  expect(links.sort()).toEqual([...routes].sort());
  expect(new Set(links).size).toBe(links.length);
  const sales = sidebar.getByRole('button', { name: 'Продажи', exact: true });
  await sales.focus();
  await page.keyboard.press('Space');
  await expect(sales).toHaveAttribute('aria-expanded', 'true');
  await expect(sidebar.locator('.sidebar-section-toggle[aria-expanded="true"]')).toHaveCount(1);
  await expect(sidebar.getByRole('link', { name: 'Тарифы', exact: true })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(sidebar.getByRole('link', { name: 'Тарифы', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/rates$/);
  await expect(sidebar.locator('[aria-current="page"]')).toHaveText('Тарифы');
  await page.goBack();
  await expect(sidebar.getByRole('button', { name: 'Работа с гостями' })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  await expect(sidebar.locator('[aria-current="page"]')).toHaveText('Главная');
});

test('компактная панель открывает выбранную группу; прямая ссылка раскрывает текущий раздел', async ({
  page,
}) => {
  await page.goto('/hotel-settings/services');
  const sidebar = page.locator('.workspace-sidebar');
  await expect(sidebar.getByRole('button', { name: 'Настройки', exact: true })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  await expect(sidebar.locator('[aria-current="page"]')).toHaveText('Гостиница');
  await page.getByRole('button', { name: 'Свернуть панель', exact: true }).click();
  await sidebar.getByRole('button', { name: 'Номерной фонд', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Свернуть панель', exact: true })).toBeVisible();
  await expect(sidebar.getByRole('button', { name: 'Номерной фонд', exact: true })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  await sidebar.getByRole('link', { name: 'Номера и койки', exact: true }).click();
  await expect(page).toHaveURL(/\/inventory$/);
  await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toHaveText(
    'Номерной фонд',
  );
  await expect(sidebar.locator('[aria-current="page"]')).toHaveCount(1);
});

test('все пункты меню открывают существующие страницы', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/today');
  const sidebar = page.locator('.workspace-sidebar');
  const sections = sidebar.locator('.sidebar-section');
  for (let i = 0; i < (await sections.count()); i++) {
    const section = sections.nth(i);
    const toggle = section.getByRole('button');
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
    const links = section.locator('a');
    for (let j = 0; j < (await links.count()); j++) {
      const link = links.nth(j);
      const href = await link.getAttribute('href');
      await link.click();
      await expect(page).toHaveURL(new RegExp(`${href}$`));
      await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByRole('main')).not.toContainText('Не удалось загрузить данные');
      await expect(sidebar.locator('[aria-current="page"]')).toHaveCount(1);
      await expect(link).toHaveAttribute('aria-current', 'page');
    }
  }
});

for (const theme of ['light', 'dark'] as const) {
  test(`навигация ровная, адаптивная и доступная: ${theme}`, async ({ page }) => {
    test.setTimeout(120_000);
    mkdirSync('reports/navigation-2026-09-20', { recursive: true });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/today');
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      const mobile = width <= 960;
      const menu = mobile
        ? page.getByRole('dialog', { name: 'Навигация', exact: true })
        : page.locator('.workspace-sidebar');
      if (mobile) await page.getByRole('button', { name: 'Открыть меню', exact: true }).click();
      const groups = menu.locator('.sidebar-section-toggle');
      await expect(groups).toHaveCount(6);
      const boxes = await groups.evaluateAll((items) =>
        items.map((item) => {
          const box = item.getBoundingClientRect();
          return { x: box.x, width: box.width, height: box.height };
        }),
      );
      expect(new Set(boxes.map((box) => box.x)).size).toBe(1);
      expect(new Set(boxes.map((box) => box.width)).size).toBe(1);
      for (const box of boxes) expect(box.height).toBeGreaterThanOrEqual(mobile ? 44 : 40);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
      if (width === 390 || width === 1440) {
        const audit = await new AxeBuilder({ page })
          .include(mobile ? '.mobile-navigation' : '.workspace-sidebar')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze();
        expect(audit.violations).toEqual([]);
        await menu.screenshot({ path: `reports/navigation-2026-09-20/menu-${theme}-${width}.png` });
      }
      if (mobile) {
        await menu.getByRole('button', { name: 'Настройки', exact: true }).click();
        await menu.getByRole('link', { name: 'Сайт', exact: true }).scrollIntoViewIfNeeded();
        const close = menu.getByRole('button', { name: 'Закрыть: Навигация', exact: true });
        const rect = await close.boundingBox();
        expect(rect!.y).toBeGreaterThanOrEqual(0);
        expect(rect!.y + rect!.height).toBeLessThan(844);
        expect(
          await menu.evaluate((element) => element.scrollHeight <= element.clientHeight + 1),
        ).toBe(true);
        await page.keyboard.press('Escape');
        await expect(menu).not.toBeVisible();
        await expect(page.getByRole('button', { name: 'Открыть меню', exact: true })).toBeFocused();
      }
    }
    expect(errors).toEqual([]);
  });
}
