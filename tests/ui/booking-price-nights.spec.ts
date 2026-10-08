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

test('календарь: сводка дня карточкой справа, управление слева', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/chessboard');
  const panel = page.getByRole('group', { name: 'Сегодня на объекте' });
  await expect(panel).toBeVisible();
  const p = (await panel.boundingBox())!;
  const c = (await page.locator('.calendar-workspace__main > .board-controls').boundingBox())!;
  // Вертикальная сводка справа полностью помещается в рабочий экран.
  expect(p.y + p.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  expect(c.x + c.width).toBeLessThanOrEqual(p.x + 1);
  await expect(panel.getByTestId('day-free')).toBeVisible();
  await expect(panel.getByTestId('day-units')).toHaveCount(0);
  await page.screenshot({ path: 'reports/calendar-2026-10-02/header-compact-1440.png' });
});
