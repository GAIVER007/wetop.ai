import { FIXTURE_API, expect, test, devNoise, type Page } from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';

/**
 * Навигация стойки сверху (ADR-134, plans/workspace-top-navigation-2026-10-02.md): вместо бокового меню
 * строка вкладок во второй строке шапки. Главное одним щелчком, группы «Продажи», «Маркетинг», «Настройки» и
 * «Платформа» раскрывают список под вкладкой; на телефоне и планшете по-прежнему выдвижное меню
 * «Навигация» и нижняя панель.
 */
const routes = [
  '/ai-agents',
  '/today',
  '/chessboard',
  // «Гости и бронирования» с 09.10.2026: один пункт на месте «Броней» и «Гостей», список броней открывается кнопкой
  '/guests',
  '/inventory',
  '/market',
  '/channels',
  // MKT2: вход в сайт через хаб «Маркетинг», у страниц /website/* своего пункта меню нет
  '/marketing',
  '/reports',
  '/finance',
  '/bar',
  '/management/analytics',
  '/hotel-settings',
  '/connections',
  '/team',
  '/journal',
  '/incidents',
];

const TABS = [
  'Главная',
  'Календарь',
  'Гости и бронирования',
  'Финансы',
  'Бар',
  'Продажи',
  'Маркетинг',
  'Отчёты',
  'Номерной фонд',
  'Настройки',
];

const fixture = FIXTURE_API;
const SHOTS = 'reports/top-menu-2026-10-02';
const menuOf = (page: Page) =>
  page.locator('.workspace-header').getByRole('navigation', { name: 'Разделы' });

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

