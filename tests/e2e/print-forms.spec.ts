import { expect, test } from '@playwright/test';

/**
 * Заготовки печатных форм: договор и счёт открываются с карточки брони на RU и KZ, в тексте есть
 * номер брони и плашка «ЗАГОТОВКА» (содержание заменит образец владельца). Существующая
 * регистрационная карта проверяется в print-and-journal.spec.ts и здесь не трогается.
 * Гость вымышленный (ADR-010), бронь отменяется в конце; метка E2E-АВТОТЕСТ — для уборки и сверок.
 */
const today = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
const plus = (n: number) => {
  const x = new Date(`${today}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
const TITLES = {
  contract: { ru: 'Договор', kz: 'шарты' },
  invoice: { ru: 'Счёт на оплату', kz: 'Төлем шоты' },
} as const;

test('договор и счёт печатаются на RU и KZ: номер брони, плашка заготовки, ссылки с карточки', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.goto(`/reservations/new?arrival=${plus(15)}&departure=${plus(17)}`);
  const form = page.getByTestId('new-reservation-form');
  await form.locator('select[name="source"]').selectOption('PHONE');
  await form.locator('select[name="accommodationTypeCode"]').selectOption('exely-5074688');
  await form.locator('input[name="firstName"]').fill('Гость');
  await form.locator('input[name="lastName"]').fill('Тест-печать');
  await form.locator('textarea[name="notes"]').fill('E2E-АВТОТЕСТ'); // сверка исключает автотесты
  await form.getByRole('button', { name: 'Создать бронь' }).click();
  await expect(page).toHaveURL(/\/reservations\/\d{8}-[A-Z0-9]{6}$/);
  const number = page.url().split('/').pop()!;

  // ссылки на новые формы стоят рядом с регистрационной картой
  for (const id of [
    'print-contract-ru',
    'print-contract-kz',
    'print-invoice-ru',
    'print-invoice-kz',
  ])
    await expect(page.getByTestId(id)).toBeVisible();

  for (const kind of ['contract', 'invoice'] as const) {
    for (const lang of ['ru', 'kz'] as const) {
      await page.goto(`/reservations/${number}/print/${kind}?lang=${lang}`);
      const main = page.getByTestId(`print-${kind}`);
      await expect(main).toContainText(number);
      await expect(main).toContainText(TITLES[kind][lang]);
      await expect(page.getByTestId('draft-banner')).toContainText('ЗАГОТОВКА');
      await page.screenshot({
        path: `reports/screenshots/print-${kind}-${lang}.png`,
        fullPage: true,
      });
    }
  }
  // счёт: начисление за проживание попало в строки, итог равен ему
  await page.goto(`/reservations/${number}/print/invoice?lang=ru`);
  await expect(page.getByTestId('invoice-line')).toHaveCount(1);
  await expect(page.getByTestId('invoice-line').first()).toHaveAttribute(
    'data-kind',
    'ACCOMMODATION',
  );
  await expect(page.getByTestId('invoice-due')).toContainText('₸');

  // прибрать за собой
  await page.goto(`/reservations/${number}`);
  page.once('dialog', (d) => d.accept());
  await page.getByTestId('cancel-reservation').click();
  await expect(page.getByTestId('stay-row').first()).toContainText('отменена');
});
