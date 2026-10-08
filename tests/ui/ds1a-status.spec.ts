import { mkdirSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { FIXTURE_API, expect, test, devNoise } from './fixtures';

const out = 'reports/mv8-5-ds1a-2026-10-08/screens';
for (const width of [1440, 390]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`DS1a shared status words ${width} ${theme}`, async ({ page, request }) => {
      test.setTimeout(180_000);
      await request.post(`${FIXTURE_API}/__test/reset`);
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      mkdirSync(out, { recursive: true });
      const errors: string[] = [];
      page.on('pageerror', (error) => {
        if (!devNoise.test(error.message)) errors.push(error.message);
      });
      const capture = async (name: string) => {
        await page.waitForLoadState('networkidle');
        await page.screenshot({
          path: `${out}/${name}-${width}-${theme}.png`,
          fullPage: true,
          caret: 'initial',
        });
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          width + 1,
        );
      };
      await page.goto('/chessboard');
      const stay = page.locator('td[data-status="CHECKED_IN"] [data-testid="stay-cell"]').first();
      await expect(stay).toBeVisible();
      const number = await stay.getAttribute('data-number');
      await capture('chessboard');
      await stay.click();
      await expect(page.getByTestId('stay-preview')).toContainText('Проживает');
      await capture('stay-preview');
      await page.keyboard.press('Escape');
      await page.goto(`/reservations/${number}`);
      await expect(
        page
          .getByRole('main')
          .locator('.badge')
          .filter({ hasText: /^Проживает$/ })
          .first(),
      ).toBeVisible();
      await capture('reservation');
      await page.goto('/reservations');
      await expect(
        page
          .getByTestId('reservations-table')
          .locator('.badge')
          .filter({ hasText: /^Проживает$/ })
          .first(),
      ).toBeVisible();
      await expect(
        page.getByLabel('Статус брони').locator('option[value="CHECKED_OUT"]'),
      ).toContainText('Выехавшие');
      await capture('reservations');
      await page.goto('/units/R01');
      await expect(page.getByTestId('housekeeping-panel')).toBeVisible();
      await capture('unit');
      await request.post(`${FIXTURE_API}/__test/control`, { data: { showcase: true } });
      await page.goto('/channels/events/ui-rev-new-2');
      await expect(page.getByTestId('revision-chain')).toBeVisible();
      await expect(
        page
          .getByRole('main')
          .locator('.badge')
          .filter({ hasText: /^Не подтверждена$/ })
          .first(),
      ).toBeVisible();
      await capture('channel-event');
      await page.goto('/design-system');
      const themeButton = page.getByRole('button', {
        name: theme === 'light' ? 'Только светлая' : 'Только тёмная',
        exact: true,
      });
      await themeButton.click();
      await expect(themeButton).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByTestId(`kit-${theme === 'light' ? 'dark' : 'light'}`)).toBeHidden();
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
      expect(errors).toEqual([]);
    });
  }
}
