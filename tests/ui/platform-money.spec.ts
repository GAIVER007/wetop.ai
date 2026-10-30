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
  await page.waitForURL(/\/(today|platform\/cabinet)$/);
  await request.post(`${FIXTURE_API}/__test/control`, { data: { platformAdmin: true } });
}

test('оплата и расход: доход, расходы и прибыль месяца в долларах; ошибочную оплату можно отменить', async ({ page, request }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page, request);
  await page.goto('/platform/cabinet/money');
  await expect(page.getByTestId('money-income')).toHaveText('$0');

  // формы не висят на странице: кнопка открывает окно, после записи окно закрывается само (владелец 30.10.2026)
  await expect(page.getByTestId('money-payment-form')).toHaveCount(0);
  await page.getByTestId('money-payment-dialog-open').click();
  const pay = page.getByTestId('money-payment-dialog').getByTestId('money-payment-form');
  await pay.getByLabel('Сумма, $').fill('-5');
  await pay.getByTestId('money-payment-save').click();
  await expect(page.getByTestId('money-payment-error')).toContainText('Сумма в долларах');
  await pay.getByLabel('Сумма, $').fill('99.50');
  await pay.getByTestId('money-payment-save').click();
  await expect(page.getByTestId('money-income')).toHaveText('$99,50');
  await expect(page.getByTestId('money-payment-dialog')).toBeHidden();
  await expect(page.getByTestId('money-payments')).toContainText('Хостел «Пример»');

  await page.getByTestId('money-expense-dialog-open').click();
  const exp = page.getByTestId('money-expense-dialog').getByTestId('money-expense-form');
  await exp.getByLabel('Сумма, $').fill('20');
  await exp.getByTestId('money-expense-save').click();
  await expect(page.getByTestId('money-expenses')).toHaveText('$20');
  await expect(page.getByTestId('money-profit')).toHaveText('$79,50');
  // таблица по месяцам: доход, статья «Сервер», прибыль
  const table = page.getByTestId('money-table');
  await expect(table).toContainText('Доход: оплаты клиентов');
  await expect(table).toContainText('Сервер');
  await expect(table).toContainText('$79,50');

  await page.getByTestId('money-payments').getByTestId('money-void-payment').click();
  await expect(page.getByTestId('money-income')).toHaveText('$0');
  await expect(page.getByTestId('money-profit')).toHaveText('\u2212$20');
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(wide).toBeLessThanOrEqual(0);
  if (process.env.CABINET_SHOTS) await page.screenshot({ path: `${process.env.CABINET_SHOTS}/money-1280.png`, fullPage: true });
});

test('тариф, подписка клиента, команда с цифровым сотрудником и выплатой зарплаты', async ({ page, request }) => {
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

  // «Команда WETOP» (владелец 30.10.2026): человек (ФИО, телефон, почта, зарплата) и цифровой сотрудник (имя и зарплата);
  // «Выплатить» пишет расход «Зарплаты», он сразу в «Деньгах»
  await page.goto('/platform/cabinet/team');
  await expect(page.getByTestId('cabinet').getByRole('navigation', { name: 'Кабинет WETOP' })).toContainText('Команда WETOP');
  await page.getByTestId('team-add-dialog-open').click();
  const team = page.getByTestId('team-add-dialog').getByTestId('money-team-form');
  await team.getByLabel('ФИО').fill('Айдар Тестов');
  await team.getByLabel('Должность').fill('Поддержка');
  await team.getByLabel('Телефон').fill('+974 5500 0001');
  await team.getByLabel('Почта').fill('aidar@example.invalid');
  await team.getByLabel('Зарплата в месяц, $').fill('800');
  await team.getByTestId('money-team-save').click();
  await expect(page.getByTestId('team-list')).toContainText('Айдар Тестов');
  await expect(page.getByTestId('team-list')).toContainText('+974 5500 0001');
  await page.getByTestId('team-add-digital-dialog-open').click();
  const digital = page.getByTestId('team-add-digital-dialog').getByTestId('money-team-form');
  await expect(digital.getByLabel('Телефон')).toHaveCount(0);
  await digital.getByLabel('Имя').fill('ИИ-продавец');
  await digital.getByLabel('Зарплата в месяц, $').fill('30');
  await digital.getByTestId('money-team-save').click();
  await expect(page.getByTestId('team-row').filter({ hasText: 'ИИ-продавец' })).toContainText('цифровой сотрудник');
  await expect(page.getByTestId('team-payroll')).toHaveText('$830');
  await page.getByTestId('team-row').filter({ hasText: 'Айдар Тестов' }).getByTestId('team-pay-dialog-open').click();
  const payout = page.getByTestId('team-pay-dialog').getByTestId('money-expense-form');
  await expect(payout.getByLabel('Сумма, $')).toHaveValue('800');
  await payout.getByTestId('money-expense-save').click();
  await expect(page.getByTestId('team-paid')).toHaveText('$800');
  await expect(page.getByTestId('team-left')).toHaveText('$30');
  await expect(page.getByTestId('team-payouts')).toContainText('Айдар Тестов');
  if (process.env.CABINET_SHOTS) await page.screenshot({ path: `${process.env.CABINET_SHOTS}/team-1280.png`, fullPage: true });
  await page.goto('/platform/cabinet/money');
  await expect(page.getByTestId('money-expenses')).toHaveText('$800');
  await expect(page.getByTestId('money-table')).toContainText('Зарплаты');
});

