import { expect, test } from '@playwright/test';

/**
 * «Цены и ограничения» без каши (21.09.2026, продолжение правки).
 *
 * Найдено на стенде: восемь колонок, из которых четыре («Макс. ночей», «Стоп-продажа», «Закрыт
 * заезд», «Закрыт выезд») на обычный месяц — 120 прочерков подряд; последняя колонка на 1440 px
 * уходила в прокрутку панели без признака (таблица 861 px в обёртке 743); строка 57 px при норме
 * §4 «38–42» — месяц в 1 700 px; на телефоне видны были только дата и цены, ограничения — за краем;
 * в массовом изменении «вс» переносилось на отдельную строку, а кнопка говорила «Сохранить (0)».
 */
const fixture = 'http://127.0.0.1:4311';

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

test('цены: ограничения одной колонкой словами, строка по шкале, таблица помещается в панель', async ({
  page,
  request,
}) => {
  // витрина: две закрытые ночи в месяце — ограничение должно быть названо словами в строке
  await request.post(`${fixture}/__test/control`, { data: { showcase: true } });
  const main = page.getByRole('main');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/rates?month=2026-10');
  const table = main.getByTestId('rates-table');
  await expect(table).toBeVisible();
  await expect(table.locator('thead th')).toHaveText([
    'Дата',
    'Цена за 1 гостя',
    'Цена за 2 гостей',
    'Мин. ночей',
    'Ограничения',
  ]);
  // у ночи без ограничений — один прочерк, а не четыре
  const rows = table.locator('tbody tr');
  const n = await rows.count();
  expect(n).toBeGreaterThan(20);
  expect(await table.locator('tbody td', { hasText: /^—$/ }).count()).toBeLessThanOrEqual(n);
  // закрытая ночь названа словами (слово «закрыто» держит запись сертификации Channex)
  await expect(table.locator('tbody tr.is-stop').first()).toContainText('закрыто (стоп-продажа)');
  await expect(main.getByTestId('rate-row-2026-10-01')).toContainText('1 ночь');
  // последняя колонка не уходит в прокрутку обёртки без признака
  const clipped = await table.evaluate((el) => {
    const scroller = el.closest('.table-scroll') ?? el.parentElement!;
    return scroller.scrollWidth - scroller.clientWidth;
  });
  expect(clipped, 'таблица цен обрезана прокруткой').toBeLessThanOrEqual(1);
  // строка по шкале §4 (38–42 px), а не 57
  const height = await rows.first().evaluate((el) => el.getBoundingClientRect().height);
  expect(height).toBeGreaterThanOrEqual(34);
  expect(height).toBeLessThanOrEqual(44);
});

test('цены: на телефоне строка складывается в карточку, цена по-прежнему правится в ячейке', async ({
  page,
}) => {
  const main = page.getByRole('main');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/rates?month=2026-10');
  const table = main.getByTestId('rates-table');
  await expect(table).toBeVisible();
  const clipped = await table.evaluate((el) => {
    const scroller = el.closest('.table-scroll') ?? el.parentElement!;
    return scroller.scrollWidth - scroller.clientWidth;
  });
  expect(clipped, 'таблица цен уезжает в прокрутку вбок').toBeLessThanOrEqual(1);
  const row = main.getByTestId('rate-row-2026-10-01');
  // в сложенной строке слово стоит у числа: «1 гость 8 000 ₸», «2 гостя 10 000 ₸», «мин. 1 ночь»
  await expect(row).toContainText('1 гость');
  await expect(row).toContainText('2 гостя');
  await expect(row).toContainText('мин. 1 ночь');
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

test('массовое изменение: дни недели одной строкой, кнопка называет число изменений', async ({
  page,
}) => {
  const main = page.getByRole('main');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/rates?month=2026-10');
  const editor = main.getByTestId('bulk-editor');
  await expect(editor).toBeVisible();
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
});
