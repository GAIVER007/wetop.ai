import AxeBuilder from '@axe-core/playwright';
import { FIXTURE_API, expect, test } from './fixtures';
import type { Page, APIRequestContext } from '@playwright/test';

/**
 * Филиал салона в стойке (DATA_MODEL §19, срез B2; решения Q-254 и Q-256 от 03.10.2026, ADR-141).
 * Салон заводится той же формой, что гостиничный филиал, но объекта у него нет, поэтому гостиничные
 * разделы ему не показываются: они не нашли бы объект. Экран салона говорит прямо, чего в нём пока нет.
 */
const SNAPSHOTS = 'reports/beauty-b2-2026-10-03';

async function signIn(page: Page, request: APIRequestContext) {
  await request.post(`${FIXTURE_API}/__test/reset`);
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
}

/** Заводит салон формой филиалов и переключает стойку на него */
async function createAndOpenSalon(page: Page, name: string) {
  await page.goto('/branches');
  const main = page.getByRole('main');
  await main.locator('summary').filter({ hasText: 'Добавить филиал' }).click();
  await main.getByRole('radio', { name: 'Салон красоты или студия' }).check();
  await main.getByLabel('Название филиала').fill(name);
  await page.screenshot({ path: `${SNAPSHOTS}/branch-form-vertical.png`, fullPage: true });
  await main.getByRole('button', { name: 'Добавить филиал', exact: true }).click();
  await expect(main.getByRole('status')).toContainText('Салон создан');
  await page.reload();
  const card = main.locator('.branches-grid section').filter({ hasText: name });
  await expect(card).toContainText('Салон красоты');
  await expect(card).not.toContainText('номеров и коек');
  await main
    .locator('.branches-grid section')
    .filter({ hasText: name })
    .getByRole('button', { name: 'Открыть салон', exact: true })
    .click();
  // MV8: открытый салон начинает с общего рабочего экрана дня
  await page.waitForURL('**/today');
  await expect(page.getByTestId('beauty-today')).toBeVisible();
  await page.goto('/calendar');
}

test('салон заводится той же формой и открывается своим рабочим местом', async ({
  page,
  request,
}) => {
  await signIn(page, request);
  await createAndOpenSalon(page, 'Студия Айна');
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { level: 1 })).toHaveText('Календарь');
  await expect(main).toContainText('Студия Айна');
  await expect(main.getByRole('heading', { name: 'Пока нечего показывать' })).toBeVisible();
  await page.screenshot({ path: `${SNAPSHOTS}/salon-1440.png`, fullPage: true });
});

test('в салоне меню без гостиничных разделов: шахматки и тарифов у него нет', async ({
  page,
  request,
}) => {
  await signIn(page, request);
  const menu = page.locator('.topmenu');
  // до переключения это обычная гостиница
  await expect(menu.getByRole('link', { name: 'Календарь', exact: true })).toBeVisible();
  await createAndOpenSalon(page, 'Студия Айна');
  await expect(menu.getByRole('link', { name: 'Календарь', exact: true })).toBeVisible();
  for (const label of ['Главная', 'Брони', 'Номерной фонд', 'Гости']) {
    await expect(menu.getByRole('link', { name: label, exact: true })).toHaveCount(0);
  }
  // MV8: «Сегодня» салона на общем адресе
  await expect(menu.getByRole('link', { name: 'Сегодня', exact: true })).toHaveAttribute(
    'href',
    '/today',
  );
  await expect(menu.getByRole('link', { name: 'Календарь', exact: true })).toHaveAttribute(
    'href',
    '/calendar',
  );
  await expect(menu.getByRole('link', { name: 'Мастера', exact: true })).toHaveAttribute(
    'href',
    '/employees',
  );
});

test('карточка объекта показывает имя салона, а не «объект не загружен»', async ({
  page,
  request,
}) => {
  await signIn(page, request);
  await createAndOpenSalon(page, 'Студия Айна');
  const header = page.locator('.workspace-header');
  await expect(header).toContainText('Студия Айна');
  await expect(header).not.toContainText('Объект не загружен');
  await expect(header.getByTestId('data-freshness')).toHaveCount(0);
});

test('салон на телефоне: нижняя панель своих разделов, без горизонтальной прокрутки', async ({
  page,
  request,
}) => {
  await signIn(page, request);
  await createAndOpenSalon(page, 'Студия Айна');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toHaveText('Календарь');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `${SNAPSHOTS}/salon-390.png`, fullPage: true });
});

for (const theme of ['light', 'dark'] as const) {
  test(`салон доступен и в ${theme === 'light' ? 'светлой' : 'тёмной'} теме`, async ({
    page,
    request,
  }) => {
    await signIn(page, request);
    await createAndOpenSalon(page, 'Студия Айна');
    await page.emulateMedia({ colorScheme: theme });
    await page.reload();
    await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible();
    const audit = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(audit.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    await page.screenshot({ path: `${SNAPSHOTS}/salon-${theme}.png`, fullPage: true });
  });
}
