import { expect, test } from '@playwright/test';

/**
 * Главная не должна пропадать целиком, когда показатели за период не пришли (замечание владельца
 * 16.09.2026: «выбираю период и нифига не открывает»). Числа считаются из шахматки и счетов за месяц,
 * и на медленной связи с базой этот вызов может не успеть — экран обязан открыться и сказать, что
 * именно не загрузилось, а стойка на сегодня остаться на месте.
 */
const API = 'http://127.0.0.1:4311';

test.afterEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});

test('показатели не пришли — экран открыт, стойка на месте, причина названа', async ({
  page,
  request,
}) => {
  await request.post(`${API}/__test/control`, { data: { failPath: '/desk/dashboard' } });
  await page.goto('/today?period=month');
  await expect(page.getByRole('heading', { name: 'Главная' })).toBeVisible();
  // период по-прежнему выбирается
  await expect(page.getByRole('link', { name: 'Этот месяц', exact: true })).toBeVisible();
  // причина названа, а не пустой экран
  await expect(page.getByTestId('dashboard-error')).toBeVisible();
  // стойка на сегодня осталась
  await expect(page.getByTestId('c-arrivals')).toBeVisible();
});

test('период выбирается: «этот месяц» открывается с числами', async ({ page }) => {
  await page.goto('/today?period=month');
  await expect(page.getByTestId('period-caption')).toContainText('дней');
  await expect(page.getByTestId('kpi-occupancy')).toBeVisible();
  await expect(page.getByTestId('dashboard-error')).toHaveCount(0);
});
