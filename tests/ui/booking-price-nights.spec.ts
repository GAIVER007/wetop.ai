import { expect, test } from './fixtures';

/**
 * Образец Exely (поручение 03.10): в форме брони — «Детализация цены по дням», цена каждой ночи
 * из того же расчёта, что итог; шапка календаря — панель «Сегодня» не выше строки управления.
 */
const fixture = process.env['UI_FIXTURE_API'] ?? 'http://127.0.0.1:4311';

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

test('календарь: панель «Сегодня» не выше строки управления, под ней нет пустоты', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/chessboard');
  const panel = page.getByRole('group', { name: 'Сегодня на объекте' });
  await expect(panel).toBeVisible();
  const p = (await panel.boundingBox())!;
  const c = (await page.locator('.board-top > .board-controls').boundingBox())!;
  // было 5 строк (~150px) против одной строки управления; теперь две строки показателей
  expect(p.height).toBeLessThanOrEqual(Math.max(c.height, 64) + 4);
  await expect(panel.getByTestId('day-free')).toBeVisible();
  await expect(panel.getByTestId('day-units')).toBeVisible();
  await page.screenshot({ path: 'reports/calendar-2026-10-02/header-compact-1440.png' });
});
