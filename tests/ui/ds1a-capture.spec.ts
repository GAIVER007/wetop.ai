import { mkdirSync } from 'node:fs';
import { FIXTURE_API, test } from './fixtures';

/**
 * MV8.5 DS1a: снимки «до» и «после» переноса слов статусов в реестры `lib/status`. Не проверка, а
 * инструмент сравнения для ревью владельца: работает только с `DS1A_CAPTURE=before|after`, в обычном
 * прогоне набора пропускается. Салон и ресторан снимают свои наборы (`tests/beauty-ui`, `tests/food-ui`).
 */
const phase = process.env['DS1A_CAPTURE'];
const out = `reports/mv8-5-ds1a-2026-10-08/${phase}`;

const SCREENS: Array<{ name: string; route: string; open?: string }> = [
  { name: 'chessboard', route: '/chessboard' },
  {
    name: 'stay-preview',
    route: '/chessboard',
    open: 'td[data-status="CHECKED_IN"] [data-testid="stay-cell"]',
  },
  { name: 'reservations', route: '/reservations' },
  { name: 'reservation-card', route: '/reservations/20260913-TEST1' },
  { name: 'unit-card', route: '/units/R01' },
  { name: 'inventory', route: '/inventory' },
  { name: 'channel-event', route: '/channels/events/ui-rev-failed' },
];

test.skip(!phase, 'только для сравнения DS1a: DS1A_CAPTURE=before|after');

test.beforeEach(async ({ request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
});

for (const theme of ['light', 'dark'] as const) {
  for (const width of [1440, 390] as const) {
    test(`статусы гостиницы ${theme} ${width}`, async ({ page }) => {
      test.setTimeout(240_000);
      mkdirSync(out, { recursive: true });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      for (const s of SCREENS) {
        await page.goto(s.route).catch(() => undefined);
        await page.waitForLoadState('networkidle').catch(() => undefined);
        if (s.open) {
          await page.locator(s.open).first().click();
          await page.getByTestId('stay-preview').waitFor();
        }
        await page.mouse.move(0, 0);
        await page.screenshot({ path: `${out}/${s.name}-${width}-${theme}.png` });
      }
    });
  }
}
