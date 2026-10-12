import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { FIXTURE_API, expect, test } from './fixtures';

test.beforeEach(async ({ request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
  await request.post(`${FIXTURE_API}/__test/design-seed`);
});

test('UI4.2-D: на 320 px поиск, фильтры и разворот в одной строке, предупреждения видны', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/chessboard');
  const search = page.getByLabel('Поиск в календаре');
  const filters = page.getByRole('button', { name: 'Фильтры', exact: true });
  const expand = page.getByRole('button', { name: 'На весь экран' });
  const [searchBox, filterBox, expandBox] = await Promise.all([
    search.boundingBox(),
    filters.boundingBox(),
    expand.boundingBox(),
  ]);
  expect(Math.abs(searchBox!.y - filterBox!.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(searchBox!.y - expandBox!.y)).toBeLessThanOrEqual(1);
  await expect(page.getByTestId('review-callout')).toBeVisible();
  await expect(page.getByTestId('unassigned-stays')).toBeVisible();
  const grid = await page.locator('.board-wrap').boundingBox();
  expect(grid!.y).toBeLessThanOrEqual(710);
});

test('UI4.2-D: снимки мобильной светлой и тёмной шахматки с настоящими предупреждениями', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const directory = resolve('reports/ui4-2-d-2026-10-12');
  if (process.env.UI_CAPTURE === '1') mkdirSync(directory, { recursive: true });
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme });
    for (const { width, height } of [
      { width: 390, height: 844 },
      { width: 320, height: 800 },
    ]) {
      await page.setViewportSize({ width, height });
      await page.goto('/chessboard');
      await expect(page.getByTestId('board-period-button')).toBeVisible();
      await expect(page.locator('.board-kpi')).toHaveCount(4);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width + 1,
      );
      if (process.env.UI_CAPTURE === '1') {
        await page.screenshot({ path: resolve(directory, `board-${width}-${theme}.png`) });
      }
    }
  }
});
