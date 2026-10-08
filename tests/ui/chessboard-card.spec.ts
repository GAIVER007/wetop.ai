import { FIXTURE_API, expect, test } from './fixtures';

/**
 * Шахматка v2, PR 3 (ТЗ §18–§25, §58): карточка брони и быстрый предпросмотр.
 * Одинарный клик — floating-предпросмотр (гость → даты → размещение → источник → суммы →
 * действия по статусу), двойной — полная карточка. Подпись плашки подстраивается под ширину:
 * полное имя → «Имя Ф.» → инициалы; долг на узкой — точкой, на широкой — плашкой суммы.
 */
const fixture = FIXTURE_API;

test.beforeEach(async ({ request, page }) => {
  // These cases verify the two-line booking caption in the normal view.
  await page.addInitScript(() => localStorage.setItem('wetop.chessboard.view', 'normal'));
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
  await expect(
    preview.getByRole('link', { name: 'Редактировать бронь', exact: true }),
  ).toHaveAttribute('href', `/reservations/${number}#booking-actions`);
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
  await expect(
    preview.getByRole('button', { name: 'Оплата / возврат', exact: true }),
  ).toBeVisible();
  await expect(
    preview.getByRole('link', { name: 'Редактировать бронь', exact: true }),
  ).toHaveAttribute('href', /#booking-actions$/);
  await expect(preview.locator('.stay-preview__actions > *')).toHaveCount(3);
  await page.keyboard.press('Escape');

  await page.locator('td[data-status="CHECKED_IN"] [data-testid="stay-cell"]').first().click();
  await expect(preview.getByRole('button', { name: 'Выселить', exact: true })).toBeVisible();
  await expect(preview.getByRole('button', { name: 'Заселить', exact: true })).toHaveCount(0);
  await expect(preview.locator('.stay-preview__actions > *')).toHaveCount(3);
});

test('«Заселить» из предпросмотра выполняет существующую команду и меняет статус', async ({
  page,
  request,
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
  const preview = page.getByTestId('stay-preview');
  await expect(preview).toBeVisible();
  await expect(preview.getByRole('button', { name: 'Заселить', exact: true })).toHaveCount(0);
  await expect(preview.getByRole('button', { name: 'Выселить', exact: true })).toBeVisible();
  await expect(preview.getByTestId('preview-status')).toContainText('Заселён');
  await expect(page.getByTestId('board-legend')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.reload();
  const persisted = page.locator(`td[data-status="CHECKED_IN"] [data-number="${number}"]`).first();
  await persisted.click();
  await expect(preview.getByRole('button', { name: 'Выселить', exact: true })).toBeVisible();
  await preview.getByRole('button', { name: 'Выселить', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Выселить', exact: true }).click();
  const debt = page.locator('dialog[open]');
  const checkedOut = preview.locator('[data-testid="preview-status"][data-status="CHECKED_OUT"]');
  await expect(debt.or(checkedOut)).toBeVisible();
  if (await debt.isVisible())
    await debt.getByRole('button', { name: 'Выселить с долгом', exact: true }).click();
  await expect(preview.getByTestId('preview-status')).toContainText('Выселен');
  await expect(preview.getByRole('button', { name: 'Выселить', exact: true })).toHaveCount(0);
  const saved = await request.get(`${fixture}/reservations/${number}`, {
    headers: { 'x-wetop-test-client': '1' },
  });
  expect(saved.ok()).toBe(true);
  const card = await saved.json();
  expect(card.items.some((item: { status: string }) => item.status === 'CHECKED_OUT')).toBe(true);
});

test('подпись подстраивается под ширину: полное имя → «Имя Ф.» → инициалы; долг точкой на узкой', async ({
  page,
  request,
}) => {
  const seeded = await request.post(`${fixture}/__test/design-seed`);
  expect(seeded.ok()).toBe(true);
  // подпись в две строки (имя, затем долг) живёт в «Обычном» виде; «Компактный» по умолчанию прячет вторую строку
  await page.addInitScript(() => localStorage.setItem('wetop.chessboard.view', 'normal'));
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
  const today = await page.locator('[data-testid="date-col"].is-today').getAttribute('data-date');
  const nextMonth = new Date(`${today!.slice(0, 7)}-01T00:00:00Z`);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  const from = nextMonth.toISOString().slice(0, 10);
  nextMonth.setUTCDate(30);
  await page.goto(`/chessboard?from=${from}&to=${nextMonth.toISOString().slice(0, 10)}`);
  await expect(page.getByTestId('date-col')).toHaveCount(30);
  // Явно открываем месяц тестовой брони: проверка не зависит от текущего дня месяца.
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

test('служебный код скрыт на плашке, источник не повторяется, бронь открывается', async ({
  page,
}) => {
  await page.goto('/reservations/new?unit=M03');
  const form = page.getByTestId('new-reservation-form');
  await form.getByLabel('Имя *', { exact: true }).fill('Гость');
  await form.getByLabel('Фамилия *', { exact: true }).fill('Стойка-a1b2c3');
  await form.getByRole('button', { name: '3 ночи', exact: true }).click();
  await form.getByRole('button', { name: 'Создать бронь', exact: true }).click();
  await expect(page).toHaveURL(/\/reservations\/20260913-NEW\d+$/);
  const number = page.url().split('/').pop()!;
  await page.goto('/chessboard');
  const stay = page
    .locator(`[data-testid="stay-cell"][data-number="${number}"]`)
    .filter({ has: page.locator('.board-stay-caption') })
    .first();
  await expect(stay.locator('.board-stay-name')).toHaveText('Бронь со стойки');
  await expect(stay).not.toContainText('a1b2c3');
  await expect(stay.getByTestId('cell-channel')).toHaveCount(0);
  await stay.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'reports/chessboard-readable-label.png' });
  await stay.click();
  await expect(page.getByTestId('preview-guest')).toHaveText('Бронь со стойки');
  await expect(
    page.getByRole('link', { name: 'Редактировать бронь', exact: true }),
  ).toHaveAttribute('href', `/reservations/${number}#booking-actions`);
});
