import { expect, test } from '@playwright/test';

/**
 * Q-103: отмена сторнирует начисление за проживание и ставит штраф по политике тарифа
 * (умолчание — правило Exely «стоимость первых суток»); штраф стойка может сторнировать.
 * Гость вымышленный (ADR-010).
 */
const today = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
const plus = (n: number) => {
  const x = new Date(`${today}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
const minor = (text: string) => BigInt(text.replace(/[^\d−-]/g, '').replace('−', '-'));

test('отмена: проживание сторнировано, начислен штраф за первые сутки, стойка может его снять', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto(`/reservations/new?arrival=${plus(20)}&departure=${plus(23)}`);
  const form = page.getByTestId('new-reservation-form');
  await form.locator('select[name="source"]').selectOption('PHONE');
  await form.locator('select[name="accommodationTypeCode"]').selectOption('exely-5074688');
  await form.locator('input[name="firstName"]').fill('Гость');
  await form.locator('input[name="lastName"]').fill('Тест-штраф');
  await form.getByRole('button', { name: 'Создать бронь' }).click();
  await expect(page).toHaveURL(/\/reservations\/\d{8}-[A-Z0-9]{6}$/);

  const panel = page.getByTestId('folio-panel');
  const stayTotal = minor(
    await page.getByTestId('stay-row').first().locator('td').nth(5).innerText(),
  );
  const balance = async () => minor(await page.getByTestId('folio-balance').innerText());
  expect(await balance()).toBe(stayTotal);

  page.on('dialog', (d) => d.accept());
  await page.getByTestId('cancel-reservation').click();
  await expect(page.getByText('отменена').first()).toBeVisible();

  // проживание сторнировано, вместо него — штраф; 3 ночи, штраф = одна ночь
  const accommodation = panel.getByTestId('charge-row').filter({ hasText: 'проживание' }).first();
  await expect(accommodation).toContainText('сторнировано');
  const penalty = panel.getByTestId('charge-row').filter({ hasText: 'Штраф за отмену' });
  await expect(penalty).toHaveCount(1);
  const penaltyMinor = minor(await penalty.locator('td').nth(3).innerText());
  expect(penaltyMinor).toBeGreaterThan(0n);
  expect(penaltyMinor * 3n).toBe(stayTotal); // цена ночи одинакова во все 3 ночи
  expect(await balance()).toBe(penaltyMinor);
  await page.screenshot({ path: 'reports/screenshots/cancellation-penalty.png', fullPage: true });

  // стойка решила не взыскивать — сторнирует штраф, баланс обнуляется
  await penalty.getByRole('button', { name: 'сторно' }).click();
  await expect(penalty).toContainText('сторнировано');
  expect(await balance()).toBe(0n);
});
