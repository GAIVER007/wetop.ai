import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { FIXTURE_API, expect, test } from './fixtures';

const sizes = [
  { width: 1536, height: 1024 },
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 320, height: 800 },
] as const;

test.beforeEach(async ({ request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
  const seeded = await request.post(`${FIXTURE_API}/__test/design-seed`);
  expect(seeded.ok()).toBe(true);
});

test('UI4.2-B: один период, компактная шапка и работающая сетка во всех размерах и темах', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const directory = resolve('reports/ui4-2-b-2026-10-12');
  if (process.env.UI_CAPTURE === '1') mkdirSync(directory, { recursive: true });
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme });
    for (const { width, height } of sizes) {
      await page.setViewportSize({ width, height });
      await page.goto('/chessboard');
      await expect(page.getByRole('heading', { name: 'Календарь', level: 1 })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Новая бронь', exact: true })).toBeVisible();
      await expect(page.getByTestId('board-period-button')).toHaveCount(1);
      await expect(page.getByTestId('board-length-button')).toHaveCount(0);
      await expect(page.getByRole('navigation', { name: 'Масштаб календаря' })).toHaveCount(0);
      await expect(page.getByTestId('date-col')).toHaveCount(7);
      await expect(page.getByLabel('Поиск в календаре')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Фильтры', exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width + 1,
      );
      if (process.env.UI_CAPTURE === '1') {
        await page.screenshot({ path: resolve(directory, `board-${width}-${theme}.png`) });
        if (width === 1536 || width === 390) {
          await page.getByTestId('board-period-button').click();
          await expect(page.getByRole('button', { name: 'Применить', exact: true })).toBeVisible();
          await page.screenshot({ path: resolve(directory, `period-open-${width}-${theme}.png`) });
        }
      }
    }
  }
});

test('UI4.2-B: пресеты и ручной диапазон задают точное число колонок', async ({ page }) => {
  await page.goto('/chessboard');
  for (const [preset, count] of [
    ['Сегодня', 1],
    ['7 дней', 7],
    ['14 дней', 14],
    ['30 дней', 30],
  ] as const) {
    await page.getByTestId('board-period-button').click();
    await page
      .locator('.board-nav .date-range')
      .getByRole('button', { name: preset, exact: true })
      .click();
    await page.getByRole('button', { name: 'Применить', exact: true }).click();
    await expect(page.getByTestId('date-col')).toHaveCount(count);
  }
  await page.getByTestId('board-period-button').click();
  await page.getByLabel('Период: с').fill('2028-02-10');
  await page.getByLabel('Период: по').fill('2028-02-20');
  await page.getByRole('button', { name: 'Применить', exact: true }).click();
  await expect(page.getByTestId('date-col')).toHaveCount(11);
  await expect(page.getByTestId('date-col').first()).toHaveAttribute('data-date', '2028-02-10');
});
