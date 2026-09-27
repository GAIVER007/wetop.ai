import { expect, test } from './fixtures';
import { mkdirSync } from 'node:fs';

/**
 * Снимки визуального стоп-гейта «Шахматка v2» для владельца (условие 1 к плану
 * plans/chessboard-v2-2026-09-27.md §Г): полный desktop, верх крупнее, элементы управления
 * по одному, плашка «Без ячейки» свёрнутая и раскрытая, колонка сегодняшнего дня.
 * Данные — design-seed: брони с крайними случаями и одна без ячейки; фонд как у Luxx (88 мест).
 * Спек ничего не доказывает red→green — он генерирует артефакты гейта; счётчики строк
 * подтверждают, что снят настоящий экран, а не пустая страница.
 */
const DIR = 'reports/chessboard-v2-pr1-2026-09-27/gate';
const fixture = 'http://127.0.0.1:4311';

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
  const seeded = await request.post(`${fixture}/__test/design-seed`);
  expect(seeded.ok()).toBe(true);
  mkdirSync(DIR, { recursive: true });
});

test('гейт: светлая тема — полный экран, верх, элементы управления, «Без ячейки», сегодня', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/chessboard');
  await expect(page.getByTestId('unit-row')).toHaveCount(88);
  await expect(page.getByTestId('date-col')).toHaveCount(7);

  // полный viewport с бронями и сегодняшним днём
  await page.screenshot({ caret: 'initial', path: `${DIR}/desktop-light.png` });
  // верх шахматки крупнее: заголовок, управление, фильтры и начало сетки
  await page.screenshot({
    caret: 'initial',
    path: `${DIR}/top-light.png`,
    clip: { x: 230, y: 0, width: 1210, height: 620 },
  });
  // заголовок и главное действие
  await page.locator('.page__head').screenshot({ path: `${DIR}/header.png` });
  // строка дат: стрелки, период, «Сегодня», 7/14/30, «Даты», «? Помощь»
  await page.locator('.board-controls').screenshot({ path: `${DIR}/controls.png` });
  // раскрытые «Даты»: С, По, «Применить» и «Месяц»
  await page.getByRole('button', { name: 'Даты', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Месяц', exact: true })).toBeVisible();
  await page.locator('.board-controls').screenshot({ path: `${DIR}/controls-dates-open.png` });
  await page.getByRole('button', { name: 'Даты', exact: true }).click();
  // строка поиска и фильтров: поиск, категория, тип места, статусы
  await page.locator('.board-toolbar').screenshot({ path: `${DIR}/toolbar.png` });

  // плашка «Без ячейки»: одна строка; список — по щелчку (при овербукинге раскрыта сразу)
  const strip = page.getByTestId('unassigned-stays');
  await expect(strip).toHaveAttribute('data-count', '1');
  if ((await strip.getAttribute('open')) === null) {
    await strip.screenshot({ path: `${DIR}/unassigned-collapsed.png` });
    await strip.locator('summary').click();
  }
  await strip.screenshot({ path: `${DIR}/unassigned-open.png` });
  await strip.locator('summary').click();

  // колонка сегодняшнего дня: спокойное выделение вместо сплошной синей полосы
  const today = await page.locator('th.is-today').boundingBox();
  await page.screenshot({
    caret: 'initial',
    path: `${DIR}/today-column-light.png`,
    clip: { x: today!.x - 140, y: 0, width: today!.width + 180, height: 700 },
  });
});

test('гейт: тёмная тема — полный экран и верх', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/chessboard');
  await expect(page.getByTestId('unit-row')).toHaveCount(88);
  await page.screenshot({ caret: 'initial', path: `${DIR}/desktop-dark.png` });
  await page.screenshot({
    caret: 'initial',
    path: `${DIR}/top-dark.png`,
    clip: { x: 230, y: 0, width: 1210, height: 620 },
  });
  const today = await page.locator('th.is-today').boundingBox();
  await page.screenshot({
    caret: 'initial',
    path: `${DIR}/today-column-dark.png`,
    clip: { x: today!.x - 140, y: 0, width: today!.width + 180, height: 700 },
  });
});
