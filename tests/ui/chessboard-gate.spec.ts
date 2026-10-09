import { FIXTURE_API, expect, test } from './fixtures';
import { mkdirSync } from 'node:fs';

/**
 * Снимки визуального стоп-гейта «Шахматка v2» для владельца (условие 1 к плану
 * plans/chessboard-v2-2026-09-27.md §Г): полный desktop, верх крупнее, элементы управления
 * по одному, плашка «Без ячейки» свёрнутая и раскрытая, колонка сегодняшнего дня.
 * Данные — design-seed: брони с крайними случаями и одна без ячейки; фонд как у Luxx (88 мест).
 * Спек ничего не доказывает red→green — он генерирует артефакты гейта; счётчики строк
 * подтверждают, что снят настоящий экран, а не пустая страница.
 */
const DIR = 'reports/chessboard-v2-pr2-2026-09-27/gate';
const fixture = FIXTURE_API;

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
  // строка дат (09.10.2026): стрелки, период-кнопка, «? Помощь»
  await page.locator('.board-controls').screenshot({ path: `${DIR}/controls.png` });
  // раскрытый период: чипы «Сегодня», 7/14/30, «Месяц», поля С / По и «Применить»
  await page.getByTestId('board-period-button').click();
  await expect(page.getByRole('link', { name: 'Месяц', exact: true })).toBeVisible();
  await page.screenshot({
    caret: 'initial',
    path: `${DIR}/controls-dates-open.png`,
    clip: { x: 0, y: 0, width: 900, height: 560 },
  });
  await page.getByTestId('board-period-button').click();
  // строка поиска и фильтров: поиск, категория, тип места, статусы
  await page.locator('.board-toolbar').screenshot({ path: `${DIR}/toolbar.png` });

  // брони без места: одна строка над сеткой (ТЗ §11); список — ящиком по «Разместить» (§12, PR 6)
  const strip = page.getByTestId('unassigned-stays');
  await expect(strip).toHaveAttribute('data-count', '1');
  await strip.screenshot({ path: `${DIR}/unassigned-collapsed.png` });
  await strip.getByRole('button', { name: 'Разместить', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'Брони без размещения' });
  await expect(drawer.getByTestId('unassigned-card')).toHaveCount(1);
  await page.screenshot({ caret: 'initial', path: `${DIR}/unassigned-open.png` });
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();

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
  await page.getByRole('link', { name: '30 дней', exact: true }).click();
  await expect(page.getByTestId('date-col')).toHaveCount(30);
  await page.screenshot({ caret: 'initial', path: `${DIR}/mode-30-days-dark.png` });
});

test('гейт: овербукинг (critical), режим 30 дней и включённый фильтр', async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: 'light' });

  // продано сверх мест: строка броней без места — critical, сверху плашка овербукинга
  await request.post(`${fixture}/__test/reset`);
  await request.post(`${fixture}/__test/control`, { data: { showcase: true } });
  await page.goto('/chessboard');
  await expect(page.getByTestId('overbooked-callout')).toBeVisible();
  const strip = page.getByTestId('unassigned-stays');
  await expect(strip).toHaveAttribute('data-tone', 'critical');
  await page.screenshot({ caret: 'initial', path: `${DIR}/overbooking-critical.png` });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({ caret: 'initial', path: `${DIR}/overbooking-critical-dark.png` });
  await page.emulateMedia({ colorScheme: 'light' });

  // 30-дневный режим: окно от сегодня, горизонтальная прокрутка внутри сетки
  await request.post(`${fixture}/__test/reset`);
  const seeded = await request.post(`${fixture}/__test/design-seed`);
  expect(seeded.ok()).toBe(true);
  await page.goto('/chessboard');
  await page.getByRole('link', { name: '30 дней', exact: true }).click();
  await expect(page.getByTestId('date-col')).toHaveCount(30);
  await page.screenshot({ caret: 'initial', path: `${DIR}/mode-30-days.png` });

  // включённый фильтр: категория номеров — показано 16 из 88, счётчик и «Сбросить» на виду
  // (с PR 7 тип места — в окошке «Фильтры», в строке остались категория и места)
  await page.getByRole('link', { name: '7 дней', exact: true }).click();
  await expect(page.getByTestId('date-col')).toHaveCount(7);
  await page.getByLabel('Категория в календаре').selectOption('ROOM');
  await expect(page.getByTestId('unit-row')).toHaveCount(16);
  await page.screenshot({ caret: 'initial', path: `${DIR}/filters-applied.png` });
});
