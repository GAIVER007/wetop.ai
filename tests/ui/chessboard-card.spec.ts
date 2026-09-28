import { expect, test } from './fixtures';

/**
 * Шахматка v2, PR 3 (ТЗ §18–§25, §58): карточка брони и быстрый предпросмотр.
 * Одинарный клик — floating-предпросмотр (гость → даты → размещение → источник → суммы →
 * действия по статусу), двойной — полная карточка. Подпись плашки подстраивается под ширину:
 * полное имя → «Имя Ф.» → инициалы; долг на узкой — точкой, на широкой — плашкой суммы.
 */
const fixture = 'http://127.0.0.1:4311';

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

test('одинарный клик — предпросмотр без ухода со страницы; Esc закрывает и возвращает фокус', async ({
  page,
}) => {
  await page.goto('/chessboard');
  const stay = page.getByTestId('stay-cell').first();
  const number = await stay.getAttribute('data-number');
  await stay.click();
  const preview = page.getByTestId('stay-preview');
  await expect(preview).toBeVisible();
  await expect(page).toHaveURL('/chessboard');
  // состав по ТЗ §23: гость → даты → размещение → источник → суммы; технических ID нет
  await expect(preview.getByTestId('preview-guest')).not.toBeEmpty();
  await expect(preview.getByTestId('preview-dates')).toContainText('→');
  await expect(preview.getByTestId('preview-place')).not.toBeEmpty();
  await expect(preview.getByTestId('preview-sums')).toContainText('₸');
  await expect(preview).not.toContainText(number!);
  await expect(preview.getByRole('link', { name: 'Открыть бронь', exact: true })).toHaveAttribute(
    'href',
    `/reservations/${number}`,
  );
  await page.keyboard.press('Escape');
  await expect(preview).toBeHidden();
  await expect(stay).toBeFocused();
});

test('двойной клик открывает полную карточку брони', async ({ page }) => {
  await page.goto('/chessboard');
  await page.getByTestId('stay-cell').first().dblclick();
  await expect(page.getByRole('dialog', { name: 'Бронирование', exact: true })).toBeVisible();
});

test('действия по статусу: подтверждённой — заселить, заселённому — выселить', async ({ page }) => {
  await page.goto('/chessboard');
  const preview = page.getByTestId('stay-preview');

  await page.locator('td[data-status="CONFIRMED"] [data-testid="stay-cell"]').first().click();
  await expect(preview.getByRole('button', { name: 'Заселить', exact: true })).toBeVisible();
  await expect(preview.getByRole('button', { name: 'Выселить', exact: true })).toHaveCount(0);
  await expect(preview.getByRole('link', { name: 'Принять оплату', exact: true })).toHaveAttribute(
    'href',
    /#booking-finance$/,
  );
  await expect(preview.getByRole('link', { name: 'Переселить', exact: true })).toHaveAttribute(
    'href',
    /#booking-actions$/,
  );
  await page.keyboard.press('Escape');

  await page.locator('td[data-status="CHECKED_IN"] [data-testid="stay-cell"]').first().click();
  await expect(preview.getByRole('button', { name: 'Выселить', exact: true })).toBeVisible();
  await expect(preview.getByRole('button', { name: 'Заселить', exact: true })).toHaveCount(0);
});

test('«Заселить» из предпросмотра выполняет существующую команду и меняет статус', async ({
  page,
}) => {
  await page.goto('/chessboard');
  const confirmed = page.locator('td[data-status="CONFIRMED"] [data-testid="stay-cell"]').first();
  const number = await confirmed.getAttribute('data-number');
  await confirmed.click();
  await page
    .getByTestId('stay-preview')
    .getByRole('button', { name: 'Заселить', exact: true })
    .click();
  // как в карточке брони (Q-156): в непроверенную ячейку — только после подтверждения
  const checkedIn = page.locator(`td[data-status="CHECKED_IN"] [data-number="${number}"]`).first();
  const confirm = page.locator('dialog[open]');
  await expect(confirm.or(checkedIn)).toBeVisible();
  if (await confirm.isVisible()) await confirm.getByRole('button', { name: /^Заселить/ }).click();
  await expect(checkedIn).toBeVisible();
});

