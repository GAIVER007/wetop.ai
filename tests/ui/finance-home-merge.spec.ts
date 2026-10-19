import { formatMoney } from '../../apps/web/src/lib/money';
import { formatPercent } from '../../apps/web/src/lib/dashboard-format';
import { FIXTURE_API, expect, test, sideNav } from './fixtures';

/**
 * «Главная» и «Финансы» разделены заново (ADR-180, решение владельца 13.10.2026 поверх ADR-152):
 * `/finance` — денежный экран по эталону `design/references/03_finance_analytics/finance_owner_2026-10-13.webp`
 * (четыре плитки, динамика, структура доходов, операции, расходы по статьям, способы, отчёты, аналитика;
 * ниже прежние отборы, долги и касса), `/today` у гостиницы — «Главная»: загрузка с прогнозом,
 * «Сегодня» и «Что требует внимания». Числа сверяются с подставным API: цифры макета вымышленные.
 */
const fixture = FIXTURE_API;
const asClient = { headers: { 'x-wetop-test-client': '1' } };

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

test('финансы: четыре плитки эталона из тех же API, блоки без заглушек', async ({ page }) => {
  await page.goto('/finance');
  await expect(page.getByRole('heading', { name: 'Финансы', exact: true, level: 1 })).toBeVisible();
  const main = page.getByRole('main');
  const board = main.getByTestId('finance-board');

  // суммы периода из того же API, что экран
  const params = new URLSearchParams(
    await page
      .getByTestId('period-form')
      .evaluate((form) =>
        new URLSearchParams(new FormData(form as HTMLFormElement) as never).toString(),
      ),
  );
  const range = `from=${params.get('from')}&to=${params.get('to')}`;
  const ops = await (
    await page.request.get(`${fixture}/finance/operations?${range}`, asClient)
  ).json();
  const report = await (
    await page.request.get(`${fixture}/finance/report?${range}`, asClient)
  ).json();
  const income = BigInt(ops.paidMinor) + BigInt(ops.incomeMinor);
  const profit = income - BigInt(ops.refundedMinor) - BigInt(ops.expenseMinor);
  const kpis = board.getByRole('region', { name: 'Деньги за период', exact: true });
  await expect(kpis.getByTestId('fin-charged')).toHaveText(formatMoney(report.chargedMinor, 'KZT'));
  await expect(kpis.getByTestId('fin-income')).toHaveText(formatMoney(income.toString(), 'KZT'));
  await expect(kpis.getByTestId('fin-expense')).toHaveText(formatMoney(ops.expenseMinor, 'KZT'));
  await expect(kpis.getByTestId('fin-profit')).toHaveText(formatMoney(profit.toString(), 'KZT'));

  // блоки эталона на месте, числа из данных
  await expect(board.getByRole('heading', { name: 'Динамика поступлений, возвратов и расходов' })).toBeVisible();
  await expect(board.getByTestId('fin-dynamics').locator('.line__legend')).toContainText('Возвраты и расходы');
  await expect(board.getByTestId('fin-dynamics').locator('.line__legend')).toContainText(
    formatMoney((BigInt(ops.refundedMinor) + BigInt(ops.expenseMinor)).toString(), 'KZT'),
  );
  await expect(board.getByTestId('fin-dynamics')).toContainText(
    formatMoney(income.toString(), 'KZT'),
  );
  await expect(board.getByRole('heading', { name: 'Структура доходов' })).toBeVisible();
  await expect(board.getByRole('heading', { name: 'Расходы по категориям' })).toBeVisible();
  await expect(board.getByRole('heading', { name: 'Финансовые отчёты' })).toBeVisible();
  await expect(board.getByRole('heading', { name: 'Аналитика и прогнозы' })).toBeVisible();
  // «Финансовый обзор»: возвраты отдельной строкой (ADR-176) и остаток на счетах
  const money = board.getByTestId('cash-summary');
  await expect(money.getByTestId('cash-period-income')).toHaveText(
    formatMoney(income.toString(), 'KZT'),
  );
  await expect(money.getByTestId('cash-period-refunds')).toHaveText(
    formatMoney(ops.refundedMinor, 'KZT'),
  );
  await expect(money.getByTestId('cash-period-expense')).toHaveText(
    formatMoney(ops.expenseMinor, 'KZT'),
  );
  const cash = await (await page.request.get(`${fixture}/finance/cash`, asClient)).json();
  await expect(money.getByTestId('cash-balance')).toHaveText(
    formatMoney(cash.totalMinor, cash.currency),
  );
  await expect(board.getByTestId('recent-ops').getByTestId('recent-op-row')).toHaveCount(
    Math.min(7, ops.rows.length),
  );
  await expect(main.getByTestId('finance-export-top')).toHaveAttribute(
    'href',
    `/finance/export?${range}`,
  );
  await expect(main.getByText('Нет данных', { exact: true })).toHaveCount(0);

  // один контрол периода (Q-DES-1): конкурирующей полосы пресетов в шапке нет
  await expect(main.getByTestId('finance-period')).toBeVisible();
  await expect(main.getByRole('navigation', { name: 'Период обзора' })).toHaveCount(0);

  // операционные блоки бывшего «Обзора бизнеса» уехали на «Главную» (ADR-180)
  await expect(
    main.getByRole('region', { name: 'Загрузка и операционные показатели' }),
  ).toHaveCount(0);
  await expect(main.getByTestId('owner-risks')).toHaveCount(0);
});

