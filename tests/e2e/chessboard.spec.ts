import { expect, test } from './fixtures';
import { almatyToday, plusDays } from './dates';

/**
 * Gate 2 (шахматка): сетка на 88 ячеек, и число занятых на экране совпадает с данными API,
 * а занято + свободно + заблокировано всегда равно 88.
 * Сверка ИМЕННО С EXELY по числам — в датированных отчётах `reports/double-entry-*.md`
 * (скрипт `cli-double-entry.ts` читает Exely живьём). Жёсткое число здесь не зашивается:
 * оно меняется с каждой новой бронью и делало бы тест ложно-красным. Дата — сегодняшняя в Алматы, а не
 * 08.09.2026: и рабочая копия, и сид автотестов (`tests/tools/test-seed.ts`) держат занятость вокруг «сегодня».
 */
const TODAY = almatyToday();
test('шахматка показывает 88 ячеек, и занятость на экране совпадает с данными', async ({
  page,
}) => {
  const api = process.env.APP_API_URL ?? 'http://127.0.0.1:3001';
  const res = await page.request.get(`${api}/chessboard?from=${TODAY}&to=${TODAY}`);
  const summary = (await res.json()).summary[TODAY] as {
    occupied: number;
    free: number;
    blocked: number;
  };
  expect(summary.occupied + summary.free + summary.blocked).toBe(88);
  expect(summary.occupied).toBeGreaterThan(0);

  await page.goto(`/chessboard?from=${TODAY}&to=${plusDays(TODAY, 13)}`);
  await expect(page.getByRole('heading', { name: 'Шахматка' })).toBeVisible();
  await expect(page.getByRole('main').getByTestId('unit-row')).toHaveCount(88);
  await expect(page.getByRole('main').getByTestId('date-col')).toHaveCount(14);
  await expect(page.getByRole('main').getByTestId(`occupied-${TODAY}`)).toHaveText(
    String(summary.occupied),
  );
  await page.screenshot({ path: 'reports/screenshots/chessboard-today.png', fullPage: false });
});

test('клик по занятой клетке открывает карточку брони с проживаниями', async ({ page }) => {
  await page.goto(`/chessboard?from=${TODAY}&to=${plusDays(TODAY, 2)}`);
  const first = page.locator('td[data-state="OCCUPIED"] a').first();
  const number = (await first.getAttribute('href'))!.split('/').pop()!;
  await first.click();
  await expect(page).toHaveURL(new RegExp(`/reservations/${number}`));
  await expect(page.getByRole('heading', { name: /Бронь/ })).toBeVisible();
  await expect(page.getByRole('main').getByTestId('stay-row').first()).toBeVisible();
  await page.screenshot({
    path: 'reports/screenshots/reservation-card-today.png',
    fullPage: true,
  });
});