test('строка вкладок в шапке: порядок, одна активная, список группы с клавиатуры', async ({ page }) => {
  await page.goto('/today');
  const header = page.locator('.workspace-header');
  const menu = menuOf(page);
  // бокового меню больше нет: все разделы в шапке
  await expect(page.locator('.workspace-sidebar')).toHaveCount(0);
  await expect(menu.locator('.topmenu__tab')).toHaveText(TABS);
  // Утверждённая owner Главная скрывает поиск; вкладки остаются под верхней строкой.
  await expect(header.getByRole('button', { name: 'Найти гостя или бронь' })).toBeHidden();
  const row = await header.locator('.workspace-header__row').boundingBox();
  const homeTab = await menu.locator('.topmenu__tab').first().boundingBox();
  expect(homeTab!.y).toBeGreaterThanOrEqual(row!.y + row!.height - 1);
  // Прежняя проверка поиска сохраняется на Календаре, где поиск доступен.
  await page.goto('/chessboard');
  const search = await header.getByRole('button', { name: 'Найти гостя или бронь' }).boundingBox();
  const first = await menu.locator('.topmenu__tab').first().boundingBox();
  expect(first!.y).toBeGreaterThanOrEqual(search!.y + search!.height - 1);
  await page.goto('/today');
  // в разметке каждый раздел ровно один раз, включая пункты закрытых списков
  const links = await menu
    .locator('a')
    .evaluateAll((items) => items.map((item) => item.getAttribute('href')));
  expect([...links].sort()).toEqual([...routes].sort());
  expect(new Set(links).size).toBe(links.length);
  await expect(menu.locator('[aria-current="page"]')).toHaveText('Главная');

  const sales = menu.getByRole('button', { name: 'Продажи', exact: true });
  await expect(sales).toHaveAttribute('aria-expanded', 'false');
  // /today стримится, а шапка клиентская: до гидрации у кнопки нет обработчика, и Space теряется
  await expect(async () => {
    await sales.focus();
    await page.keyboard.press('Space');
    await expect(sales).toHaveAttribute('aria-expanded', 'true', { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  await expect(menu.locator('[aria-expanded="true"]')).toHaveCount(1);
  const rates = menu.getByRole('link', { name: 'Анализ конкурентов', exact: true });
  await expect(rates).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(rates).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/market$/);
  // переход закрывает список, текущий пункт остаётся в разметке и подсвечивает вкладку группы
  await expect(sales).toHaveAttribute('aria-expanded', 'false');
  await expect(rates).toBeHidden();
  await expect(menu.locator('[aria-current="page"]')).toHaveCount(1);
  await expect(menu.locator('[aria-current="page"]')).toHaveText('Анализ конкурентов');
  await expect(sales).toHaveClass(/has-current-page/);
  await expect(menu.getByRole('link', { name: 'Главная', exact: true })).not.toHaveAttribute(
    'aria-current',
    'page',
  );

  // Escape закрывает список и возвращает фокус на вкладку
  await sales.click();
  await expect(sales).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(sales).toHaveAttribute('aria-expanded', 'false');
  await expect(sales).toBeFocused();
  // щелчок мимо списка закрывает его
  await sales.click();
  await expect(sales).toHaveAttribute('aria-expanded', 'true');
  // мимо — в нижний угол окна: на «Загрузке конкурентов» раскрытый список лежит поверх заголовка страницы
  const viewport = page.viewportSize()!;
  await page.mouse.click(8, viewport.height - 8);
  await expect(sales).toHaveAttribute('aria-expanded', 'false');
  // вторая группа закрывает первую: открытый список один
  await sales.click();
  await menu.getByRole('button', { name: 'Настройки', exact: true }).click();
  await expect(menu.locator('[aria-expanded="true"]')).toHaveCount(1);
  await expect(menu.getByRole('link', { name: 'Объект', exact: true })).toBeVisible();
  await expect(rates).toBeHidden();
});

test('вложенные адреса подсвечивают свою вкладку', async ({ page }) => {
  await page.goto('/hotel-settings/services');
  const menu = menuOf(page);
  const settings = menu.getByRole('button', { name: 'Настройки', exact: true });
  await expect(settings).toHaveClass(/has-current-page/);
  await expect(settings).toHaveAttribute('aria-expanded', 'false');
  await expect(menu.locator('[aria-current="page"]')).toHaveCount(1);
  await expect(menu.locator('[aria-current="page"]')).toHaveText('Объект');
  // «Номерной фонд»: вкладки страницы подсвечивают его вкладку (ADR-108)
  await page.goto('/rooms/categories');
  await expect(menu.locator('[aria-current="page"]')).toHaveText('Номерной фонд');
  await expect(menu.getByRole('link', { name: 'Номерной фонд', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  // вкладка модуля сайта: один пункт «Сайт и SEO» группы «Маркетинг» (MKT2, раньше «Продажи», ADR-117)
  await page.goto('/website/settings');
  await expect(menu.locator('[aria-current="page"]')).toHaveText('Сайт и SEO');
  await expect(menu.getByRole('button', { name: 'Маркетинг', exact: true })).toHaveClass(
    /has-current-page/,
  );
  await expect(menu.getByRole('button', { name: 'Продажи', exact: true })).not.toHaveClass(
    /has-current-page/,
  );
  // страницы продавца: пункт «ИИ-продавцы» (S0)
  await page.goto('/ai-seller/dialogs');
  await expect(menu.locator('[aria-current="page"]')).toHaveText('ИИ-продавцы');
  await page.goto('/connections');
  await expect(menu.locator('[aria-current="page"]')).toHaveText('Подключения');
  await expect(settings).toHaveClass(/has-current-page/);
  await expect(menu.getByRole('button', { name: 'Продажи', exact: true })).not.toHaveClass(
    /has-current-page/,
  );
});

for (const theme of ['light', 'dark'] as const) {
  test(`шапка ровная, без прокрутки вбок и доступная: ${theme}`, async ({ page }) => {
    test.setTimeout(120_000);
    mkdirSync(SHOTS, { recursive: true });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      if (!devNoise.test(error.message)) errors.push(error.message);
    });
    await page.goto('/today');
    const header = page.locator('.workspace-header');
    for (const width of [1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const tabs = menuOf(page).locator('.topmenu__tab');
      await expect(tabs).toHaveCount(TABS.length);
      const boxes = await tabs.evaluateAll((items) =>
        items.map((item) => {
          const box = item.getBoundingClientRect();
          return { y: box.y, height: box.height, right: box.right };
        }),
      );
      // одна строка: у всех вкладок один верх и высота не меньше 40 px, последняя не выходит за край
      expect(new Set(boxes.map((box) => Math.round(box.y))).size).toBe(1);
      for (const box of boxes) expect(box.height).toBeGreaterThanOrEqual(40);
      expect(boxes.at(-1)!.right).toBeLessThanOrEqual(width);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
      if (width === 1024 || width === 1440) {
        const audit = await new AxeBuilder({ page })
          .include('.workspace-header')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze();
        expect(audit.violations).toEqual([]);
      }
      if (width === 1440) {
        await header.screenshot({ path: `${SHOTS}/header-${theme}-${width}.png` });
        await menuOf(page).getByRole('button', { name: 'Продажи', exact: true }).click();
        await page.screenshot({
          path: `${SHOTS}/menu-sales-${theme}-${width}.png`,
          clip: { x: 0, y: 0, width: 1440, height: 360 },
        });
        await page.keyboard.press('Escape');
      }
    }
    // телефон: строки вкладок нет, работают выдвижное меню и нижняя панель
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('.topmenu')).toBeHidden();
    await page.getByRole('button', { name: 'Открыть меню', exact: true }).click();
    const drawer = page.getByRole('dialog', { name: 'Навигация', exact: true });
    for (const label of ['Главная', 'Календарь', 'Гости и бронирования', 'Финансы', 'Номерной фонд'])
      await expect(drawer.getByRole('link', { name: label, exact: true })).toBeVisible();
    await drawer.getByRole('button', { name: 'Настройки', exact: true }).click();
    await expect(drawer.getByRole('link', { name: 'Объект', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(drawer).not.toBeVisible();
    const bottom = page.locator('.bottom-navigation');
    await expect(bottom).toBeVisible();
    await expect(bottom.locator('a')).toHaveText(['Главная', 'Календарь', 'Брони', 'Финансы']);
    await expect(bottom.getByRole('button', { name: 'Ещё разделы', exact: true })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    ).toBe(true);
    await page.screenshot({ path: `${SHOTS}/phone-${theme}.png` });
    expect(errors).toEqual([]);
  });
}
