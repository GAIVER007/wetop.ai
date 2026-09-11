import { expect, test } from '@playwright/test';

/**
 * ADR-021: ранний заезд и поздний выезд — платные услуги на счёте одной кнопкой, половина цены ночи
 * по умолчанию. Гость вымышленный, бронь помечена для уборки.
 */
const today = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
const plus = (n: number) => {
  const x = new Date(`${today}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
const money = (s: string) => Number(s.replace(/[^\d,]/g, '').replace(',', '.'));

test('поздний выезд и ранний заезд начисляются на счёт как половина ночи', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto(`/reservations/new?arrival=${plus(12)}&departure=${plus(14)}`);
  const form = page.getByTestId('new-reservation-form');
  await form.locator('select[name="source"]').selectOption('WALK_IN');
  await form.locator('select[name="accommodationTypeCode"]').selectOption('exely-5074688');
  const unit = (await form.locator('select[name="unitCode"] option').nth(1).getAttribute('value'))!;
  await form.locator('select[name="unitCode"]').selectOption(unit);
  await form.locator('input[name="firstName"]').fill('Гость');
  await form.locator('input[name="lastName"]').fill('Тест-поздний-выезд');
  await form.locator('textarea[name="notes"]').fill('E2E-АВТОТЕСТ'); // сверка исключает автотесты
  await form.getByRole('button', { name: 'Создать бронь' }).click();
  await expect(page).toHaveURL(/\/reservations\/\d{8}-[A-Z0-9]{6}$/);

  // цена двух ночей — из строки проживания; половина ночи = цена / 2 / 2
  const price = money(await page.getByTestId('stay-row').first().locator('td').nth(5).innerText());
  const half = Math.floor(price / 2 / 2);

  page.once('dialog', (d) => d.accept());
  await page.locator('[data-testid^="late-check-out-"]').click();
  const late = page.getByTestId('charge-row').filter({ hasText: 'Поздний выезд' });
  await expect(late).toHaveCount(1);
  expect(money(await late.locator('td').nth(3).innerText())).toBe(half);
  // услуга датирована днём выезда
  await expect(late).toContainText(plus(14));

  page.once('dialog', (d) => d.accept());
  await page.locator('[data-testid^="early-check-in-"]').click();
  const early = page.getByTestId('charge-row').filter({ hasText: 'Ранний заезд' });
  await expect(early).toHaveCount(1);
  await expect(early).toContainText(plus(12));

  // баланс вырос ровно на две половины ночи
  expect(money(await page.getByTestId('folio-balance').innerText())).toBe(price + 2 * half);

  page.once('dialog', (d) => d.accept());
  await page.getByTestId('cancel-reservation').click();
  await expect(page.getByTestId('stay-row').first()).toContainText('отменена');
});
