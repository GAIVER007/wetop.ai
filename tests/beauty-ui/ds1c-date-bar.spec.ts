import { test, expect } from '@playwright/test';

/**
 * MV8.5 DS1c: день журнала салона на общем `DateBar` ведёт по тем же адресам, что прежние ссылки:
 * `?date=` у пути, «Сегодня» без даты; поле даты держит прежний `data-testid`.
 */
const api = `http://127.0.0.1:${process.env.BEAUTY_UI_API_PORT || '55814'}`;

test('салон: предыдущий и следующий день, дата и «Сегодня» по прежним адресам', async ({
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
  await page.goto('/calendar?date=2026-10-12');
  const bar = page.locator('.date-bar');
  await expect(bar.getByTestId('beauty-day-date')).toHaveValue('2026-10-12');
  await bar.getByRole('button', { name: 'Следующий день' }).click();
  await expect(page).toHaveURL(/\/calendar\?date=2026-10-13$/);
  await bar.getByRole('button', { name: 'Предыдущий день' }).click();
  await expect(page).toHaveURL(/\/calendar\?date=2026-10-12$/);
  await bar.getByLabel('Дата', { exact: true }).fill('2026-10-20');
  await expect(page).toHaveURL(/\/calendar\?date=2026-10-20$/);
  await bar.getByRole('button', { name: 'Сегодня', exact: true }).click();
  await expect(page).toHaveURL(/\/calendar$/);
});
