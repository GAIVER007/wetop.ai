import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

const SCREENS = ['/finance', '/chessboard', '/reservations', '/guests'];
const DEFAULT_STYLE_ROUTES = [
  '/finance',
  '/chessboard',
  '/reservations',
  '/reservations/new',
  '/guests',
  '/inventory',
  '/rooms/categories',
  '/rooms/availability',
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
  '/journal',
  '/units/R01',
  '/website/booking',
  '/website/settings',
];
// DS0B_ROUTES_FILE: JSON-список маршрутов вместо основного (дополнительный проход по остальным экранам)
const STYLE_ROUTES: string[] = process.env['DS0B_ROUTES_FILE']
  ? (JSON.parse(readFileSync(process.env['DS0B_ROUTES_FILE'], 'utf8')) as string[])
  : DEFAULT_STYLE_ROUTES;
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
        // переадресация обрывает первый переход (ERR_ABORTED), страница всё равно открывается
        await page.goto(route).catch(() => undefined);
        await page.waitForLoadState('networkidle').catch(() => undefined);
        await page.mouse.move(0, 0);
        const name = route.slice(1).replace(/\//g, '-');
        await page.screenshot({ path: `${out}/screens/hospitality-${name}-${width}-${theme}.png` });
      }
    });
  }
}

// 1440 светлая пишет в `<phase>/`, остальные виды в `<phase>-<ширина>-<тема>/`
for (const [width, theme] of [
  [1440, 'light'],
  [390, 'light'],
  [1440, 'dark'],
] as const) {
  test(`вычисленные стили маршрутов гостиницы, ${width} ${theme}`, async ({ page }) => {
    test.setTimeout(1_800_000);
    const dir = width === 1440 && theme === 'light' ? stylesOut : `${stylesOut}-${width}-${theme}`;
    mkdirSync(dir, { recursive: true });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    // прогрев: холодный next dev отдаёт содержимое потоком, первый заход ловит экран загрузки
    for (const route of STYLE_ROUTES) await page.goto(route).catch(() => undefined);
    for (const route of STYLE_ROUTES) {
      // переадресация обрывает первый переход (ERR_ABORTED), страница всё равно открывается
      await page.goto(route).catch(() => undefined);
      await page.waitForLoadState('networkidle').catch(() => undefined);
      await page
        .waitForFunction('!document.querySelector(".skeleton, [aria-busy=\\"true\\"]")', null, {
          timeout: 30_000,
        })
        .catch(() => undefined);
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
      writeFileSync(`${dir}/${name}.json`, JSON.stringify(dump));
    }
  });
}

// Наведение: статический снимок состояний не видит, а слои могли развернуть правило раздела против
// `.inp:hover`, `.tbl tr:hover td` и подобных. Наводим на первые элементы примитивов и пишем их вид.
const HOVER_TARGETS = [
  '.tbl tbody tr',
  '.inp',
  'select.inp',
  '.btn',
  '.btn--secondary',
  '.chips a',
  '.chips button',
  '.seg a',
  '.tbl td a',
  '.facts a',
  '.sidenav__link',
];
const HOVER_PROPS = [
  'background-color',
  'background-image',
  'color',
  'border-top-width',
  'border-top-color',
  'box-shadow',
  'text-decoration-line',
  'filter',
];
test('наведение на примитивы маршрутов гостиницы, 1440 светлая', async ({ page }) => {
  test.setTimeout(900_000);
  const dir = `${stylesOut}-hover`;
  mkdirSync(dir, { recursive: true });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const route of STYLE_ROUTES) await page.goto(route).catch(() => undefined);
  for (const route of STYLE_ROUTES) {
    await page.goto(route).catch(() => undefined);
    await page.waitForLoadState('networkidle').catch(() => undefined);
    const out: Record<string, Record<string, string>> = {};
    for (const sel of HOVER_TARGETS) {
      const all = await page.locator(sel).all();
      let n = 0;
      for (const el of all) {
        if (n >= 2) break;
        if (!(await el.isVisible().catch(() => false))) continue;
        await el.hover({ timeout: 2_000 }).catch(() => undefined);
        // строка таблицы красит ячейки, поэтому берём первую ячейку
        // в корневом tsconfig нет библиотеки DOM: узкие типы вместо Element
        type Node = {
          matches(s: string): boolean;
          querySelector(s: string): Node | null;
          getAttribute(n: string): string | null;
        };
        type Styles = { getPropertyValue(p: string): string };
        const row = await el.evaluate((node: Node, props: string[]) => {
          const t = node.matches('tr') ? node.querySelector('td') || node : node;
          const cs = (
            globalThis as unknown as { getComputedStyle(n: Node): Styles }
          ).getComputedStyle(t);
          const r: Record<string, string> = {};
          for (const p of props) r[p] = cs.getPropertyValue(p);
          r['class'] = t.getAttribute('class') || '';
          return r;
        }, HOVER_PROPS);
        out[`${sel}#${n}`] = row as Record<string, string>;
        n++;
      }
    }
    await page.mouse.move(0, 0);
    writeFileSync(`${dir}/${route.slice(1).replace(/\//g, '-')}.json`, JSON.stringify(out));
  }
});
