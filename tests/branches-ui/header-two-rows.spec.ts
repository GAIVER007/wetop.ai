import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const api = `http://127.0.0.1:${process.env.BRANCHES_UI_API_PORT ?? '26864'}`;
const shots = 'reports/header-two-rows-2026-10-20';
const seen: Record<string, string[]> = {};

test.describe.configure({ mode: 'serial' });
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

for (const vertical of ['hotel', 'beauty', 'food'] as const) {
  test(`шапка в две строки: ${vertical}`, async ({ page, request }) => {
    test.setTimeout(120_000);
    const response = await request.post(`${api}/__test/reset`);
    expect(response.ok()).toBe(true);
    const f = await response.json();
    const branch = {
      hotel: { business: f.hotel, location: f.locations[4], route: '/chessboard' },
      beauty: { business: f.beauty, location: f.locations[3], route: '/calendar' },
      food: { business: f.business, location: f.locations[0], route: '/floor-plan' },
    }[vertical];
    await page.context().addCookies([
      {
        name: 'wetop_scope',
        value: encodeURIComponent(`business=${branch.business};location=${branch.location}`),
        domain: '127.0.0.1',
        path: '/',
      },
    ]);
    await page.goto(branch.route);
    mkdirSync(shots, { recursive: true });
    for (const width of [1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      const header = page.locator('.workspace-header');
      const tabs = page.locator('.tabnav .tabnav__tab');
      await expect(tabs).toHaveCount(11);
      // две строки: 48 px управление + 40 px разделы, переменная шапки совпадает с высотой
      const height = (await header.boundingBox())!.height;
      expect(height).toBe(88);
      expect(
        await page.evaluate(() =>
          getComputedStyle(document.querySelector('.workspace')!).getPropertyValue('--header-h'),
        ),
      ).not.toBe('');
      const brand = (await page.locator('.workspace-brand').boundingBox())!;
      const first = (await tabs.first().boundingBox())!;
      expect(first.y).toBeGreaterThanOrEqual(brand.y + brand.height - 1);
      // ничего не обрезано и не уезжает вбок: ни в разделах, ни в поиске, филиале и профиле
      const cut = await page.evaluate(() =>
        [
          ...document.querySelectorAll<HTMLElement>(
            '.tabnav, .tabnav__tab, .workspace-search, .workspace-header__property strong, .workspace-header__property span, .profile-caption strong, .profile-caption small',
          ),
        ]
          .filter((el) => el.scrollWidth > el.clientWidth + 1)
          .map((el) => `${el.className}:${el.textContent?.trim()}`),
      );
      expect(cut, `${vertical} ${width}`).toEqual([]);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
      // поиск словом и подсказкой клавиши, не одной иконкой; в календаре гостиницы у экрана свой поиск (ADR шапки)
      if (branch.route !== '/chessboard')
        await expect(page.locator('.workspace-search .workspace-search-full')).toBeVisible();
      seen[`${vertical}-${width}`] = await tabs.allTextContents();
      await page.screenshot({
        path: `${shots}/${vertical}-${width}.png`,
        clip: { x: 0, y: 0, width, height: 110 },
      });
    }
    // список раздела открывается прямо под шапкой
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.locator('.tabnav__tab', { hasText: 'Клиенты' }).click();
    const list = page.locator('.tabnav__list:not([hidden])');
    await expect(list).toBeVisible();
    expect((await list.boundingBox())!.y).toBeGreaterThanOrEqual(87);
    await page.screenshot({
      path: `${shots}/${vertical}-1440-open.png`,
      clip: { x: 0, y: 0, width: 1440, height: 420 },
    });
  });
}

test('у всех трёх направлений одни и те же разделы в одном порядке', () => {
  const base = seen['hotel-1440'];
  expect(base).toHaveLength(11);
  for (const key of Object.keys(seen)) expect(seen[key], key).toEqual(base);
});