/**
 * Владелец 29.10.2026 (скрин «Подписки клиентов»): «давай сделаем тут выдачу доступов к тарифу». У каждого клиента в
 * подписках видны его филиалы и доступ к конструктору сайта: пробный на 14 дней одной кнопкой, оплачен, выключить.
 * Пишет тот же API, что «Платформа → Организации» (лицензия филиала), журнал на сервере.
 */
test('подписки клиентов: выдать доступ к конструктору сайта по филиалу одной кнопкой', async ({ page, request }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, request);
  await page.goto('/platform/cabinet/subscriptions');
  const access = page.getByTestId('subscription-access').filter({ hasText: 'Хостел «Пример» (центр)' });
  await expect(access).toBeVisible();
  await expect(access).toContainText('Конструктор сайта');
  await expect(access).toContainText('не подключён');
  await access.getByTestId('access-trial').click();
  await expect(access).toContainText('пробный');
  await expect(access).toContainText('действует');
  // последний день пробного: сегодня плюс 14 дней по Алматы (пояс платформы)
  const until = new Date(Date.now() + 14 * 86_400_000 + 5 * 3_600_000).toISOString().slice(0, 10).split('-').reverse().join('.');
  await expect(access).toContainText(until);
  await access.getByTestId('access-activate').click();
  await expect(access).toContainText('оплачен');
  await access.getByTestId('access-off').click();
  await expect(access).toContainText('не подключён');
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(wide).toBeLessThanOrEqual(0);
  if (process.env.CABINET_SHOTS) await page.screenshot({ path: `${process.env.CABINET_SHOTS}/subscriptions-access-1440.png`, fullPage: true });
});

/**
 * Партнёры WETOP (владелец 30.10.2026, DATA_MODEL §63.1): процент, клиент назначается в карточке, начислено от его
 * оплат, «Выплатить» пишет расход «Партнёрам», к выплате уменьшается.
 */
