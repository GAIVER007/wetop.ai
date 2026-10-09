import { formatMoney } from '../../apps/web/src/lib/money';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
import { FIXTURE_API, expect, test } from './fixtures';

const evidence = 'reports/finance-cash-first-2026-10-05';
test.beforeEach(async ({ request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
});

test('касса: простой вход, фильтры применяются вместе и сбрасываются', async ({
  page,
  request,
}) => {
  await page.goto('/finance');
  await expect(
    page.getByRole('heading', { name: 'Обзор бизнеса', exact: true, level: 1 }),
  ).toBeVisible();
  await expect(page.getByTestId('cash-summary')).toBeVisible();
  await expect(page.getByTestId('finance-operations')).not.toBeVisible();
  await expect(page.getByTestId('finance-kpis')).not.toBeVisible();
  await expect(page.getByTestId('finance-attention')).not.toBeVisible();
  const params = new URLSearchParams(
    await page
      .getByTestId('period-form')
      .evaluate((form) =>
        new URLSearchParams(new FormData(form as HTMLFormElement) as never).toString(),
      ),
  );
  const ops = await (
    await request.get(
      `${FIXTURE_API}/finance/operations?from=${params.get('from')}&to=${params.get('to')}`,
      { headers: { 'x-wetop-test-client': '1' } },
    )
  ).json();
  const money = (v: string) => formatMoney(v, 'KZT');
  await expect(page.getByTestId('cash-period-income')).toHaveText(
    money((BigInt(ops.paidMinor) + BigInt(ops.incomeMinor)).toString()),
  );
  await expect(page.getByTestId('cash-period-expense')).toHaveText(
    money((BigInt(ops.refundedMinor) + BigInt(ops.expenseMinor)).toString()),
  );
  const before = await page.getByTestId('cash-period-income').innerText();
  await page.getByLabel('Тип операции', { exact: true }).selectOption('expense');
  await page.getByLabel('Способ оплаты', { exact: true }).selectOption('KASPI');
  await expect(page.getByLabel('Источник', { exact: true })).not.toBeVisible();
  await page.getByText('Дополнительные фильтры', { exact: true }).click();
  await page.getByLabel('Источник', { exact: true }).selectOption('cash');
  await page.getByRole('button', { name: 'Показать', exact: true }).click();
  await expect(page).toHaveURL(/op=expense.*method=KASPI.*src=cash/);
  await expect(page.getByTestId('ops-empty')).toBeVisible();
  await expect(page.getByTestId('cash-period-income')).toHaveText(before);
  await page.getByRole('link', { name: 'Сбросить фильтр' }).click();
  await expect(page.getByLabel('Тип операции', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Способ оплаты', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Источник', { exact: true })).toHaveValue('');
  await page.getByText('Отчёты и управление', { exact: true }).click();
  await page.getByRole('tab', { name: 'Обзор', exact: true }).click();
  await expect(page.getByTestId('finance-kpis')).toBeVisible();
});

for (const width of [1440, 390, 360]) {
  test(`касса: доступность и верстка ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : width === 360 ? 740 : 900 });
    await page.goto('/finance');
    await expect(page.getByTestId('cash-summary')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(page.getByTestId('finance-operations')).not.toBeVisible();
    if (width < 600) {
      // с 09.10 над кассой стоит сводка владельца (plans/finance-home-merge-2026-10-09.md):
      // первый экран: сводка, «Показать» достижима прокруткой и остаётся целью не ниже 44 px
      const show = page.getByRole('button', { name: 'Показать', exact: true });
      await show.scrollIntoViewIfNeeded();
      await expect(show).toBeInViewport();
    }
    const axe = await new AxeBuilder({ page }).include('main').analyze();
    expect(axe.violations).toEqual([]);
    if (width < 600) {
      for (const el of await page
        .getByTestId('period-form')
        .locator('select:visible, button:visible')
        .all()) {
        expect((await el.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
    }
    mkdirSync(evidence, { recursive: true });
    await page.screenshot({ path: `${evidence}/${width}.png`, fullPage: true });
  });
}

test('касса: первый экран без лишних кнопок, действия внутри управления', async ({ page }) => {
  await page.goto('/finance');
  await expect(page.getByRole('button', { name: 'Новая операция', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Вчера', exact: true })).toBeVisible();
  const todayHref = await page
    .getByRole('navigation', { name: 'Готовые периоды' })
    .getByRole('link', { name: 'Сегодня', exact: true })
    .getAttribute('href');
  const today = new URL(todayHref!, 'http://localhost').searchParams.get('from')!;
  const yesterday = new Date(`${today}T00:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const date = yesterday.toISOString().slice(0, 10);
  await page.getByRole('link', { name: 'Вчера', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`from=${date}&to=${date}`));
  await page.getByText('Отчёты и управление', { exact: true }).click();
  await page.getByRole('tab', { name: 'Касса', exact: true }).click();
  await page.getByTestId('cash-expense-btn').click();
  await expect(page.getByTestId('cash-operation-form')).toBeVisible();
});

test('касса: визуальная иерархия итогов и спокойный сброс', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/finance');
  // «Финансовый обзор» по макету 09.10: поступления и расходы рядом, одной строкой
  const income = await page.getByTestId('cash-period-income').boundingBox();
  const expense = await page.getByTestId('cash-period-expense').boundingBox();
  expect(Math.abs(expense!.y - income!.y)).toBeLessThanOrEqual(1);
  expect(expense!.x).toBeGreaterThan(income!.x);
  await expect(page.getByTestId('finance-period')).toContainText('За период с');
  expect(
    await page.getByTestId('cash-summary').evaluate((el) => getComputedStyle(el).backgroundColor),
  ).not.toBe('rgba(0, 0, 0, 0)');
  expect(
    await page
      .getByRole('link', { name: 'Сбросить фильтр' })
      .evaluate((el) => getComputedStyle(el).backgroundColor),
  ).toBe('rgba(0, 0, 0, 0)');
});

test('касса: тёмное оформление читается на телефоне', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/finance');
  await expect(page.getByTestId('cash-summary')).toBeVisible();
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
  await page.screenshot({ path: `${evidence}/390-dark.png`, fullPage: true });
});
