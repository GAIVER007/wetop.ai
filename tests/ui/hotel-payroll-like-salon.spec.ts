import { mkdirSync } from 'node:fs';
import { FIXTURE_API, expect, test } from './fixtures';

/** Вход и филиал гостиницы стенда (DEFAULT_FIXTURE_BRANCH): «График» и «Зарплата» гостиницы работают в филиале */
async function openHotelBranch(page: import('@playwright/test').Page) {
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
  await page.context().addCookies([
    {
      name: 'wetop_scope',
      value: encodeURIComponent('business=33333333-3333-4333-8333-333333333333;location=22222222-2222-4222-8222-222222222222'),
      url: new URL(page.url()).origin,
      httpOnly: true,
    },
  ]);
}

/** «Зарплата» гостиницы ровно как у салона (владелец 31.10.2026): итоги, вкладки, те же колонки. Данные вымышленные. */
test('зарплата гостиницы: итоги месяца, вкладки и колонки салона', async ({ page, request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
  await page.setViewportSize({ width: 1280, height: 800 });
  await openHotelBranch(page);
  await page.goto('/payroll?month=2026-10');
  const main = page.getByRole('main');
  await expect(main.getByRole('tab', { name: 'Сотрудники', exact: true })).toBeVisible();
  await expect(main.getByRole('tab', { name: 'Начисления', exact: true })).toBeVisible();
  await expect(main.getByRole('columnheader')).toHaveText([
    'Сотрудник', 'Уборок', 'Как платим', 'Оклад', 'За уборки', 'Начислено', 'Выплачено', 'Осталось', 'Действия',
  ]);
  await expect(main.getByTestId('hotel-payroll-row').first()).toContainText('Айгерим');
  await expect(main.getByTestId('payroll-fund')).toContainText('Фонд оплаты');
  await expect(page.getByText('Начислено', { exact: true }).first()).toBeVisible();
  if (process.env.SCHEDULE_SHOTS) {
    mkdirSync(process.env.SCHEDULE_SHOTS, { recursive: true });
    await page.screenshot({ path: `${process.env.SCHEDULE_SHOTS}/hotel-payroll-1280.png` });
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});
