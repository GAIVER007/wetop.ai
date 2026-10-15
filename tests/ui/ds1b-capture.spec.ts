import { mkdirSync } from 'node:fs';
import { FIXTURE_API, test } from './fixtures';

/**
 * MV8.5 DS1b: снимки «до» и «после» общих вкладок, чипов, переключателя и полосы инструментов. Не
 * проверка, а инструмент сравнения для ревью владельца: работает только с `DS1B_CAPTURE=before|after`,
 * в обычном прогоне набора пропускается. Пять экранов, 1440 и 390, светлая и тёмная (не больше 20 снимков).
 */
const phase = process.env['DS1B_CAPTURE'];
const out = `reports/mv8-5-ds1b-2026-10-08/${phase}`;

const SCREENS: Array<{ name: string; route: string }> = [
  { name: 'reservations', route: '/reservations' },
  { name: 'reservation-card', route: '/reservations/20260913-TEST1' },
  { name: 'settings', route: '/hotel-settings' },
  { name: 'chessboard', route: '/chessboard' },
];
/** секции страницы компонентов, которые трогает DS1b; до среза есть только «Вкладки», новые стоят сразу за ними */
const KIT = ['tabs', 'chip', 'segmented', 'toolbar'];

test.skip(!phase, 'только для сравнения DS1b: DS1B_CAPTURE=before|after');

test.beforeEach(async ({ request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
});

for (const theme of ['light', 'dark'] as const) {
  for (const width of [1440, 390] as const) {
    test(`примитивы DS1b ${theme} ${width}`, async ({ page }) => {
      test.setTimeout(240_000);
      mkdirSync(out, { recursive: true });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      for (const s of SCREENS) {
        await page.goto(s.route).catch(() => undefined);
        await page.waitForLoadState('networkidle').catch(() => undefined);
        await page.mouse.move(0, 0);
        await page.screenshot({ path: `${out}/${s.name}-${width}-${theme}.png` });
      }
      await page.goto('/design-system');
      await page.waitForLoadState('networkidle').catch(() => undefined);
      const block = page.getByTestId(`kit-${theme}`);
      // секции, которых до среза нет, пропускаются: boundingBox ждал бы их до конца теста
      const boxes = [];
      for (const id of KIT) {
        const section = block.locator(`section[data-component="${id}"]`);
        if ((await section.count()) > 0) boxes.push((await section.boundingBox())!);
      }
      const top = Math.min(...boxes.map((b) => b.y));
      const bottom = Math.max(...boxes.map((b) => b.y + b.height));
      await page.mouse.move(0, 0);
      await page.screenshot({
        path: `${out}/design-system-${width}-${theme}.png`,
        fullPage: true,
        clip: { x: 0, y: top, width, height: bottom - top },
      });
    });
  }
}