test('партнёры: процент, клиент партнёра, начислено и выплата', async ({ page, request }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page, request);
  const token = (await page.context().cookies()).find((c) => c.name === 'wetop_session')?.value;
  const asAdmin = { headers: { 'x-wetop-test-client': '1', 'x-wetop-session': token! } };
  await page.goto('/platform/cabinet/partners');
  await expect(page.getByTestId('partners-list')).toContainText('Партнёров пока нет');
  await page.getByTestId('partner-add-dialog-open').click();
  const form = page.getByTestId('partner-add-dialog').getByTestId('partner-form');
  await form.getByLabel('Имя или компания').fill('Агентство Тест');
  await form.getByLabel('Процент от оплат клиентов').fill('120');
  await form.getByTestId('partner-save').click();
  await expect(page.getByTestId('partner-error')).toContainText('Процент');
  // ошибка не стирает введённое: правим только процент
  await expect(form.getByLabel('Имя или компания')).toHaveValue('Агентство Тест');
  await form.getByLabel('Процент от оплат клиентов').fill('20');
  await form.getByTestId('partner-save').click();
  await expect(page.getByTestId('partner-row')).toContainText('Агентство Тест');
  await expect(page.getByTestId('partner-row')).toContainText('20%');

  // клиент партнёра: в карточке клиента
  await page.goto('/platform/cabinet/clients/ui-org-2');
  const pick = page.getByTestId('client-partner-form');
  await pick.getByLabel('Партнёр').selectOption({ label: 'Агентство Тест' });
  await pick.getByTestId('client-partner-save').click();
  await expect(page.getByTestId('client-partner-result')).toBeVisible();
  // клиент оплатил $50: начислено 20% = $10
  expect((await request.post(`${FIXTURE_API}/platform/payments`, { ...asAdmin, data: { organizationId: 'ui-org-2', amount: '50', paidOn: new Date().toISOString().slice(0, 10) } })).ok()).toBe(true);
  await page.goto('/platform/cabinet/partners');
  const row = page.getByTestId('partner-row').filter({ hasText: 'Агентство Тест' });
  await expect(row).toContainText('Хостел «Пример»');
  await expect(row).toContainText('$50');
  await expect(page.getByTestId('partners-due')).toHaveText('$10');
  await row.getByTestId('partner-pay-dialog-open').click();
  const pay = page.getByTestId('partner-pay-dialog').getByTestId('partner-payout-form');
  await expect(pay.getByLabel('Сумма, $')).toHaveValue('10');
  await pay.getByTestId('partner-payout-save').click();
  await expect(page.getByTestId('partners-due')).toHaveText('$0');
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(wide).toBeLessThanOrEqual(0);
  if (process.env.CABINET_SHOTS) await page.screenshot({ path: `${process.env.CABINET_SHOTS}/partners-1280.png`, fullPage: true });
  // выплата в «Деньгах» по статье «Партнёрам»
  await page.goto('/platform/cabinet/money');
  await expect(page.getByTestId('money-table')).toContainText('Партнёрам');
});

/**
 * «Расходы» (владелец 30.10.2026: «раздел расходы, там будем видеть все расходы и добавлять расходы»): запись в окне,
 * итог месяца, статьи с долей, отбор по статье; зарплата из «Команды» здесь тоже видна.
 */
test('расходы: запись в окне, итог, статьи с долей и отбор по статье', async ({ page, request }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page, request);
  await page.goto('/platform/cabinet/expenses');
  await expect(page.getByTestId('cabinet').getByRole('navigation', { name: 'Кабинет WETOP' })).toContainText('Расходы');
  await expect(page.getByTestId('expenses-by-category')).toContainText('Расходов в этом месяце нет');
  for (const [category, amount, note] of [
    ['Сервер', '30', 'Hetzner'],
    ['Реклама', '90', 'Instagram'],
  ] as const) {
    await page.getByTestId('expenses-add-dialog-open').click();
    const form = page.getByTestId('expenses-add-dialog').getByTestId('money-expense-form');
    await form.getByLabel('Статья').selectOption({ label: category });
    await form.getByLabel('Сумма, $').fill(amount);
    await form.getByLabel('Заметка').fill(note);
    await form.getByTestId('money-expense-save').click();
    await expect(page.getByTestId('expenses-list')).toContainText(note);
  }
  await expect(page.getByTestId('expenses-total')).toHaveText('$120');
  await expect(page.getByTestId('expenses-top')).toContainText('Реклама');
  await expect(page.getByTestId('expenses-by-category').getByTestId('expenses-category').first()).toContainText('75%');
  await expect(page.getByTestId('expenses-row')).toHaveCount(2);
  if (process.env.CABINET_SHOTS) await page.screenshot({ path: `${process.env.CABINET_SHOTS}/expenses-1280.png`, fullPage: true });
  // отбор по статье и обратно
  await page.getByTestId('expenses-category').filter({ hasText: 'Сервер' }).click();
  await expect(page.getByTestId('expenses-row')).toHaveCount(1);
  await expect(page.getByTestId('expenses-list')).toContainText('Hetzner');
  await page.getByTestId('expenses-all').click();
  await expect(page.getByTestId('expenses-row')).toHaveCount(2);
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(wide).toBeLessThanOrEqual(0);
  // те же записи в «Деньгах»
  await page.goto('/platform/cabinet/money');
  await expect(page.getByTestId('money-expenses')).toHaveText('$120');
});
