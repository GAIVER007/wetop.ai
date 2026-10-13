import { mkdirSync, writeFileSync } from 'node:fs';
import { FIXTURE_API, expect, test } from './fixtures';

/**
 * DESIGN.md §21, шаги 3 и 5: съёмка экранов для сравнения с эталоном владельца.
 * `REF_ROUTES`: маршруты через запятую (по умолчанию `/guests,/inventory`), `REF_OUT`: папка отчёта
 * (по умолчанию `reports/ui43-hospitality-2026-10-13`), `REF_PHASE=before|after`.
 * Снимки `<маршрут>-<ширина>-<тема>.png` и `geometry.json` (перелив вбок, шрифт, рамки `main h1` и
 * первых плиток, панели, таблицы). Утверждает только, что страница открылась и не тянется вбок.
 */
const ROUTES = (process.env.REF_ROUTES ?? '/guests,/inventory').split(',').filter(Boolean);
const OUT = `${process.env.REF_OUT ?? 'reports/ui43-hospitality-2026-10-13'}/${process.env.REF_PHASE ?? 'after'}`;
const VIEWPORTS = [
  { name: 'ref-1672', width: 1672, height: 941 },
  { name: '1440', width: 1440, height: 900 },
  { name: '1280', width: 1280, height: 800 },
  { name: '1024', width: 1024, height: 768 },
  { name: '768', width: 768, height: 1024 },
  { name: '390', width: 390, height: 844 },
  { name: '320', width: 320, height: 800 },
];
const PROBES: Record<string, string> = {
  title: 'main h1',
  stats: 'main .stats, main [role="group"]:has(.stat)',
  statFirst: 'main .stat',
  table: 'main table',
  firstRow: 'main tbody tr',
  panel: 'main aside, main [data-testid$="-panel"]',
};

for (const route of ROUTES) {
  const slug = route.replace(/^\//, '').replace(/\W+/g, '-') || 'root';
  test(`эталон: съёмка ${route}`, async ({ page, request }) => {
    test.setTimeout(240_000);
    mkdirSync(OUT, { recursive: true });
    await request.post(`${FIXTURE_API}/__test/reset`);
    await page.goto(route);
    await expect(page.locator('main h1')).toBeVisible();
    const geometry: Record<string, unknown> = {};
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      for (const colorScheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme });
        await expect(page.locator('html')).toHaveAttribute('data-theme', colorScheme);
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({ path: `${OUT}/${slug}-${vp.name}-${colorScheme}.png` });
        if (colorScheme !== 'light') continue;
        geometry[vp.name] = await page.evaluate((probes) => {
          const out: Record<string, unknown> = {
            scrollWidth: document.documentElement.scrollWidth,
            font: getComputedStyle(document.body).fontFamily.split(',')[0],
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
              radius: cs.borderRadius,
            };
          }
          return out;
        }, PROBES);
        expect(
          (geometry[vp.name] as { scrollWidth: number }).scrollWidth,
          `${route} ${vp.name}`,
        ).toBeLessThanOrEqual(vp.width);
      }
    }
    writeFileSync(`${OUT}/${slug}-geometry.json`, `${JSON.stringify(geometry, null, 2)}\n`);
  });
}
