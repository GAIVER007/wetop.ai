import { formatMoney } from '../../apps/web/src/lib/money';
import { formatPercent } from '../../apps/web/src/lib/dashboard-format';
import { FIXTURE_API, expect, test } from './fixtures';

/**
 * Финансы и Главная одним разделом (план plans/finance-home-merge-2026-10-09.md): блоки Главной
 * живут на /finance, /today гостиницы перенаправляет туда, в меню «Финансы» первой вкладкой без
 * «Главной», деньги показываются один раз и из данных кассы, без заглушек «Нет данных».
 */
const fixture = FIXTURE_API;
const asClient = { headers: { 'x-wetop-test-client': '1' } };

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

test('финансы: один раздел с блоками Главной и деньгами кассы', async ({ page }) => {
  await page.goto('/finance');
  await expect(page.getByRole('heading', { name: 'Финансы', exact: true, level: 1 })).toBeVisible();
  const main = page.getByRole('main');
  // блоки Главной на месте
  const load = main.getByRole('region', { name: 'Загрузка сегодня', exact: true });
  await expect(load.getByTestId('c-occupancy')).toBeVisible();
  await expect(load.getByTestId('owner-outlook-chart')).toBeVisible();
  await expect(main.getByRole('region', { name: 'Сегодня', exact: true })).toBeVisible();
  await expect(main.getByRole('button', { name: 'Требуют внимания', exact: true })).toBeVisible();
  // деньги один раз: сводка кассы вместо блока «Деньги» с заглушками
  await expect(main.getByTestId('cash-summary')).toBeVisible();
  for (const id of ['owner-paid', 'owner-expenses', 'owner-cash', 'owner-total'])
    await expect(main.getByTestId(id)).toHaveCount(0);
  await expect(main.getByText('Нет данных', { exact: true })).toHaveCount(0);
  // загрузка сверяется с ответом шахматки за сегодня
  const d = await (await page.request.get(`${fixture}/desk/today`, asClient)).json();
  const board = await (
    await page.request.get(`${fixture}/chessboard?from=${d.date}&to=${d.date}`, asClient)
  ).json();
  const s = board.summary[d.date];
  const total = s.occupied + s.free + s.blocked;
  const percent = total > 0 ? Math.round((s.occupied * 1000) / total) / 10 : 0;
  await expect(load.getByTestId('c-occupancy')).toHaveText(formatPercent(percent));
  await expect(load.getByTestId('c-free')).toHaveText(String(s.free));
  // расходы за период: живое число из /finance/operations, той же формулой, что у кассы
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
  await expect(main.getByTestId('cash-period-expense')).toHaveText(
    formatMoney((BigInt(ops.refundedMinor) + BigInt(ops.expenseMinor)).toString(), 'KZT'),
  );
});

test('/today гостиницы перенаправляет в финансы', async ({ page }) => {
  await page.goto('/today');
  await expect(page).toHaveURL(/\/finance(?:[?#]|$)/);
  await expect(page.getByRole('heading', { name: 'Финансы', exact: true, level: 1 })).toBeVisible();
});

test('меню: «Финансы» первой вкладкой, «Главной» нет', async ({ page }) => {
  await page.goto('/finance');
  const menu = page.locator('.workspace-header').getByRole('navigation', { name: 'Разделы' });
  await expect(menu.locator('.topmenu__tab').first()).toHaveText('Финансы');
  await expect(menu.getByRole('link', { name: 'Главная', exact: true })).toHaveCount(0);
  await expect(menu.locator('[aria-current="page"]')).toHaveText('Финансы');
});

test('телефон: сводка первым экраном, фильтры достижимы', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/finance');
  await expect(page.getByTestId('cash-summary')).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
  ).toBeLessThanOrEqual(1);
  const show = page.getByRole('button', { name: 'Показать', exact: true });
  await show.scrollIntoViewIfNeeded();
  await expect(show).toBeInViewport();
  expect((await show.boundingBox())!.height).toBeGreaterThanOrEqual(44);
});
