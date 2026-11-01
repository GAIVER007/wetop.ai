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
  // миграция 176 (владелец 31.10.2026): кому заплатили, документ, повторяется
  await exp.getByLabel('Получатель').fill('Hetzner');
  await exp.getByLabel('Документ').fill('Счёт 17');
  await exp.getByTestId('money-expense-recurring').check();
  await exp.getByTestId('money-expense-save').click();
  await expect(page.getByTestId('money-expenses')).toHaveText('$20');
  await expect(page.getByTestId('money-profit')).toHaveText('$79,50');
  // поля расхода видны в «Расходах»
  await page.goto('/platform/cabinet/expenses');
  await expect(page.getByRole('main')).toContainText('Hetzner, Счёт 17, каждый месяц');
  await page.goto('/platform/cabinet/money');
  await expect(page.getByTestId('money-months')).toContainText('$79,50');
  // один экран (владелец 01.11.2026): обзор «Денег» на 1440×900 без прокрутки вниз
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByTestId('money-months')).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBeLessThanOrEqual(0);
  // таблица по месяцам (вкладка «По месяцам», вариант Б): доход, статья «Сервер», прибыль
  await page.getByTestId('money-tab-months').click();
  const table = page.getByTestId('money-table');
  await expect(table).toContainText('Доход: оплаты клиентов');
  await expect(table).toContainText('Сервер');
  await expect(table).toContainText('$79,50');

  await page.getByTestId('money-tab-in').click();
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
  // «Тарифы» (вариант Б, владелец 01.11.2026): новый тариф в окне «+ Тариф», клиенты вкладкой, «Изменить» в окне
  await page.goto('/platform/cabinet/subscriptions');
  await expect(page.getByTestId('cabinet').getByRole('navigation', { name: 'Кабинет WETOP' })).toContainText('Тарифы');
  await page.getByTestId('plan-add-dialog-open').click();
  const plan = page.getByTestId('plan-add-dialog').getByTestId('money-plan-form');
  await plan.getByLabel('Тариф').fill('WETOP Core');
  await plan.getByLabel('Цена, $').fill('49');
  // владелец 30.10.2026: у тарифа разовая выплата партнёру за первый чек клиента
  await plan.getByLabel('Партнёру за первый чек, $').fill('10');
  await plan.getByTestId('money-plan-save').click();
  await page.getByTestId('plans-tab-plans').click();
  await expect(page.getByTestId('money-plans')).toContainText('WETOP Core');
  await expect(page.getByTestId('money-plans')).toContainText('партнёру $10');

  await page.getByTestId('plans-tab-clients').click();
  await page.getByTestId('plan-client-row').first().getByTestId('plan-client-dialog-open').click();
  const sub = page.getByTestId('plan-client-dialog').getByTestId('money-subscription-form');
  await sub.getByLabel('В месяц, $').fill('49');
  await sub.getByTestId('money-subscription-save').click();
  await expect(page.getByTestId('money-subscriptions')).toContainText('$49 в месяц');
  // без «оплачено до» клиент сразу в должниках (DATA_MODEL §63): статус «просрочен»
  await expect(page.getByTestId('plan-client-row').first()).toContainText('просрочен');
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
  await page.goto('/platform/cabinet/money?tab=months');
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
  await page.getByTestId('plan-client-row').filter({ hasText: 'Хостел «Пример»' }).getByTestId('plan-client-dialog-open').click();
  const access = page.getByTestId('plan-client-dialog').getByTestId('subscription-access').filter({ hasText: 'Хостел «Пример» (центр)' });
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
  await form.getByLabel('Процент с допов').fill('120');
  await form.getByTestId('partner-save').click();
  await expect(page.getByTestId('partner-error')).toContainText('Процент');
  // ошибка не стирает введённое: правим только процент
  await expect(form.getByLabel('Имя или компания')).toHaveValue('Агентство Тест');
  await form.getByLabel('Процент с допов').fill('20');
  await form.getByTestId('partner-save').click();
  await expect(page.getByTestId('partner-row')).toContainText('Агентство Тест');
  await expect(page.getByTestId('partner-row')).toContainText('20%');

  // клиент партнёра: в карточке клиента
  await page.goto('/platform/cabinet/clients/ui-org-2');
  const pick = page.getByTestId('client-partner-form');
  await pick.getByLabel('Партнёр').selectOption({ label: 'Агентство Тест' });
  await pick.getByTestId('client-partner-save').click();
  await expect(page.getByTestId('client-partner-result')).toBeVisible();
  // владелец 30.10.2026: процент партнёра только с допов; клиент оплатил доп (ИИ-продавец) $50: начислено 20% = $10
  expect((await request.post(`${FIXTURE_API}/platform/payments`, { ...asAdmin, data: { organizationId: 'ui-org-2', amount: '50', paidOn: new Date().toISOString().slice(0, 10), kind: 'ADDON' } })).ok()).toBe(true);
  await page.goto('/platform/cabinet/partners');
  const row = page.getByTestId('partner-row').filter({ hasText: 'Агентство Тест' });
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
  await page.goto('/platform/cabinet/money?tab=months');
  await expect(page.getByTestId('money-table')).toContainText('Партнёрам');
});

