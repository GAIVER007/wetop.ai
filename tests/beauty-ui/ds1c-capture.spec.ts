import { mkdirSync } from 'node:fs';
import { test, expect } from '@playwright/test';

/**
 * MV8.5 DS1c: снимки «до» и «после» дневной навигации салона (общий DateBar). Только с
 * `DS1C_CAPTURE=before|after`, в обычном прогоне набора пропускается.
 */
const phase = process.env['DS1C_CAPTURE'];
const out = `reports/mv8-5-ds1c-2026-10-08/${phase}`;
const api = `http://127.0.0.1:${process.env.BEAUTY_UI_API_PORT || '55814'}`;

test.skip(!phase, 'только для сравнения DS1c: DS1C_CAPTURE=before|after');

for (const theme of ['light', 'dark'] as const) {
  for (const width of [1440, 390] as const) {
    test(`салон: дневная навигация ${theme} ${width}`, async ({ page, request }) => {
      mkdirSync(out, { recursive: true });
      const response = await request.post(`${api}/__test/reset`);
      expect(response.ok()).toBe(true);
      const f: { business: string; locations: string[] } = await response.json();
      await page.context().addCookies([
        {
          name: 'wetop_scope',
          value: encodeURIComponent(`business=${f.business};location=${f.locations[0]}`),
          domain: '127.0.0.1',
          path: '/',
        },
      ]);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await page.goto('/calendar?date=2026-10-12');
      await page.waitForLoadState('networkidle').catch(() => undefined);
      await page.mouse.move(0, 0);
      await page.screenshot({ path: `${out}/beauty-day-${width}-${theme}.png` });
    });
  }
}
