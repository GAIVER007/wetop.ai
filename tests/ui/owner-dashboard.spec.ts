import { FIXTURE_API, expect, test } from './fixtures';

/* Компактная Главная владельца: загрузка, деньги и события дня. */
const fixture = FIXTURE_API;

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});
test('owner dashboard: compact owner metrics and operational widgets', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/today');
  const main = page.getByRole('main');
  await expect(main.getByTestId('owner-net-cash')).toHaveCount(0);
  await expect(main.getByTestId('owner-refunds')).toHaveCount(0);
  await expect(main.getByTestId('owner-paid')).toBeVisible();
  await expect(main.getByTestId('c-occupancy')).toBeVisible();
  await expect(main.getByTestId('owner-expenses')).toContainText('Нет данных');
  for (const name of ['Загрузка на сегодня', 'Гости сегодня', 'Состояние номеров'])
    await expect(main.getByRole('article', { name })).toHaveCount(0);
  await expect(main.getByRole('link', { name: /Новая бронь/ })).toHaveCount(0);
  await expect(main.getByRole('link', { name: 'Все филиалы' })).toHaveCount(0);
  await expect(main.getByRole('link', { name: 'Брони сегодня' })).toBeVisible();
  // Деньги по умолчанию за месяц, виджеты загрузки показывают сегодня.
  await expect(page.getByRole('link', { name: 'Месяц', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await page.screenshot({
    caret: 'initial',
    path: 'reports/owner-home-v2-2026-10-05/desktop.png',
    fullPage: true,
  });
});
test('dashboard period changes and mobile retains content', async ({ page }) => {
  await page.goto('/today');
  await page.getByRole('link', { name: '7 дней', exact: true }).click();
  await expect(page).toHaveURL(/period=week/);
  await expect(page.getByTestId('owner-paid')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate('document.documentElement.scrollWidth-innerWidth'),
  ).toBeLessThanOrEqual(1);
});

test('owner dashboard keeps attention available when finance fails', async ({ page, request }) => {
  await request.post(`${fixture}/__test/control`, {
    data: { failPath: '/desk/dashboard' },
  });
  await page.goto('/today');
  await expect(
    page.getByText('Финансовая аналитика не загрузилась.', { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Требуют внимания', exact: true })).toBeVisible();
  await expect(page.getByTestId('owner-paid')).toHaveCount(0);
});

test('owner dashboard dark desktop and mobile remain usable', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/today?period=week');
  await expect(page.getByTestId('owner-paid')).toBeVisible();
  await page.screenshot({
    caret: 'initial',
    path: 'reports/owner-home-v2-2026-10-05/desktop-dark.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  // На телефоне основные показатели видны на первом экране.
  await expect(page.getByTestId('owner-paid')).toBeInViewport();
  await page.getByRole('button', { name: 'Требуют внимания', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Требуют внимания', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.reload();
  await page.screenshot({
    caret: 'initial',
    path: 'reports/owner-home-v2-2026-10-05/mobile-dark.png',
    fullPage: true,
  });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.reload();
  await page.screenshot({
    caret: 'initial',
    path: 'reports/owner-home-v2-2026-10-05/mobile.png',
    fullPage: true,
  });
});

test('owner mobile overview fits above navigation and omits refund metrics', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/today');
  await expect(page.getByTestId('owner-paid')).toContainText('Поступления');
  await expect(page.getByTestId('owner-refunds')).toHaveCount(0);
  await expect(page.getByTestId('owner-cash')).toContainText('Нет данных');
  await expect(page.getByTestId('owner-total')).toContainText('Нет данных');
  await expect(page.getByTestId('owner-outlook-chart')).toBeVisible();
  const bottom = await page
    .getByTestId('owner-dashboard')
    .evaluate((el) => el.getBoundingClientRect().bottom);
  const boxes = await page
    .locator('.page__head, .owner-load, .owner-finance, .owner-today, .owner-attention')
    .evaluateAll((els) =>
      els.map((el) => ({
        className: el.className,
        top: el.getBoundingClientRect().top,
        height: el.getBoundingClientRect().height,
      })),
    );
  expect(bottom, JSON.stringify(boxes)).toBeLessThanOrEqual(748);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
  ).toBeLessThanOrEqual(1);
  await page.screenshot({ caret: 'initial', path: 'reports/owner-home-v2-2026-10-05/mobile.png' });
});

test('owner overview stays usable at narrow widths and custom dates remain accessible', async ({
  page,
}) => {
  await page.goto('/today');
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    ).toBeLessThanOrEqual(1);
    await expect(page.getByTestId('owner-paid')).toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel('Свои даты', { exact: true }).click();
  await page.getByLabel('Начало периода').fill('2026-10-01');
  await page.getByLabel('Конец периода').fill('2026-10-07');
  await page.getByRole('button', { name: 'Показать', exact: true }).click();
  await expect(page).toHaveURL(/period=custom/);
  await expect(page.locator('[data-testid="owner-paid"]:visible')).toBeVisible();
});

test('approved owner concept groups forecast with occupancy and matches attention count', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/today');
  const load = page.getByRole('region', { name: 'Загрузка сегодня', exact: true });
  await expect(load.getByTestId('owner-outlook-chart')).toBeVisible();
  await expect(load.getByTestId('c-occupancy')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Найти гостя или бронь', exact: true }),
  ).toBeHidden();
  const badge = page.getByTestId('owner-attention-count');
  await expect(badge).toBeVisible();
  const count = await badge.innerText();
  await page.getByRole('button', { name: 'Требуют внимания', exact: true }).click();
  await expect(page.locator('#day-attention .attention-count')).toHaveText(count);
});
