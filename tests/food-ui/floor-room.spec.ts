import { test, expect } from './fixtures';

/**
 * План зала (владелец 24.10.2026: «план зала непонятно, отрезано»): зона без сохранённой схемы показывается
 * таким же залом 16:10, как зона со схемой, а не узкой полосой под столами. Компьютер и телефон.
 */
const api = `http://127.0.0.1:${process.env.FOOD_UI_API_PORT ?? '55824'}`;

for (const width of [1440, 390] as const) {
  test(`план зала: зона без схемы выглядит залом ${width}`, async ({ page, request }) => {
    test.setTimeout(120_000);
    const response = await request.post(`${api}/__test/reset`);
    expect(response.ok()).toBe(true);
    const f: { business: string; locations: string[] } = await response.json();
    const pointer = `business=${f.business};location=${f.locations[0]}`;
    await page.context().addCookies([{ name: 'wetop_scope', value: encodeURIComponent(pointer), domain: '127.0.0.1', path: '/' }]);
    const headers = { 'x-wetop-scope': pointer };
    const area = await (await request.post(`${api}/food-service/areas`, { headers, data: { name: 'Основной зал', sortOrder: 0, active: true } })).json();
    await request.post(`${api}/food-service/tables`, { headers, data: { areaId: area.id, name: 'Стол 7', capacity: 4, sortOrder: 0, active: true } });
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.goto('/floor-plan?date=2026-10-12&time=19:00');
    const room = page.getByRole('region', { name: 'Основной зал' }).locator('.rest-fp__tables');
    await expect(room).toBeVisible();
    const box = (await room.boundingBox())!;
    // зал не уже 280 px по высоте и в пропорции 16:10 (как полотно схемы), стол внутри зала
    expect(box.height).toBeGreaterThanOrEqual(279);
    if (width === 1440) expect(Math.abs(box.width / box.height - 1.6)).toBeLessThan(0.05);
    const table = (await room.locator('.rest-fp-table').first().boundingBox())!;
    expect(table.y + table.height).toBeLessThanOrEqual(box.y + box.height + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  });
}
