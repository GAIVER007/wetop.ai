import { mkdirSync, writeFileSync } from 'node:fs';
import { FIXTURE_API, expect, test } from './fixtures';

/**
 * UI5 §13: инструментальный аудит таблиц (UI5_AUDIT=1, в гейте не бежит).
 * По маршруту: таблицы без шапки th, разнобой высот строк внутри одной таблицы,
 * таблица шире контейнера без собственной прокрутки (на 390).
 */
const OUT = 'reports/ui5-audit-2026-10-14/tables';
const ROUTES = [
  '/reservations', '/guests', '/inventory', '/finance', '/finance?tab=cash',
  '/bar', '/bar/products', '/bar/receipts', '/bar/suppliers', '/bar/operations',
  '/channels', '/journal', '/incidents', '/team', '/reports/units',
  '/management/analytics/units', '/management/analytics/channels', '/rooms/categories',
];

test.describe(() => {
  test.skip(!process.env['UI5_AUDIT'], 'аудит включается только UI5_AUDIT=1');
  for (const route of ROUTES) {
    test(`таблицы ${route}`, async ({ page, request }) => {
      test.setTimeout(120_000);
      await request.post(`${FIXTURE_API}/__test/reset`);
      await page.goto(route);
      await expect(page.getByRole('main')).toBeVisible();
      const out: Record<string, unknown> = {};
      for (const width of [1440, 390] as const) {
        await page.setViewportSize({ width, height: 900 });
        out[width] = await page.evaluate(() => {
          const tables = Array.from(document.querySelectorAll('main table')).filter((t) =>
            (t as HTMLElement).checkVisibility?.(),
          );
          return tables.map((t) => {
            const rows = Array.from(t.querySelectorAll('tbody tr')).filter((r) =>
              (r as HTMLElement).checkVisibility?.(),
            );
            const hs = [...new Set(rows.map((r) => Math.round(r.getBoundingClientRect().height)))].sort(
              (a, b) => a - b,
            );
            // прокрутку может дать и сам table, и любой предок до main
            let scroller: Element | null = t;
            let scrolls = false;
            while (scroller && scroller.tagName !== 'MAIN') {
              const cs = getComputedStyle(scroller);
              if (/(auto|scroll)/.test(cs.overflowX)) { scrolls = true; break; }
              scroller = scroller.parentElement;
            }
            const r = t.getBoundingClientRect();
            return {
              cols: t.querySelectorAll('thead th').length,
              noHead: !t.querySelector('thead th'),
              rows: rows.length,
              rowHeights: hs.slice(0, 6),
              widerThanViewport: Math.round(r.width) > window.innerWidth,
              hasOwnScroll: scrolls,
            };
          });
        });
      }
      mkdirSync(OUT, { recursive: true });
      writeFileSync(`${OUT}/${route.replace(/\W+/g, '-')}.json`, `${JSON.stringify({ [route]: out }, null, 1)}\n`);
    });
  }
});
