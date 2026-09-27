import { expect, test } from './fixtures';

/**
 * «Показатели за период» не должны пропадать целиком, когда числа не пришли (замечание владельца
 * 16.09.2026: «выбираю период и нифига не открывает»; с A1, ADR-103, блок живёт на
 * `/management/dashboard`). Числа считаются из шахматки и счетов за месяц, и на медленной связи
 * этот вызов может не успеть — экран обязан открыться и назвать причину. Главная (`/today`) от
 * `GET /desk/dashboard` больше не зависит вовсе.
 */
const API = 'http://127.0.0.1:4311';

test.afterEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});

test('показатели не пришли — экран открыт, период выбирается, причина названа', async ({
  page,
  request,
}) => {
  await request.post(`${API}/__test/control`, { data: { failPath: '/desk/dashboard' } });
  await page.goto('/management/dashboard?period=month');
  await expect(page.getByRole('heading', { name: 'Показатели за период' })).toBeVisible();
  // период по-прежнему выбирается
  await expect(page.getByRole('link', { name: 'Этот месяц', exact: true })).toBeVisible();
  // причина названа, а не пустой экран
  await expect(page.getByTestId('dashboard-error')).toBeVisible();
});

test('период выбирается: «этот месяц» открывается с числами', async ({ page }) => {
  await page.goto('/management/dashboard?period=month');
  await expect(page.getByTestId('period-caption')).toContainText('дней');
  await expect(page.getByTestId('kpi-occupancy')).toBeVisible();
  await expect(page.getByTestId('dashboard-error')).toHaveCount(0);
});

test('Главная открывается и с упавшими показателями периода: она их не зовёт', async ({
  page,
  request,
}) => {
  await request.post(`${API}/__test/control`, { data: { failPath: '/desk/dashboard' } });
  await page.goto('/today');
  await expect(page.getByRole('heading', { name: 'Главная', exact: true })).toBeVisible();
  await expect(page.getByTestId('c-arrivals')).toBeVisible();
  await expect(page.getByTestId('dashboard-error')).toHaveCount(0);
});
