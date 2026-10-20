import { expect, test } from '@playwright/test';

const api = `http://127.0.0.1:${process.env.BRANCHES_UI_API_PORT ?? '26864'}`;

test.afterAll(async ({ request }) => {
  expect((await request.post(`${api}/__test/cleanup`)).ok()).toBe(true);
});

/** Д10 аудита платформы (17.10.2026): медиатека сайта открывается салону и ресторану, импорт Channex только у гостиницы */
for (const vertical of ['hotel', 'beauty', 'food'] as const) {
  test(`Д10: ${vertical} открывает изображения сайта`, async ({ page, request }) => {
    const f = await (await request.post(`${api}/__test/reset`)).json();
    const scope = {
      hotel: `business=${f.hotel};location=${f.locations[4]}`,
      beauty: `business=${f.beauty};location=${f.locations[3]}`,
      food: `business=${f.business};location=${f.locations[0]}`,
    }[vertical];
    await page.context().addCookies([
      { name: 'wetop_scope', value: encodeURIComponent(scope), domain: '127.0.0.1', path: '/' },
    ]);
    await page.goto('/marketing/site/assets');
    await expect(page).toHaveURL(/\/marketing\/site\/assets$/);
    await expect(page.getByRole('heading', { name: 'Изображения сайта', level: 1 })).toBeVisible();
    await expect(page.getByTestId('site-assets-channex')).toHaveCount(vertical === 'hotel' ? 1 : 0);
  });
}
