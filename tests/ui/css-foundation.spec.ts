import AxeBuilder from '@axe-core/playwright';
import { FIXTURE_API, expect, test } from './fixtures';

const shots = process.env.VISUAL_REPORT_DIR || 'reports/mv8-5-ds0b-2026-10-07/current';
const screens = [
  ['today', '/today', 'owner-paid'],
  ['chessboard', '/chessboard?view=week', 'chessboard'],
  ['reservations', '/reservations', 'reservations-table'],
  ['finance', '/finance', 'cash-summary'],
] as const;

for (const width of [1440, 390]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`CSS foundation hospitality ${width} ${theme}`, async ({ page, request }) => {
      test.setTimeout(180_000);
      expect((await request.post(`${FIXTURE_API}/__test/reset`)).ok()).toBe(true);
      expect(
        (await request.post(`${FIXTURE_API}/__test/control`, { data: { showcase: true } })).ok(),
      ).toBe(true);
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      for (const [name, path, ready] of screens) {
        await page.goto(path);
        await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible();
        await expect(page.getByTestId(ready)).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await expect(page.getByRole('main')).not.toContainText('Филиал недоступен');
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
        ).toBeLessThanOrEqual(1);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
        await page.screenshot({
          path: `${shots}/hospitality/${name}-${width}-${theme}.png`,
          fullPage: true,
          animations: 'disabled',
        });
      }
    });
  }
}
