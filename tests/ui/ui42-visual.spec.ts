import { mkdirSync, writeFileSync } from 'node:fs';
import { FIXTURE_API, expect, test } from './fixtures';

/**
 * UI4.2, DESIGN.md §21: съёмка шахматки для сравнения с эталоном владельца
 * (`design/references/01_hospitality/chessboard_owner_2026-10-13.webp`, 1586×992).
 * `UI42_PHASE=before|after` задаёт папку отчёта; снимки и геометрия ключевых элементов
 * ложатся в `reports/ui42-chessboard-2026-10-13/<phase>/`. Ничего не утверждает, кроме того,
 * что страница открылась и не тянется вбок: сходство судит сравнение по §21, а не этот файл.
 */
const PHASE = process.env.UI42_PHASE ?? 'after';
const OUT = `reports/ui42-chessboard-2026-10-13/${PHASE}`;

const VIEWPORTS = [
  { name: 'ref-1586', width: 1586, height: 992 },
  { name: '1440', width: 1440, height: 900 },
  { name: '1280', width: 1280, height: 800 },
  { name: '1024', width: 1024, height: 768 },
  { name: '768', width: 768, height: 1024 },
  { name: '390', width: 390, height: 844 },
  { name: '360', width: 360, height: 800 },
  { name: '320', width: 320, height: 800 },
];

/** ключевые элементы эталона: шапка, заголовок, полоса управления, плитки, фильтры, сетка, плашка, легенда */
const PROBES: Record<string, string> = {
  header: '.workspace-header',
  title: 'main h1',
  controls: '.board-nav',
  stats: '[aria-label="Сегодня на объекте"]',
  statFirst: '[aria-label="Сегодня на объекте"] > *:first-child',
  filters: '.board-toolbar, .board-filters',
  grid: '[aria-label="Календарь по дням"]',
  dateHead: '[data-testid="date-col"]',
  plate: '.board-stay',
  legend: '.board-legend, .board-footer',
};

test('UI4.2: съёмка шахматки на ширинах и темах', async ({ page, request }) => {
  test.setTimeout(240_000);
  mkdirSync(OUT, { recursive: true });
  await request.post(`${FIXTURE_API}/__test/reset`);
  await page.goto('/chessboard');
  await expect(page.locator('main h1')).toBeVisible();
  const geometry: Record<string, unknown> = {};
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      await expect(page.locator('html')).toHaveAttribute('data-theme', colorScheme);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `${OUT}/chessboard-${vp.name}-${colorScheme}.png` });
      if (colorScheme === 'light') {
        geometry[vp.name] = await page.evaluate((probes) => {
          const out: Record<string, unknown> = {
            scrollWidth: document.documentElement.scrollWidth,
            font: getComputedStyle(document.body).fontFamily,
            fontsLoaded: [...document.fonts]
              .filter((f) => f.status === 'loaded')
              .map((f) => `${f.family} ${f.weight}`),
          };
          for (const [key, sel] of Object.entries(probes)) {
            const el = document.querySelector(sel);
            if (!el) {
              out[key] = null;
              continue;
            }
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            out[key] = {
              x: Math.round(r.x),
              y: Math.round(r.y),
              w: Math.round(r.width),
              h: Math.round(r.height),
              fontSize: cs.fontSize,
              fontWeight: cs.fontWeight,
              radius: cs.borderRadius,
            };
          }
          return out;
        }, PROBES);
        expect((geometry[vp.name] as { scrollWidth: number }).scrollWidth).toBeLessThanOrEqual(
          vp.width,
        );
      }
    }
  }
  writeFileSync(`${OUT}/geometry.json`, `${JSON.stringify(geometry, null, 2)}\n`);
});
