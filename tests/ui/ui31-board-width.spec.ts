import { FIXTURE_API, expect, test } from './fixtures';

test('UI3.1: сетка занимает ширину без постоянной сводки дня', async ({ page, request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
  await page.goto('/chessboard');
  const stage = page.locator('.board-stage');
  await expect(stage).toBeVisible();
  await expect(page.locator('.calendar-day-summary')).toHaveCount(0);
  await expect(stage).not.toHaveAttribute('data-docked', 'true');
  const grid = page.getByRole('region', { name: 'Календарь по дням', exact: true });
  const available = await stage.boundingBox();
  const actual = await grid.boundingBox();
  expect(actual!.width).toBeGreaterThan(available!.width - 4);
  for (const width of [1440, 1536, 768, 390, 320]) {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      await expect(page.locator('html')).toHaveAttribute('data-theme', colorScheme);
      await expect(page.locator('.calendar-day-summary')).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await page.screenshot({ path: `reports/ui3-1-fixes-2026-10-11/board-${colorScheme}-${width}.png` });
    }
  }
});
