import { FIXTURE_API, expect, test } from './fixtures';
const number = '20260913-TESTAA';
const headers = { 'x-wetop-test-client': '1' };

test.beforeEach(async ({ request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
});

test('оплата в карточке требует проверки и подтверждения', async ({ page, request }) => {
  const before = await (
    await request.get(`${FIXTURE_API}/finance/reservations/${number}`, { headers })
  ).json();
  await page.goto(`/reservations/${number}#booking-finance`);
  const form = page.getByTestId('payment-form').first();
  await form.getByLabel('Сумма', { exact: true }).fill('100');
  await form.getByRole('button', { name: 'Проверить оплату', exact: true }).click();
  await expect(form.getByRole('region', { name: 'Проверка оплаты' })).toContainText('100');
  const untouched = await (
    await request.get(`${FIXTURE_API}/finance/reservations/${number}`, { headers })
  ).json();
  expect(untouched.paidMinor).toBe(before.paidMinor);
  await form.getByLabel('Сумма', { exact: true }).fill('200');
  await expect(form.getByRole('button', { name: 'Подтвердить оплату', exact: true })).toHaveCount(
    0,
  );
  await form.getByRole('button', { name: 'Проверить оплату', exact: true }).click();
  await form.getByRole('button', { name: 'Подтвердить оплату', exact: true }).click();
  await expect
    .poll(
      async () =>
        (
          await (
            await request.get(`${FIXTURE_API}/finance/reservations/${number}`, { headers })
          ).json()
        ).paidMinor,
    )
    .toBe((BigInt(before.paidMinor) + 20000n).toString());
});

test('возврат требует подтверждения и сохраняет результат', async ({ page, request }) => {
  const before = await (
    await request.get(`${FIXTURE_API}/finance/reservations/${number}`, { headers })
  ).json();
  await page.goto(`/reservations/${number}#booking-finance`);
  const form = page.getByTestId('refund-form').first();
  await form.getByLabel('Сумма', { exact: true }).fill('50');
  await form.getByLabel('Причина возврата').fill('Тестовая причина');
  await form.getByRole('button', { name: 'Проверить возврат', exact: true }).click();
  await expect(form.getByRole('region', { name: 'Проверка возврата' })).toContainText(
    'Тестовая причина',
  );
  const untouched = await (
    await request.get(`${FIXTURE_API}/finance/reservations/${number}`, { headers })
  ).json();
  expect(untouched.refundedMinor).toBe(before.refundedMinor);
  await form.getByRole('button', { name: 'Подтвердить возврат', exact: true }).click();
  await expect
    .poll(
      async () =>
        (
          await (
            await request.get(`${FIXTURE_API}/finance/reservations/${number}`, { headers })
          ).json()
        ).refundedMinor,
    )
    .toBe((BigInt(before.refundedMinor) + 5000n).toString());
  await expect(form.getByRole('button', { name: 'Подтвердить возврат', exact: true })).toHaveCount(
    0,
  );
});
