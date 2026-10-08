import { FIXTURE_API, expect, test } from './fixtures';
const number = '20260913-TESTAA';
const headers = { 'x-wetop-test-client': '1' };

test.beforeEach(async ({ request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
});

test('календарь: оплата без перехода и отказ от незавершённого ввода', async ({ page, request }) => {
  const card = await (await request.get(`${FIXTURE_API}/reservations/${number}`, { headers })).json();
  const before = await (await request.get(`${FIXTURE_API}/finance/reservations/${number}`, { headers })).json();
  await page.goto(`/chessboard?from=${card.arrivalDate}&to=${card.departureDate}`);
  await page.locator(`[data-testid="stay-cell"][data-number="${number}"]`).first().click();
  const preview = page.getByTestId('stay-preview');
  await preview.getByRole('button', { name: 'Оплата / возврат', exact: true }).click();
  const form = preview.getByTestId('payment-form');
  await form.getByLabel('Сумма', { exact: true }).fill('100');
  await preview.getByRole('button', { name: 'Закрыть предпросмотр' }).click();
  const close = page.getByRole('dialog', { name: 'Закрыть без проведения?' });
  await expect(close).toBeVisible();
  await close.getByRole('button', { name: 'Продолжить ввод', exact: true }).click();
  await form.getByRole('button', { name: 'Проверить оплату', exact: true }).click();
  const untouched = await (await request.get(`${FIXTURE_API}/finance/reservations/${number}`, { headers })).json();
  expect(untouched.paidMinor).toBe(before.paidMinor);
  await form.getByRole('button', { name: 'Подтвердить оплату', exact: true }).click();
  await expect(preview.getByTestId('preview-finance-result')).toContainText('Оплата принята');
  await expect(page).toHaveURL(/\/chessboard\?/);
  await expect.poll(async () => (await (await request.get(`${FIXTURE_API}/finance/reservations/${number}`, { headers })).json()).paidMinor).toBe((BigInt(before.paidMinor) + 10000n).toString());
});

test('телефон: возврат в календаре проверяет платёж и подтверждает сумму', async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const card = await (await request.get(`${FIXTURE_API}/reservations/${number}`, { headers })).json();
  const before = await (await request.get(`${FIXTURE_API}/finance/reservations/${number}`, { headers })).json();
  await page.goto(`/chessboard?from=${card.arrivalDate}&to=${card.departureDate}`);
  await page.locator(`[data-testid="stay-cell"][data-number="${number}"]`).first().click();
  const preview = page.getByTestId('stay-preview');
  await preview.getByRole('button', { name: 'Оплата / возврат', exact: true }).click();
  await preview.getByRole('button', { name: 'Возврат', exact: true }).click();
  await expect(preview.getByLabel('Платёж для возврата')).toBeVisible();
  const form = preview.getByTestId('refund-form');
  await form.getByLabel('Сумма', { exact: true }).fill('50');
  await form.getByLabel('Причина возврата').fill('Синтетический возврат');
  await form.getByRole('button', { name: 'Проверить возврат', exact: true }).click();
  const confirm = form.getByRole('button', { name: 'Подтвердить возврат', exact: true });
  await confirm.scrollIntoViewIfNeeded();
  await expect(confirm).toBeInViewport({ ratio: 0.95 });
  await confirm.click();
  await expect(preview.getByTestId('preview-finance-result')).toContainText('Возврат проведён');
  await expect.poll(async () => (await (await request.get(`${FIXTURE_API}/finance/reservations/${number}`, { headers })).json()).refundedMinor).toBe((BigInt(before.refundedMinor) + 5000n).toString());
  await preview.getByRole('button', { name: 'Закрыть предпросмотр' }).click();
  await expect(preview).toBeHidden();
});

test('закрытие незавершённого ввода ничего не проводит', async ({ page, request }) => {
  const card = await (await request.get(`${FIXTURE_API}/reservations/${number}`, { headers })).json();
  const before = await (await request.get(`${FIXTURE_API}/finance/reservations/${number}`, { headers })).json();
  await page.goto(`/chessboard?from=${card.arrivalDate}&to=${card.departureDate}`);
  await page.locator(`[data-testid="stay-cell"][data-number="${number}"]`).first().click();
  const preview = page.getByTestId('stay-preview');
  await preview.getByRole('button', { name: 'Оплата / возврат', exact: true }).click();
  await preview.getByTestId('payment-form').getByLabel('Сумма', { exact: true }).fill('125');
  await page.keyboard.press('Escape');
  const close = page.getByRole('dialog', { name: 'Закрыть без проведения?' });
  await expect(close).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(close).toBeHidden();
  await expect(preview).toBeVisible();
  await preview.getByRole('button', { name: 'Закрыть предпросмотр' }).click();
  await close.getByRole('button', { name: 'Закрыть без проведения', exact: true }).click();
  await expect(preview).toBeHidden();
  const after = await (await request.get(`${FIXTURE_API}/finance/reservations/${number}`, { headers })).json();
  expect(after.paidMinor).toBe(before.paidMinor);
  expect(after.refundedMinor).toBe(before.refundedMinor);
});
