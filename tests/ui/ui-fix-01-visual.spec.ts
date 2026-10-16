import { mkdirSync } from 'node:fs';
import { FIXTURE_API, test, expect } from './fixtures';
const phase = process.env.UI_FIX_01_VISUAL;
const routes = [
  '/team',
  '/platform/support/base',
  '/inventory',
  '/rooms/categories',
  '/chessboard',
  '/reservations/new',
  '/reservations/20260913-TEST1',
  '/units/R02',
  '/bar',
  '/bar/products',
  '/bar/operations',
  '/bar/receipts',
  '/bar/receipts/new',
  '/bar/suppliers',
  '/channels/sync',
  '/channels/events',
  '/help',
];
test.skip(!phase, 'Explicit UI-FIX-01 evidence capture only');
// Same 17 screens and geometry checks as the first capture attempt, split per route so cold
// compilation does not consume one aggregate 3-minute timer. No assertion has been removed.
for (const theme of ['light', 'dark'] as const)
  for (const width of [1440, 390])
    for (const route of routes) {
      test(`UI-FIX-01 ${theme} ${width} ${route}`, async ({ page, request }) => {
        const out = `reports/ui-fix-01-2026-10-12/${phase}`;
        mkdirSync(out, { recursive: true });
        await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
        await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
        await request.post(`${FIXTURE_API}/__test/reset`);
        await page.goto('/auth/fallback');
        await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
        await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
        await page.getByRole('button', { name: 'Войти', exact: true }).click();
        await page.waitForURL('**/today');
        if (route === '/team') {
          await request.post(`${FIXTURE_API}/__test/control`, {
            data: { failPath: '/auth/access-structure', failStatus: 503 },
          });
          await page.goto(route);
        } else if (route === '/platform/support/base') {
          await request.post(`${FIXTURE_API}/__test/control`, { data: { platformAdmin: true } });
          await page.goto('/platform/support/base?status=DRAFT');
          await page
            .getByTestId('kb-catalog')
            .getByRole('link', { name: /только чтение/ })
            .click();
          await page.getByLabel('Текст знания').fill('Synthetic unsaved version B');
        } else {
          await request.post(`${FIXTURE_API}/__test/control`, { data: { orgTrialDays: 'ended' } });
          await page.goto(route);
        }
        await expect(page.getByRole('main').filter({ visible: true })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        await page.screenshot({
          path: `${out}/${route.slice(1).replaceAll('/', '_')}-${width}-${theme}.png`,
          fullPage: true,
        });
      });
    }
