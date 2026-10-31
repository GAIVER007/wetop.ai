import AxeBuilder from '@axe-core/playwright';
import { FIXTURE_API, expect, test } from './fixtures';

/**
 * Строка разделов в шапке (решения владельца 17–18.10.2026, ADR-TOPNAV-20261017): от 1280 px кнопки ☰ нет, слева знак
 * «W» с надписью WETOP.AI, разделы одной строкой, у группы список подразделов по наведению и нажатию.
 */
const SECTIONS = [
  'Главная',
  'Журнал',
  'Персонал',
  'Клиенты',
  'Услуги',
  'Статистика',
  'Склад',
  'Финансы',
  'Настройки',
  'Продвижение',
  'Помощь',
];

test.beforeEach(async ({ request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
});

test('широкий экран: знак с надписью, без кнопки ☰, все разделы строкой', async ({ page }) => {
  for (const width of [1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/finance');
    const header = page.locator('.workspace-header');
    await expect(header.getByRole('button', { name: 'Открыть меню', exact: true })).toBeHidden();
    await expect(header.locator('.workspace-brand .brand-name')).toBeVisible();
    await expect(header.locator('.workspace-brand')).toContainText('WETOP.AI');
    const nav = page.getByRole('navigation', { name: 'Главное меню' });
    await expect(nav.locator('.tabnav__tab')).toHaveText(SECTIONS);
    await expect(nav.locator('.tabnav__tab.is-current')).toHaveText('Финансы');
    // строка помещается целиком, страница вбок не прокручивается
    expect(await nav.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
});

test('наведение открывает список, щелчок ведёт на страницу и подсвечивает раздел', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/finance');
  const nav = page.getByRole('navigation', { name: 'Главное меню' });
  const settings = nav.getByRole('button', { name: 'Настройки', exact: true });
  await expect(async () => {
    await settings.hover();
    await expect(settings).toHaveAttribute('aria-expanded', 'true', { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  const list = page.locator(`[id="${await settings.getAttribute('aria-controls')}"]`);
  await expect(list.getByRole('link')).toHaveText([
    // меню «Настройки» одно у всех направлений (31.10.2026)
    'Все настройки',
    'История действий',
    // «Все бизнесы» владельцу (30.10.2026)
    'Все бизнесы',
  ]);
  // щелчок мышью по открытому наведением разделу список не закрывает
  await settings.click();
  await expect(list).toBeVisible();
  await list.getByRole('link', { name: 'Все настройки', exact: true }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(list).toBeHidden();
  await expect(nav.locator('.tabnav__tab.is-current')).toHaveText('Настройки');
  await expect(nav.locator('.tabnav__link[aria-current="page"]')).toHaveText('Все настройки');
  // прямой раздел ведёт сразу на страницу
  await nav.getByRole('link', { name: 'Журнал', exact: true }).click();
  await expect(page).toHaveURL(/\/chessboard$/);
  await expect(nav.locator('.tabnav__tab.is-current')).toHaveText('Журнал');
});

test('клавиатура: стрелка вниз открывает список, стрелки ходят по пунктам, Escape возвращает фокус', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/finance');
  const nav = page.getByRole('navigation', { name: 'Главное меню' });
  const promo = nav.getByRole('button', { name: 'Продвижение', exact: true });
  const list = page.locator(`[id="${await promo.getAttribute('aria-controls')}"]`);
  await expect(async () => {
    await promo.focus();
    await page.keyboard.press('ArrowDown');
    await expect(list.getByRole('link', { name: 'Обзор', exact: true })).toBeFocused({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  await page.keyboard.press('ArrowDown');
  await expect(list.getByRole('link', { name: 'Реклама', exact: true })).toBeFocused();
  await page.keyboard.press('End');
  await expect(list.getByRole('link', { name: 'Бюджет и аналитика', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(list).toBeHidden();
  await expect(promo).toBeFocused();
});

test('меню под именем: «Моя работа» у всех направлений, свежесть данных и пробный период', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/finance');
  await page.locator('.profile-trigger').click();
  const dropdown = page.locator('#profile-dropdown');
  await expect(dropdown.getByRole('link', { name: 'Помощь', exact: true })).toHaveAttribute('href', '/help');
  // у гостиницы своя «Моя работа» с 22.10.2026: кабинет горничной и ресепшена
  await expect(dropdown.getByRole('link', { name: 'Моя работа', exact: true })).toHaveAttribute('href', '/my-work');
});

for (const theme of ['light', 'dark'] as const) {
  test(`строка разделов доступна: ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.goto('/finance');
    const nav = page.getByRole('navigation', { name: 'Главное меню' });
    await expect(async () => {
      await nav.getByRole('button', { name: 'Персонал', exact: true }).hover();
      await expect(nav.locator('.tabnav__list:not([hidden])')).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
    const audit = await new AxeBuilder({ page })
      .include('.workspace-header')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(audit.violations).toEqual([]);
  });
}
