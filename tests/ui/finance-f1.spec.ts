import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from './fixtures';

/**
 * «Финансы за период», срез F1 (ADR-113, план `plans/finance-f1-2026-09-27.md`). Проверяет критерии среза и
 * снимает стоп-гейт для владельца: шапка и период одной строкой, четыре итога одной высоты в ряд, «Требует
 * внимания», структура денег с «Итого», список «Брони с остатком к сбору» с отбором и действиями, «только
 * чтение», сбой одного запроса. Брони подставного API — вымышленные (ADR-010): 20260913-TESTAA и TEST1…8,
 * из них TEST4 уже выехала с остатком.
 */
const fixture = 'http://127.0.0.1:4311';
const report = 'reports/finance-f1-2026-09-27';
const today = new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
const add = (days: number) =>
  new Date(Date.parse(today) + days * 86400000).toISOString().slice(0, 10);
// заезды фикстуры — сегодня и позавчера: окно в шесть дней ловит их при любом «сегодня»
const from = add(-5);
const url = `/finance?from=${from}&to=${today}`;

interface Debts {
  count: number;
  checkedOut: { count: number };
  rows: Array<{ confirmationNumber: string; status: string }>;
}

async function debtsOf(request: import('@playwright/test').APIRequestContext): Promise<Debts> {
  const res = await request.get(`${fixture}/finance/debts?from=${from}&to=${today}`, {
    headers: { 'x-wetop-test-client': '1' },
  });
  expect(res.ok()).toBe(true);
  return (await res.json()) as Debts;
}
const money = (text: string) => Number(text.replace(/[^\d]/g, ''));

/** Вход стойки — как в reservations-v2.spec: «только чтение» видит вошедший */
async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
}

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});
test.afterEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

test('F1: заголовок и период в подзаголовке, период одной строкой, четыре итога одной высоты', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(url);
  const main = page.getByRole('main');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Финансы за период');
  await expect(main.getByTestId('finance-period')).toContainText('→');
  await expect(main.getByTestId('finance-period')).toContainText(', 6 дней');
  // одна кнопка действия: оплата принимается только на счёте брони
  await expect(page.locator('.page__actions a')).toHaveText(['Найти бронь для оплаты']);

  // «С», «По», готовые отрезки и «Показать» — одной строкой
  const form = main.getByTestId('period-form');
  const middle = async (l: import('@playwright/test').Locator) => {
    const b = (await l.boundingBox())!;
    return b.y + b.height / 2;
  };
  const line = await middle(form.getByLabel('Период: с'));
  for (const part of [
    form.getByLabel('Период: по'),
    form.getByRole('link', { name: 'Этот месяц', exact: true }),
    form.getByRole('button', { name: 'Показать', exact: true }),
  ])
    expect(Math.abs((await middle(part)) - line)).toBeLessThanOrEqual(4);
  await expect(
    main.getByText('Начисления — по дате услуги, оплаты и возвраты — по дате операции.'),
  ).toHaveCount(1);

  // четыре итога: порядок, один ряд, одна высота
  const tiles = main.getByTestId('finance-kpis').locator('.stat');
  await expect(tiles.locator('.stat__label')).toHaveText([
    'Начислено',
    'Оплачено',
    'Возвращено',
    'К сбору',
  ]);
  const boxes = await tiles.evaluateAll((xs) =>
    xs.map((x) => {
      const r = x.getBoundingClientRect();
      return { top: r.top, height: r.height };
    }),
  );
  for (const b of boxes) {
    expect(Math.abs(b.top - boxes[0]!.top)).toBeLessThanOrEqual(1);
    expect(Math.abs(b.height - boxes[0]!.height)).toBeLessThanOrEqual(1);
  }
  // «К сбору» ведёт к списку долгов
  await main.getByTestId('kpi-due').click();
  await expect(page).toHaveURL(/#debts$/);
  await expect(main.locator('#debts')).toBeInViewport();
});

test('F1: «Требует внимания» — сумма к сбору и выехавшие со ссылками к списку, возвраты справкой', async ({
  page,
  request,
}) => {
  const debts = await debtsOf(request);
  expect(debts.count, 'в фикстуре нужны должники').toBeGreaterThan(1);
  expect(debts.checkedOut.count, 'в фикстуре нужен выехавший с долгом').toBeGreaterThan(0);
  await page.goto(url);
  const main = page.getByRole('main');
  const attention = main.getByTestId('finance-attention');
  await expect(attention.getByRole('heading', { level: 2 })).toHaveText('Требует внимания');
  await expect(attention.getByTestId('attention-due')).toContainText('к сбору');
  await expect(attention.getByTestId('attention-due')).toContainText(`${debts.count} брон`);
  await expect(attention.getByTestId('attention-left')).toContainText('гость уже выехал');
  // возвратов в фикстуре нет — строки о них тоже нет, «проблем не найдено» не пишется при долгах
  await expect(attention.getByTestId('attention-refunds')).toHaveCount(0);
  await expect(attention).not.toContainText('проблем не найдено');

  await attention.getByTestId('attention-left').getByRole('link').click();
  await expect(page).toHaveURL(/debts=left#debts$/);
  const rows = main.getByTestId('debt-row');
  await expect(rows).toHaveCount(debts.checkedOut.count);
  for (const row of await rows.all()) await expect(row).toContainText('завершена');
  await expect(
    main
      .getByRole('navigation', { name: 'Отбор долгов' })
      .getByRole('link', { name: /Гость выехал/ }),
  ).toHaveAttribute('aria-current', 'page');
});

test('F1: структура денег — четыре вида всегда, «Итого» сходится с итогами, две колонки на 1440', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(url);
  const main = page.getByRole('main');
  const charges = main.getByTestId('charges-table');
  await expect(charges.getByTestId('report-row').locator('td:first-child')).toHaveText([
    'Проживание',
    'Услуги',
    'Штрафы',
    'Корректировки',
  ]);
  await expect(main.getByTestId('charges-table-total')).toHaveText(
    (await main.getByTestId('charged').innerText()).trim(),
  );
  await expect(main.getByTestId('payments-table-total')).toHaveText(
    (await main.getByTestId('paid').innerText()).trim(),
  );
  await expect(main.getByTestId('category-table').getByRole('columnheader')).toHaveText([
    'Категория',
    'Проживаний',
    'Сумма',
  ]);
  const left = (await main.getByTestId('finance-charges').boundingBox())!;
  const right = (await main.getByTestId('finance-money').boundingBox())!;
  expect(Math.abs(left.y - right.y)).toBeLessThanOrEqual(1);
  expect(right.x).toBeGreaterThan(left.x + left.width - 1);
});

