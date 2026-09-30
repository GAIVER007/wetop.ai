import { expect, test } from './fixtures';

test.beforeEach(async ({ request }) => {
  await request.post('http://127.0.0.1:4311/__test/reset');
});
test('owner dashboard shows financial and operational summary without desktop scrolling', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/today');
  await expect(page.getByTestId('owner-dashboard')).toBeVisible();
  await expect(page.getByTestId('owner-paid')).toBeVisible();
  await expect(page.getByTestId('owner-expenses')).toContainText('Не подключён');
  await expect(page.getByTestId('owner-guests')).toBeVisible();
  await page.screenshot({ path: 'reports/owner-dashboard-desktop.png', fullPage: true });
  expect(
    await page.evaluate('document.documentElement.scrollHeight - innerHeight'),
  ).toBeLessThanOrEqual(2);
  await page.screenshot({ path: 'reports/owner-dashboard-desktop.png', fullPage: true });
  await page
    .getByTestId('owner-dashboard')
    .getByRole('button', { name: 'Работа с гостями', exact: true })
    .click();
  await expect(page.getByRole('dialog', { name: 'Работа с гостями', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Работа с гостями', exact: true })).toBeHidden();
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

test('owner dashboard keeps operations visible when finance fails', async ({ page, request }) => {
  await request.post('http://127.0.0.1:4311/__test/control', {
    data: { failPath: '/desk/dashboard' },
  });
  await page.goto('/today');
  await expect(
    page.getByText('Финансовая аналитика не загрузилась.', { exact: false }),
  ).toBeVisible();
  await expect(page.getByTestId('owner-guests')).toBeVisible();
  await expect(page.getByTestId('owner-paid')).toHaveCount(0);
});

test('owner dashboard dark desktop and mobile remain usable', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/today?period=week');
  await expect(page.getByTestId('owner-paid')).toBeVisible();
  expect(
    await page.evaluate('document.documentElement.scrollHeight-innerHeight'),
  ).toBeLessThanOrEqual(2);
  await page.screenshot({ path: 'reports/owner-dashboard-2026-09-30/dashboard-dark.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Требуют внимания', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Требуют внимания', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.screenshot({
    path: 'reports/owner-dashboard-2026-09-30/dashboard-mobile.png',
    fullPage: true,
  });
});
