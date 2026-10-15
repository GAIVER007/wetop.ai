import { mkdirSync } from 'node:fs';
import { test, expect } from './fixtures';

/**
 * DESIGN.md §21: снимки зала ресторана для сравнения с эталоном владельца
 * (`design/references/05_verticals/three_calendar_concepts.png`). Только с `REF_PHASE=before|after`.
 */
const phase = process.env['REF_PHASE'];
const out = `reports/ui45-food-2026-10-13/${phase}`;
const api = `http://127.0.0.1:${process.env.FOOD_UI_API_PORT ?? '55824'}`;
const date = '2026-10-12';

test.skip(!phase, 'только для сравнения с эталоном: REF_PHASE=before|after');

test('ресторан: зал на ширинах и темах', async ({ page, request }) => {
  test.setTimeout(240_000);
  mkdirSync(out, { recursive: true });
  const response = await request.post(`${api}/__test/reset`);
  expect(response.ok()).toBe(true);
  const f: { business: string; locations: string[] } = await response.json();
  const pointer = `business=${f.business};location=${f.locations[0]}`;
  await page.context().addCookies([
    { name: 'wetop_scope', value: encodeURIComponent(pointer), domain: '127.0.0.1', path: '/' },
  ]);
  const headers = { 'x-wetop-scope': pointer };
  const post = async (path: string, data: unknown) => {
    const r = await request.post(`${api}${path}`, { headers, data });
    expect(r.ok(), `${path}: ${await r.text()}`).toBe(true);
    return r.json();
  };
  let n = 1;
  for (const [name, count, seats] of [
    ['Основной зал', 8, 4],
    ['VIP-зона', 2, 6],
    ['Терраса', 4, 4],
    ['Бар', 2, 2],
  ] as const) {
    const area = await post('/food-service/areas', { name, sortOrder: n, active: true });
    for (let i = 0; i < count; i += 1)
      await post('/food-service/tables', {
        areaId: area.id,
        name: `Стол ${n++}`,
        capacity: seats,
        sortOrder: n,
        active: true,
      });
  }
  for (const [name, from, to] of [
    ['Завтрак', '08:00', '11:00'],
    ['Обед', '11:00', '16:00'],
    ['Ужин', '16:00', '23:00'],
  ] as const)
    await post('/food-service/service-periods', {
      name,
      weekday: 1,
      timeFrom: from,
      timeTo: to,
      defaultDurationMinutes: 90,
      endsNextDay: false,
      active: true,
    });
  await page.goto(`/floor-plan?date=${date}&time=13:00`);
  await expect(page.locator('main h1')).toBeVisible();
  for (const [width, height] of [
    [1312, 820],
    [1440, 900],
    [1024, 768],
    [390, 844],
    [320, 800],
  ] as const) {
    await page.setViewportSize({ width, height });
    for (const theme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.evaluate(() => document.fonts.ready);
      await page.mouse.move(0, 0);
      await page.screenshot({ path: `${out}/food-${width}-${theme}.png` });
      if (theme === 'light')
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
  }
});
