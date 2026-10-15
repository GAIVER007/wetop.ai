import { mkdirSync, writeFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import { UI5_VIEWS, ui5Facts } from '../ui5-audit-core';

/** UI5 (plans/ui5-fullpass-2026-10-14.md): обходчик стенда «beauty», включается только UI5_AUDIT=1. */
const api = `http://127.0.0.1:${process.env['BEAUTY_UI_API_PORT'] || '26814'}`;
const OUT = 'reports/ui5-audit-2026-10-14/routes-beauty';
const ROUTES: string[] = ['/today', '/beauty/schedule', '/appointments', '/services', '/employees', '/employees/shifts', '/customers', '/finance', '/team', '/help', '/branches', '/reports'];

async function scopeIn(page: Page, request: APIRequestContext) {
  const res = await request.post(`${api}/__test/reset`);
  expect(res.ok()).toBe(true);
  const f = (await res.json()) as { business: string; locations: string[] };
  await page.context().addCookies([
    {
      name: 'wetop_scope',
      value: encodeURIComponent(`business=${f.business};location=${f.locations[0]}`),
      domain: '127.0.0.1',
      path: '/',
    },
  ]);
}

test.describe(() => {
  test.skip(!process.env['UI5_AUDIT'], 'аудит включается только UI5_AUDIT=1');
  for (const route of ROUTES) {
    test(`аудит beauty ${route}`, async ({ page, request }) => {
      test.setTimeout(180_000);
      await scopeIn(page, request);
      const consoleErrors: string[] = [];
      page.on('console', (m) => {
        if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200));
      });
      const r: Record<string, unknown> = {};
      await page.goto(route);
      await expect(page.getByRole('main')).toBeVisible();
      for (const v of UI5_VIEWS) {
        await page.setViewportSize({ width: v.width, height: v.height });
        r[v.name] = await ui5Facts(page, v.name === '390');
      }
      for (const theme of ['light', 'dark'] as const) {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
        await page
          .waitForFunction((t) => document.documentElement.dataset['theme'] === t, theme, { timeout: 5_000 })
          .catch(() => {});
        const audit = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze();
        r[`axe-${theme}`] = audit.violations.map((x) => `${x.id}×${x.nodes.length}`);
      }
      r['console'] = [...new Set(consoleErrors)].slice(0, 6);
      mkdirSync(OUT, { recursive: true });
      writeFileSync(`${OUT}/${route.replace(/\W+/g, '-')}.json`, `${JSON.stringify({ [route]: r }, null, 1)}\n`);
    });
  }
});
