import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { FIXTURE_API, expect, test } from './fixtures';

test.beforeEach(async ({ request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
  await request.post(`${FIXTURE_API}/__test/design-seed`);
});

test('UI4.2-C: четыре основных показателя, остальные доступны в деталях', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/chessboard');
  const panel = page.getByRole('group', { name: 'Сегодня на объекте' });
  await expect(panel.locator('.board-kpi')).toHaveCount(4);
  await expect(panel.getByTestId('day-occupancy')).toBeVisible();
  await expect(panel.getByTestId('day-arrivals')).toBeVisible();
  await expect(panel.getByTestId('day-departures')).toBeVisible();
  await expect(panel.getByTestId('day-attention')).toBeVisible();
  await panel.getByText('Другие показатели', { exact: true }).click();
  await expect(panel.getByTestId('day-free')).toBeVisible();
  await expect(panel.getByTestId('day-dirty')).toBeVisible();
});

test('UI4.2-C: плотная сетка, категории и четыре KPI на desktop и mobile в двух темах', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const directory = resolve('reports/ui4-2-c-2026-10-12');
  if (process.env.UI_CAPTURE === '1') mkdirSync(directory, { recursive: true });
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme });
    for (const { width, height } of [
      { width: 1536, height: 1024 },
      { width: 1440, height: 900 },
      { width: 1024, height: 768 },
      { width: 768, height: 1024 },
      { width: 390, height: 844 },
      { width: 320, height: 800 },
    ]) {
      await page.setViewportSize({ width, height });
      await page.goto('/chessboard');
      await expect(page.locator('.board-kpi')).toHaveCount(4);
      await expect(page.getByTestId('unit-row').first()).toBeVisible();
      const category = page.getByTestId('category-row').first();
      await expect(category).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width + 1,
      );
      if (process.env.UI_CAPTURE === '1') {
        await page.screenshot({ path: resolve(directory, `board-${width}-${theme}.png`) });
      }
    }
  }
  const first = page.getByTestId('category-row').first();
  await first.locator('.board-group-toggle').click();
  await expect(first.locator('.board-group-toggle')).toHaveAttribute('aria-expanded', 'false');
  await first.locator('.board-group-toggle').click();
  await expect(first.locator('.board-group-toggle')).toHaveAttribute('aria-expanded', 'true');
});
