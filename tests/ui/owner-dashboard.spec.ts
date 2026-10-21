import { FIXTURE_API, expect, test } from './fixtures';

/* Блоки владельца на «Главной» `/today` (ADR-180, 13.10.2026): загрузка, события дня и внимание. */
const fixture = FIXTURE_API;
const SHOTS = 'reports/finance-home-merge-2026-10-09';

test.beforeEach(async ({ request, page }) => {
  await page.context().addCookies([
    {
      name: 'wetop_scope',
      value: encodeURIComponent(
        'business=33333333-3333-4333-8333-333333333333;location=22222222-2222-4222-8222-222222222222',
      ),
      domain: '127.0.0.1',
      path: '/',
    },
  ]);
  await request.post(`${fixture}/__test/reset`);
  await request.post(`${fixture}/__test/control`, { data: { signedIn: true } });
  await page
    .context()
    .addCookies([{ name: 'wetop_session', value: 'ui-session-1', domain: '127.0.0.1', path: '/' }]);
});
test('owner blocks: operational widgets on home, money on finance (ADR-180)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/today');
  const main = page.getByRole('main');
  // блок «Деньги» с заглушками не вернулся
  for (const id of ['owner-net-cash', 'owner-refunds', 'owner-paid', 'owner-expenses'])
    await expect(main.getByTestId(id)).toHaveCount(0);
  await expect(main.getByTestId('c-occupancy')).toBeVisible();
  for (const name of ['Загрузка на сегодня', 'Гости сегодня', 'Состояние номеров'])
    await expect(main.getByRole('article', { name })).toHaveCount(0);
  await expect(main.getByRole('link', { name: /Новая бронь/ })).toHaveCount(0);
  await expect(main.getByRole('link', { name: 'Все филиалы' })).toHaveCount(0);
  await expect(main.getByRole('region', { name: 'Сегодня', exact: true })).toBeVisible();
  await page.screenshot({
    caret: 'initial',
    path: `${SHOTS}/desktop.png`,
    fullPage: true,
  });
  // деньги на «Финансах»: сводка с возвратами отдельной строкой (ADR-176), месяц по умолчанию
  await page.goto('/finance');
  await expect(main.getByTestId('cash-summary')).toBeVisible();
  await expect(main.getByTestId('cash-period-income')).toBeVisible();
  await expect(
    page
      .getByRole('navigation', { name: 'Готовые периоды', exact: true })
      .getByRole('link', { name: 'Месяц', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
});
test('period changes through cash presets and mobile retains content', async ({ page }) => {
  await page.goto('/finance');
  await page
    .getByRole('navigation', { name: 'Готовые периоды', exact: true })
    .getByRole('link', { name: 'Неделя', exact: true })
    .click();
  await expect(page).toHaveURL(/from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}/);
  await expect(page.getByTestId('cash-period-income')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate('document.documentElement.scrollWidth-innerWidth'),
  ).toBeLessThanOrEqual(1);
});

test('attention stays available when dashboard API fails; cash on finance', async ({ page, request }) => {
  await request.post(`${fixture}/__test/control`, {
    data: { failPath: '/desk/dashboard' },
  });
  await page.goto('/today');
  await page.getByText('Прогноз загрузки', { exact: true }).click();
  await expect(page.getByText('Прогноз загрузки недоступен', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Все задачи', exact: true })).toBeVisible();
  await page.goto('/finance');
  await expect(page.getByTestId('cash-summary')).toBeVisible();
});

test('owner blocks dark desktop and mobile remain usable', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/today');
  await expect(page.getByTestId('c-occupancy')).toBeVisible();
  await page.screenshot({
    caret: 'initial',
    path: `${SHOTS}/desktop-dark.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  // На телефоне первый экран начинается с загрузки.
  await expect(page.getByTestId('c-occupancy')).toBeInViewport();
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
  await page.goto('/today');
  for (const id of ['owner-refunds', 'owner-cash', 'owner-total'])
    await expect(page.getByTestId(id)).toHaveCount(0);
  await page.getByText('Прогноз загрузки', { exact: true }).click();
  await expect(page.getByTestId('owner-outlook-chart')).toBeVisible();
  // Первый экран телефона начинается с загрузки
  await expect(page.getByTestId('c-occupancy')).toBeInViewport();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
  ).toBeLessThanOrEqual(1);
  await page.screenshot({ caret: 'initial', path: `${SHOTS}/mobile.png` });
  // деньги на «Финансах» (ADR-180): сводка с ₸ на месте
  await page.goto('/finance');
  await expect(page.getByTestId('cash-period-income')).toContainText('₸');
  await expect(page.getByTestId('cash-summary')).toBeVisible();
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
  const filters = page.locator('#finance-filters');
  await filters.getByLabel('Период: с', { exact: true }).fill('2026-10-01');
  await filters.getByLabel('Период: по', { exact: true }).fill('2026-10-07');
  await filters.getByRole('button', { name: 'Показать', exact: true }).click();
  await expect(page).toHaveURL(/from=2026-10-01&to=2026-10-07/);
  await expect(page.getByTestId('cash-period-income')).toBeVisible();
});

test('approved owner concept groups forecast with occupancy and matches attention count', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/today');
  const load = page.getByRole('region', { name: 'Загрузка и операционные показатели' });
  await load.getByText('Прогноз загрузки', { exact: true }).click();
  await expect(load.getByTestId('owner-outlook-chart')).toBeVisible();
  await expect(load.getByTestId('c-occupancy')).toBeVisible();
  const badge = page.getByTestId('owner-attention-count');
  await expect(badge).toBeVisible();
  const count = await badge.innerText();
  await page.getByRole('button', { name: 'Все задачи', exact: true }).click();
  await expect(page.locator('#day-attention .attention-count')).toHaveText(count);
});
