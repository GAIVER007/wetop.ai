import { FIXTURE_API, expect, test, type Page } from './fixtures';
import AxeBuilder from '@axe-core/playwright';

/**
 * Формы бара берут способы оплаты из настройки объекта (DATA_MODEL §21.6, ADR-185, план
 * plans/bar-payment-methods-2026-10-15.md): порядок настройки, выключенного нет, без подходящих способов форма
 * говорит словами и кнопку не рисует. Подставной API держит настройку в памяти (`PUT /hotel/payment-methods`).
 */
const fixture = FIXTURE_API;
const headers = { 'x-wetop-test-client': '1' };
const main = (page: Page) => page.getByRole('main').filter({ visible: true });
const ALL = ['CASH', 'CARD_TERMINAL', 'KASPI', 'HALYK', 'BANK_TRANSFER_PERSON', 'BANK_TRANSFER_LEGAL', 'DEPOSIT', 'CARD_GUARANTEE'];
const settings = (order: string[], disabled: string[]) =>
  [...order, ...ALL.filter((m) => !order.includes(m))].map((method) => ({ method, enabled: !disabled.includes(method) }));

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});
// настройка остаётся в памяти подставного API: после себя возвращаем умолчание, соседние спеки бара
// (bar-reference «mobile quick actions») сброс перед собой не зовут и ждут кнопку «Продать»
test.afterEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

test('быстрая продажа: Halyk первым, Kaspi выключен и не предлагается', async ({ page, request }) => {
  const saved = await request.put(`${fixture}/hotel/payment-methods`, { headers, data: { methods: settings(['HALYK'], ['KASPI']) } });
  expect(saved.ok()).toBe(true);
  await page.goto('/bar#bar-quick-sale');
  const sale = page.locator('#bar-quick-sale').getByRole('tabpanel', { name: 'Продажа напрямую', exact: true });
  const select = sale.getByRole('combobox', { name: 'Способ оплаты' });
  await expect(select.locator('option')).toHaveText(['Halyk', 'Наличные', 'Карта', 'Перевод']);
  await expect(select).toHaveValue('HALYK');
  await expect(sale.getByRole('button', { name: 'Продать' })).toBeVisible();
});

test('оплата поставщику: список по настройке, счёт организации остаётся умолчанием, пока включён', async ({ page, request }) => {
  await request.put(`${fixture}/hotel/payment-methods`, { headers, data: { methods: settings(['HALYK'], ['KASPI', 'CARD_TERMINAL']) } });
  await page.goto('/bar/receipts');
  const form = main(page).locator('.bar-payment-form').first();
  const select = form.getByRole('combobox', { name: 'Способ' });
  await expect(select.locator('option')).toHaveText(['Halyk', 'Наличные', 'Перевод', 'Счет организации']);
  await expect(select).toHaveValue('BANK_TRANSFER_LEGAL');
});

test('объект оставил только депозит и гарантию: форма говорит словами, кнопки продажи нет', async ({ page, request }) => {
  await request.put(`${fixture}/hotel/payment-methods`, {
    headers,
    data: { methods: settings([], ['CASH', 'CARD_TERMINAL', 'KASPI', 'HALYK', 'BANK_TRANSFER_PERSON', 'BANK_TRANSFER_LEGAL']) },
  });
  await page.goto('/bar#bar-quick-sale');
  const sale = page.locator('#bar-quick-sale').getByRole('tabpanel', { name: 'Продажа напрямую', exact: true });
  await expect(sale.getByTestId('bar-no-methods')).toHaveText('В настройках объекта нет способа оплаты, который принимает бар');
  await expect(sale.getByRole('button', { name: 'Продать' })).toHaveCount(0);
  await expect(sale.getByRole('combobox', { name: 'Способ оплаты' })).toHaveCount(0);
  const axe = await new AxeBuilder({ page }).include('#bar-quick-sale').analyze();
  expect(axe.violations).toEqual([]);
});
