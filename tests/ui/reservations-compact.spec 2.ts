import { test, expect } from './fixtures';

test('compact reservations: filters disclose, submit and persist', async ({ page, request }) => {
  await request.post('http://127.0.0.1:4311/__test/reset');
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/reservations');
  await expect(page.getByLabel('Источник', { exact: true })).toBeHidden();
  await expect(page.getByLabel('Статус брони')).toBeVisible();
  await page.getByRole('button', { name: 'Фильтры', exact: true }).click();
  await expect(page.getByLabel('Источник', { exact: true })).toBeVisible();
  await page.getByLabel('Поиск броней').fill('несуществующая бронь');
  await page.getByRole('button', { name: 'Показать', exact: true }).click();
  await expect(page.getByTestId('reservations-empty')).toBeVisible();
  await expect(page.getByLabel('Поиск броней')).toHaveValue('несуществующая бронь');
  await page.getByTestId('reservations-empty').getByRole('link', { name: 'Убрать поиск' }).click();
  await expect(page.getByTestId('reservations-table')).toBeVisible();
  expect((await page.locator('.reservations-controls').boundingBox())!.height).toBeLessThan(240);
  await page.screenshot({ path: 'reports/reservations-compact.png' });
});
