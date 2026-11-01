import { FIXTURE_API, expect, test } from './fixtures';
import type { APIRequestContext, Page } from '@playwright/test';

/**
 * VTOP Overview (ТЗ владельца 30.10.2026 «две категории админок», п. 3): пять блоков, Выручка, Клиенты, Подписки,
 * Партнёры, Финансы. Оплата клиента, записанная в «Деньгах», сразу видна в выручке месяца, с начала года и в остатке
 * денег; расход уменьшает прибыль и остаток. Клиент бизнеса (уровень 3) этот раздел не открывает.
 */
test.beforeEach(async ({ request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
});

async function signIn(page: Page, request: APIRequestContext) {
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL(/\/(today|platform\/cabinet)$/);
  await request.post(`${FIXTURE_API}/__test/control`, { data: { platformAdmin: true } });
}

test('Обзор WETOP: оплата и расход из «Денег» в выручке, прибыли и остатке', async ({ page, request }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, request);
  await page.goto('/platform/cabinet/money');
  await page.getByTestId('money-payment-dialog-open').click();
  const pay = page.getByTestId('money-payment-dialog').getByTestId('money-payment-form');
  await pay.getByLabel('Сумма, $').fill('199');
  await pay.getByTestId('money-payment-save').click();
  await expect(page.getByTestId('money-income')).toHaveText('$199');
  await page.getByTestId('money-expense-dialog-open').click();
  const exp = page.getByTestId('money-expense-dialog').getByTestId('money-expense-form');
  await exp.getByLabel('Сумма, $').fill('20');
  await exp.getByTestId('money-expense-save').click();
  await expect(page.getByTestId('money-expenses')).toHaveText('$20');

  await page.goto('/platform/cabinet/overview');
  const o = page.getByTestId('ceo-overview');
  for (const block of ['revenue', 'clients', 'subscriptions', 'partners', 'finance']) await expect(o.getByTestId(`ceo-${block}`)).toBeVisible();
  await expect(o.getByTestId('ceo-revenue-month')).toContainText('$199');
  await expect(o.getByTestId('ceo-revenue-ytd')).toContainText('$199');
  await expect(o.getByTestId('ceo-finance-profit')).toContainText('$179');
  await expect(o.getByTestId('ceo-finance-cash')).toContainText('$179');
  await expect(page.getByRole('link', { name: 'Обзор WETOP' })).toHaveAttribute('aria-current', 'page');
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(wide).toBeLessThanOrEqual(0);
  if (process.env.CABINET_SHOTS) await page.screenshot({ path: `${process.env.CABINET_SHOTS}/ceo-overview-1440.png`, fullPage: true });
});

test('сквозная цепочка: тариф, партнёр, оплата клиента → Обзор (MRR, ARR, комиссия, долг, платит), отмена всё возвращает', async ({
  page,
  request,
}) => {
  // ТЗ владельца 01.11.2026 (Task 1): Client → Subscription → Payment → Revenue → MRR/ARR → Commission → Finance → Dashboard
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, request);
  // те же адреса API, что у форм кабинета, от имени вошедшего главного администратора
  const token = (await page.context().cookies()).find((cookie) => cookie.name === 'wetop_session')?.value ?? '';
  const headers = { 'x-wetop-test-client': '1', 'x-wetop-session': token };
  const api = async (method: 'post' | 'put', path: string, data: unknown) => {
    const r = await request[method](`${FIXTURE_API}${path}`, { data, headers });
    expect(r.ok(), `${method} ${path}: ${r.status()} ${(await r.text()).slice(0, 200)}`).toBe(true);
    return r;
  };
  const plan = await (await api('post', '/platform/plans', { name: 'Pro E2E', price: '100', periodMonths: 1, partnerPayout: '50' })).json();
  const partner = await (await api('post', '/platform/partners', { name: 'Партнёр E2E', percent: '20' })).json();
  // клиент на пробном: «Хостел «Пример»»
  await api('put', '/platform/clients/ui-org-2/partner', { partnerId: partner.id });
  await api('put', '/platform/subscriptions/ui-org-2', { planId: plan.id, monthly: '100' });

  await page.goto('/platform/cabinet/overview');
  const o = page.getByTestId('ceo-overview');
  await expect(o.getByTestId('ceo-revenue-mrr')).toContainText('$0');
  const payingBefore = Number((await o.getByTestId('ceo-clients-active').innerText()).replace(/\D/g, ''));

  // оплата клиента формой в «Деньгах»
  await page.goto('/platform/cabinet/money');
  await page.getByTestId('money-payment-dialog-open').click();
  const pay = page.getByTestId('money-payment-dialog').getByTestId('money-payment-form');
  await pay.getByLabel('Клиент').selectOption('ui-org-2');
  await pay.getByLabel('Сумма, $').fill('100');
  await pay.getByTestId('money-payment-save').click();
  await expect(page.getByTestId('money-income')).toHaveText('$100');

  await page.goto('/platform/cabinet/overview');
  await expect(o.getByTestId('ceo-revenue-mrr')).toContainText('$100');
  await expect(o.getByTestId('ceo-revenue-arr')).toContainText('$1 200');
  await expect(o.getByTestId('ceo-subscriptions-active')).toContainText('1');
  await expect(o.getByTestId('ceo-partners-commissions')).toContainText('$50');
  await expect(o.getByTestId('ceo-finance-payable')).toContainText('$50');
  await expect(o.getByTestId('ceo-finance-cash')).toContainText('$100');
  await expect(o.getByTestId('ceo-clients-active')).toContainText(String(payingBefore + 1));
  if (process.env.CABINET_SHOTS) await page.screenshot({ path: `${process.env.CABINET_SHOTS}/ceo-overview-chain.png` });

  // отмена ошибочной оплаты: выручка, MRR, ARR и комиссия возвращаются
  const money = await (await request.get(`${FIXTURE_API}/platform/money`, { headers })).json();
  const paid = (money.payments as Array<{ id: string; organizationId: string }>).find((p) => p.organizationId === 'ui-org-2')!;
  await api('post', `/platform/payments/${paid.id}/void`, {});
  await page.reload();
  await expect(o.getByTestId('ceo-revenue-mrr')).toContainText('$0');
  await expect(o.getByTestId('ceo-revenue-arr')).toContainText('$0');
  await expect(o.getByTestId('ceo-partners-commissions')).toContainText('$0');
  await expect(o.getByTestId('ceo-finance-cash')).toContainText('$0');
});

test('клиент бизнеса не видит Обзор WETOP', async ({ page, request }) => {
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL(/\/(today|platform\/cabinet)$/);
  await request.post(`${FIXTURE_API}/__test/control`, { data: { platformAdmin: false } });
  await page.goto('/platform/cabinet/overview');
  await expect(page.getByTestId('cabinet-forbidden')).toBeVisible();
  await expect(page.getByTestId('ceo-overview')).toHaveCount(0);
});
