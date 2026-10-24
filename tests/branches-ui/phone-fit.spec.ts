import { expect, test } from '@playwright/test';

/**
 * Телефон 390: ничего не выходит за край и не обрезается (поручение владельца 24.10.2026: «чтобы нигде не было
 * никаких косых отрезков текста»). Находки обхода всех разделов трёх направлений: сертификаты салона (поле
 * проверки и пустое состояние шире экрана), заказы ресторана (полоса даты шире экрана), «Все специалисты» в
 * журнале салона обрезано многоточием.
 */
const api = `http://127.0.0.1:${process.env.BRANCHES_UI_API_PORT ?? '26864'}`;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const get = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key: string) {
      const value = get.call(this, key);
      return value === null && key.startsWith('wetop.tour.v1:') ? 'done' : value;
    };
  });
});
test.afterAll(async ({ request }) => {
  expect((await request.post(`${api}/__test/cleanup`)).ok()).toBe(true);
});

test('телефон 390: сертификаты, заказы и журнал салона помещаются без обрезки', async ({ page, request }) => {
  test.setTimeout(180_000);
  const f = await (await request.post(`${api}/__test/reset`)).json();
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [biz, loc, path] of [
    ['beauty', 3, '/finance/certificates'],
    ['business', 0, '/orders'],
    ['beauty', 3, '/calendar'],
  ] as const) {
    await page.context().clearCookies();
    await page.context().addCookies([
      { name: 'wetop_scope', value: encodeURIComponent(`business=${f[biz]};location=${f.locations[loc]}`), domain: '127.0.0.1', path: '/' },
    ]);
    await page.goto(path);
    await page.locator('main h1, main .journal-head__title').first().waitFor();
    const wide = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('main *')]
        .filter((e) => e.checkVisibility({ checkVisibilityCSS: true }) && !e.closest('details:not([open]) > :not(summary)') && e.getBoundingClientRect().right > innerWidth + 1)
        .map((e) => `${e.tagName}.${String(e.className).split(' ')[0]}`)
        .slice(0, 5),
    );
    expect(wide, path).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), path).toBe(true);
    const cut = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('main *')]
        .filter((e) => e.checkVisibility({ checkVisibilityCSS: true }) && !e.closest('details:not([open]) > :not(summary)') && getComputedStyle(e).textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 1)
        .map((e) => e.textContent?.trim()),
    );
    expect(cut, path).toEqual([]);
  }
});
