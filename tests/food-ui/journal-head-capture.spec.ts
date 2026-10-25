import { mkdirSync } from 'node:fs';
import { test, expect } from './fixtures';

/**
 * Шапка журнала ресторана (решение 23.10.2026, единая шапка): снимки плана зала и расписания, 1440 и 390.
 * Только с `JOURNAL_HEAD_CAPTURE=<папка>`, в обычном прогоне пропускается.
 */
const phase = process.env['JOURNAL_HEAD_CAPTURE'];
const out = `reports/journal-head-2026-10-24/${phase}`;
const api = `http://127.0.0.1:${process.env.FOOD_UI_API_PORT ?? '55824'}`;
const date = '2026-10-12';

test.skip(!phase, 'только для снимков шапки: JOURNAL_HEAD_CAPTURE=before|after');

for (const width of [1440, 390] as const) {
  test(`ресторан: шапка журнала ${width}`, async ({ page, request }) => {
    test.setTimeout(180_000);
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
      await request.post(`${api}/food-service/areas`, { headers, data: { name: 'Основной зал', sortOrder: 0, active: true } })
    ).json();
    await request.post(`${api}/food-service/tables`, {
      headers,
      data: { areaId: area.id, name: 'Стол 7', capacity: 4, sortOrder: 0, active: true },
    });
    await request.post(`${api}/food-service/service-periods`, {
      headers,
      data: { name: 'Ужин', weekday: 1, timeFrom: '18:00', timeTo: '23:00', defaultDurationMinutes: 120, endsNextDay: false, active: true },
    });
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    for (const [name, path] of [
      ['floor-plan', `/floor-plan?date=${date}&time=19:00`],
      ['table-reservations', `/table-reservations?date=${date}`],
    ] as const) {
      await page.goto(path);
      await page.waitForLoadState('networkidle').catch(() => undefined);
      await page.mouse.move(0, 0);
      await page.screenshot({ path: `${out}/${name}-${width}.png` });
    }
  });
}