/**
 * «Партнёры» A (владелец 01.11.2026, «давай а»): выплаты списком справа, ошибочную выплату отменяют и долг возвращается;
 * поиск и фильтры; клиентов партнёра назначают и убирают прямо здесь; всё в один экран 1440×900.
 */
test('партнёры A: отмена выплаты, поиск и фильтры, клиенты партнёра, один экран', async ({ page, request }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, request);
  const token = (await page.context().cookies()).find((c) => c.name === 'wetop_session')?.value;
  const asAdmin = { headers: { 'x-wetop-test-client': '1', 'x-wetop-session': token! } };
  const partner = await (await request.post(`${FIXTURE_API}/platform/partners`, { ...asAdmin, data: { name: 'Айгерим Тестова', percent: '20', phone: '+7 700 000 00 01' } })).json();
  await request.post(`${FIXTURE_API}/platform/partners`, { ...asAdmin, data: { name: 'Ержан Тестов', percent: '10' } });
  await page.goto('/platform/cabinet/partners');
  const row = page.getByTestId('partner-row').filter({ hasText: 'Айгерим Тестова' });

  // клиента партнёру назначают прямо здесь: окно «Клиенты»
  await row.getByTestId('partner-clients-dialog-open').click();
  const dlg = page.locator('dialog[open]');
  await expect(dlg).toContainText('У партнёра пока нет клиентов');
  await dlg.getByLabel('Назначить клиента').selectOption({ label: 'Хостел «Пример»' });
  await dlg.getByTestId('partner-client-assign-save').click();
  // окно остаётся открытым: клиент сразу в списке партнёра, рядом «Убрать»
  await expect(dlg.getByTestId('partner-client')).toHaveText(/Хостел «Пример»/);
  await dlg.getByRole('button', { name: 'Закрыть' }).click();
  expect((await request.post(`${FIXTURE_API}/platform/payments`, { ...asAdmin, data: { organizationId: 'ui-org-2', amount: '50', paidOn: new Date().toISOString().slice(0, 10), kind: 'ADDON' } })).ok()).toBe(true);
  await page.reload();
  await expect(page.getByTestId('partners-due')).toHaveText('$10');
  await row.getByTestId('partner-clients-dialog-open').click();
  await expect(page.getByTestId('partner-client')).toHaveText(/Хостел «Пример»/);
  await page.locator('dialog[open]').getByRole('button', { name: 'Закрыть' }).click();

  // фильтры «стекло» и поиск по клиенту
  await page.getByTestId('partners-filter-due').click();
  await page.waitForURL('**/partners?show=due');
  await expect(page.getByTestId('partner-row')).toHaveCount(1);
  await page.getByLabel('Поиск партнёра').fill('Пример');
  await page.getByLabel('Поиск партнёра').press('Enter');
  await page.waitForURL(/q=/);
  await expect(page.getByTestId('partner-row')).toHaveCount(1);
  await page.getByLabel('Поиск партнёра').fill('нет такого');
  await page.getByLabel('Поиск партнёра').press('Enter');
  await expect(page.getByTestId('partners-list')).toContainText('Никого не нашли');
  await page.goto('/platform/cabinet/partners');
  await expect(page.getByTestId('partner-row')).toHaveCount(2);

  // выплата видна справа; ошибочную отменяют, к выплате снова $10
  await row.getByTestId('partner-pay-dialog-open').click();
  await page.locator('dialog[open]').getByTestId('partner-payout-save').click();
  await expect(page.getByTestId('partners-due')).toHaveText('$0');
  const paid = page.getByTestId('partner-payout-row').filter({ hasText: 'Айгерим Тестова' });
  await expect(paid).toContainText('$10');
  // один экран 1440×900: без прокрутки и вбок, и вниз
  const over = await page.evaluate(() => ({ w: document.documentElement.scrollWidth - innerWidth, h: document.documentElement.scrollHeight - innerHeight }));
  expect(over.w).toBeLessThanOrEqual(0);
  expect(over.h).toBeLessThanOrEqual(0);
  if (process.env.CABINET_SHOTS) await page.screenshot({ path: `${process.env.CABINET_SHOTS}/partners-a-1440.png` });
  await paid.getByTestId('money-void-expense').click();
  await expect(page.getByTestId('partners-due')).toHaveText('$10');
  await expect(paid).toContainText('отменена');

  // убрать клиента у партнёра: начисленное уходит
  await row.getByTestId('partner-clients-dialog-open').click();
  await page.locator('dialog[open]').getByTestId('partner-client-remove').click();
  await expect(page.getByTestId('partners-due')).toHaveText('$0');
  expect(partner.id).toBeTruthy();
});

