import { formatMoney } from '../../apps/web/src/lib/money';
import { formatPercent } from '../../apps/web/src/lib/dashboard-format';
import { FIXTURE_API, expect, test } from './fixtures';

/**
 * Единый раздел «Финансы» по макету владельца 09.10.2026 («Обзор бизнеса», план
 * plans/finance-overview-2026-10-09.md поверх слияния ADR-152): плитки показателей, загрузка с
 * прогнозом, финансовый обзор с остатками, способы оплаты, «Сегодня», «Что требует внимания»,
 * «Последние операции»; /today гостиницы ведёт сюда, в меню «Финансы» первой вкладкой без
 * «Главной». Числа сверяются с подставным API, а не с макетом: его цифры вымышленные.
 */
const fixture = FIXTURE_API;
const asClient = { headers: { 'x-wetop-test-client': '1' } };

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

test('обзор бизнеса: плитки, блоки макета и деньги кассы без заглушек', async ({ page }) => {
  await page.goto('/finance');
  await expect(
    page.getByRole('heading', { name: 'Обзор бизнеса', exact: true, level: 1 }),
  ).toBeVisible();
  const main = page.getByRole('main');

  // суммы периода из того же API, что экран
  const params = new URLSearchParams(
    await page
      .getByTestId('period-form')
      .evaluate((form) =>
        new URLSearchParams(new FormData(form as HTMLFormElement) as never).toString(),
      ),
  );
  const ops = await (
    await page.request.get(
      `${fixture}/finance/operations?from=${params.get('from')}&to=${params.get('to')}`,
      asClient,
    )
  ).json();
  const income = BigInt(ops.paidMinor) + BigInt(ops.incomeMinor);
  const expense = BigInt(ops.refundedMinor) + BigInt(ops.expenseMinor);

  // плитки показателей: выручка, чистая прибыль, свободные места
  const kpis = main.getByRole('region', { name: 'Ключевые показатели', exact: true });
  await expect(kpis.getByTestId('biz-revenue')).toHaveText(formatMoney(income.toString(), 'KZT'));
  await expect(kpis.getByTestId('biz-profit')).toHaveText(
    formatMoney((income - expense).toString(), 'KZT'),
  );
  const d = await (await page.request.get(`${fixture}/desk/today`, asClient)).json();
  const board = await (
    await page.request.get(`${fixture}/chessboard?from=${d.date}&to=${d.date}`, asClient)
  ).json();
  const s = board.summary[d.date];
  const total = s.occupied + s.free + s.blocked;
  await expect(kpis.getByTestId('biz-free')).toHaveText(String(s.free));
  const percent = total > 0 ? Math.round((s.occupied * 1000) / total) / 10 : 0;
  await expect(kpis.getByTestId('biz-occupancy')).toHaveText(formatPercent(percent));

  // загрузка и прогноз в одном блоке
  const load = main.getByRole('region', { name: 'Загрузка и операционные показатели' });
  await expect(load.getByTestId('c-occupancy')).toHaveText(formatPercent(percent));
  await expect(load.getByTestId('c-free')).toHaveText(String(s.free));
  await expect(load.getByTestId('owner-outlook-chart')).toBeVisible();

  // финансовый обзор: поступления, расходы, движение по дням, остаток на счетах
  const money = main.getByTestId('cash-summary');
  await expect(money.getByTestId('cash-period-income')).toHaveText(
    formatMoney(income.toString(), 'KZT'),
  );
  await expect(money.getByTestId('cash-period-expense')).toHaveText(
    formatMoney(expense.toString(), 'KZT'),
  );
  const cash = await (await page.request.get(`${fixture}/finance/cash`, asClient)).json();
  await expect(money.getByTestId('cash-balance')).toHaveText(
    formatMoney(cash.totalMinor, cash.currency),
  );
  await expect(money.getByTestId('cash-flow-chart')).toBeVisible();

  // способы оплаты полосками, «Сегодня» и внимание
  await expect(
    main
      .getByRole('region', { name: 'Поступления по способам оплаты' })
      .locator('progress')
      .first(),
  ).toBeVisible();
  const today = main.getByRole('region', { name: 'Сегодня', exact: true });
  await expect(today.getByTestId('biz-arrivals')).toHaveText(String(d.counts.arrivals));
  await expect(today.getByTestId('biz-departures')).toHaveText(String(d.counts.departures));
  await expect(main.getByRole('region', { name: 'Что требует внимания' })).toBeVisible();

  // последние операции сразу, без «Показать»
  await expect(main.getByTestId('recent-ops').getByTestId('recent-op-row')).toHaveCount(
    Math.min(7, ops.rows.length),
  );

  // блок «Деньги» с заглушками не вернулся
  for (const id of ['owner-paid', 'owner-expenses', 'owner-cash', 'owner-total'])
    await expect(main.getByTestId(id)).toHaveCount(0);
  await expect(main.getByText('Нет данных', { exact: true })).toHaveCount(0);
});

test('очередь «Требуют внимания» открывается из «Все задачи»', async ({ page }) => {
  await page.goto('/finance');
  await page.getByRole('button', { name: 'Все задачи', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Требуют внимания', exact: true })).toBeVisible();
  await expect(page.locator('#day-attention')).toHaveCount(1);
});

test('/today гостиницы перенаправляет в финансы', async ({ page }) => {
  await page.goto('/today');
  await expect(page).toHaveURL(/\/finance(?:[?#]|$)/);
  await expect(
    page.getByRole('heading', { name: 'Обзор бизнеса', exact: true, level: 1 }),
  ).toBeVisible();
});

test('меню: «Финансы» первой вкладкой, «Главной» нет', async ({ page }) => {
  await page.goto('/finance');
  const menu = page.locator('.workspace-header').getByRole('navigation', { name: 'Разделы' });
  await expect(menu.locator('.topmenu__tab').first()).toHaveText('Финансы');
  await expect(menu.getByRole('link', { name: 'Главная', exact: true })).toHaveCount(0);
  // активная отметка живёт на пункте группы (ADR-157): на /finance это «Оплаты и касса»
  await expect(menu.locator('[aria-current="page"]')).toHaveText('Оплаты и касса');
});

test('период в шапке: Сегодня, 7 дней, Месяц; Месяц по умолчанию', async ({ page }) => {
  await page.goto('/finance');
  const period = page.getByRole('navigation', { name: 'Период обзора', exact: true });
  await expect(period.getByRole('link', { name: 'Месяц', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await period.getByRole('link', { name: '7 дней', exact: true }).click();
  await expect(page).toHaveURL(/from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}/);
  await expect(page.getByTestId('cash-period-income')).toBeVisible();
});

test('телефон: показатели первым экраном, фильтры достижимы', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/finance');
  await expect(
    page
      .getByRole('region', { name: 'Ключевые показатели', exact: true })
      .getByTestId('biz-revenue'),
  ).toBeInViewport();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
  ).toBeLessThanOrEqual(1);
  const show = page.getByRole('button', { name: 'Показать', exact: true });
  await show.scrollIntoViewIfNeeded();
  await expect(show).toBeInViewport();
  expect((await show.boundingBox())!.height).toBeGreaterThanOrEqual(44);
});
