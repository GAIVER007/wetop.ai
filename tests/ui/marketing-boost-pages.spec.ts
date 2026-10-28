import { FIXTURE_API, expect, test } from './fixtures';

/**
 * «Продвижение» у всех направлений (владелец 28.10.2026): один пульт у салона, ресторана и гостиницы; нажатие на
 * буст открывает его страницу. Строка ведёт на свой экран, экран открывается без ошибки и без прокрутки вбок.
 */
test.use({ extraHTTPHeaders: { 'x-wetop-test-client': '1' } });
const salon = { location: '44444444-4444-4444-8444-444444444444', business: '55555555-5555-4555-8555-555555555555' };
const food = { location: '66666666-6666-4666-8666-666666666666', business: '77777777-7777-4777-8777-777777777777' };

const BOOSTS = ['site', 'budget', 'ads', 'competitors', 'voice', 'seller', 'content'] as const;

async function enter(page: import('@playwright/test').Page, request: import('@playwright/test').APIRequestContext, vertical: 'HOSPITALITY' | 'BEAUTY' | 'FOOD_SERVICE') {
  expect((await request.post(`${FIXTURE_API}/__test/reset`)).ok()).toBeTruthy();
  await request.post(`${FIXTURE_API}/__test/control`, { data: { role: 'OWNER' } });
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
  if (vertical === 'HOSPITALITY') return;
  const ids = vertical === 'BEAUTY' ? salon : food;
  const name = vertical === 'BEAUTY' ? 'Салон Пульт' : 'Ресторан Пульт';
  expect(
    (
      await request.post(`${FIXTURE_API}/branches`, {
        data: { id: ids.location, name, newBusinessId: ids.business, businessName: name, vertical },
      })
    ).ok(),
  ).toBeTruthy();
  await page.context().addCookies([
    { name: 'wetop_scope', value: encodeURIComponent(`business=${ids.business};location=${ids.location}`), domain: '127.0.0.1', path: '/' },
  ]);
}

for (const vertical of ['BEAUTY', 'FOOD_SERVICE', 'HOSPITALITY'] as const) {
  test(`${vertical}: каждый буст открывает свою страницу`, async ({ page, request }) => {
    test.setTimeout(180_000);
    await enter(page, request, vertical);
    for (const key of BOOSTS) {
      await page.goto('/marketing');
      const link = page.getByTestId(`marketing-${key}-page`);
      await expect(link).toBeVisible();
      const href = await link.getAttribute('href');
      await link.click();
      await expect(page).toHaveURL(new RegExp(`${href!.replace(/[/]/g, '\\/')}(\\?|$)`));
      const main = page.locator('main');
      await expect(main.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(main).not.toContainText('Что-то пошло не так');
      await expect(main).not.toContainText('Раздел недоступен');
      const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(wide, `${key}: прокрутка вбок`).toBeLessThanOrEqual(0);
      if (process.env.PULT_SHOTS)
        await page.screenshot({ path: `${process.env.PULT_SHOTS}/${vertical}-${key}.png` });
    }
  });
}
