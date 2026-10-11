import { mkdirSync } from 'node:fs';
import { test, expect } from '@playwright/test';

/**
 * MV8.5 DS1c: снимки «до» и «после» дневной навигации ресторана (общий DateBar) и формы брони стола
 * (FormGrid и обязательные поля). Только с `DS1C_CAPTURE=before|after`, в обычном прогоне пропускается.
 */
const phase = process.env['DS1C_CAPTURE'];
const out = `reports/mv8-5-ds1c-2026-10-08/${phase}`;
const api = 'http://127.0.0.1:55824';
const date = '2026-10-12';

test.skip(!phase, 'только для сравнения DS1c: DS1C_CAPTURE=before|after');

for (const theme of ['light', 'dark'] as const) {
  for (const width of [1440, 390] as const) {
    test(`ресторан: дневная навигация и форма брони ${theme} ${width}`, async ({ page, request }) => {
      mkdirSync(out, { recursive: true });
      const response = await request.post(`${api}/__test/reset`);
      expect(response.ok()).toBe(true);
      const f: { business: string; locations: string[] } = await response.json();
      const pointer = `business=${f.business};location=${f.locations[0]}`;
      await page.context().addCookies([
        { name: 'wetop_scope', value: encodeURIComponent(pointer), domain: '127.0.0.1', path: '/' },
      ]);
      const headers = { 'x-wetop-scope': pointer };
      const area = await (
        await request.post(`${api}/food-service/areas`, {
          headers,
          data: { name: 'Основной зал', sortOrder: 0, active: true },
        })
      ).json();
      await request.post(`${api}/food-service/tables`, {
        headers,
        data: { areaId: area.id, name: 'Стол 7', capacity: 4, sortOrder: 0, active: true },
      });
      await request.post(`${api}/food-service/service-periods`, {
        headers,
        data: {
          name: 'Ужин',
          weekday: 1,
          timeFrom: '18:00',
          timeTo: '23:00',
          defaultDurationMinutes: 120,
          endsNextDay: false,
          active: true,
        },
      });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await page.goto(`/floor-plan?date=${date}&time=19:00`);
      await page.waitForLoadState('networkidle').catch(() => undefined);
      await page.mouse.move(0, 0);
      await page.screenshot({ path: `${out}/food-day-${width}-${theme}.png` });
      await page.getByRole('button', { name: '+ Новая бронь', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('radio', { name: 'Новый', exact: true }).check();
      await page.waitForTimeout(400);
      await page.mouse.move(0, 0);
      await page.screenshot({ path: `${out}/food-form-${width}-${theme}.png` });
    });
  }
}
