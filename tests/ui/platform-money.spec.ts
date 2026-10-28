import { FIXTURE_API, expect, test } from './fixtures';
import type { APIRequestContext, Page } from '@playwright/test';

/**
 * Деньги компании WETOP (DATA_MODEL §63): владелец записывает оплату клиента и расход, видит доход, расходы и
 * прибыль месяца в долларах; задаёт тариф, подписку клиента и команду. Стенд: клиент «Хостел «Пример»» (ui-org-2).
 */
test.beforeEach(async ({ request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
});

async function signIn(page: Page, request: APIRequestContext) {
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
  await request.post(`${FIXTURE_API}/__test/control`, { data: { platformAdmin: true } });
}

test('оплата и расход: доход, расходы и прибыль месяца в долларах; ошибочную оплату можно отменить', async ({ page, request }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page, request);
  await page.goto('/platform/cabinet/money');
  await expect(page.getByTestId('money-income')).toHaveText('$0');

  const pay = page.getByTestId('money-payment-form');
  await pay.getByLabel('Сумма, $').fill('-5');
  await pay.getByTestId('money-payment-save').click();
  await expect(page.getByTestId('money-payment-error')).toContainText('Сумма в долларах');
  await pay.getByLabel('Сумма, $').fill('99.50');
  await pay.getByTestId('money-payment-save').click();
  await expect(page.getByTestId('money-income')).toHaveText('$99,50');
  await expect(page.getByTestId('money-payments')).toContainText('Хостел «Пример»');

  const exp = page.getByTestId('money-expense-form');
  await exp.getByLabel('Сумма, $').fill('20');
  await exp.getByTestId('money-expense-save').click();
  await expect(page.getByTestId('money-expenses')).toHaveText('$20');
  await expect(page.getByTestId('money-profit')).toHaveText('$79,50');

  await page.getByTestId('money-payments').getByTestId('money-void-payment').click();
  await expect(page.getByTestId('money-income')).toHaveText('$0');
  await expect(page.getByTestId('money-profit')).toHaveText('\u2212$20');
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(wide).toBeLessThanOrEqual(0);
  if (process.env.CABINET_SHOTS) await page.screenshot({ path: `${process.env.CABINET_SHOTS}/money-1280.png`, fullPage: true });
});

test('тариф, подписка клиента и команда', async ({ page, request }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page, request);
  await page.goto('/platform/cabinet/subscriptions');
  const plan = page.getByTestId('money-plans').getByTestId('money-plan-form').last();
  await plan.getByLabel('Тариф').fill('WETOP Core');
  await plan.getByLabel('Цена, $').fill('49');
  await plan.getByTestId('money-plan-save').click();
  await expect(page.getByTestId('money-plans')).toContainText('WETOP Core');

  const sub = page.getByTestId('money-subscription-form').first();
  await sub.getByLabel('В месяц, $').fill('49');
  await sub.getByTestId('money-subscription-save').click();
  await expect(page.getByTestId('money-subscriptions')).toContainText('$49 в месяц');
  await expect(page.getByTestId('money-subscriptions')).toContainText('не оплачено');
  if (process.env.CABINET_SHOTS) await page.screenshot({ path: `${process.env.CABINET_SHOTS}/subscriptions-1280.png`, fullPage: true });

  await page.goto('/platform/cabinet/team');
  const team = page.getByTestId('money-team-form').first();
  await team.getByLabel('Имя').fill('Айдар');
  await team.getByLabel('Должность').fill('Поддержка');
  await team.getByLabel('Зарплата в месяц, $').fill('800');
  await team.getByTestId('money-team-save').click();
  await expect(page.getByTestId('team-list')).toContainText('Айдар');
  await expect(page.getByTestId('team-payroll')).toHaveText('$800');
  if (process.env.CABINET_SHOTS) await page.screenshot({ path: `${process.env.CABINET_SHOTS}/team-1280.png`, fullPage: true });
});
