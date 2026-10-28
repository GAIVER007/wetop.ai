import { FIXTURE_API, expect, test } from './fixtures';

/**
 * «Продвижение» салона, вариант В владельца (28.10.2026): сверху цифры месяца, ниже пульт одной строкой на
 * инструмент. На 1280 всё в ширину экрана, без прокрутки вбок; на 390 строки складываются в карточки.
 */
test.use({ extraHTTPHeaders: { 'x-wetop-test-client': '1' } });
const location = '44444444-4444-4444-8444-444444444444';
const business = '55555555-5555-4555-8555-555555555555';

test.beforeEach(async ({ page, request }) => {
  expect((await request.post(`${FIXTURE_API}/__test/reset`)).ok()).toBeTruthy();
  await request.post(`${FIXTURE_API}/__test/control`, { data: { role: 'OWNER' } });
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
  expect(
    (
      await request.post(`${FIXTURE_API}/branches`, {
        data: { id: location, name: 'Салон Пульт', newBusinessId: business, businessName: 'Салон Пульт', vertical: 'BEAUTY' },
      })
    ).ok(),
  ).toBeTruthy();
  await page.context().addCookies([
    { name: 'wetop_scope', value: encodeURIComponent(`business=${business};location=${location}`), domain: '127.0.0.1', path: '/' },
  ]);
});

for (const width of [1280, 390]) {
  test(`салон: пульт «Продвижения» на ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 1280 ? 800 : 844 });
    await page.goto('/marketing');
    const hub = page.getByTestId('business-marketing');
    await expect(hub).toBeVisible();
    await expect(hub.getByTestId('marketing-results')).toBeVisible();
    await expect(hub.locator('[data-module]')).toHaveCount(7);
    if (width === 1280) await expect(hub.getByRole('columnheader', { name: 'Стоимость' })).toBeVisible();
    else await expect(hub.getByTestId('marketing-seller-price')).toContainText('Цена скоро');
    await expect(hub.getByRole('link', { name: /^Подключить: / })).toHaveCount(7);
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(wide).toBeLessThanOrEqual(0);
    if (process.env.PULT_SHOTS) await page.screenshot({ path: `${process.env.PULT_SHOTS}/salon-${width}.png`, fullPage: true });
  });
}
