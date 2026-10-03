import { FIXTURE_API, expect, test } from './fixtures';

test.beforeEach(async ({ request }) => {
  await request.post(`${FIXTURE_API}/__test/control`, {
    data: { piiStorage: 'pseudonymized' },
  });
});

test('invalid departure preserves input, marks field and clears price', async ({ page }) => {
  await page.goto('/reservations/new?arrival=2026-10-01&departure=2026-10-02');
  const form = page.getByTestId('new-reservation-form');
  const arrival = form.getByLabel('Заезд', { exact: true });
  const departure = form.getByLabel('Выезд', { exact: true });
  await arrival.fill('2026-10-01');
  await departure.fill('2026-10-02');
  await expect(form.getByRole('button', { name: 'Создать бронь', exact: true })).toBeEnabled();
  await departure.fill('2026-09-30');
  await departure.blur();
  await expect(departure).toHaveValue('2026-09-30');
  await expect(departure).toHaveAttribute('aria-invalid', 'true');
  await expect(
    form.getByText('Дата выезда должна быть позже даты заезда', { exact: true }),
  ).toBeVisible();
  await expect(
    form.getByText('Укажите корректные даты для расчёта', { exact: true }),
  ).toBeVisible();
  await expect(form.getByRole('button', { name: 'Создать бронь', exact: true })).toBeDisabled();
  await departure.press('Enter');
  await expect(form).toBeVisible();
  await departure.fill('2026-10-04');
  await expect(form.getByTestId('availability')).toContainText('3 ночи');
  await expect(form.getByRole('button', { name: 'Создать бронь', exact: true })).toBeEnabled();
});

test('equal, empty, later arrival and recovery work on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/reservations/new?arrival=2028-02-28&departure=2028-02-29');
  const form = page.getByTestId('new-reservation-form');
  const arrival = form.getByLabel('Заезд', { exact: true });
  const departure = form.getByLabel('Выезд', { exact: true });
  const submit = form.getByRole('button', { name: 'Создать бронь', exact: true });
  await departure.fill('2028-02-28');
  await expect(submit).toBeDisabled();
  await departure.fill('');
  await expect(departure).toHaveValue('');
  await expect(departure).toHaveAttribute('aria-invalid', 'true');
  await departure.fill('2028-02-29');
  await expect(submit).toBeEnabled();
  await arrival.fill('2028-03-01');
  await expect(departure).toHaveValue('2028-02-29');
  await expect(submit).toBeDisabled();
  await form.getByRole('button', { name: '3 ночи', exact: true }).click();
  await expect(departure).toHaveValue('2028-03-04');
  await expect(submit).toBeEnabled();
  await expect(form.getByTestId('booking-digest')).toContainText('3 ночи');
  await page.screenshot({ path: 'reports/booking-date-mobile.png' });
});

test('pending quote blocks submit and old responses cannot restore old period', async ({
  page,
  request,
}) => {
  await page.goto('/reservations/new?arrival=2026-12-30&departure=2026-12-31');
  const form = page.getByTestId('new-reservation-form');
  const submit = form.getByRole('button', { name: 'Создать бронь', exact: true });
  await expect(submit).toBeEnabled();
  await request.post(`${FIXTURE_API}/__test/control`, {
    data: { piiStorage: 'pseudonymized', delayPath: '/reservations/quote', delayMs: 1800 },
  });
  await form.getByRole('button', { name: '2 ночи', exact: true }).click();
  await expect(submit).toBeDisabled();
  await expect(form.locator('.booking-create__price')).toContainText('Рассчитываем');
  // Allow the first request to reach the deliberately slow fixture before changing dates again.
  await page.waitForTimeout(400);
  await form.getByRole('button', { name: '7 ночей', exact: true }).click();
  await expect(submit).toBeDisabled();
  await expect(form.getByLabel('Выезд', { exact: true })).toHaveValue('2027-01-06');
  await expect(submit).toBeEnabled();
  await expect(form.getByTestId('booking-digest')).toContainText('7 ночей');
  await expect(form.locator('.booking-create__price strong')).toBeVisible();
});

test('failed quote and availability can be retried without reopening', async ({
  page,
  request,
}) => {
  await page.goto('/reservations/new');
  const form = page.getByTestId('new-reservation-form');
  const submit = form.getByRole('button', { name: 'Создать бронь', exact: true });
  await expect(submit).toBeEnabled();
  for (const path of ['/reservations/quote', '/availability']) {
    await request.post(`${FIXTURE_API}/__test/control`, {
      data: { piiStorage: 'pseudonymized', failPath: path },
    });
    await form
      .getByRole('button', { name: path === '/availability' ? '3 ночи' : '2 ночи', exact: true })
      .click();
    const retry = form.getByRole('button', {
      name: path === '/availability' ? 'Повторить проверку' : 'Повторить расчёт',
      exact: true,
    });
    await expect(retry).toBeVisible();
    await expect(submit).toBeDisabled();
    await request.post(`${FIXTURE_API}/__test/control`, {
      data: { piiStorage: 'pseudonymized' },
    });
    await retry.click();
    await expect(submit).toBeEnabled();
  }
});

test('calendar and keyboard produce the same period', async ({ page }) => {
  await page.goto('/reservations/new?arrival=2026-10-01&departure=2026-10-02');
  const form = page.getByTestId('new-reservation-form');
  await form.getByRole('button', { name: 'Открыть календарь' }).nth(1).click();
  await page.getByRole('button', { name: '4 октября 2026', exact: true }).click();
  await expect(form.getByLabel('Выезд', { exact: true })).toHaveValue('2026-10-04');
  await expect(form.getByTestId('booking-digest')).toContainText('3 ночи');
  await expect(form.getByRole('button', { name: 'Создать бронь', exact: true })).toBeEnabled();
  const price = await form.locator('.booking-create__price strong').innerText();
  await form.getByLabel('Выезд', { exact: true }).fill('2026-10-02');
  await form.getByLabel('Выезд', { exact: true }).fill('2026-10-04');
  await expect(form.getByRole('button', { name: 'Создать бронь', exact: true })).toBeEnabled();
  await expect(form.locator('.booking-create__price strong')).toHaveText(price);
});

test('occupied selection stays visible and cannot silently become unassigned', async ({
  page,
}) => {
  await page.goto('/reservations/new?arrival=2029-01-10&departure=2029-01-12&unit=M03');
  await page.getByRole('button', { name: 'Создать бронь', exact: true }).click();
  await expect(page).toHaveURL(/\/reservations\/20260913-NEW\d+$/);
  await page.goto('/reservations/new?arrival=2029-01-08&departure=2029-01-09&unit=M03');
  const form = page.getByTestId('new-reservation-form');
  const unit = form.getByRole('combobox', { name: 'Номер / койка', exact: true });
  await expect(unit).toHaveValue('M03');
  await form.getByLabel('Выезд', { exact: true }).fill('2029-01-11');
  await expect(unit).toHaveValue('M03');
  await expect(unit).toHaveAttribute('aria-invalid', 'true');
  await expect(form.getByRole('button', { name: 'Создать бронь', exact: true })).toBeDisabled();
  await expect(form.getByText(/Выбранная ячейка M03 недоступна/)).toBeVisible();
  await unit.selectOption('');
  await expect(form.getByRole('button', { name: 'Создать бронь', exact: true })).toBeEnabled();
});
