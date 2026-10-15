import { expect, test, FIXTURE_API, settleStreaming } from './fixtures';
const fixture = FIXTURE_API;
test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
  await request.post(`${fixture}/__test/control`, { data: { showcase: true } });
});
test('финансы: обзор на ноутбуке, вкладки и переход из суммы к операциям', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/finance#charges');
  await expect(page.getByTestId('cash-summary')).toBeVisible();
  await page.getByRole('tab', { name: 'Обзор', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Обзор', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.screenshot({
    path: 'reports/finance-compact-2026-10-01/overview.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('tab', { name: 'Операции', exact: true }).click();
  await expect(page.getByTestId('finance-operations')).toBeVisible();
  await expect(page.getByTestId('finance-charges')).not.toBeVisible();
  await page.getByRole('tab', { name: 'Долги', exact: true }).click();
  await expect(page.getByTestId('finance-debts')).toBeVisible();
  await page.getByRole('tab', { name: 'Обзор', exact: true }).click();
  await page.getByTestId('kpi-paid').click();
  await settleStreaming(page);
  await expect(page.getByTestId('finance-operations')).toBeVisible();
  await expect(page).toHaveURL(/op=payment/);
});
