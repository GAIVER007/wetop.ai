import { expect, test } from '@playwright/test';

const api = `http://127.0.0.1:${process.env.BRANCHES_UI_API_PORT ?? '26864'}`;

/**
 * РНП бизнеса (владелец 30.10.2026: «рнп должна быть у клиентов тоже и заполняться туда каждый день все данные»):
 * у салона, ресторана и гостиницы пункт «РНП» в «Статистике», каждый день месяца строкой до сегодня и итог внизу.
 * В `seed-today` у салона выполненная запись 12 000 ₸ сегодня: она в строке сегодняшнего дня и в итоге.
 */
test.afterAll(async ({ request }) => {
  expect((await request.post(`${api}/__test/cleanup`)).ok()).toBe(true);
});

test('РНП салона: дни месяца, сегодняшняя выручка из базы, итог', async ({ page, request }) => {
  test.setTimeout(120_000);
  const f = await (await request.post(`${api}/__test/reset`)).json();
  const seeded = await request.post(`${api}/__test/seed-today`, { data: { analyticsStable: true } });
  expect(seeded.ok(), await seeded.text()).toBe(true);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page
    .context()
    .addCookies([{ name: 'wetop_scope', value: encodeURIComponent(`business=${f.beauty};location=${f.locations[3]}`), domain: '127.0.0.1', path: '/' }]);
  await page.goto('/rnp');
  const rnp = page.getByTestId('business-rnp');
  await expect(rnp).toBeVisible();
  // дни месяца по поясу филиала (Алматы, UTC+5): вечером последнего дня месяца по UTC там уже новый месяц
  const local = new Date(Date.now() + 5 * 3600_000).toISOString();
  const utc = new Date().toISOString();
  const day = local.slice(0, 7) === utc.slice(0, 7) ? Number(utc.slice(8, 10)) - 1 : Number(local.slice(8, 10));
  expect(await rnp.getByTestId('rnp-day').count()).toBeGreaterThanOrEqual(Math.max(1, day));
  await expect(rnp.getByTestId('rnp-revenue')).toContainText('12 000');
  await expect(rnp.getByTestId('rnp-total')).toContainText('12 000');
  await expect(rnp.locator('thead')).toContainText('Новые записи');
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(wide).toBeLessThanOrEqual(0);
  if (process.env.OWNER_SHOTS) await page.screenshot({ path: `${process.env.OWNER_SHOTS}/rnp-beauty.png`, fullPage: true });
});

for (const vertical of ['food', 'hotel'] as const)
  test(`РНП: у ${vertical} своя таблица по дням`, async ({ page, request }) => {
    const f = await (await request.post(`${api}/__test/reset`)).json();
    const scope = vertical === 'hotel' ? `business=${f.hotel};location=${f.locations[4]}` : `business=${f.business};location=${f.locations[0]}`;
    await page.context().addCookies([{ name: 'wetop_scope', value: encodeURIComponent(scope), domain: '127.0.0.1', path: '/' }]);
    await page.goto('/rnp');
    const rnp = page.getByTestId('business-rnp');
    await expect(rnp.locator('thead')).toContainText(vertical === 'hotel' ? 'Заезды' : 'Чеки');
    await expect(rnp.getByTestId('rnp-total')).toBeVisible();
    if (process.env.OWNER_SHOTS) await page.screenshot({ path: `${process.env.OWNER_SHOTS}/rnp-${vertical}.png` });
  });
