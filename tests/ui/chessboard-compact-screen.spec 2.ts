import { test, expect } from './fixtures';

test.beforeEach(async ({ request }) => {
  await request.post('http://127.0.0.1:4311/__test/reset');
});

test('compact board: notebook viewport and remembered category overview', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/chessboard?from=2026-09-14&to=2026-09-20');
  await expect(page.getByTestId('unit-row')).toHaveCount(88);
  const board = page.getByRole('region', { name: 'Шахматка по дням' });
  const box = await board.boundingBox();
  expect(box!.height).toBeGreaterThan(400);
  expect(await page.evaluate('document.documentElement.scrollHeight <= innerHeight + 1')).toBe(true);
  await page.getByRole('button', { name: 'Свернуть категории', exact: true }).click();
  await expect(page.getByTestId('unit-row')).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('unit-row')).toHaveCount(0);
  await page.getByRole('button', { name: 'Развернуть категории', exact: true }).click();
  await expect(page.getByTestId('unit-row')).toHaveCount(88);
  await page.screenshot({ path: 'reports/chessboard-compact-screen.png' });
});