/**
 * «Расходы» (владелец 30.10.2026: «раздел расходы, там будем видеть все расходы и добавлять расходы»): запись в окне,
 * итог месяца, статьи с долей, отбор по статье; зарплата из «Команды» здесь тоже видна.
 */
test('расходы: запись в окне, итог, статьи с долей и отбор по статье', async ({ page, request }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page, request);
  // «Расходы» вкладкой в «Деньгах» (вариант Б, владелец 01.11.2026); старый адрес ведёт туда же
  await page.goto('/platform/cabinet/expenses');
  await expect(page).toHaveURL(/\/platform\/cabinet\/money\?tab=out/);
  await expect(page.getByTestId('money-tab-out')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByTestId('expenses-by-category')).toContainText('Расходов в этом месяце нет');
  for (const [category, amount, note] of [
    ['Сервер', '30', 'Hetzner'],
    ['Реклама', '90', 'Instagram'],
  ] as const) {
    await page.getByTestId('money-expense-dialog-open').click();
    const form = page.getByTestId('money-expense-dialog').getByTestId('money-expense-form');
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

/** Кабинет партнёра (ТЗ VTOP 01.11.2026, DATA_MODEL §63.3): приглашение → регистрация партнёра → кабинет */
test('партнёр: приглашение, регистрация по ссылке, кабинет со своим клиентом, комиссией и выплатой', async ({ page, request }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page, request);
  const token = (await page.context().cookies()).find((c) => c.name === 'wetop_session')?.value;
  const asAdmin = { headers: { 'x-wetop-test-client': '1', 'x-wetop-session': token! } };
  await page.goto('/platform/cabinet/partners');
  // ТЗ 01.11.2026: «Пригласить партнёра» одним окном: имя, почта, телефон, ссылка и кнопки к ней
  await page.getByTestId('partner-create-invite-dialog-open').click();
  const dlg = page.getByTestId('partner-create-invite-dialog');
  const form = dlg.getByTestId('partner-create-invite-form');
  await form.getByLabel('Имя партнёра').fill('Айдар Партнёр');
  await form.getByLabel('Почта').fill('aidar.partner@example.invalid');
  await form.getByLabel('Телефон').fill('+7 701 000 00 01');
  await form.getByTestId('partner-create-invite-save').click();
  const link = await dlg.getByTestId('partner-invite-link').inputValue();
  expect(link).toMatch(/\/partner\/invite\/[^/]+$/);
  await expect(dlg.getByTestId('partner-invite-open')).toHaveAttribute('href', link);
  await expect(dlg.getByTestId('partner-invite-mail')).toHaveAttribute('href', /^mailto:aidar\.partner@example\.invalid\?/);
  await expect(dlg.getByTestId('partner-invite-copy')).toBeVisible();
  if (process.env.CABINET_SHOTS) await page.screenshot({ path: `${process.env.CABINET_SHOTS}/partner-invite-1280.png` });
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('partner-row').filter({ hasText: 'Айдар Партнёр' })).toBeVisible();

  // партнёр открывает приглашение без входа
  await page.context().clearCookies();
  await page.goto(new URL(link).pathname);
  await expect(page.getByTestId('partner-join-page')).toContainText('Айдар Партнёр');
  const join = page.getByTestId('partner-join-form');
  await join.getByLabel('Имя и фамилия').fill('Айдар Сериков');
  await join.getByLabel('Почта').fill('aidar.partner@example.invalid');
  await join.getByLabel('Телефон').fill('+7 701 000 00 01');
  await join.locator('input[name="password"]').fill('Партнёр-пароль-2026');
  await join.getByLabel('Повторите пароль').fill('Другой-пароль-2026');
  await join.locator('input[name="privacyAccepted"]').check();
  await join.getByTestId('partner-join-submit').click();
  await expect(page.getByTestId('partner-join-error')).toHaveText('Пароли не совпадают');
  // после ошибки введённое остаётся на месте
  await expect(join.getByLabel('Имя и фамилия')).toHaveValue('Айдар Сериков');
  await expect(join.getByLabel('Телефон')).toHaveValue('+7 701 000 00 01');
  if (process.env.CABINET_SHOTS) await page.screenshot({ path: `${process.env.CABINET_SHOTS}/partner-join-1280.png` });
  await join.getByLabel('Повторите пароль').fill('Партнёр-пароль-2026');
  await join.getByTestId('partner-join-submit').click();
  await page.waitForURL(/\/login\/check-email/);
  // ссылка одноразовая: повторное открытие без формы
  await page.goto(new URL(link).pathname);
  await expect(page.getByTestId('partner-join-page')).toContainText('Приглашение не открылось');
  await expect(page.getByTestId('partner-join-form')).toHaveCount(0);
  // старый адрес /partner/join тоже открывает страницу приглашения
  await page.goto('/partner/join/неверный');
  await expect(page.getByTestId('partner-join-page')).toContainText('Приглашение не открылось');

  // клиент партнёра оплатил доп $50: 30% = $15; выплачено $5
  await signIn(page, request);
  await page.goto('/platform/cabinet/clients/ui-org-2');
  await page.getByTestId('client-partner-form').getByLabel('Партнёр').selectOption({ label: 'Айдар Партнёр' });
  await page.getByTestId('client-partner-form').getByTestId('client-partner-save').click();
  await expect(page.getByTestId('client-partner-result')).toBeVisible();
  const partnerId = (await (await request.get(`${FIXTURE_API}/platform/partners`, asAdmin)).json()).partners.find((p: { name: string }) => p.name === 'Айдар Партнёр').id;
  expect((await request.post(`${FIXTURE_API}/platform/payments`, { ...asAdmin, data: { organizationId: 'ui-org-2', amount: '50', paidOn: new Date().toISOString().slice(0, 10), kind: 'ADDON' } })).ok()).toBe(true);
  expect((await request.post(`${FIXTURE_API}/platform/partners/${partnerId}/payouts`, { ...asAdmin, data: { amount: '5', spentOn: new Date().toISOString().slice(0, 10), note: 'Kaspi' } })).ok()).toBe(true);

  await page.goto('/partner');
  await expect(page.getByTestId('partner-cabinet')).toBeVisible();
  await expect(page.getByTestId('partner-code')).toHaveText('P001');
  await expect(page.getByTestId('partner-clients-count')).toContainText('1');
  await expect(page.getByTestId('partner-balance')).toContainText('$10');
  await page.getByRole('link', { name: 'Клиенты' }).click();
  await expect(page.getByTestId('partner-client-row')).toContainText('$15');
  await page.getByRole('link', { name: 'Ссылка' }).click();
  await expect(page.getByTestId('partner-link-value')).toHaveValue(/\/start\?p=P001$/);
  await page.getByRole('link', { name: 'Деньги' }).click();
  await expect(page.getByTestId('partner-accrued')).toContainText('$15');
  await expect(page.getByTestId('partner-payout-row')).toContainText('Kaspi');
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(wide).toBeLessThanOrEqual(0);
  if (process.env.CABINET_SHOTS) await page.screenshot({ path: `${process.env.CABINET_SHOTS}/partner-money-1280.png`, fullPage: true });
});
