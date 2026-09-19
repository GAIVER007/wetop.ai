import { expect, test } from './fixtures';
import { cardTab } from './card-tabs';
import { confirmDialog } from './confirm';

/**
 * Gate 3 живьём: бронь со стойки появляется в шахматке и уменьшает доступность, отмена возвращает всё назад.
 * Гость вымышленный (ADR-010); даты далеко в будущем, чтобы не трогать контрольные числа 08.09.2026.
 */
const ARRIVAL = '2027-05-10';
const DEPARTURE = '2027-05-12';

test('создать бронь с ячейкой → видна в шахматке → отменить → ячейка свободна', async ({
  page,
}) => {
  await page.goto(`/reservations/new?arrival=${ARRIVAL}&departure=${DEPARTURE}`);
  await expect(page.getByRole('heading', { name: 'Новая бронь' })).toBeVisible();
  const availabilityBefore = await page.getByRole('main').getByTestId('availability').textContent();
  const freeBefore = Number(/свободно (\d+)/.exec(availabilityBefore ?? '')?.[1]);
  expect(freeBefore).toBeGreaterThan(0);

  const form = page.getByRole('main').getByTestId('new-reservation-form');
  await form.locator('select[name="source"]').selectOption('PHONE');
  const unitSelect = form.locator('select[name="unitCode"]');
  const unitCode = await unitSelect.locator('option').nth(1).getAttribute('value');
  expect(unitCode).toBeTruthy();
  await unitSelect.selectOption(unitCode!);
  await form.locator('input[name="firstName"]').fill('Гость');
  await form.locator('input[name="lastName"]').fill('Тест-e2e');
  await form.locator('textarea[name="notes"]').fill('E2E-АВТОТЕСТ'); // сверка исключает автотесты
  await form.locator('input[name="phone"]').fill('+70000000000');
  await form.getByRole('button', { name: 'Создать бронь' }).click();

  await expect(page).toHaveURL(/\/reservations\/\d{8}-[A-Z0-9]{6}$/);
  await expect(page.getByRole('heading', { name: /Бронь/ })).toBeVisible();
  await expect(page.getByRole('main').getByTestId('stay-row').first()).toContainText(unitCode!);
  await page.screenshot({
    path: 'reports/screenshots/manual-reservation-card.png',
    fullPage: true,
  });
  const number = page.url().split('/').pop()!;

  await page.goto(`/chessboard?from=${ARRIVAL}&to=${DEPARTURE}`);
  const cellLink = page.locator(`td[data-state="OCCUPIED"] a[href*="${number}"]`);
  await expect(cellLink.first()).toBeVisible();
  await page.screenshot({ path: 'reports/screenshots/manual-reservation-chessboard.png' });

  await page.goto(`/reservations/new?arrival=${ARRIVAL}&departure=${DEPARTURE}`);
  const availabilityAfter = await page.getByRole('main').getByTestId('availability').textContent();
  expect(Number(/свободно (\d+)/.exec(availabilityAfter ?? '')?.[1])).toBe(freeBefore - 1);

  await page.goto(`/reservations/${number}`);
  await cardTab(page, 'Действия');
  await page.getByRole('main').getByTestId('cancel-reservation').click();
  await confirmDialog(page, 'Отменить бронь');
  await expect(page.getByText('отменена').first()).toBeVisible();
  await page.goto(`/reservations/new?arrival=${ARRIVAL}&departure=${DEPARTURE}`);
  const availabilityEnd = await page.getByRole('main').getByTestId('availability').textContent();
  expect(Number(/свободно (\d+)/.exec(availabilityEnd ?? '')?.[1])).toBe(freeBefore);
});
