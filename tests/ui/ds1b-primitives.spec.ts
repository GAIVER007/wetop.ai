import AxeBuilder from '@axe-core/playwright';
import { FIXTURE_API, expect, test, type Page } from './fixtures';

/**
 * MV8.5 DS1b: вкладки, чипы, переключатель и полоса инструментов (DESIGN.md §8.1) в браузере.
 * Клавиатура и фокус на живых компонентах, разная семантика вкладок маршрутами и на странице,
 * экраны-представители без прокрутки вбок на 390 px и axe в двух темах.
 */
test.beforeEach(async ({ request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
});

const focused = (page: Page) =>
  page.evaluate(() => {
    const el = (globalThis as unknown as { document: { activeElement: { textContent: string } } })
      .document.activeElement;
    return el.textContent.trim();
  });

test('вкладки на странице: стрелки по кругу, Home, End, выбор сразу и фокус на вкладке', async ({
  page,
}) => {
  await page.goto('/reservations/20260913-TESTAA');
  const list = page.getByRole('tablist', { name: 'Разделы карточки брони' });
  const tabs = list.getByRole('tab');
  const count = await tabs.count();
  expect(count).toBeGreaterThan(2);
  await tabs.first().focus();
  await page.keyboard.press('ArrowRight');
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
  await expect(tabs.nth(1)).toBeFocused();
  const panel = page.locator(`#${await tabs.nth(1).getAttribute('aria-controls')}`);
  await expect(panel).toBeVisible();
  await expect(panel).toHaveAttribute('role', 'tabpanel');
  await page.keyboard.press('End');
  await expect(tabs.nth(count - 1)).toHaveAttribute('aria-selected', 'true');
  await expect(tabs.nth(count - 1)).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowLeft');
  await expect(tabs.nth(count - 1)).toBeFocused();
  await page.keyboard.press('Home');
  await expect(tabs.first()).toBeFocused();
  await expect(tabs.first()).toHaveAttribute('tabindex', '0');
  await expect(tabs.nth(1)).toHaveAttribute('tabindex', '-1');
});

test('вкладки маршрутами: ссылки с aria-current, стрелки не перехватываются', async ({ page }) => {
  await page.goto('/hotel-settings/stay');
  const nav = page.getByRole('navigation', { name: 'Настройки объекта' });
  await expect(nav.getByRole('tab')).toHaveCount(0);
  await expect(nav.getByRole('link', { name: 'Проживание' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(nav.getByRole('link', { name: 'Основное' })).not.toHaveAttribute('aria-current');
  await nav.getByRole('link', { name: 'Основное' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(nav.getByRole('link', { name: 'Основное' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(nav.getByRole('link', { name: 'Проживание' })).toBeFocused();
  await nav.getByRole('link', { name: 'Услуги' }).click();
  await expect(page).toHaveURL(/\/hotel-settings\/services$/);
  await expect(nav.getByRole('link', { name: 'Услуги' })).toHaveAttribute('aria-current', 'page');
});

test('переключатель шахматки: ровно один выбран, стрелки и Home/End, выбор помнится', async ({
  page,
}) => {
  await page.goto('/chessboard');
  const group = page.getByRole('group', { name: 'Вид строк календаря' });
  const pressed = group.locator('[aria-pressed="true"]');
  await expect(pressed).toHaveCount(1);
  await expect(pressed).toHaveText('Компактный');
  await pressed.focus();
  await page.keyboard.press('ArrowRight');
  await expect(group.locator('[aria-pressed="true"]')).toHaveText('Обычный');
  expect(await focused(page)).toBe('Обычный');
  await page.keyboard.press('End');
  await expect(group.locator('[aria-pressed="true"]')).toHaveText('Подробный');
  await page.keyboard.press('ArrowRight');
  await expect(group.locator('[aria-pressed="true"]')).toHaveText('Компактный');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Home');
  await expect(group.locator('[aria-pressed="true"]')).toHaveText('Компактный');
  await group.getByRole('button', { name: 'Обычный' }).click();
  await expect(group.locator('[aria-pressed="true"]')).toHaveCount(1);
  await page.reload();
  await expect(
    page
      .getByRole('group', { name: 'Вид строк календаря' })
      .getByRole('button', { name: 'Обычный' }),
  ).toHaveAttribute('aria-pressed', 'true');
});

test('брони: чипы видов ссылками, полоса инструментов по порядку поиск, отбор, период, действия', async ({
  page,
}) => {
  await page.goto('/reservations');
  const views = page.getByRole('navigation', { name: 'Быстрые виды' });
  await expect(views.locator('[aria-current="page"]')).toHaveCount(1);
  await expect(views.locator('[aria-pressed]')).toHaveCount(0);
  const bar = page.getByRole('group', { name: 'Поиск и отбор броней' });
  const order = await bar.locator(':scope > div').evaluateAll((els) => els.map((e) => e.className));
  expect(order).toEqual([
    'toolbar__search',
    'toolbar__filters',
    'toolbar__period',
    'toolbar__actions',
  ]);
  // Tab идёт в том же порядке: поиск, статус, «Фильтры», «Даты», «Показать»
  await bar.getByLabel('Поиск броней').focus();
  const seen: string[] = [];
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab');
    seen.push(
      await page.evaluate(() => {
        const el = (
          globalThis as unknown as {
            document: {
              activeElement: { getAttribute(n: string): string | null; textContent: string };
            };
          }
        ).document.activeElement;
        return el.getAttribute('aria-label') ?? el.textContent.trim();
      }),
    );
  }
  expect(seen).toEqual(['Статус брони', 'Фильтры', 'Даты', 'Показать']);
  // плотность: тот же переключатель
  const density = page.getByRole('group', { name: 'Плотность строк' });
  await expect(density.locator('[aria-pressed="true"]')).toHaveCount(1);
});

test('чип: кнопка переключает aria-pressed, число читается в имени', async ({ page }) => {
  await page.goto('/design-system');
  const group = page.getByTestId('kit-light').getByRole('group', { name: 'Отбор броней (light)' });
  const debt = group.getByRole('button', { name: 'С долгом 12' });
  await expect(debt).toHaveAttribute('aria-pressed', 'false');
  await debt.click();
  await expect(debt).toHaveAttribute('aria-pressed', 'true');
  await debt.press('Space');
  await expect(debt).toHaveAttribute('aria-pressed', 'false');
});

const SCREENS = [
  '/reservations',
  '/reservations/20260913-TESTAA',
  '/hotel-settings',
  '/chessboard',
];

for (const theme of ['light', 'dark'] as const) {
  test(`390 px: экраны-представители без прокрутки вбок, цели не ниже 44 px, axe (${theme})`, async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.emulateMedia({ colorScheme: theme });
    await page.setViewportSize({ width: 390, height: 844 });
    for (const route of SCREENS) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      const overflow = await page.evaluate(() => {
        const root = (
          globalThis as unknown as {
            document: { documentElement: { scrollWidth: number; clientWidth: number } };
          }
        ).document.documentElement;
        return root.scrollWidth - root.clientWidth;
      });
      expect(overflow, route).toBeLessThanOrEqual(0);
      const small = await page
        .locator('.tabs__item:visible, .chip:visible, .seg__item:visible')
        .evaluateAll((els) =>
          els
            .map((e) => ({ text: e.textContent?.trim(), h: e.getBoundingClientRect().height }))
            .filter((e) => e.h < 44),
        );
      expect(small, route).toEqual([]);
      const result = await new AxeBuilder({ page })
        .include('.tabs, .chip-group, .seg, .toolbar')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(
        result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
        route,
      ).toEqual([]);
    }
  });
}
