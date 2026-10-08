import { mkdirSync } from 'node:fs';
import { FIXTURE_API, test, type Page } from './fixtures';

/**
 * MV8.5 DS1c: снимки «до» и «после» экранов-представителей общих примитивов. Не проверка, а инструмент
 * сравнения для ревью владельца: работает только с `DS1C_CAPTURE=before|after`, в обычном прогоне
 * набора пропускается. Салон и ресторан снимают свои наборы (`tests/beauty-ui`, `tests/food-ui`).
 */
const phase = process.env['DS1C_CAPTURE'];
const out = `reports/mv8-5-ds1c-2026-10-08/${phase}`;

const SCREENS: Array<{ name: string; route: string; open?: (page: Page) => Promise<void> }> = [
  { name: 'market', route: '/market' },
  { name: 'website-analytics', route: '/website/analytics' },
  { name: 'reservations-period', route: '/reservations?from=2026-09-10&to=2026-09-24' },
  {
    name: 'task-drawer',
    route: '/tasks',
    open: async (page) => {
      await page.getByTestId('task-new').click({ timeout: 30_000 });
      await page.getByRole('dialog').waitFor({ timeout: 30_000 });
    },
  },
  {
    name: 'route-drawer-new',
    route: '/reservations',
    open: async (page) => {
      await page.getByRole('link', { name: 'Новая бронь' }).first().click({ timeout: 30_000 });
      await page.getByRole('dialog').waitFor({ timeout: 60_000 });
    },
  },
];
/** секции страницы компонентов, которые трогает DS1c; новых до среза нет, они пропускаются */
const KIT = [
  'button',
  'input',
  'stat',
  'table',
  'states',
  'sharebar',
  'form-grid',
  'period-picker',
  'date-bar',
  'overlay-size',
];

test.skip(!phase, 'только для сравнения DS1c: DS1C_CAPTURE=before|after');

test.beforeEach(async ({ request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
});

for (const theme of ['light', 'dark'] as const) {
  for (const width of [1440, 390] as const) {
    test(`представители DS1c ${theme} ${width}`, async ({ page }) => {
      test.setTimeout(300_000);
      mkdirSync(out, { recursive: true });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      for (const s of SCREENS) {
        await page.goto(s.route).catch(() => undefined);
        await page.waitForLoadState('networkidle').catch(() => undefined);
        if (s.open) await s.open(page).catch(() => undefined);
        await page.waitForTimeout(400);
        await page.mouse.move(0, 0);
        await page.screenshot({ path: `${out}/${s.name}-${width}-${theme}.png` });
      }
      // секции страницы компонентов: только на компьютере, на телефоне они повторяют те же состояния
      if (width !== 1440) return;
      await page.goto('/design-system');
      await page.waitForLoadState('networkidle').catch(() => undefined);
      const block = page.getByTestId(`kit-${theme}`);
      for (const id of KIT) {
        const section = block.locator(`section[data-component="${id}"]`);
        if ((await section.count()) === 0) continue;
        await section.scrollIntoViewIfNeeded();
        await page.mouse.move(0, 0);
        await section.screenshot({ path: `${out}/kit-${id}-${width}-${theme}.png` });
      }
    });
  }
}
