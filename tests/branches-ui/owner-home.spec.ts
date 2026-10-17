import { expect, test } from '@playwright/test';

const api = `http://127.0.0.1:${process.env.BRANCHES_UI_API_PORT ?? '26864'}`;

/**
 * Общая Главная V4 за флагом (аудит платформы 17.10.2026, Д6): у трёх направлений с неё есть путь к рабочему дню.
 * Идёт только с `APP_UNIFIED_OWNER_HOME=true` у веб-сервера стенда; в обычном прогоне флаг выключен.
 */
test.skip(process.env.APP_UNIFIED_OWNER_HOME !== 'true', 'общая Главная включается флагом');

test.afterAll(async ({ request }) => {
  expect((await request.post(`${api}/__test/cleanup`)).ok()).toBe(true);
});

for (const vertical of ['hotel', 'beauty', 'food'] as const) {
  test(`Д6: ${vertical} с общей Главной есть путь к рабочему дню`, async ({ page, request }) => {
    const f = await (await request.post(`${api}/__test/reset`)).json();
    const scope = {
      hotel: `business=${f.hotel};location=${f.locations[4]}`,
      beauty: `business=${f.beauty};location=${f.locations[3]}`,
      food: `business=${f.business};location=${f.locations[0]}`,
    }[vertical];
    await page.context().addCookies([
      { name: 'wetop_scope', value: encodeURIComponent(scope), domain: '127.0.0.1', path: '/' },
    ]);
    await page.goto('/today');
    const main = page.locator('main#main-content');
    await expect(main.getByText('Обзор бизнеса')).toBeVisible();
    await main.getByRole('link', { name: 'Рабочий день' }).click();
    await expect(page).toHaveURL(/\/today\/operations$/);
    await expect(page.locator('main#main-content h1')).toBeVisible();
  });
}