test('подпись подстраивается под ширину: полное имя → «Имя Ф.» → инициалы; долг точкой на узкой', async ({
  page,
  request,
}) => {
  const seeded = await request.post(`${fixture}/__test/design-seed`);
  expect(seeded.ok()).toBe(true);
  await page.goto('/chessboard');
  // неделя: широкая плашка — полное имя и плашка суммы долга
  await expect(
    page.locator('.board-stay-caption[data-span="3"] .board-stay-name').first(),
  ).toBeVisible();
  await expect(page.getByTestId('cell-due').filter({ visible: true }).first()).toContainText('₸');
  // 30 дней: одна ночь — «Имя Ф.», полное имя спрятано; долг на узкой — точкой
  await page.getByRole('link', { name: '30 дней', exact: true }).click();
  await expect(page.getByTestId('date-col')).toHaveCount(30);
  // M04: однодневная «Гость Букинг»; в той же строке с 1-го числа — длинная бронь следующего месяца
  const oneNight = page.locator('[data-number="20260916-DSG-BDC"] .board-stay-caption');
  await expect(oneNight.locator('.board-stay-name-short')).toHaveText('Гость Б.');
  await expect(oneNight.locator('.board-stay-name')).toBeHidden();
  await expect(page.getByTestId('cell-due-dot').filter({ visible: true }).first()).toBeVisible();
  // календарный месяц: колонка 24 px — инициалы
  const arrival = await page
    .locator('[data-testid="stay-cell"][data-number="20260916-DSG-BDC"]')
    .first()
    .getAttribute('data-date');
  const first = `${arrival!.slice(0, 7)}-01`;
  const lastDay = new Date(`${first}T00:00:00Z`);
  lastDay.setUTCMonth(lastDay.getUTCMonth() + 1, 0);
  await page.goto(`/chessboard?from=${first}&to=${lastDay.toISOString().slice(0, 10)}`);
  await expect(oneNight.locator('.board-stay-initials')).toHaveText('ГБ');
  await expect(oneNight.locator('.board-stay-initials')).toBeVisible();
});

test('длинное проживание: имя не уезжает при горизонтальной прокрутке', async ({
  page,
  request,
}) => {
  const seeded = await request.post(`${fixture}/__test/design-seed`);
  expect(seeded.ok()).toBe(true);
  await page.goto('/chessboard');
  await page.getByRole('link', { name: '30 дней', exact: true }).click();
  await expect(page.getByTestId('date-col')).toHaveCount(30);
  // 26 ночей со следующего месяца: подпись длиннее окна, имя должно прилипнуть к колонке мест
  const long = page.locator('.board-stay-caption').filter({ hasText: 'Гость Полный' }).first();
  const name = long.locator('.board-stay-name');
  await expect(name).toBeVisible();
  const colRight = (await page.locator('.board th.board__unit-head').boundingBox())!;
  await page.locator('.board-wrap').evaluate((el) => {
    el.scrollLeft = 400;
  });
  const after = await name.boundingBox();
  // имя прилипло к правому краю колонки мест, а не уехало влево за экран
  expect(after!.x).toBeGreaterThanOrEqual(colRight.x + colRight.width - 4);
  await expect(name).toBeVisible();
});

test('узкая плашка: вторая строка (источник, ночи) спрятана целиком, имя не теснится', async ({
  page,
  request,
}) => {
  const seeded = await request.post(`${fixture}/__test/design-seed`);
  expect(seeded.ok()).toBe(true);
  await page.goto('/chessboard');
  await page.getByRole('link', { name: '30 дней', exact: true }).click();
  await expect(page.getByTestId('date-col')).toHaveCount(30);
  const oneNight = page.locator('[data-number="20260916-DSG-BDC"] .board-stay-caption');
  await expect(oneNight.locator('.board-stay-line--meta')).toBeHidden();
  const short = oneNight.locator('.board-stay-name-short');
  expect(await short.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
});
