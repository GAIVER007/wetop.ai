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
  const screen = page.locator('main:visible');
  await expect(screen.getByRole('heading', { name: 'Касса', exact: true, level: 1 })).toBeVisible();
  await expect(screen.getByTestId('cash-summary')).toBeVisible();
  await expect(screen.getByTestId('finance-operations')).not.toBeVisible();
  await expect(screen.getByTestId('finance-kpis')).not.toBeVisible();
  await expect(screen.getByTestId('finance-attention')).not.toBeVisible();
  const params = new URLSearchParams(
    await screen
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
  await expect(screen.getByTestId('cash-period-income').filter({ visible: true })).toHaveText(
    money((BigInt(ops.paidMinor) + BigInt(ops.incomeMinor)).toString()),
  );
  await expect(screen.getByTestId('cash-period-expense')).toHaveText(
    money((BigInt(ops.refundedMinor) + BigInt(ops.expenseMinor)).toString()),
  );
  const before = await screen
    .getByTestId('cash-period-income')
    .filter({ visible: true })
    .innerText();
  await screen.getByLabel('Тип операции', { exact: true }).selectOption('expense');
  await screen.getByLabel('Способ оплаты', { exact: true }).selectOption('KASPI');
  await expect(screen.getByLabel('Источник', { exact: true })).not.toBeVisible();
  await screen.getByText('Дополнительные фильтры', { exact: true }).click();
  await screen.getByLabel('Источник', { exact: true }).selectOption('cash');
  await screen.getByRole('button', { name: 'Показать', exact: true }).click();
  await expect(page).toHaveURL(/op=expense.*method=KASPI.*src=cash/);
  await expect(screen.getByTestId('ops-empty').filter({ visible: true })).toHaveCount(1);
  await expect(screen.getByTestId('cash-period-income').filter({ visible: true })).toHaveText(
    before,
  );
  await screen.getByRole('link', { name: 'Сбросить фильтр' }).click();
  await expect(screen.getByLabel('Тип операции', { exact: true })).toHaveValue('');
  await expect(screen.getByLabel('Способ оплаты', { exact: true })).toHaveValue('');
  await expect(screen.getByLabel('Источник', { exact: true })).toHaveValue('');
  await screen.getByText('Отчёты и управление', { exact: true }).click();
  await screen.getByRole('tab', { name: 'Обзор', exact: true }).click();
  await expect(screen.getByTestId('finance-kpis')).toBeVisible();
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
      expect(
        await page.evaluate(() => document.documentElement.scrollHeight - innerHeight),
      ).toBeLessThanOrEqual(1);
      await expect(page.getByRole('button', { name: 'Показать', exact: true })).toBeInViewport();
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
  const income = await page
    .getByTestId('cash-period-income')
    .filter({ visible: true })
    .boundingBox();
  const expense = await page.getByTestId('cash-period-expense').boundingBox();
  expect(expense!.y).toBeGreaterThan(income!.y);
  expect(Math.abs(expense!.x + expense!.width - income!.x - income!.width)).toBeLessThanOrEqual(1);
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
  expect(
    await page.evaluate(() => document.documentElement.scrollHeight - innerHeight),
  ).toBeLessThanOrEqual(1);
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
  await page.screenshot({ path: `${evidence}/390-dark.png`, fullPage: true });
});
