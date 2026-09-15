import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const routes = [
  '/today',
  '/chessboard',
  '/reservations',
  '/reservations/new?unit=M03',
  '/reservations/20260913-TESTAA',
  '/guests',
  '/guests?q=Тест',
  '/guests/ui-guest',
  '/rooms',
  '/rooms/categories',
  '/rooms/availability',
  '/inventory',
  '/units/R01',
  '/rates',
  '/finance',
  '/hotel-settings',
  '/hotel-settings/check-in',
  '/hotel-settings/penalties',
  '/hotel-settings/services',
  '/hotel-settings/description',
  '/hotel-settings/photos',
  '/hotel-settings/amenities',
  '/management/statistics',
  '/channel-manager',
  '/channels',
  '/connections',
  '/analytics',
  '/analytics/setup',
  '/profile',
  '/login',
  '/incidents',
  '/journal',
];

for (const width of [1440, 390]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`доступность всех разделов: ${theme}, ${width}px`, async ({ page, request }) => {
      test.setTimeout(360_000);
      await request.post('http://127.0.0.1:4311/__test/reset');
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.setViewportSize({ width, height: 1000 });
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      const report = [];
      mkdirSync('reports/ui-quality', { recursive: true });
      for (const route of routes) {
        await page.goto(route);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        const result = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze();
        const violations = result.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          help: v.help,
          nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
        }));
        const layout = await page.evaluate(() => {
          const browser = globalThis as unknown as {
            innerWidth: number;
            document: { documentElement: { scrollWidth: number } };
          };
          return {
            viewport: browser.innerWidth,
            content: browser.document.documentElement.scrollWidth,
          };
        });
        report.push({ route, violations, layout });
        expect
          .soft(layout.content, `${route}: page overflow`)
          .toBeLessThanOrEqual(layout.viewport + 1);
        if (['/today', '/chessboard', '/guests', '/rooms'].includes(route))
          await page.screenshot({
            path: `reports/ui-quality/${route.slice(1)}-${theme}-${width}.png`,
          });
        writeFileSync(
          `reports/ui-quality/accessibility-${theme}-${width}.json`,
          JSON.stringify(report, null, 2),
        );
        expect
          .soft(
            violations.map((v) => ({ ...v, nodes: v.nodes.slice(0, 3) })),
            route,
          )
          .toEqual([]);
      }
      expect(errors).toEqual([]);
      writeFileSync(
        `reports/ui-quality/accessibility-${theme}-${width}.json`,
        JSON.stringify(report, null, 2),
      );
    });
  }
}

for (const width of [1440, 390]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`доступность открытых форм и drawer: ${theme}, ${width}px`, async ({ page, request }) => {
      test.setTimeout(120_000);
      await request.post('http://127.0.0.1:4311/__test/reset');
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.setViewportSize({ width, height: 1000 });
      await page.goto('/reservations');
      await page.getByRole('link', { name: 'Открыть бронь 20260913-TESTAA' }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      const report = [];
      for (const tab of ['Обзор', 'Счета', 'Действия', 'История']) {
        await dialog.getByRole('tab', { name: tab, exact: true }).click();
        if (tab === 'Действия')
          await page.screenshot({ path: `reports/ui-quality/drawer-${theme}-${width}.png` });
        const result = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze();
        report.push({ tab, violations: result.violations });
        mkdirSync('reports/ui-quality', { recursive: true });
        writeFileSync(
          `reports/ui-quality/forms-${theme}-${width}.json`,
          JSON.stringify(report, null, 2),
        );
        expect
          .soft(
            result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
            tab,
          )
          .toEqual([]);
      }
    });
  }
}
