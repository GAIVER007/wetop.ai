import { expect, test } from '@playwright/test';
import { HEADER_GROWTH_PX, FIXTURE_API } from './fixtures';
const fixture = FIXTURE_API;
test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
  await request.post(`${fixture}/__test/control`, { data: { showcase: true } });
});
test('финансы: обзор на ноутбуке, вкладки и переход из суммы к операциям', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/finance');
  await expect(page.getByRole('tab', { name: 'Обзор', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.screenshot({
    path: 'reports/finance-compact-2026-10-01/overview.png',
    fullPage: true,
    animations: 'disabled',
  });
  // бюджет задан 01.10.2026 при прежней шапке; с ADR-134 шапка выше на HEADER_GROWTH_PX, место под обзор то же
  const overflow = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  expect(overflow, 'обзор финансов не помещается на ноутбуке').toBeLessThanOrEqual(
    HEADER_GROWTH_PX + 1,
  );
  await page.getByRole('tab', { name: 'Операции', exact: true }).click();
  await expect(page.getByTestId('finance-operations')).toBeVisible();
  await expect(page.getByTestId('finance-charges')).not.toBeVisible();
  await page.getByRole('tab', { name: 'Долги', exact: true }).click();
  await expect(page.getByTestId('finance-debts')).toBeVisible();
  await page.getByTestId('kpi-paid').click();
  await expect(page.getByTestId('finance-operations')).toBeVisible();
  await expect(page).toHaveURL(/op=payment/);
});
