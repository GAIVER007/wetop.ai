import { test, expect } from '@playwright/test';

/**
 * MV8.5 DS1c: день плана зала на общем `DateBar`: переход сразу, по тем же адресам `?date=` (время
 * плана в адресе не меняется); «Сегодня» в ресторане нет, как и раньше. Форма брони стола: дата и
 * время обязательны (родное `required` через `Field required`) в общей сетке формы.
 */
const api = 'http://127.0.0.1:55824';

test('ресторан: день по прежним адресам, форма брони с обязательными датой и временем', async ({
  page,
  request,
}) => {
  const response = await request.post(`${api}/__test/reset`);
  expect(response.ok()).toBe(true);
  const f: { business: string; locations: string[] } = await response.json();
  await page.context().addCookies([
    {
      name: 'wetop_scope',
      value: encodeURIComponent(`business=${f.business};location=${f.locations[0]}`),
      domain: '127.0.0.1',
      path: '/',
    },
  ]);
  await page.goto('/floor-plan?date=2026-10-12&time=19:00');
  const bar = page.locator('.date-bar');
  await expect(bar.getByRole('button', { name: 'Сегодня', exact: true })).toHaveCount(0);
  await bar.getByRole('button', { name: 'Следующий день' }).click();
  await expect(page).toHaveURL(/\/floor-plan\?date=2026-10-13$/);
  await bar.getByRole('button', { name: 'Предыдущий день' }).click();
  await expect(page).toHaveURL(/\/floor-plan\?date=2026-10-12$/);
  await bar.getByLabel('Дата', { exact: true }).fill('2026-10-15');
  await expect(page).toHaveURL(/\/floor-plan\?date=2026-10-15$/);

  await page.getByRole('button', { name: '+ Новая бронь', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const grid = dialog.locator('.form-grid');
  await expect(grid.getByLabel('Дата', { exact: true })).toHaveAttribute('required', '');
  await expect(grid.getByLabel('Время', { exact: true })).toHaveAttribute('required', '');
  await expect(grid.locator('.field__label--required')).toHaveCount(2);
});
