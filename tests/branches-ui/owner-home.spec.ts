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
    await page
      .context()
      .addCookies([
        { name: 'wetop_scope', value: encodeURIComponent(scope), domain: '127.0.0.1', path: '/' },
      ]);
    await page.goto('/today');
    const main = page.locator('main#main-content');
    // строка «Обзор бизнеса» снята: шапка Главной одной строкой (решение владельца 21.10.2026)
    await expect(main.getByRole('heading', { level: 1, name: 'Главная' })).toBeVisible();
    await expect(main.getByRole('complementary', { name: 'Решения' })).toBeVisible();
    await expect(main.getByRole('region', { name: 'Куда уходят деньги' })).toBeVisible();
    await main.getByRole('link', { name: 'Рабочий день' }).click();
    await expect(page).toHaveURL(/\/today\/operations$/);
    await expect(page.locator('main#main-content h1')).toBeVisible();
  });
}

/**
 * «Требуют решения» (решение 21.10.2026, docs/decisions/2026-10-21-owner-home-attention.md): настоящие дела дня от
 * `GET /owner-summary`. В `seed-today` у салона одна выполненная запись без оплаты; строк не больше 4, экран не листается.
 */
test('«Требуют решения» салона: запись без оплаты из базы, Главная в одном экране 1280x720', async ({ page, request }) => {
  test.setTimeout(120_000);
  const f = await (await request.post(`${api}/__test/reset`)).json();
  // analyticsStable: записи от 06:00 дня филиала, выполненная запись остаётся «сегодня» и ночью
  const seeded = await request.post(`${api}/__test/seed-today`, { data: { analyticsStable: true } });
  expect(seeded.ok(), await seeded.text()).toBe(true);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page
    .context()
    .addCookies([
      { name: 'wetop_scope', value: encodeURIComponent(`business=${f.beauty};location=${f.locations[3]}`), domain: '127.0.0.1', path: '/' },
    ]);
  await page.goto('/today');
  const block = page.getByRole('region', { name: 'Требуют решения' });
  const unpaid = block.getByTestId('owner-attention-unpaid-visits');
  await expect(unpaid).toContainText('Не оплачено сегодня: 1 запись');
  await expect(unpaid.getByRole('link', { name: 'Журнал', exact: true })).toHaveAttribute('href', '/calendar');
  expect(await block.locator('li').count()).toBeLessThanOrEqual(4);
  const size = await page.evaluate(() => ({
    scroll: document.documentElement.scrollHeight,
    height: window.innerHeight,
    wide: document.documentElement.scrollWidth - window.innerWidth,
  }));
  expect(size.scroll).toBeLessThanOrEqual(size.height);
  expect(size.wide).toBeLessThanOrEqual(0);
});

/**
 * Главная владельца салона «B» (владелец 30.10.2026: «Вариант б хочу»): настоящие записи базы через
 * `GET /beauty/owner-home`. В `seed-today` у салона один клиент: выполненная запись без оплаты (12 000 ₸), неявка,
 * отмена и будущие записи. Выручка 12 000 ₸, путь клиента 1, 1, 0, 0; мастер Анна; без прокрутки вбок на 1280.
 */
test('Главная владельца салона «B»: цифры месяца, путь клиента, мастера, по месяцам', async ({ page, request }) => {
  test.setTimeout(120_000);
  const f = await (await request.post(`${api}/__test/reset`)).json();
  const seeded = await request.post(`${api}/__test/seed-today`, { data: { analyticsStable: true } });
  expect(seeded.ok(), await seeded.text()).toBe(true);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page
    .context()
    .addCookies([
      { name: 'wetop_scope', value: encodeURIComponent(`business=${f.beauty};location=${f.locations[3]}`), domain: '127.0.0.1', path: '/' },
    ]);
  await page.goto('/today');
  const b = page.getByTestId('owner-b');
  // дело дня из базы на месте: запись без оплаты
  await expect(b.getByTestId('owner-attention-unpaid-visits')).toContainText('Не оплачено сегодня: 1 запись');
  await expect(b).toBeVisible();
  await expect(b.getByTestId('owner-b-revenue')).toContainText('12 000');
  await expect(b.getByTestId('owner-b-clients')).toContainText('0');
  await expect(b.getByTestId('owner-b-step-BOOKED')).toContainText('1');
  await expect(b.getByTestId('owner-b-step-CAME')).toContainText('100%');
  await expect(b.getByTestId('owner-b-step-PAID')).toContainText('0%');
  await expect(b.getByTestId('owner-b-master')).toHaveCount(1);
  await expect(b.getByTestId('owner-b-masters')).toContainText('нет оценок');
  await expect(b.getByTestId('owner-b-sources')).toContainText('Оплаченных визитов в этом месяце нет');
  await expect(b.getByTestId('owner-b-months').locator('.owner-b__chart > div')).toHaveCount(6);
  // шапка Главной на месте, дела сегодня и расходы прежней Главной тоже (решения 21.10 и 23.10.2026)
  await expect(page.getByRole('link', { name: 'Рабочий день' })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Решения' })).toContainText('Требуют решения');
  await expect(page.getByRole('region', { name: 'Куда уходят деньги' })).toBeVisible();
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(wide).toBeLessThanOrEqual(0);
  if (process.env.OWNER_SHOTS) await page.screenshot({ path: `${process.env.OWNER_SHOTS}/owner-b-1280.png`, fullPage: true });
  await page.setViewportSize({ width: 1280, height: 720 });
  const tall = await page.evaluate(() => document.documentElement.scrollHeight);
  console.log(`owner-b height at 1280x720: ${tall}`);
  if (process.env.OWNER_SHOTS) await page.screenshot({ path: `${process.env.OWNER_SHOTS}/owner-b-720.png` });
});