test('главная гостиницы: /today с загрузкой, «Сегодня» и «Что требует внимания»', async ({
  page,
}) => {
  await page.goto('/today');
  await expect(page).toHaveURL(/\/today(?:[?#]|$)/);
  await expect(page.getByRole('heading', { name: 'Главная', exact: true, level: 1 })).toBeVisible();
  const main = page.getByRole('main');

  // загрузка и прогноз: те же числа, что в API доски
  const d = await (await page.request.get(`${fixture}/desk/today`, asClient)).json();
  const board = await (
    await page.request.get(`${fixture}/chessboard?from=${d.date}&to=${d.date}`, asClient)
  ).json();
  const s = board.summary[d.date];
  const total = s.occupied + s.free + s.blocked;
  const percent = total > 0 ? Math.round((s.occupied * 1000) / total) / 10 : 0;
  const load = main.getByRole('region', { name: 'Загрузка и операционные показатели' });
  await expect(load.getByTestId('c-occupancy')).toHaveText(formatPercent(percent));
  await expect(load.getByTestId('c-free')).toHaveText(String(s.free));
  await page.getByText('Прогноз загрузки', {exact:true}).click();
  await expect(load.getByTestId('owner-outlook-chart')).toBeVisible();

  const today = main.getByRole('region', { name: 'Сегодня', exact: true });
  await expect(today.getByTestId('biz-arrivals')).toHaveText(String(d.counts.arrivals));
  await expect(today.getByTestId('biz-departures')).toHaveText(String(d.counts.departures));
  await expect(main.getByRole('region', { name: 'Что требует внимания' })).toBeVisible();
});

test('очередь «Требуют внимания» открывается из «Все задачи» на главной', async ({ page }) => {
  await page.goto('/today');
  await page.getByRole('button', { name: 'Все задачи', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Требуют внимания', exact: true })).toBeVisible();
  await expect(page.locator('#day-attention')).toHaveCount(1);
});

// верхнее меню 17.10.2026: Главная, Журнал, ..., «Финансы» восьмым разделом
test('меню: «Главная» первой вкладкой, «Финансы» группой после склада', async ({ page }) => {
  await page.goto('/finance');
  const menu = sideNav(page);
  await expect(menu.locator('.sidenav__section').first()).toHaveText('Главная');
  await expect(menu.locator('.sidenav__section').nth(1)).toHaveText('Журнал');
  await expect(menu.locator('.sidenav__section').nth(7)).toHaveText('Финансы');
  // активная отметка живёт на пункте группы: на /finance это «Движение денег»
  await expect(menu.locator('.sidenav__items [aria-current="page"]')).toHaveText('Движение денег');
  await page.goto('/today');
  await expect(sideNav(page).locator('.sidenav__section').first()).toHaveText('Главная');
});

test('телефон: плитки денег первым экраном, фильтры достижимы', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/finance');
  await expect(page.getByTestId('fin-income')).toBeInViewport();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
  ).toBeLessThanOrEqual(1);
  await page.locator('#finance-filters').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('period-form')).toBeVisible();
});
