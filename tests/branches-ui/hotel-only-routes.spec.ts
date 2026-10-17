import { expect, test, type Page } from '@playwright/test';

/**
 * DS2 F1 (план mv8-5-ds2-shell-navigation §15): гостиничные экраны закрыты салону и ресторану по прямому адресу,
 * а не только отсутствием ссылки в меню. Защита та же, что у `/reports`: `requireVertical(['HOSPITALITY'])`
 * уводит чужое направление на его стартовую страницу и не даёт странице звать гостиничный API.
 */
const api = `http://127.0.0.1:${process.env.BRANCHES_UI_API_PORT ?? '26864'}`;

/** Экраны гостиницы; `/connections/channex` входит в раздел `/connections` */
const HOTEL_ROUTES = [
  '/units/101',
  '/reservations/new',
  '/tasks',
  '/connections',
  '/connections/channex',
  '/incidents',
];

/** Запросы, которые делают только гостиничные экраны: у чужого направления их быть не должно */
const HOTEL_API = /^\/(units|tasks|guard|channels|integrations|reservations|guests|hotel|inventory)(?:\/|\?|$)/;

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

async function setScope(page: Page, business: string, location: string) {
  await page.context().addCookies([
    {
      name: 'wetop_scope',
      value: encodeURIComponent(`business=${business};location=${location}`),
      domain: '127.0.0.1',
      path: '/',
    },
  ]);
}

test('F1: гостиница открывает свои экраны по прямому адресу', async ({ page, request }) => {
  test.setTimeout(240_000);
  const f = await (await request.post(`${api}/__test/reset`)).json();
  await setScope(page, f.hotel, f.locations[4]);
  for (const route of HOTEL_ROUTES) {
    await page.goto(route);
    // первый заход на маршрут компилируется dev-сервером
    await expect(page, route).toHaveURL(new RegExp(`${route.replace(/\//g, '\\/')}$`), { timeout: 15000 });
    await expect(page.getByRole('main').getByRole('heading', { level: 1 }).first(), route).toBeVisible();
  }
});

for (const vertical of ['beauty', 'food'] as const) {
  test(`F1: ${vertical} не открывает гостиничные экраны по прямому адресу`, async ({ page, request }) => {
    test.setTimeout(240_000);
    const f = await (await request.post(`${api}/__test/reset`)).json();
    const branch =
      vertical === 'beauty'
        ? { business: f.beauty, location: f.locations[3] }
        : { business: f.business, location: f.locations[0] };
    await setScope(page, branch.business, branch.location);
    const before = ((await (await request.get(`${api}/__test/calls`)).json()) as string[]).length;
    for (const route of HOTEL_ROUTES) {
      await page.goto(route);
      await expect(page, route).toHaveURL(/\/today$/, { timeout: 15000 });
    }
    const calls = ((await (await request.get(`${api}/__test/calls`)).json()) as string[]).slice(before);
    expect(calls.filter((c) => HOTEL_API.test(c))).toEqual([]);
  });
}

/**
 * У1 (реестр функций): адреса, которые раньше открывались чужому направлению по прямой ссылке, потому что у страницы
 * не было охраны. Брони и их печать, `/rates`, `/channel-manager` гостиничные; профиль сотрудника у салона и ресторана.
 */
const HOTEL_DIRECT = [
  '/reservations/ABC',
  '/reservations/ABC/print',
  '/reservations/ABC/print/contract',
  '/reservations/ABC/print/invoice',
  '/rates',
  '/channel-manager',
];
for (const vertical of ['beauty', 'food'] as const) {
  test(`У1: ${vertical} не открывает брони, печать и старые адреса гостиницы`, async ({ page, request }) => {
    test.setTimeout(240_000);
    const f = await (await request.post(`${api}/__test/reset`)).json();
    const branch =
      vertical === 'beauty'
        ? { business: f.beauty, location: f.locations[3] }
        : { business: f.business, location: f.locations[0] };
    await setScope(page, branch.business, branch.location);
    const before = ((await (await request.get(`${api}/__test/calls`)).json()) as string[]).length;
    for (const route of HOTEL_DIRECT) {
      await page.goto(route);
      await expect(page, route).toHaveURL(/\/today$/, { timeout: 15000 });
    }
    const calls = ((await (await request.get(`${api}/__test/calls`)).json()) as string[]).slice(before);
    expect(calls.filter((c) => HOTEL_API.test(c))).toEqual([]);
  });
}
test('У1: гостиница не открывает профиль сотрудника салона по прямому адресу', async ({ page, request }) => {
  test.setTimeout(120_000);
  const f = await (await request.post(`${api}/__test/reset`)).json();
  await setScope(page, f.hotel, f.locations[4]);
  await page.goto('/employees/00000000-0000-4000-8000-000000000000/profile');
  await expect(page).toHaveURL(/\/today$/, { timeout: 15000 });
});
