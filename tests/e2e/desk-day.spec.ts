import { expect, test } from '@playwright/test';

/** Рабочий день стойки: заезды, выезды и живущие на дату, и что мешает заселить. */
test('экран «Сегодня» открывается с корня и показывает три списка на дату', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByRole('heading', { name: /Сегодня/ })).toBeVisible();

  // три группы всегда на месте, даже если пусто
  for (const g of ['arrivals', 'departures', 'inhouse'])
    await expect(page.getByTestId(`group-${g}`)).toBeVisible();

  // числа на карточках согласованы со строками таблиц
  const rows = async (g: string) => page.getByTestId(`row-${g}`).count();
  const card = async (id: string) => Number(await page.getByTestId(id).innerText());
  expect(await card('c-arrivals')).toBe(await rows('arrivals'));
  expect(await card('c-departures')).toBe(await rows('departures'));
  expect(await card('c-inhouse')).toBe(await rows('inhouse'));

  await page.screenshot({ path: 'reports/screenshots/desk-today.png', fullPage: true });

  // на дату из прошлого списки тоже строятся
  await page.goto('/today?date=2026-08-15');
  await expect(page.getByRole('heading', { name: 'Сегодня, 2026-08-15' })).toBeVisible();
  expect(await card('c-arrivals')).toBe(await rows('arrivals'));
});
