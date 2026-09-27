import { expect, test } from '@playwright/test';

/**
 * «Тарифы и цены» v2 (27.09.2026, ТЗ владельца, ADR-106, RT1).
 *
 * Было: цены месяца вертикальным списком, справа постоянно висела форма «Массовое изменение» на
 * треть экрана — картину месяца (где дорого, где закрыто, где min stay) не увидеть. Стало: сетка
 * месяца пн–вс с ценой и ограничениями словами в ячейке дня; форма массовой правки — та же, но в
 * выдвижной панели за кнопкой «Изменить цены»; фильтры перезагружают данные сами, кнопки «Показать»
 * нет. Поля и testid'ы формы не менялись — их водит запись сертификации Channex.
 */
const fixture = 'http://127.0.0.1:4311';

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

test('календарь: сетка месяца с ценой в ячейке, ограничения словами, постоянной формы нет', async ({
  page,
  request,
}) => {
  // витрина: закрытые ночи, CTA/CTD, «мин. 2» и ночь без цены — ограничение названо в ячейке дня
  await request.post(`${fixture}/__test/control`, { data: { showcase: true } });
  const main = page.getByRole('main');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/rates?month=2026-10');
  await expect(main.getByRole('heading', { level: 1 })).toHaveText('Тарифы и цены');
  const cal = main.getByTestId('rates-calendar');
  await expect(cal).toBeVisible();
  // семь колонок недели, день октября на месте
  await expect(cal.locator('.rate-cal__weekdays span')).toHaveText([
    'пн',
    'вт',
    'ср',
    'чт',
    'пт',
    'сб',
    'вс',
  ]);
  const day1 = main.getByTestId('rate-row-2026-10-01');
  await expect(day1.locator('time')).toHaveAttribute('datetime', '2026-10-01');
  // главная информация — цена за полную вместимость, вторая цена мельче со словом (§6, §10 ТЗ)
  await expect(day1.getByTestId('price-2026-10-01-2')).toContainText('10 000 ₸');
  await expect(day1.getByTestId('price-2026-10-01-1')).toContainText('1 гость');
  // стоп-продажа: тон плюс слово сертификации «закрыто» (§9 DESIGN, §22 ТЗ)
  const stop = cal.locator('.rate-cal__day.is-stop').first();
  await expect(stop).toContainText('закрыто (стоп-продажа)');
  // CTA/CTD и min stay — словами, «мин. 1» шумом не показывается (§23–24 ТЗ)
  await expect(main.getByTestId('rate-row-2026-10-09')).toContainText('закрыт заезд');
  await expect(main.getByTestId('rate-row-2026-10-10')).toContainText('закрыт выезд');
  await expect(main.getByTestId('rate-row-2026-10-16')).toContainText('мин. 2 ночи');
  await expect(day1).not.toContainText('мин. 1');
  // ночь без цены — словами, не прочерком (§21 ТЗ)
  await expect(main.getByTestId('rate-row-2026-10-21')).toContainText('Нет цены');
  // постоянной правой формы больше нет: форма — только за кнопкой «Изменить цены»
  await expect(main.getByTestId('bulk-editor')).toHaveCount(0);
  await expect(main.getByRole('button', { name: 'Показать' })).toHaveCount(0);
  // сетка помещается в окно без прокрутки вбок
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
});

test('изменить цены: панель открывается кнопкой, форма прежняя — дни одной строкой, число изменений', async ({
  page,
}) => {
  const main = page.getByRole('main');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/rates?month=2026-10');
  await main.getByTestId('rates-edit-open').click();
  const editor = main.getByTestId('bulk-editor');
  await expect(editor).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('Изменить цены и ограничения');
  const tops = await editor
    .locator('input[name^="day-"]')
    .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
  expect(tops).toHaveLength(7);
  expect(new Set(tops).size, 'дни недели разъехались на две строки').toBe(1);
  const save = editor.getByTestId('apply-changes');
  await expect(save).toHaveText('Сохранить');
  await expect(save).toBeDisabled();
  await editor.getByLabel('Цена за ночь').fill('9100');
  await editor.getByRole('button', { name: '+ Добавить в список', exact: true }).click();
  await expect(save).toHaveText('Сохранить 1 изменение');
  await expect(save).toBeEnabled();
  // Escape закрывает панель и возвращает фокус кнопке (§12 DESIGN)
  await page.keyboard.press('Escape');
  await expect(main.getByTestId('bulk-editor')).toHaveCount(0);
  await expect(main.getByTestId('rates-edit-open')).toBeFocused();
});

// Аудит 26.09, С-48: сняв все дни недели, администратор получал правку «на все дни» — форма просто не передавала
// список, и стоп-продажа уходила на весь период во все каналы.
test('массовое изменение: ни одного дня недели — строка не добавляется, форма объясняет почему', async ({
  page,
}) => {
  const main = page.getByRole('main');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/rates?month=2026-10');
  await main.getByTestId('rates-edit-open').click();
  const editor = main.getByTestId('bulk-editor');
  await expect(editor).toBeVisible();
  for (const box of await editor.locator('input[name^="day-"]').all()) await box.uncheck();
  await editor.getByLabel('Цена за ночь').fill('9100');
  await editor.getByRole('button', { name: '+ Добавить в список', exact: true }).click();
  await expect(editor.getByText('Отметьте хотя бы один день недели')).toBeVisible();
  await expect(editor.getByTestId('apply-changes')).toHaveText('Сохранить');
});

test('фильтры: смена категории перезагружает данные сама, без кнопки «Показать»', async ({
  page,
}) => {
  const main = page.getByRole('main');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/rates?month=2026-10');
  const filters = main.getByTestId('rates-filters');
  await filters.getByLabel('Категория').selectOption('MALE');
  await expect(page).toHaveURL(/category=MALE/);
  // категория на одного гостя — в ячейке одна цена, без слова «гость»
  await expect(main.getByTestId('price-2026-10-01-1')).toBeVisible();
  await expect(main.getByTestId('rate-row-2026-10-01')).not.toContainText('гост');
});

test('на телефоне сетка складывается в список дней, цена по-прежнему правится в ячейке', async ({
  page,
}) => {
  const main = page.getByRole('main');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/rates?month=2026-10');
  const cal = main.getByTestId('rates-calendar');
  await expect(cal).toBeVisible();
  const row = main.getByTestId('rate-row-2026-10-01');
  // в сложенной строке дата словами и слово у числа: «1 окт. чт», «1 гость 8 000 ₸»
  await expect(row).toContainText('1 окт. чт');
  await expect(row).toContainText('1 гость');
  await expect(row).toContainText('8 000 ₸');
  const right = await row
    .getByTestId('price-2026-10-01-2')
    .evaluate((el) => el.getBoundingClientRect().right);
  expect(right, 'цена за 2 гостей за краем экрана').toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  await row.getByTestId('price-2026-10-01-1').getByTestId('price-cell-edit').click();
  await expect(page.getByTestId('price-cell-input')).toBeVisible();
  // окно правки целиком на экране: привязанное к половине карточки, оно уезжало за левый край
  const editor = await page.locator('.price-editor').boundingBox();
  expect(editor, 'окно правки цены не нашлось').not.toBeNull();
  expect(editor!.x, 'окно правки цены за левым краем экрана').toBeGreaterThanOrEqual(0);
  expect(editor!.x + editor!.width, 'окно правки цены за правым краем').toBeLessThanOrEqual(390);
  await expect(page.getByRole('button', { name: 'Сохранить цену' })).toBeInViewport();
});
