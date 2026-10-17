import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const api = `http://127.0.0.1:${process.env.BRANCHES_UI_API_PORT ?? '26864'}`;
const shots = 'reports/ui3-1-2026-10-11/verticals';

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
  test(`UI3.1: ${vertical} shared shell desktop/mobile`, async ({ page, request }) => {
    test.setTimeout(180_000);
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
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      if (!/Failed to execute 'measure' on 'Performance'/.test(error.message))
        errors.push(error.message);
    });
    await page.goto(branch.route);
    await expect(page).toHaveURL(new RegExp(`${branch.route}$`));
    mkdirSync(shots, { recursive: true });
    for (const theme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 900 });
        const trigger = page.getByRole('button', { name: 'Открыть меню', exact: true });
        await expect(trigger).toHaveCount(1);
        await expect(trigger).toBeEnabled();
        await expect(page.locator('.bottom-navigation')).toHaveCount(0);
        expect((await page.locator('.workspace-header').boundingBox())!.height).toBe(56);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true);
        await trigger.click();
        const menu =
          width > 960
            ? page.locator('.sidenav__panel')
            : page.getByRole('dialog', { name: 'Навигация', exact: true });
        await expect(menu).toBeVisible();
        await expect(menu.locator('[aria-current="page"]')).toHaveCount(1);
        await expect(menu.locator('[aria-current="page"]')).toBeVisible();
        if (vertical !== 'hotel')
          await expect(menu.locator('a[href="/chessboard"]')).toHaveCount(0);
        await page.screenshot({ path: `${shots}/${vertical}-${theme}-${width}-menu.png` });
        await page.keyboard.press('Escape');
        await expect(menu).toBeHidden();
        await expect(trigger).toBeFocused();
        await page.screenshot({ path: `${shots}/${vertical}-${theme}-${width}.png` });
      }
    }
    expect(errors).toEqual([]);
  });
}

// Д3 аудита платформы (17.10.2026): поиск в шапке одинаково открывает быстрый поиск у трёх направлений,
// а быстрый переход строит меню своего направления, без гостиничных разделов у салона и ресторана
for (const vertical of ['hotel', 'beauty', 'food'] as const) {
  test(`Д3: ${vertical} поиск открывает быстрый поиск по своему меню`, async ({ page, request }) => {
    const f = await (await request.post(`${api}/__test/reset`)).json();
    const branch = {
      hotel: { business: f.hotel, location: f.locations[4], own: 'Календарь', ownHref: '/chessboard' },
      beauty: { business: f.beauty, location: f.locations[3], own: 'Календарь', ownHref: '/calendar' },
      food: { business: f.business, location: f.locations[0], own: 'План зала', ownHref: '/floor-plan' },
    }[vertical];
    await page.context().addCookies([
      {
        name: 'wetop_scope',
        value: encodeURIComponent(`business=${branch.business};location=${branch.location}`),
        domain: '127.0.0.1',
        path: '/',
      },
    ]);
    await page.goto('/marketing');
    await page.locator('.workspace-search').click();
    const dialog = page.getByRole('dialog', { name: 'Быстрый поиск' });
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/\/marketing$/);
    await dialog.getByRole('textbox', { name: 'Запрос' }).fill(branch.own.slice(0, 4));
    await expect(dialog.getByRole('link', { name: branch.own })).toHaveAttribute('href', branch.ownHref);
    if (vertical !== 'hotel') await expect(dialog.locator('a[href="/chessboard"]')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.keyboard.press('ControlOrMeta+k');
    await expect(dialog).toBeVisible();
  });
}

// Д4 аудита платформы (17.10.2026): меню профиля одинаково у трёх направлений, «Помощь» и «Профиль» живут в нём,
// а не отдельными пунктами меню только у салона и ресторана
for (const vertical of ['hotel', 'beauty', 'food'] as const) {
  test(`Д4: ${vertical} меню профиля с «Профилем» и «Помощью»`, async ({ page, request }) => {
    const f = await (await request.post(`${api}/__test/reset`)).json();
    const scope = {
      hotel: `business=${f.hotel};location=${f.locations[4]}`,
      beauty: `business=${f.beauty};location=${f.locations[3]}`,
      food: `business=${f.business};location=${f.locations[0]}`,
    }[vertical];
    await page.context().addCookies([
      { name: 'wetop_scope', value: encodeURIComponent(scope), domain: '127.0.0.1', path: '/' },
    ]);
    await page.goto('/marketing');
    await page.locator('.profile-trigger').click();
    const dropdown = page.locator('#profile-dropdown');
    await expect(dropdown.getByRole('link', { name: 'Профиль' })).toHaveAttribute('href', '/profile');
    await expect(dropdown.getByRole('link', { name: 'Помощь' })).toHaveAttribute('href', '/help');
    await expect(dropdown.getByRole('link', { name: 'Филиалы' })).toHaveAttribute('href', '/branches');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Открыть меню', exact: true }).click();
    await expect(page.locator('.sidenav__panel a[href="/help"]')).toHaveCount(0);
  });
}
