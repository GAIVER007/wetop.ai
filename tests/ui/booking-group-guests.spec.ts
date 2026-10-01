import { expect, test } from './fixtures';

/**
 * WET-02 (ТЗ QA 01.10.2026): групповая бронь на койки. Поле «Гостей» относится к одному месту, API заводит столько
 * проживаний, сколько мест, поэтому форма до отправки называет общее число гостей: подпись поля, подсказка под
 * группой, липкая строка сути и блок «Проверить детали брони» говорят одно и то же. Стенд: подставной API.
 */
const API = 'http://127.0.0.1:4311';

test.beforeEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});

test('3 койки: поле «Гостей на место», подсказка и сводка считают 3 гостей', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/reservations/new');
  const form = page.getByTestId('new-reservation-form');
  await expect(form.getByTestId('availability')).toContainText(/свободно/);
  // подписи полей оборачивают поле (`Field`), поэтому имя поля включает значение: ищем по `name`
  await form.locator('select[name="accommodationTypeCode"]').selectOption('MALE');
  const guests = form.locator('input[name="adults"]');
  await expect(guests).toHaveValue('1');
  await expect(form.getByText('Гостей', { exact: true })).toBeVisible();
  await form.locator('input[name="quantity"]').fill('3');

  await expect(form.getByText('Гостей на место', { exact: true })).toBeVisible();
  await expect(guests).toHaveValue('1');
  await expect(guests).toHaveAttribute('max', '1');
  await expect(form.getByTestId('group-hint')).toContainText('3 проживания');
  await expect(form.getByTestId('group-hint')).toContainText('всего 3 гостя');
  const digest = form.getByTestId('booking-digest');
  await expect(digest).toContainText('3 места, ячейки назначит система, 3 гостя');
  await expect(digest).not.toContainText('1 гость');

  await form.getByText('Проверить детали брони', { exact: true }).click();
  await expect(form.getByTestId('booking-summary')).toContainText(
    'Мужской общий номер, 3 места, ячейки назначит система, 3 гостя',
  );

  // обратно к одному месту: подпись и сводка возвращаются к одному гостю
  await form.locator('input[name="quantity"]').fill('1');
  await expect(form.getByText('Гостей', { exact: true })).toBeVisible();
  await expect(digest).toContainText('1 гость');
});

test('2 номера по 2 гостя: сводка считает 4 гостей; телефон без горизонтальной прокрутки', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/reservations/new');
  const form = page.getByTestId('new-reservation-form');
  await expect(form.getByTestId('availability')).toContainText(/свободно/);
  await form.locator('select[name="accommodationTypeCode"]').selectOption('ROOM');
  await form.locator('input[name="adults"]').fill('2');
  await form.locator('input[name="quantity"]').fill('2');
  await expect(form.getByText('Гостей на место', { exact: true })).toBeVisible();
  await expect(form.locator('input[name="adults"]')).toHaveValue('2');
  await expect(form.getByTestId('group-hint')).toContainText('всего 4 гостя');
  await expect(form.getByTestId('booking-digest')).toContainText('2 места, ячейки назначит система, 4 гостя');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});