test('F1: брони с остатком — колонки, крупные долги первыми, «Принять оплату» ведёт на счёт брони', async ({
  page,
  request,
}) => {
  const debts = await debtsOf(request);
  await page.goto(url);
  const main = page.getByRole('main');
  const table = main.getByTestId('debts-table');
  await expect(table.getByRole('columnheader')).toHaveText([
    'Бронь',
    'Гость',
    'Проживание',
    'Начислено',
    'Оплачено',
    'Остаток',
    'Статус',
    'Действия',
  ]);
  await expect(main.getByTestId('debt-row')).toHaveCount(Math.min(debts.count, 20));
  const balances = (await main.getByTestId('debt-balance').allInnerTexts()).map(money);
  expect(balances).toEqual([...balances].sort((a, b) => b - a));
  expect(balances.every((x) => x > 0)).toBe(true);
  // итог списка назван словами; если он расходится с плиткой «К сбору» — сказано почему
  await expect(main.getByTestId('debts-meta')).toContainText(`${debts.count} брон`);
  if (money(await main.getByTestId('balance').innerText()) !== balances.reduce((a, b) => a + b, 0))
    await expect(main.getByTestId('debts-differs')).toContainText('только деньги этого периода');

  const first = debts.rows[0]!.confirmationNumber;
  const row = main.getByTestId('debt-row').first();
  await expect(row).toContainText(first);
  await row.getByRole('link', { name: 'Принять оплату' }).click();
  await expect(page).toHaveURL(new RegExp(`/reservations/${first}#booking-finance$`));
  await expect(page.locator('#booking-finance')).toBeVisible();
});

test('F1: «только чтение» — список долгов виден, «Принять оплату» нет', async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/control`, { data: { orgTrialDays: 'ended' } });
  await signIn(page);
  await page.goto(url);
  const main = page.getByRole('main');
  await expect(main.getByTestId('debt-row').first()).toBeVisible();
  await expect(main.getByRole('link', { name: 'Принять оплату' })).toHaveCount(0);
  await expect(
    main.getByTestId('debt-row').first().getByRole('link', { name: 'Открыть' }),
  ).toBeVisible();
});

test('F1: сбой списка долгов не роняет итоги; пустой период — «проблем не найдено»', async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/control`, { data: { failPath: '/finance/debts' } });
  await page.goto(url);
  const main = page.getByRole('main');
  await expect(main.getByTestId('charged')).toBeVisible();
  await expect(main.getByTestId('debts-error')).toBeVisible();
  await expect(main.getByTestId('attention-failed')).toContainText('не загрузился');
  await expect(main.getByTestId('debt-row')).toHaveCount(0);

  await request.post(`${fixture}/__test/control`, { data: { empty: true } });
  await page.goto(url);
  await expect(main.getByTestId('finance-attention')).toContainText('За период проблем не найдено');
  await expect(main.getByTestId('debts-empty')).toContainText('оплачены');
  await expect(main.getByRole('navigation', { name: 'Отбор долгов' })).toHaveCount(0);
});

test('F1: телефон — без прокрутки страницы вбок, итоги столбиком, таблица долгов листается внутри', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url);
  const main = page.getByRole('main');
  await expect(main.getByTestId('debts-table')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  const xs = await main
    .getByTestId('finance-kpis')
    .locator('.stat')
    .evaluateAll((tiles) => tiles.map((t) => Math.round(t.getBoundingClientRect().left)));
  expect(new Set(xs).size).toBe(1);
});

for (const theme of ['light', 'dark'] as const) {
  test(`F1, стоп-гейт: снимки для владельца, ${theme}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(url);
    const main = page.getByRole('main');
    await expect(main.getByTestId('debts-table')).toBeVisible();
    await page.mouse.move(0, 0);
    mkdirSync(report, { recursive: true });
    await page.screenshot({ path: `${report}/${theme}-1440.png`, caret: 'initial' });
    await page.screenshot({
      path: `${report}/${theme}-1440-full.png`,
      caret: 'initial',
      fullPage: true,
    });
    await main
      .getByTestId('finance-debts')
      .screenshot({ path: `${report}/${theme}-debts-closeup.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: `${report}/${theme}-390-full.png`,
      caret: 'initial',
      fullPage: true,
    });
  });
}
