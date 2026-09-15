import { expect, test } from './fixtures';
import { almatyToday, plusDays } from './dates';

/** B4/B5: печатная форма RU и KZ по существующей брони (любая занятая клетка сегодня), журнал действий. */
test('регистрационная карта печатается на RU и KZ; журнал показывает действия', async ({
  page,
}) => {
  const today = almatyToday();
  await page.goto(`/chessboard?from=${today}&to=${plusDays(today, 2)}`);
  const first = page.locator('td[data-state="OCCUPIED"] a').first();
  const number = (await first.getAttribute('href'))!.split('/').pop()!;
  await page.goto(`/reservations/${number}/print?lang=ru`);
  await expect(page.getByTestId('print-registration')).toContainText('Регистрационная карта гостя');
  await expect(page.getByTestId('print-registration')).toContainText(number);
  await page.screenshot({ path: 'reports/screenshots/print-registration-ru.png', fullPage: true });
  await page.goto(`/reservations/${number}/print?lang=kz`);
  await expect(page.getByTestId('print-registration')).toContainText('Қонақтың тіркеу карточкасы');
  await page.screenshot({ path: 'reports/screenshots/print-registration-kz.png', fullPage: true });
  await page.goto('/journal?type=Reservation');
  await expect(page.getByTestId('journal-row').first()).toBeVisible();
  await page.screenshot({ path: 'reports/screenshots/journal.png' });
});
