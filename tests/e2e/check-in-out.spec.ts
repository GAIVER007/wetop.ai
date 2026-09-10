import { expect, test } from '@playwright/test';

/** Срез 5, B1: заезд и выезд с карточки; незаезд снимает ячейку. Гость вымышленный, даты сегодня → завтра. */
const today = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
const plus = (n: number) => {
  const x = new Date(`${today}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

test('заселить → карточка и шахматка показывают «заселён» → выселить; незаезд освобождает ячейку', async ({
  page,
}) => {
  // сценарий длинный: бронь, карточка гостя, документ, заезд, шахматка, выезд, вторая бронь, незаезд
  test.setTimeout(240_000);
  await page.goto(`/reservations/new?arrival=${plus(3)}&departure=${plus(4)}`);
  const form = page.getByTestId('new-reservation-form');
  await form.locator('select[name="source"]').selectOption('WALK_IN');
  await form.locator('select[name="accommodationTypeCode"]').selectOption('exely-5074688'); // dorm: остаток есть всегда
  const unitSelect = form.locator('select[name="unitCode"]');
  const unitCode = (await unitSelect.locator('option').nth(1).getAttribute('value'))!;
  await unitSelect.selectOption(unitCode);
  await form.locator('input[name="firstName"]').fill('Гость');
  await form.locator('input[name="lastName"]').fill('Тест-заезд');
  await form.getByRole('button', { name: 'Создать бронь' }).click();
  await expect(page).toHaveURL(/\/reservations\/\d{8}-[A-Z0-9]{6}$/);
  const number = page.url().split('/').pop()!;
  // без гражданства заселение блокируется (DATA_MODEL §3, eQonaq)
  await page.locator('[data-testid^="check-in-"]').click();
  await expect(page.getByRole('alert').first()).toContainText('гражданство');
  await page.getByTestId('guest-link').click();
  await expect(page).toHaveURL(/\/guests\//);
  await page.getByTestId('guest-form').locator('input[name="citizenship"]').fill('KAZ');
  await page.getByTestId('guest-form').getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByTestId('guest-form').locator('input[name="citizenship"]')).toHaveValue(
    'KAZ',
  );
  const doc = page.getByTestId('document-form');
  await doc.locator('input[name="number"]').fill('N 0000001');
  await doc.locator('input[name="issueCountry"]').fill('KAZ');
  await doc.getByRole('button', { name: 'Добавить' }).click();
  await expect(page.getByTestId('document-row')).toContainText('****0001');
  await page.screenshot({ path: 'reports/screenshots/guest-card.png', fullPage: true });
  await page.goto(`/reservations/${number}`);
  await page.locator('[data-testid^="check-in-"]').click();
  // статус читаем в строке проживания: слово встречается ещё и в заголовке брони
  await expect(page.getByTestId('stay-row').first()).toContainText('заселён');
  await page.goto(`/chessboard?from=${plus(3)}&to=${plus(4)}`);
  const cell = page.locator(`td[data-state="OCCUPIED"] a[href*="${number}"]`).first();
  await expect(cell).toBeVisible();
  await page.screenshot({ path: 'reports/screenshots/check-in-chessboard.png' });
  await page.goto(`/reservations/${number}`);

  // T3: на счёте есть начисление за проживание и нет оплаты, значит выселение должно быть остановлено.
  // Диалог отклоняем — проверяем именно защиту, а не текст ошибки: статус обязан остаться «заселён».
  page.once('dialog', (d) => d.dismiss());
  await page.locator('[data-testid^="check-out-"]').click();
  await expect(page.getByRole('alert').first()).toContainText('долг');
  await expect(page.getByTestId('stay-row').first()).toContainText('заселён');
  await expect(page.getByTestId('folio-balance')).toContainText('к оплате');

  // то же действие с подтверждением администратора — гость выселен, долг за ним остаётся
  page.once('dialog', (d) => d.accept());
  await page.locator('[data-testid^="check-out-"]').click();
  await expect(page.getByTestId('stay-row').first()).toContainText('выселен');
  await expect(page.getByTestId('folio-balance')).toContainText('к оплате');
  await page.screenshot({ path: 'reports/screenshots/check-out-card.png', fullPage: true });

  // незаезд
  await page.goto(`/reservations/new?arrival=${plus(5)}&departure=${plus(6)}`);
  const f2 = page.getByTestId('new-reservation-form');
  await f2.locator('select[name="source"]').selectOption('PHONE');
  await f2.locator('select[name="accommodationTypeCode"]').selectOption('exely-5074688');
  const freeUnit = f2.locator('select[name="unitCode"]');
  await expect(freeUnit.locator('option')).not.toHaveCount(1); // есть хотя бы одна свободная койка
  await freeUnit.selectOption((await freeUnit.locator('option').nth(1).getAttribute('value'))!);
  await f2.locator('input[name="firstName"]').fill('Гость');
  await f2.locator('input[name="lastName"]').fill('Тест-незаезд');
  await f2.getByRole('button', { name: 'Создать бронь' }).click();
  await expect(page).toHaveURL(/\/reservations\/\d{8}-[A-Z0-9]{6}$/);
  page.on('dialog', (d) => d.accept());
  await page.locator('[data-testid^="no-show-"]').click();
  // статус читаем в строке проживания: слово «Незаезд» есть ещё и на кнопке
  await expect(page.getByTestId('stay-row').first()).toContainText('незаезд');
  await expect(page.getByTestId('stay-row').first()).toContainText('не назначена');
});
