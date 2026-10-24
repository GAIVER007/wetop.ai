import { test, expect } from './fixtures';

/**
 * «На весь экран» во всех журналах (владелец 24.10.2026): квадратик перед «Быстрым отчётом», как у календаря
 * гостиницы. Ресторан: план зала и расписание. Нажатие раскрывает журнал на весь экран, Esc возвращает.
 */
const api = `http://127.0.0.1:${process.env.FOOD_UI_API_PORT ?? '55824'}`;

test('ресторан: «На весь экран» перед «Быстрым отчётом», раскрывает и Esc возвращает', async ({ page, request }) => {
  test.setTimeout(120_000);
  const f = await (await request.post(`${api}/__test/reset`)).json();
  const pointer = `business=${f.business};location=${f.locations[0]}`;
  await page.context().addCookies([{ name: 'wetop_scope', value: encodeURIComponent(pointer), domain: '127.0.0.1', path: '/' }]);
  const headers = { 'x-wetop-scope': pointer };
  const area = await (await request.post(`${api}/food-service/areas`, { headers, data: { name: 'Основной зал', sortOrder: 0, active: true } })).json();
  await request.post(`${api}/food-service/tables`, { headers, data: { areaId: area.id, name: 'Стол 7', capacity: 4, sortOrder: 0, active: true } });
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const path of ['/floor-plan?date=2026-10-12&time=19:00', '/table-reservations?date=2026-10-12']) {
    await page.goto(path);
    const actions = page.getByRole('group', { name: 'Период и действия журнала' });
    const expand = actions.getByRole('button', { name: 'На весь экран', exact: true });
    const report = actions.getByRole('button', { name: 'Быстрый отчёт' });
    await expect(expand).toBeVisible();
    // квадратик сразу перед «Быстрым отчётом»
    const [e, r] = [(await expand.boundingBox())!, (await report.boundingBox())!];
    expect(Math.abs(e.width - e.height)).toBeLessThan(2);
    expect(e.x + e.width).toBeLessThanOrEqual(r.x + 1);
    expect(r.x - (e.x + e.width)).toBeLessThan(24);
    await expand.click();
    const journal = page.locator('.page.journal-page');
    await expect(journal).toHaveAttribute('data-expanded', 'true');
    const box = (await journal.boundingBox())!;
    expect(box.y).toBeLessThanOrEqual(1);
    expect(box.height).toBeGreaterThanOrEqual(899);
    // журнал поверх шапки и меню: точка в верхней строке экрана принадлежит журналу
    expect(await page.evaluate(() => !!document.elementFromPoint(innerWidth / 2, 20)?.closest('.journal-page'))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(journal).not.toHaveAttribute('data-expanded', 'true');
    await expect(actions.getByRole('button', { name: 'На весь экран', exact: true })).toBeFocused();
  }
});
