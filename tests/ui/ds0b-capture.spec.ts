import { mkdirSync, writeFileSync } from 'node:fs';
import { FIXTURE_API, test } from './fixtures';

/**
 * MV8.5 DS0b: снимки и вычисленные стили «до» и «после» перестройки каскада CSS
 * (`plans/mv8-5-ds0b-css-foundation-2026-10-07.md`). Не проверка, а инструмент сравнения: работает только с
 * `DS0B_CAPTURE=before|after`, в обычном прогоне набора пропускается.
 *
 * Снимки: четыре экрана гостиницы в 1440 и 390, светлая и тёмная. Вычисленные стили: каждый элемент
 * страницы по пути в DOM и набор свойств, на которых держится внешний вид. Разметка в DS0b не
 * меняется, поэтому путь в DOM один и тот же до и после, и любое расхождение свойств значит, что
 * каскад дал другое значение. Сравнивает `scripts/design/ds0b-style-diff.ts`.
 */
const phase = process.env['DS0B_CAPTURE'];
const out = `reports/mv8-5-ds0b-2026-10-07/${phase}`;
// вычисленные стили весят мегабайты: путь задаёт DS0B_STYLES_DIR вне репозитория (`test-results/`
// Playwright чистит перед прогоном), в репозиторий идёт только итог сравнения
const stylesOut = `${process.env['DS0B_STYLES_DIR'] ?? 'reports/mv8-5-ds0b-2026-10-07/styles'}/${phase}`;

const SCREENS = ['/today', '/chessboard', '/reservations', '/guests'];
const STYLE_ROUTES = [
  '/today',
  '/chessboard',
  '/reservations',
  '/reservations/new',
  '/guests',
  '/inventory',
  '/rooms/categories',
  '/rooms/availability',
  '/finance',
  '/channels',
  '/hotel-settings',
  '/management/analytics',
  '/reports',
  '/team',
  '/tasks',
  '/website',
  '/marketing',
  '/connections',
  '/incidents',
  '/branches',
  '/market',
  '/ai-agents',
  '/design-system',
];
const PROPS = [
  'display',
  'position',
  'box-sizing',
  'width',
  'height',
  'min-height',
  'max-width',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'gap',
  'grid-template-columns',
  'flex-direction',
  'flex-wrap',
  'align-items',
  'justify-content',
  'font-size',
  'font-weight',
  'line-height',
  'letter-spacing',
  'text-transform',
  'color',
  'background-color',
  'background-image',
  'border-top-width',
  'border-top-color',
  'border-bottom-width',
  'border-bottom-color',
  'border-left-width',
  'border-right-width',
  'border-top-left-radius',
  'box-shadow',
  'backdrop-filter',
  'opacity',
  'overflow-x',
  'overflow-y',
  'z-index',
  'visibility',
];

test.skip(!phase, 'только для сравнения DS0b: DS0B_CAPTURE=before|after');

test.beforeEach(async ({ request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
});

for (const theme of ['light', 'dark'] as const) {
  for (const width of [1440, 390] as const) {
    test(`снимки гостиницы ${theme} ${width}`, async ({ page }) => {
      test.setTimeout(180_000);
      mkdirSync(`${out}/screens`, { recursive: true });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      for (const route of SCREENS) {
        await page.goto(route);
        await page.waitForLoadState('networkidle').catch(() => undefined);
        await page.mouse.move(0, 0);
        const name = route.slice(1).replace(/\//g, '-');
        await page.screenshot({ path: `${out}/screens/hospitality-${name}-${width}-${theme}.png` });
      }
    });
  }
}

test('вычисленные стили маршрутов гостиницы, 1440 светлая', async ({ page }) => {
  test.setTimeout(600_000);
  mkdirSync(stylesOut, { recursive: true });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const route of STYLE_ROUTES) {
    await page.goto(route);
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await page.mouse.move(0, 0);
    // Выражение строкой: в корневом tsconfig нет библиотеки DOM
    const dump = await page.evaluate(`(() => {
      const props = ${JSON.stringify(PROPS)};
      const out = {};
      const path = (el) => {
        const parts = [];
        for (let n = el; n && n.nodeType === 1 && n !== document.documentElement; n = n.parentElement) {
          const i = n.parentElement ? Array.prototype.indexOf.call(n.parentElement.children, n) : 0;
          parts.unshift(n.tagName.toLowerCase() + ':' + i);
        }
        return parts.join('>');
      };
      for (const el of document.querySelectorAll('body *')) {
        if (el.closest('script,style,svg')) continue;
        const cs = getComputedStyle(el);
        const row = {};
        for (const p of props) row[p] = cs.getPropertyValue(p);
        row['class'] = el.getAttribute('class') || '';
        out[path(el)] = row;
      }
      return out;
    })()`);
    const name = route.slice(1).replace(/\//g, '-');
    writeFileSync(`${stylesOut}/${name}.json`, JSON.stringify(dump));
  }
});
