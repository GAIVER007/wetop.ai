import { FIXTURE_API, expect, test } from './fixtures';

/**
 * «Заявки с сайта» (аудит «Сайт и SEO» 28.10.2026, S3): просьбы перезвонить и вопросы с сайта у салона, ресторана и
 * гостиницы. Новую берут в работу и закрывают; счётчик «Новые» и фильтры по статусу; телефон нажимается.
 */
test.use({ extraHTTPHeaders: { 'x-wetop-test-client': '1' } });
const salon = { location: '44444444-4444-4444-8444-444444444444', business: '55555555-5555-4555-8555-555555555555' };

test.beforeEach(async ({ page, request }) => {
  expect((await request.post(`${FIXTURE_API}/__test/reset`)).ok()).toBeTruthy();
  await request.post(`${FIXTURE_API}/__test/control`, { data: { role: 'OWNER' } });
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
});

test('гостиница: новые заявки, взять в работу и закрыть', async ({ page }) => {
  await page.goto('/marketing/site/leads');
  const main = page.locator('main');
  await expect(main.getByRole('heading', { level: 1 })).toHaveText('Заявки с сайта');
  await expect(main.getByRole('link', { name: /Новые/ })).toContainText('2');
  const rows = main.getByTestId('site-lead');
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText('Айжан Тестова');
  await expect(rows.first().getByRole('link', { name: '+77010000001' })).toHaveAttribute('href', 'tel:+77010000001');
  await rows.first().getByTestId('site-lead-in_progress').click();
  await expect(rows.first()).toHaveAttribute('data-status', 'IN_PROGRESS');
  await rows.first().getByTestId('site-lead-done').click();
  await expect(rows.first()).toHaveAttribute('data-status', 'DONE');
  await main.getByRole('link', { name: 'Готово', exact: true }).click();
  await expect(page).toHaveURL(/status=DONE/);
  await expect(main.getByTestId('site-lead')).toHaveCount(2);
});

for (const width of [1280, 390])
  test(`салон: заявки открываются, без прокрутки вбок на ${width}`, async ({ page, request }) => {
    await request.post(`${FIXTURE_API}/branches`, {
      data: { id: salon.location, name: 'Салон Заявки', newBusinessId: salon.business, businessName: 'Салон Заявки', vertical: 'BEAUTY' },
    });
    await page.context().addCookies([
      { name: 'wetop_scope', value: encodeURIComponent(`business=${salon.business};location=${salon.location}`), domain: '127.0.0.1', path: '/' },
    ]);
    await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
    await page.goto('/marketing/site/leads');
    await expect(page.locator('main').getByTestId('site-lead')).toHaveCount(2);
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(wide).toBeLessThanOrEqual(0);
    if (process.env.PULT_SHOTS) await page.screenshot({ path: `${process.env.PULT_SHOTS}/leads-salon-${width}.png`, fullPage: true });
  });
