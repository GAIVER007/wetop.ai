import { mkdirSync } from 'node:fs';
import { FIXTURE_API, expect, test } from './fixtures';

/**
 * «Финансы за период», срез F2 (ADR-113, план `plans/finance-f2-2026-09-28.md`): раздел «Оплаты и возвраты» с
 * отбором по типу и способу, переход от плиток и таблицы способов к строкам, выгрузка CSV, сбой одного запроса.
 * Брони подставного API вымышленные (ADR-010); возврат есть только в витрине `design-seed` (DSG-RETD).
 */
const fixture = FIXTURE_API;
const report = 'reports/finance-compact-2026-10-01/operations';
const today = new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
const add = (days: number) =>
  new Date(Date.parse(today) + days * 86400000).toISOString().slice(0, 10);
const from = add(-5);
const url = `/finance?from=${from}&to=${today}`;

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});
test.afterEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

test('F2: оплаты и возвраты — колонки, строка итога, новыми первыми; плитки ведут к деталям', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(url);
  const main = page.getByRole('main');
  await page.getByRole('tab', { name: 'Операции', exact: true }).click();
  const section = main.getByTestId('finance-operations');
  await expect(section.getByRole('heading', { level: 2 })).toHaveText('Операции за период');
  await expect(section.getByTestId('ops-table').getByRole('columnheader')).toHaveText([
    'Дата и время',
    'Тип',
    'Бронь',
    'Гость / статья',
    'Способ',
    'Сумма',
    'Статус',
  ]);
  await expect(section.getByTestId('ops-meta')).toContainText('оплачено');
  const rows = section.getByTestId('op-row');
  expect(await rows.count()).toBeGreaterThan(0);
  const times = await rows
    .locator('time')
    .evaluateAll((xs) => xs.map((x) => x.getAttribute('datetime')!));
  expect(times).toEqual([...times].sort().reverse());
  await expect(rows.first().getByRole('link')).toHaveAttribute('href', /#booking-finance$/);

  // «Начислено» — к видам начислений, «Оплачено» — к оплатам, «Возвращено» — к возвратам
  await main.getByTestId('kpi-charged').click();
  await expect(page).toHaveURL(/#charges$/);
  await expect(main.locator('#charges')).toBeInViewport();
  await main.getByTestId('kpi-paid').click();
  await expect(page).toHaveURL(/op=payment#operations$/);
  const types = main.getByRole('navigation', { name: 'Тип операций' });
  await expect(types.getByRole('link', { name: 'Оплаты', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  for (const row of await main.getByTestId('op-row').all())
    await expect(row).toHaveAttribute('data-kind', 'PAYMENT');
  await main.getByTestId('kpi-refunded').click();
  await expect(page).toHaveURL(/op=refund#operations$/);
  await expect(main.getByTestId('ops-empty')).toHaveText('По этому отбору операций за период нет.');
});

test('F2: способ в «Оплатах по способам» ведёт к его операциям; чипы способов с числами', async ({
  page,
}) => {
  await page.goto(url);
  const main = page.getByRole('main');
  await main.getByTestId('payments-table').getByRole('link', { name: 'Наличные' }).click();
  await expect(page).toHaveURL(/op=payment&method=CASH#operations$/);
  const methods = main.getByRole('navigation', { name: 'Способ оплаты' });
  await expect(methods.getByRole('link', { name: /^Наличные/ })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(main.getByTestId('ops-meta')).toContainText('по отбору');
  for (const row of await main.getByTestId('op-row').all())
    await expect(row).toContainText('Наличные');
  await methods.getByRole('link', { name: 'Все способы' }).click();
  await expect(page).toHaveURL(/op=payment#operations$/);
});

test('F2: возврат с минусом и статусом «проведён»; «Показать все» раскрывает список', async ({
  page,
  request,
}) => {
  expect((await request.post(`${fixture}/__test/design-seed`)).ok()).toBe(true);
  await page.goto(`${url}&op=refund#operations`);
  const main = page.getByRole('main');
  const refund = main.getByTestId('op-row').first();
  await expect(refund).toHaveAttribute('data-kind', 'REFUND');
  await expect(refund).toContainText('Возврат');
  await expect(refund).toContainText('проведён');
  await expect(refund.getByTestId('op-amount')).toHaveText(/^−/);

  await page.goto(`${url}#operations`);
  await expect(main.getByTestId('op-row')).toHaveCount(20);
  await main.getByTestId('ops-more').click();
  await expect(page).toHaveURL(/ops=all#operations$/);
  expect(await main.getByTestId('op-row').count()).toBeGreaterThan(20);
});

test('F2: выгрузка CSV — те же отборы, BOM и «;», без имён гостей; неверные даты — отказ словами', async ({
  page,
  request,
}) => {
  expect((await request.post(`${fixture}/__test/design-seed`)).ok()).toBe(true);
  await page.goto(`${url}&op=refund#operations`);
  const link = page.getByRole('main').getByTestId('ops-export');
  await expect(link).toHaveAttribute('href', `/finance/export?from=${from}&to=${today}&op=refund`);
  const csv = await page.request.get(`/finance/export?from=${from}&to=${today}&op=refund`);
  expect(csv.status()).toBe(200);
  expect(csv.headers()['content-type']).toContain('text/csv');
  expect(csv.headers()['content-disposition']).toContain(`wetop-operations-${from}_${today}.csv`);
  const body = (await csv.body()).toString('utf8');
  expect(body.startsWith('\uFEFF')).toBe(true);
  const lines = body.slice(1).split('\r\n');
  expect(lines[0]).toBe('Дата;Время;Тип;Статус;Способ;Сумма, ₸;Бронь;Статья;Комментарий');
  expect(lines.length).toBeGreaterThan(1);
  for (const line of lines.slice(1)) expect(line).toMatch(/;Возврат;проведён;[^;]+;-\d+,\d\d;/);
  expect(body).not.toMatch(/Гость|Посетитель|Клиент/);

  const all = await page.request.get(`/finance/export?from=${from}&to=${today}`);
  expect((await all.body()).toString('utf8')).toContain(';Оплата;проведена;Наличные;');
  const bad = await page.request.get(`/finance/export?from=${today}&to=${from}`);
  expect(bad.status()).toBe(400);
  expect(await bad.text()).toContain('Проверьте даты');
});

test('F2: сбой операций не роняет итоги и долги; сбой видно в разделе', async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/control`, { data: { failPath: '/finance/operations' } });
  await page.goto(url);
  const main = page.getByRole('main');
  await expect(main.getByTestId('charged')).toBeVisible();
  await page.getByRole('tab', { name: 'Долги', exact: true }).click();
  await expect(main.getByTestId('finance-debts')).toBeVisible();
  await page.getByRole('tab', { name: 'Операции', exact: true }).click();
  await expect(main.getByTestId('ops-error')).toBeVisible();
  await expect(main.getByTestId('op-row')).toHaveCount(0);
});

for (const theme of ['light', 'dark'] as const) {
  test(`F2, снимки для владельца, ${theme}`, async ({ page, request }) => {
    test.setTimeout(120_000);
    expect((await request.post(`${fixture}/__test/design-seed`)).ok()).toBe(true);
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${url}#operations`);
    const section = page.getByRole('main').getByTestId('finance-operations');
    await expect(section.getByTestId('ops-table')).toBeVisible();
    await page.mouse.move(0, 0);
    mkdirSync(report, { recursive: true });
    await section.screenshot({ path: `${report}/${theme}-operations.png` });
    await page.goto(`${url}&op=refund#operations`);
    await expect(section.getByTestId('op-row').first()).toBeVisible();
    await section.screenshot({ path: `${report}/${theme}-refunds.png` });
    await page.goto(url);
    await page.screenshot({
      path: `${report}/${theme}-1440-full.png`,
      fullPage: true,
      caret: 'initial',
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${url}#operations`);
    await expect(section.getByTestId('ops-table')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({
      path: `${report}/${theme}-390-full.png`,
      fullPage: true,
      caret: 'initial',
    });
  });
}
