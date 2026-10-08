import { FIXTURE_API, test, expect } from './fixtures';

test.beforeEach(async ({ request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
});

test('calendar fills notebook screen with a side summary and frozen headings', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/chessboard');
  const grid = page.getByRole('region', { name: 'Календарь по дням' });
  await expect(page.getByTestId('unit-row')).toHaveCount(88);
  await expect(page.getByLabel('Вид строк календаря')).toHaveValue('compact');
  const box = (await grid.boundingBox())!;
  expect(box.height).toBeGreaterThan(460);
  const summary = (await page.getByRole('group', { name: 'Сегодня на объекте' }).boundingBox())!;
  expect(summary.x).toBeGreaterThanOrEqual(box.x + box.width);
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)).toBe(
    true,
  );
  await grid.evaluate((el) => {
    el.scrollTop = 1000;
  });
  const date = (await page.getByTestId('date-col').first().boundingBox())!;
  expect(date.y).toBeGreaterThanOrEqual(box.y - 1);
  expect(date.y).toBeLessThan(box.y + 2);
  await page.screenshot({ path: 'reports/calendar-workspace-notebook.png' });
});

test('expanded calendar restores the workspace with Escape and remembers density', async ({
  page,
}) => {
  await page.goto('/chessboard');
  const toggle = page.getByRole('button', { name: 'На весь экран', exact: true });
  await toggle.click();
  await expect(page.getByRole('button', { name: 'Выйти из полного экрана' })).toBeVisible();
  expect((await page.locator('main').boundingBox())!.y).toBe(0);
  await page.keyboard.press('Escape');
  await expect(toggle).toBeFocused();
  expect((await page.locator('main').boundingBox())!.y).toBeGreaterThan(0);
  await page.getByLabel('Вид строк календаря').selectOption('normal');
  await page.reload();
  await expect(page.getByLabel('Вид строк календаря')).toHaveValue('normal');
});

test('booking menu and keyboard remain usable in the expanded calendar', async ({ page }) => {
  await page.goto('/chessboard');
  await page.getByRole('button', { name: 'На весь экран', exact: true }).click();
  const firstLink = page.getByRole('main').getByRole('link').first();
  await firstLink.focus();
  await page.keyboard.press('Shift+Tab');
  expect(await page.getByRole('main').evaluate((el) => el.contains(document.activeElement))).toBe(
    true,
  );
  const date = await page.getByTestId('date-col').first().getAttribute('data-date');
  await page
    .locator(`[data-testid="unit-row"][data-unit-code="R07"] td[data-date="${date}"]`)
    .click();
  const menu = page.getByTestId('free-menu');
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('link', { name: 'Новая бронь', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(page.getByRole('button', { name: 'Выйти из полного экрана' })).toBeVisible();
});
