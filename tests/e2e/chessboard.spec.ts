import { expect, test } from '@playwright/test';

/** Gate 2 (шахматка): сетка на 08.09.2026 совпадает с Exely на ту же дату — занято 78 из 88. */
test('шахматка показывает 88 ячеек и 78 занятых на 08.09.2026', async ({ page }) => {
  await page.goto('/chessboard?from=2026-09-08&to=2026-09-21');
  await expect(page.getByRole('heading', { name: 'Шахматка' })).toBeVisible();
  await expect(page.getByTestId('unit-row')).toHaveCount(88);
  await expect(page.getByTestId('date-col')).toHaveCount(14);
  await expect(page.getByTestId('occupied-2026-09-08')).toHaveText('78');
  await page.screenshot({ path: 'reports/screenshots/chessboard-2026-09-08.png', fullPage: false });
});

test('клик по занятой клетке открывает карточку брони с проживаниями', async ({ page }) => {
  await page.goto('/chessboard?from=2026-09-08&to=2026-09-10');
  const first = page.locator('td[data-state="OCCUPIED"] a').first();
  const number = (await first.getAttribute('href'))!.split('/').pop()!;
  await first.click();
  await expect(page).toHaveURL(new RegExp(`/reservations/${number}`));
  await expect(page.getByRole('heading', { name: /Бронь/ })).toBeVisible();
  await expect(page.getByTestId('stay-row').first()).toBeVisible();
  await page.screenshot({
    path: 'reports/screenshots/reservation-card-2026-09-08.png',
    fullPage: true,
  });
});
