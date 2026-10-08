import AxeBuilder from '@axe-core/playwright';
import type { APIRequestContext, Page } from '@playwright/test';
import { FIXTURE_API, expect, test } from './fixtures';

/**
 * «Счета» карточки брони после плана `plans/finance-payments-direct-2026-10-07.md`: оплата одним шагом первой,
 * «Проживание и услуги» с ценой проживания и скидкой, «Оплаты» с возвратом кнопкой, правкой и аннулированием,
 * запросы оплаты свёрнуты ниже. Администратор без права `refunds` кнопок не видит; API откажет и так.
 */
const fixture = FIXTURE_API;
const NUMBER = '20260913-TESTAA';
test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

async function openAccounts(page: Page) {
  await page.goto(`/reservations/${NUMBER}`);
  await page.getByRole('tab', { name: 'Счета', exact: true }).click();
  return page.getByTestId('folio-panel').first();
}
const top = (locator: ReturnType<Page['getByTestId']>) =>
  locator.boundingBox().then((b) => b?.y ?? Number.NaN);

async function signIn(page: Page) {
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
}
const asRole = (request: APIRequestContext, role: 'OWNER' | 'MANAGER' | 'STAFF') =>
  request.post(`${fixture}/__test/control`, { data: { role } });

test('порядок: «Принять оплату» первой, затем проживание и услуги, затем оплаты; запросы оплаты свёрнуты ниже', async ({
  page,
}) => {
  const panel = await openAccounts(page);
  const pay = panel.getByTestId('payment-form');
  await expect(pay).toBeVisible();
  await expect(pay.getByRole('button', { name: 'Проверить оплату', exact: true })).toBeVisible();
  const payY = await top(pay);
  const chargesY = await top(panel.getByTestId('folio-charges-title'));
  const paymentsY = await top(panel.getByTestId('folio-payments-title'));
  expect(payY).toBeLessThan(chargesY);
  expect(chargesY).toBeLessThan(paymentsY);
  await expect(panel.getByTestId('folio-charges-title')).toHaveText('Проживание и услуги');

  const requests = page.getByTestId('payment-requests');
  await expect(requests).toHaveJSProperty('open', false);
  expect(await top(requests)).toBeGreaterThan(paymentsY);
  await expect(requests.getByTestId('payment-requests-toggle')).toContainText(
    'Отправить гостю счёт на оплату',
  );
  // внутри прежняя панель запросов: раскрыл — форма на месте
  await requests.getByTestId('payment-requests-toggle').click();
  await expect(requests.getByTestId('payment-request-form')).toBeVisible();
});

test('возврат кнопкой «Вернуть»: форма с остатком платежа по умолчанию, после возврата строка и баланс обновлены', async ({
  page,
}) => {
  const panel = await openAccounts(page);
  const row = panel.getByTestId('payment-row').first();
  await expect(row).toHaveAttribute('data-status', 'COMPLETED');
  await expect(panel.getByTestId('refund-form')).toHaveCount(0);
  await row.getByTestId('refund-btn').click();
  const form = row.getByTestId('refund-form');
  await expect(form.getByLabel('Сумма возврата')).toHaveValue('8000.00');
  await form.getByLabel('Сумма возврата').fill('500');
  await form.getByLabel('Причина возврата').fill('ранний выезд');
  await form.getByRole('button', { name: 'Проверить возврат', exact: true }).click();
  await form.getByRole('button', { name: 'Подтвердить возврат', exact: true }).click();
  await expect(panel.getByText(/Возвраты:/)).toContainText('500 ₸');
  await expect(row.locator('td').nth(3)).toContainText('500 ₸');
  await expect(panel.getByTestId('refund-form')).toHaveCount(0);
  // после возврата платёж уже не меняется и не аннулируется: кнопок нет, «Вернуть» на остаток остаётся
  await expect(row.getByTestId('payment-edit')).toHaveCount(0);
  await expect(row.getByTestId('payment-void')).toHaveCount(0);
  await expect(row.getByTestId('refund-btn')).toBeVisible();
});

test('«Изменить» платёж: панель справа, новый способ и сумма; прежний остаётся аннулированным', async ({
  page,
}) => {
  const panel = await openAccounts(page);
  const before = await panel.getByTestId('folio-balance').innerText();
  await panel.getByTestId('payment-row').first().getByTestId('payment-edit').click();
  const form = page.getByTestId('payment-edit-form');
  await expect(form).toBeVisible();
  await expect(form.getByLabel('Сумма, KZT')).toHaveValue('8000.00');
  await form.getByLabel('Способ оплаты').selectOption('KASPI');
  await form.getByLabel('Сумма, KZT').fill('7000');
  await form.getByRole('button', { name: 'Сохранить платёж' }).click();
  await expect(panel.getByTestId('finance-done')).toContainText('Платёж изменён: 7 000 ₸');
  const rows = panel.getByTestId('payment-row');
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toHaveAttribute('data-status', 'VOIDED');
  await expect(rows.first()).toContainText('аннулирован');
  await expect(rows.first().getByRole('button')).toHaveCount(0);
  await expect(rows.nth(1)).toHaveAttribute('data-status', 'COMPLETED');
  await expect(rows.nth(1)).toContainText('Kaspi');
  await expect(rows.nth(1).locator('td').nth(2)).toContainText('7 000 ₸');
  expect(await panel.getByTestId('folio-balance').innerText()).not.toBe(before);
});

