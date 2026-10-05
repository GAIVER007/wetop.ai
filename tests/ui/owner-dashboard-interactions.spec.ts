import AxeBuilder from '@axe-core/playwright';
import { FIXTURE_API, expect, test } from './fixtures';

test.beforeEach(async ({ request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
});

test('forecast details expose availability and open the selected calendar day', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/today');
  const trigger = page.getByRole('button', { name: 'Загрузка по дням', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Ближайшие 7 дней', exact: true });
  await expect(dialog).toBeVisible();
  const days = dialog.getByRole('link');
  await expect(days).toHaveCount(7);
  expect((await days.first().boundingBox())!.height).toBeGreaterThanOrEqual(64);
  await expect(days.first()).toContainText('Свободно');
  const href = await days.nth(1).getAttribute('href');
  expect(href).toMatch(/^\/chessboard\?from=(\d{4}-\d{2}-\d{2})&to=\1$/);
  await page.screenshot({
    caret: 'initial',
    path: 'reports/owner-home-v3-2026-10-05/forecast.png',
  });
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.press('Enter');
  await days.nth(1).click();
  await expect(page).toHaveURL(new RegExp(href!.replace('?', '\\?')));
});

test('finance can recover in place after a temporary API failure', async ({ page, request }) => {
  await request.post(`${FIXTURE_API}/__test/control`, { data: { failPath: '/desk/dashboard' } });
  await page.goto('/today');
  const finance = page.getByRole('region', { name: 'Финансы за выбранный период' });
  await expect(
    finance.getByText('Финансовая аналитика не загрузилась.', { exact: false }),
  ).toBeVisible();
  await request.post(`${FIXTURE_API}/__test/control`, { data: { failPath: '' } });
  await finance.getByRole('button', { name: 'Повторить', exact: true }).click();
  await expect(finance.getByTestId('owner-paid')).toBeVisible();
  await expect(finance.getByRole('button', { name: 'Повторить', exact: true })).toHaveCount(0);
});

test('unavailable inventory stays explicit and can be retried', async ({ page, request }) => {
  await request.post(`${FIXTURE_API}/__test/control`, { data: { failPath: '/chessboard' } });
  await page.goto('/today');
  const load = page.getByRole('region', { name: 'Загрузка сегодня', exact: true });
  await expect(load.getByTestId('c-occupancy')).toHaveText('Нет данных');
  await request.post(`${FIXTURE_API}/__test/control`, { data: { failPath: '' } });
  await load.getByRole('button', { name: 'Повторить', exact: true }).click();
  await expect(load.getByTestId('c-occupancy')).not.toHaveText('Нет данных');
});

test('slow inventory keeps daily events usable and shows a stable loading card', async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/today');
  const ready = await page
    .getByRole('region', { name: 'Загрузка сегодня', exact: true })
    .boundingBox();
  await request.post(`${FIXTURE_API}/__test/control`, {
    data: { delayPath: '/chessboard', delayMs: 6000 },
  });
  await page.goto('/today', { waitUntil: 'commit' });
  const loading = page.getByRole('status', { name: 'Загружаем загрузку…', exact: true });
  await expect(loading).toBeVisible({ timeout: 2000 });
  const box = await loading.locator('..').boundingBox();
  expect(Math.abs(box!.height - ready!.height)).toBeLessThan(24);
  await expect(page.getByRole('region', { name: 'Сегодня', exact: true })).toBeVisible({
    timeout: 2000,
  });
  await page.screenshot({ caret: 'initial', path: 'reports/owner-home-v3-2026-10-05/loading.png' });
  await expect(page.getByTestId('c-occupancy')).toBeVisible();
});

for (const theme of ['light', 'dark'] as const) {
  test(`forecast drawer stays accessible at 320 px in ${theme} theme`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.goto('/today');
    await page.getByRole('button', { name: 'Загрузка по дням', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Ближайшие 7 дней', exact: true });
    await expect(dialog).toBeVisible();
    for (const link of await dialog.getByRole('link').all()) {
      expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(64);
    }
    expect(await dialog.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    const audit = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(
      audit.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
    ).toEqual([]);
    await page.screenshot({
      caret: 'initial',
      path: `reports/owner-home-v3-2026-10-05/forecast-${theme}-320.png`,
    });
  });
}

test('weekly dashboard opens a calendar day directly', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/today');
  const days = page.getByTestId('owner-outlook-chart').getByRole('link');
  await expect(days).toHaveCount(7);
  const day = days.nth(2);
  const href = await day.getAttribute('href');
  expect(href).toMatch(/^\/chessboard\?from=(\d{4}-\d{2}-\d{2})&to=\1$/);
  await day.focus();
  await day.press('Enter');
  await expect(page).toHaveURL(new RegExp(href!.replace('?', '\\?')));
});

test('compact owner overview fits a 360 by 800 phone', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/today');
  await expect(page.getByTestId('owner-paid')).toBeVisible();
  await expect(page.getByTestId('owner-outlook-chart').getByRole('link')).toHaveCount(7);
  const bottom = await page
    .getByTestId('owner-dashboard')
    .evaluate((el) => el.getBoundingClientRect().bottom);
  expect(bottom).toBeLessThanOrEqual(704);
  await page.screenshot({ path: 'reports/owner-home-v4-mobile-360.png' });
});
