import { FIXTURE_API, expect, test } from './fixtures';

/**
 * Образец Exely (поручение 03.10): в форме брони — «Детализация цены по дням», цена каждой ночи
 * из того же расчёта, что итог; шапка календаря — панель «Сегодня» не выше строки управления.
 */
const fixture = FIXTURE_API;

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

test('форма брони: детализация цены по дням, сумма ночей равна итогу', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/reservations/new?unit=M03');
  const form = page.getByTestId('new-reservation-form');
  await form.getByRole('button', { name: '3 ночи', exact: true }).click();
  const nights = form.getByTestId('price-by-night');
  await expect(nights).toBeVisible();
  // свёрнута по умолчанию: форма не вырастает, кнопка «Создать бронь» остаётся на экране
  await expect(nights.locator('table')).toBeHidden();
  await nights.getByText('Детализация цены по дням', { exact: true }).click();
  await expect(nights.locator('tbody tr')).toHaveCount(3);
  await expect(form.getByTestId('price-by-night-sum')).toContainText('Всего ночей: 3');
  await expect(form.getByTestId('price-by-night-sum')).toContainText('средняя стоимость ночи');
});

test('календарь: одна полоса управления и шесть карточек под ней, сетка начинается выше', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/chessboard');
  const panel = page.getByRole('group', { name: 'Сегодня на объекте' });
  await expect(panel).toBeVisible();
  const p = (await panel.boundingBox())!;
  const bar = (await page.locator('.board-toolbar').boundingBox())!;
  const grid = (await page.locator('.board-wrap').boundingBox())!;
  // образец владельца (09.10): полоса «Сегодня ‹ › период масштаб длина поиск Фильтры Новая бронь» одной
  // строкой, под ней шесть карточек в один ряд, затем сетка
  expect(bar.height).toBeLessThanOrEqual(56);
  expect(bar.y + bar.height).toBeLessThanOrEqual(p.y + 1);
  expect(p.height).toBeLessThanOrEqual(96);
  expect(p.y + p.height).toBeLessThanOrEqual(grid.y + 1);
  expect(grid.y).toBeLessThanOrEqual(260);
  const tops = await panel
    .locator('.board-kpi')
    .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  expect(tops).toHaveLength(6);
  expect(new Set(tops).size).toBe(1);
  // все шесть элементов полосы на одной линии
  const barTops = await page
    .locator('.board-toolbar')
    .locator(
      ':scope > .board-nav > *, :scope > .board-search, :scope > .board-filters-open, :scope > .board-new',
    )
    .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top / 8)));
  expect(new Set(barTops).size).toBe(1);
  await expect(panel.getByTestId('day-free')).toBeVisible();
  await expect(panel.getByTestId('day-units')).toHaveCount(0);
  await page.screenshot({ path: 'reports/calendar-2026-10-02/header-compact-1440.png' });
});
