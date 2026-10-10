import { FIXTURE_API, expect, test } from './fixtures';

/* Блоки владельца на едином экране «Финансы»: загрузка, деньги кассы и события дня
   (plans/finance-home-merge-2026-10-09.md; прежняя компактная Главная владельца). */
const fixture = FIXTURE_API;
const SHOTS = 'reports/finance-home-merge-2026-10-09';

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});
test('owner blocks: compact metrics and operational widgets on finance', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/finance');
  const main = page.getByRole('main');
  // блок «Деньги» с заглушками не переехал: деньги показывает сводка кассы
  for (const id of ['owner-net-cash', 'owner-refunds', 'owner-paid', 'owner-expenses'])
    await expect(main.getByTestId(id)).toHaveCount(0);
  await expect(main.getByTestId('cash-summary')).toBeVisible();
  await expect(main.getByTestId('cash-period-income')).toBeVisible();
  await expect(main.getByTestId('c-occupancy')).toBeVisible();
  for (const name of ['Загрузка на сегодня', 'Гости сегодня', 'Состояние номеров'])
    await expect(main.getByRole('article', { name })).toHaveCount(0);
  await expect(main.getByRole('link', { name: /Новая бронь/ })).toHaveCount(0);
  await expect(main.getByRole('link', { name: 'Все филиалы' })).toHaveCount(0);
  await expect(main.getByRole('region', { name: 'Сегодня', exact: true })).toBeVisible();
  // Деньги по умолчанию за месяц, виджеты дня показывают сегодня.
  await expect(
    page
      .getByRole('navigation', { name: 'Период обзора', exact: true })
      .getByRole('link', { name: 'Месяц', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await page.screenshot({
    caret: 'initial',
    path: `${SHOTS}/desktop.png`,
    fullPage: true,
  });
});
test('period changes through cash presets and mobile retains content', async ({ page }) => {
  await page.goto('/finance');
  await page.getByRole('link', { name: 'Неделя', exact: true }).click();
  await expect(page).toHaveURL(/from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}/);
  await expect(page.getByTestId('cash-period-income')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate('document.documentElement.scrollWidth-innerWidth'),
  ).toBeLessThanOrEqual(1);
});

test('attention and cash stay available when dashboard API fails', async ({ page, request }) => {
  await request.post(`${fixture}/__test/control`, {
    data: { failPath: '/desk/dashboard' },
  });
  await page.goto('/finance');
  await expect(page.getByText('Прогноз загрузки недоступен', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Все задачи', exact: true })).toBeVisible();
  await expect(page.getByTestId('cash-summary')).toBeVisible();
});

test('owner blocks dark desktop and mobile remain usable', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/finance');
  await expect(page.getByTestId('cash-period-income')).toBeVisible();
  await page.screenshot({
    caret: 'initial',
    path: `${SHOTS}/desktop-dark.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  // На телефоне первый экран начинается с плиток показателей.
  await expect(page.getByTestId('biz-revenue')).toBeInViewport();
  await page.getByRole('button', { name: 'Все задачи', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Требуют внимания', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.reload();
  await page.screenshot({
    caret: 'initial',
    path: `${SHOTS}/mobile-dark.png`,
    fullPage: true,
  });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.reload();
  await page.screenshot({
    caret: 'initial',
    path: `${SHOTS}/mobile.png`,
    fullPage: true,
  });
});

test('owner mobile summary fits the first screen and omits removed metrics', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/finance');
  await expect(page.getByTestId('cash-period-income')).toContainText('₸');
  for (const id of ['owner-refunds', 'owner-cash', 'owner-total'])
    await expect(page.getByTestId(id)).toHaveCount(0);
  await expect(page.getByTestId('owner-outlook-chart')).toBeVisible();
  // Первый экран телефона начинается с показателей; деньги ниже, достижимы прокруткой.
  await expect(page.getByTestId('biz-revenue')).toBeInViewport();
  await expect(page.getByTestId('cash-summary')).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
  ).toBeLessThanOrEqual(1);
  await page.screenshot({ caret: 'initial', path: `${SHOTS}/mobile.png` });
});

test('owner summary stays usable at narrow widths and custom dates remain accessible', async ({
  page,
}) => {
  await page.goto('/finance');
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    ).toBeLessThanOrEqual(1);
    await expect(page.getByTestId('cash-period-income')).toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel('Период: с', { exact: true }).fill('2026-10-01');
  await page.getByLabel('Период: по', { exact: true }).fill('2026-10-07');
  await page.getByRole('button', { name: 'Показать', exact: true }).click();
  await expect(page).toHaveURL(/from=2026-10-01&to=2026-10-07/);
  await expect(page.getByTestId('cash-period-income')).toBeVisible();
});

test('approved owner concept groups forecast with occupancy and matches attention count', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/finance');
  const load = page.getByRole('region', { name: 'Загрузка и операционные показатели' });
  await expect(load.getByTestId('owner-outlook-chart')).toBeVisible();
  await expect(load.getByTestId('c-occupancy')).toBeVisible();
  const badge = page.getByTestId('owner-attention-count');
  await expect(badge).toBeVisible();
  const count = await badge.innerText();
  await page.getByRole('button', { name: 'Все задачи', exact: true }).click();
  await expect(page.locator('#day-attention .attention-count')).toHaveText(count);
});
