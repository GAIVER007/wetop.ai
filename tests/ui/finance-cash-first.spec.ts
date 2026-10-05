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
  await expect(page.getByRole('heading', { name: 'Касса', exact: true, level: 1 })).toBeVisible();
  await expect(page.getByTestId('cash-summary')).toBeVisible();
  await expect(page.getByTestId('finance-operations')).toBeVisible();
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
  await page.getByLabel('Источник', { exact: true }).selectOption('cash');
  await page.getByRole('button', { name: 'Показать', exact: true }).click();
  await expect(page).toHaveURL(/op=expense.*method=KASPI.*src=cash/);
  await expect(page.getByTestId('ops-empty')).toBeVisible();
  await expect(page.getByTestId('cash-period-income')).toHaveText(before);
  await page.getByRole('link', { name: 'Сбросить фильтр' }).click();
  await expect(page.getByLabel('Тип операции', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Способ оплаты', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Источник', { exact: true })).toHaveValue('');
  await page.getByRole('tab', { name: 'Обзор', exact: true }).click();
  await expect(page.getByTestId('finance-kpis')).toBeVisible();
});

for (const width of [1440, 390]) {
  test(`касса: доступность и верстка ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/finance');
    await expect(page.getByTestId('cash-summary')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const axe = await new AxeBuilder({ page }).include('main').analyze();
    expect(axe.violations).toEqual([]);
    if (width === 390) {
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
