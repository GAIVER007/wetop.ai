import { expect, test } from '@playwright/test';

/** B4/B5: печатная форма RU и KZ по существующей брони, журнал действий. */
test('регистрационная карта печатается на RU и KZ; журнал показывает действия', async ({
  page,
}) => {
  await page.goto('/chessboard?from=2026-09-08&to=2026-09-10');
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
