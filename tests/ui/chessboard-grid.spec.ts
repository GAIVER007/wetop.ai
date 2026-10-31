import { FIXTURE_API, chooseBoardPeriod, expect, test } from './fixtures';

/**
 * Шахматка v2, PR 2 (ТЗ — plans/tz-chessboard-v2-2026-09-27.md): сетка.
 * §16 — колонка места объясняет себя подсказкой; §15 — свёрнутость категорий помнится
 * на пользователя и строка категории прилипает под шапкой дат (§13).
 */
test.beforeEach(async ({ request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
});

test('колонка места объясняет себя подсказкой: вид, код и состояние уборки', async ({ page }) => {
  await page.goto('/chessboard');
  await expect(page.getByTestId('unit-row')).toHaveCount(88);
  // у каждого места подсказка вида «Номер R01 — требует уборки» / «Койка B05 — готова к заселению»
  await expect(page.getByTestId('unit-link').first()).toHaveAttribute(
    'title',
    /^(Номер|Койка) [\wА-ЯЁа-яё-]+ — (готов(а)? к заселению|требует уборки|убрано, ждёт проверки)$/u,
  );
  await expect(page.getByTestId('unit-link').last()).toHaveAttribute('title', /^(Номер|Койка) /u);
});

test('свёрнутая категория переживает перезагрузку страницы', async ({ page }) => {
  await page.goto('/chessboard');
  await expect(page.getByTestId('unit-row')).toHaveCount(88);
  const toggle = () => page.getByTestId('category-row').first().getByRole('button');
  await toggle().click();
  await expect(page.getByTestId('unit-row')).toHaveCount(72);
  await page.reload();
  await expect(page.getByTestId('unit-row')).toHaveCount(72);
  await expect(toggle()).toHaveAttribute('aria-expanded', 'false');
  // разворот тоже запоминается
  await toggle().click();
  await expect(page.getByTestId('unit-row')).toHaveCount(88);
  await page.reload();
  await expect(page.getByTestId('unit-row')).toHaveCount(88);
});

test('строка категории прилипает под шапкой дат при вертикальной прокрутке', async ({ page }) => {
  await page.goto('/chessboard');
  await expect(page.getByTestId('unit-row')).toHaveCount(88);
  const groupCell = page.getByTestId('category-row').first().locator('td').first();
  const unitRow = page.getByTestId('unit-row').first();
  const unitBefore = await unitRow.boundingBox();
  await page.locator('.board-wrap').evaluate((el) => {
    el.scrollTop = 400;
  });
  const unitAfter = await unitRow.boundingBox();
  const groupAfter = await groupCell.boundingBox();
  const header = await page.locator('.board thead th').first().boundingBox();
  // места прокрутились наверх, а строка категории осталась пришпиленной сразу под шапкой
  expect(unitBefore!.y - unitAfter!.y).toBeGreaterThanOrEqual(300);
  expect(unitAfter!.y).toBeLessThan(groupAfter!.y);
  expect(groupAfter!.y).toBeGreaterThanOrEqual(header!.y + header!.height - 2);
  expect(groupAfter!.y).toBeLessThanOrEqual(header!.y + header!.height + 8);
});

test('30 дней: день не уже 72 px, сетка прокручивается вбок, а не сжимается', async ({ page }) => {
  await page.goto('/chessboard');
  // 30 дней выбираются в едином контроле периода.
  await chooseBoardPeriod(page, '30 дней');
  // 1-го числа 30-дневного месяца «30 дней» совпадают с календарным месяцем, и шахматка верно показывает месяц,
  // вписанный в окно (гейт main 1.11.2026). Тогда тот же отрезок со сдвигом на день: 30 дней, но не месяц.
  const url = new URL(page.url());
  const from = url.searchParams.get('from');
  if (from && from.endsWith('-01')) {
    const shift = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
    await page.goto(`/chessboard?from=${shift(from, 1)}&to=${shift(from, 30)}`);
  }
  await expect(page.getByTestId('date-col')).toHaveCount(30);
  const width = await page
    .getByTestId('date-col')
    .nth(5)
    .evaluate((el) => el.getBoundingClientRect().width);
  expect(width).toBeGreaterThanOrEqual(72);
  // читаемость ценой горизонтальной прокрутки внутри сетки (ТЗ §44)
  const scrollable = await page
    .locator('.board-wrap')
    .evaluate((el) => el.scrollWidth > el.clientWidth + 40);
  expect(scrollable).toBe(true);
});
