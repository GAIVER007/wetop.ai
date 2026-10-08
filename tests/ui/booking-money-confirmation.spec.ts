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
  await page.getByTestId('refund-btn').first().click();
  const form = page.getByTestId('refund-form').first();
  await form.getByLabel('Сумма возврата', { exact: true }).fill('50');
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

test('синтетический API: общий платёж возвращается по выбранному счёту с отдельным лимитом', async ({
  request,
}) => {
  // FinanceService.refund выбирает allocation по folioId и считает возвраты этого распределения.
  await request.post(`${FIXTURE_API}/__test/control`, { data: { group: true } });
  const finance = await (
    await request.get(`${FIXTURE_API}/finance/reservations/${number}`, { headers })
  ).json();
  const ids = finance.folios.map((f: { id: string }) => f.id);
  const paid = await request.post(`${FIXTURE_API}/finance/payments`, {
    headers,
    data: {
      method: 'CASH',
      amount: '200',
      note: 'Синтетический общий',
      allocations: ids.map((folioId: string) => ({ folioId, amount: '100' })),
    },
  });
  expect(paid.status()).toBe(201);
  const updated = await (
    await request.get(`${FIXTURE_API}/finance/reservations/${number}`, { headers })
  ).json();
  const paymentId = updated.folios[0].payments.find(
    (p: { note: string }) => p.note === 'Синтетический общий',
  ).paymentId;
  for (const folioId of ids) {
    const refund = await request.post(`${FIXTURE_API}/finance/payments/${paymentId}/refunds`, {
      headers,
      data: { folioId, amount: '80', reason: 'Синтетический возврат' },
    });
    expect(refund.status()).toBe(201);
  }
  const over = await request.post(`${FIXTURE_API}/finance/payments/${paymentId}/refunds`, {
    headers,
    data: { folioId: ids[0], amount: '30' },
  });
  expect(over.status()).toBe(400);
  const after = await (
    await request.get(`${FIXTURE_API}/finance/reservations/${number}`, { headers })
  ).json();
  expect(after.folios.map((f: { refundedMinor: string }) => f.refundedMinor)).toEqual([
    '8000',
    '8000',
  ]);
});
