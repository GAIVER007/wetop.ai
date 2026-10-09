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
  // Раздел мастеров: подпись «Мастера». Прежняя «Сотрудники» стояла в меню рядом с «Сотрудники и
  // доступ» (`/staff`, учётные записи) и читалась как тот же раздел, поэтому переименована 09.10.2026.
  await expect(menu.getByRole('link', { name: 'Мастера', exact: true })).toHaveAttribute(
    'href',
    '/employees',
  );
});

/**
 * DS2a (план mv8-5-ds2-shell-navigation §12): подсветка меню салона по его собственному реестру. Раньше `/team`,
 * `/beauty`, `/beauty/masters` и меню телефона у салона не подсвечивали ничего: правило смотрело в гостиничное меню.
 */
test('DS2a: меню салона подсвечивает свой раздел на компьютере и телефоне', async ({ page, request }) => {
  await signIn(page, request);
  await createAndOpenSalon(page, 'Студия Айна');
  const menu = page.locator('.topmenu');
  const current = menu.locator('[aria-current="page"]');
  await expect(current).toHaveText('Календарь');
  await expect(menu.getByRole('link', { name: 'Сотрудники и доступ', exact: true })).toHaveAttribute(
    'href',
    '/team',
  );
  for (const [path, label] of [
    ['/team', 'Сотрудники и доступ'],
    ['/staff', 'Сотрудники и доступ'],
    ['/beauty', 'Календарь'],
    ['/beauty/masters', 'Мастера'],
    ['/beauty/services', 'Услуги'],
  ] as const) {
    await page.goto(path);
    // `/staff` переводит на `/team` потоком: без ожидания адреса переход обрывает следующий `goto` (TESTING.md, 24.09)
    if (path === '/staff') await expect(page).toHaveURL(/\/team$/);
    await expect(current, path).toHaveCount(1);
    await expect(current, path).toHaveText(label);
  }
  // «График» уже в реестре, но вкладки у него до DS2b нет: не горит ничего
  await page.goto('/beauty/schedule');
  await expect(menu.locator('.has-current-page')).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  const bar = page.getByRole('navigation', { name: 'Основная навигация' });
  const more = bar.getByRole('button', { name: 'Ещё разделы' });
  await page.goto('/calendar');
  await expect(bar.locator('[aria-current="page"]')).toHaveText('Календарь');
  await expect(more).not.toHaveClass(/is-active/);
  await page.goto('/team');
  await expect(bar.locator('[aria-current="page"]')).toHaveCount(0);
  await expect(more).toHaveClass(/is-active/);
  await more.click();
  const drawer = page.getByRole('dialog', { name: 'Навигация', exact: true });
  await expect(drawer.locator('[aria-current="page"]')).toHaveText('Сотрудники и доступ');
  await expect(drawer.locator('.has-current-page')).toHaveCount(1);
  // анимация окна ещё идёт: сквозь полупрозрачную панель axe мерит контраст неверно (TESTING.md)
  await drawer.evaluate((el) =>
    Promise.all(
      (el.closest('.ui-overlay') ?? el).getAnimations({ subtree: true }).map((a) => a.finished.catch(() => {})),
    ),
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
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