test('«Аннулировать» платёж: вопрос с суммой, строка остаётся аннулированной, остаток к оплате вырос', async ({
  page,
  request,
}) => {
  const panel = await openAccounts(page);
  const row = panel.getByTestId('payment-row').first();
  await row.getByTestId('payment-void').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Аннулировать платёж 8 000 ₸?');
  await dialog.getByRole('button', { name: 'Аннулировать', exact: true }).click();
  await expect(panel.getByTestId('finance-done')).toContainText('Платёж аннулирован');
  await expect(row).toHaveAttribute('data-status', 'VOIDED');
  await expect(row.getByRole('button')).toHaveCount(0);
  const result = (await (
    await request.get(`${fixture}/finance/reservations/${NUMBER}`, {
      headers: { 'x-wetop-test-client': '1' },
    })
  ).json()) as { folios: Array<{ paidMinor: string; chargedMinor: string; balanceMinor: string }> };
  expect(result.folios[0]!.paidMinor).toBe('0');
  expect(result.folios[0]!.balanceMinor).toBe(result.folios[0]!.chargedMinor);
  await expect(panel.getByTestId('folio-balance')).toContainText('к оплате');
});

test('скидка 10 % от проживания ложится отдельной строкой со знаком минус; сумма скидки — тоже', async ({
  page,
}) => {
  const panel = await openAccounts(page);
  const form = panel.getByTestId('charge-form');
  await form.getByLabel('Вид начисления').selectOption('DISCOUNT');
  await expect(form.getByTestId('discount-hint')).toContainText('Процент считается от проживания');
  await form.getByLabel('Процент скидки').fill('10');
  await form.getByRole('button', { name: 'Применить скидку' }).click();
  await expect(panel.getByTestId('finance-done')).toContainText('Скидка записана');
  const discount = panel.getByTestId('charge-row').filter({ hasText: 'Скидка 10% на проживание' });
  await expect(discount).toHaveCount(1);
  await expect(discount).toHaveAttribute('data-kind', 'ADJUSTMENT');
  await expect(discount.locator('td').nth(3)).toHaveText(/^[−-]/);

  // суммой и с причиной
  const again = panel.getByTestId('charge-form');
  await again.getByLabel('Вид начисления').selectOption('DISCOUNT');
  await again.getByLabel('Сумма скидки').fill('1500');
  await again.getByLabel('Причина скидки').fill('постоянный гость');
  await again.getByRole('button', { name: 'Применить скидку' }).click();
  const byAmount = panel.getByTestId('charge-row').filter({ hasText: 'Скидка: постоянный гость' });
  await expect(byAmount).toHaveCount(1);
  await expect(byAmount.locator('td').nth(3)).toContainText('1 500 ₸');
});

test('цена проживания: «Изменить цену» у строки проживания, новая цена в счёте и в шапке брони', async ({
  page,
}) => {
  const panel = await openAccounts(page);
  await panel.getByTestId('stay-price-btn').click();
  const form = panel.getByTestId('stay-price-form');
  await expect(form.getByLabel('Цена проживания')).not.toHaveValue('');
  await form.getByLabel('Цена проживания').fill('55000');
  await form.getByRole('button', { name: 'Сохранить цену' }).click();
  await expect(panel.getByTestId('finance-done')).toContainText(
    'Цена проживания изменена: 55 000 ₸',
  );
  await expect(panel.getByTestId('charge-row').first().locator('td').nth(3)).toContainText(
    '55 000 ₸',
  );
  await expect(page.getByTestId('booking-head')).toContainText('55 000 ₸');
  await expect(panel.getByTestId('stay-price-form')).toHaveCount(0);
});

test('администратор: оплату принимает, но без «Вернуть», «Изменить», «Аннулировать» и скидки; у управляющего они есть', async ({
  page,
  request,
}) => {
  await signIn(page);
  await asRole(request, 'STAFF');
  let panel = await openAccounts(page);
  await expect(panel.getByTestId('payment-form')).toBeVisible();
  for (const id of ['refund-btn', 'payment-edit', 'payment-void'])
    await expect(panel.getByTestId(id)).toHaveCount(0);
  await expect(
    panel.getByTestId('charge-form').getByRole('option', { name: 'скидка' }),
  ).toHaveCount(0);

  await asRole(request, 'MANAGER');
  panel = await openAccounts(page);
  for (const id of ['refund-btn', 'payment-edit', 'payment-void'])
    await expect(panel.getByTestId(id).first()).toBeVisible();
  await expect(
    panel.getByTestId('charge-form').getByRole('option', { name: 'скидка' }),
  ).toHaveCount(1);
});

for (const scheme of ['light', 'dark'] as const)
  for (const width of [1440, 390])
    test(`доступность «Счетов» с возвратом и панелью правки платежа: ${scheme}, ${width}px`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize({ width, height: 900 });
      const panel = await openAccounts(page);
      await panel.getByTestId('payment-row').first().getByTestId('refund-btn').click();
      await expect(panel.getByTestId('refund-form')).toBeVisible();
      const page1 = await new AxeBuilder({ page }).include('[data-testid="folio-panel"]').analyze();
      expect(page1.violations).toEqual([]);
      await panel.getByTestId('payment-row').first().getByTestId('payment-edit').click();
      await expect(page.getByTestId('payment-edit-form')).toBeVisible();
      const drawer = await new AxeBuilder({ page }).include('dialog').analyze();
      expect(drawer.violations).toEqual([]);
      // страница не шире экрана на телефоне
      const widths = await page.evaluate(() => [
        document.documentElement.scrollWidth,
        document.documentElement.clientWidth,
      ]);
      expect(widths[0]).toBeLessThanOrEqual(widths[1]!);
      await page.screenshot({
        path: `reports/finance-card-actions-2026-10-07/accounts-${scheme}-${width}.png`,
        fullPage: width === 1440,
      });
    });
