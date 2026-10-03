import { expect, test, FIXTURE_API } from './fixtures';

const fixture = FIXTURE_API;
test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
  await request.post(`${fixture}/__test/control`, { data: { group: true } });
});

for (const edited of [true, false]) {
  test(`обновление счёта ${edited ? 'сохраняет введённые сумму и примечание' : 'обновляет сумму, если её ещё не вводили'}`, async ({
    page,
    request,
  }) => {
    await page.goto('/reservations/20260913-TESTAA');
    await page.getByRole('tab', { name: 'Счета', exact: true }).click();
    const payment = page.getByTestId('payment-form').first();
    const original = await payment.getByLabel('Сумма', { exact: true }).inputValue();
    if (edited) {
      await payment.getByLabel('Сумма', { exact: true }).fill('1.25');
      await payment.getByLabel('Примечание', { exact: true }).fill('Проверка сохранения ввода');
    }
    await page.getByText('Один платёж на несколько счетов', { exact: true }).click();
    const group = page.getByTestId('group-payment-form');
    await group.getByLabel('Общая сумма, KZT').fill('2000');
    await group.getByLabel('На счёт 1', { exact: true }).fill('1000');
    await group.getByLabel('На счёт 2', { exact: true }).fill('1000');
    await group.getByRole('button', { name: 'Принять общий платёж' }).click();
    await expect(group.getByRole('status')).toContainText('Платёж принят');
    if (edited) {
      await expect(payment.getByLabel('Сумма', { exact: true })).toHaveValue('1.25');
      await expect(payment.getByLabel('Примечание', { exact: true })).toHaveValue(
        'Проверка сохранения ввода',
      );
      await payment.getByRole('button', { name: 'Принять оплату', exact: true }).click();
      await expect
        .poll(async () => {
          const commands = (await (
            await request.get(`${fixture}/__test/commands`)
          ).json()) as Array<{ path: string; body: { amount?: string; note?: string } }>;
          return commands.filter((c) => c.path === '/finance/payments').at(-1)?.body;
        })
        .toMatchObject({ amount: '1.25', note: 'Проверка сохранения ввода' });
    } else {
      await expect(payment.getByLabel('Сумма', { exact: true })).not.toHaveValue(original);
      const result = (await (
        await request.get(`${fixture}/finance/reservations/20260913-TESTAA`, {
          headers: { 'x-wetop-test-client': '1' },
        })
      ).json()) as { folios: Array<{ balanceMinor: string }> };
      const digits = result.folios[0]!.balanceMinor.padStart(3, '0');
      await expect(payment.getByLabel('Сумма', { exact: true })).toHaveValue(
        `${digits.slice(0, -2)}.${digits.slice(-2)}`,
      );
    }
  });
}

/**
 * D3 «Оплата в брони» (tasks/todo.md): перед кнопкой видно, сколько, чем и на какой счёт какой брони
 * уходит платёж; не число не отправляется; у полей подписи; после успеха форма собирается заново.
 */
test('оплата D3: строка сути называет сумму, способ, счёт и бронь; не число не уходит', async ({
  page,
}) => {
  await page.goto('/reservations/20260913-TESTAA');
  await page.getByRole('tab', { name: 'Счета', exact: true }).click();
  const payment = page.getByTestId('payment-form').first();
  const digest = payment.getByTestId('payment-digest');
  // подсказка из баланса первого счёта — уже в строке сути, способ по умолчанию — наличные
  await expect(digest).toContainText('наличные');
  await expect(digest).toContainText('брони 20260913-TESTAA');
  await expect(digest).toContainText(/\d[\d\s]* ₸/);
  await payment.getByLabel('Сумма', { exact: true }).fill('1250,50');
  await payment.getByLabel('Способ оплаты').selectOption('KASPI');
  await expect(digest).toContainText('1 250,50 ₸, Kaspi, на счёт «');
  // не число — кнопка отключена, строка сути говорит почему
  await payment.getByLabel('Сумма', { exact: true }).fill('12a');
  await expect(digest).toContainText('не число');
  await expect(payment.getByRole('button', { name: 'Принять оплату', exact: true })).toBeDisabled();
  await payment.getByLabel('Сумма', { exact: true }).fill('1000');
  await expect(payment.getByRole('button', { name: 'Принять оплату', exact: true })).toBeEnabled();
  // подписи полей видны, не только aria-label
  // подпись — это <label> вокруг поля: его текст включает и значение, поэтому ищем по началу
  await expect(payment.locator('label.field--inline', { hasText: /^Способ/ })).toBeVisible();
  await expect(payment.locator('label.field--inline', { hasText: /^Примечание/ })).toBeVisible();
});
