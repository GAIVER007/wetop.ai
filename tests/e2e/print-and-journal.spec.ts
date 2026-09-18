import { expect, test } from '@playwright/test';

/** B4/B5: печатная форма RU и KZ по существующей брони, журнал действий. */
test('регистрационная карта печатается на RU и KZ; журнал показывает действия', async ({
  page,
}) => {
  await page.goto('/chessboard?from=2026-09-08&to=2026-09-10');
  const first = page.locator('td[data-state="OCCUPIED"] a').first();
  const number = (await first.getAttribute('href'))!.split('/').pop()!;
  // при переходе Next на миг держит и уходящую страницу — ждём, пока печатная форма останется одна;
  // сама форма и есть landmark main, поэтому внутри main её не ищем
  const form = page.getByTestId('print-registration');
  await page.goto(`/reservations/${number}/print?lang=ru`);
  await expect(form).toHaveCount(1);
  await expect(form).toContainText('Регистрационная карта гостя');
  await expect(form).toContainText(number);
  await page.screenshot({ path: 'reports/screenshots/print-registration-ru.png', fullPage: true });
  await page.goto(`/reservations/${number}/print?lang=kz`);
  await expect(form).toHaveCount(1);
  await expect(form).toContainText('Қонақтың тіркеу карточкасы');
  await page.screenshot({ path: 'reports/screenshots/print-registration-kz.png', fullPage: true });
  await page.goto('/journal?type=Reservation');
  await expect(page.getByRole('main').getByTestId('journal-row').first()).toBeVisible();
  await page.screenshot({ path: 'reports/screenshots/journal.png' });
});
