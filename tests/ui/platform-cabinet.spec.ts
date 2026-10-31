import { FIXTURE_API, expect, test } from './fixtures';
import type { APIRequestContext, Page } from '@playwright/test';

/**
 * Кабинет компании WETOP (владелец 28.10.2026, вариант «Г»): меню слева, путь клиента, клиенты, сроки. Стенд: своя
 * организация «Luxx Aparts» (ui-org) не клиент; клиент «Хостел «Пример»» (ui-org-2) на пробном, входил час назад.
 * На 1280 всё в один экран без прокрутки вбок.
 */
test.beforeEach(async ({ request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
});

async function signIn(page: Page, request: APIRequestContext, platformAdmin: boolean) {
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL(/\/(today|platform\/cabinet)$/);
  await request.post(`${FIXTURE_API}/__test/control`, { data: { platformAdmin } });
}

test('главная «B»: 4 цифры, воронка продаж из 6 шагов, пробный в оплату и продления, доход, пробный; без прокрутки вбок на 1280', async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await signIn(page, request, true);
  // клиент платит: подписка $49 оплачена на месяц вперёд и одна оплата
  const ahead = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  // подставной API пускает в «Платформу» только с сессией: запросы с куками вошедшей страницы
  const token = (await page.context().cookies()).find((c) => c.name === 'wetop_session')?.value;
  expect(token).toBeTruthy();
  const asAdmin = { headers: { 'x-wetop-test-client': '1', 'x-wetop-session': token! } };
  expect((await request.put(`${FIXTURE_API}/platform/subscriptions/ui-org-2`, { ...asAdmin, data: { monthly: '49', paidUntil: ahead } })).ok()).toBe(true);
  expect((await request.post(`${FIXTURE_API}/platform/payments`, { ...asAdmin, data: { organizationId: 'ui-org-2', amount: '49', paidOn: today } })).ok()).toBe(true);
  await page.goto('/platform/cabinet');
  const cabinet = page.getByTestId('cabinet');
  await expect(cabinet.getByRole('navigation', { name: 'Кабинет WETOP' })).toBeVisible();
  // главная «B» (владелец 30.10.2026): MRR, оплатившие клиенты, средний чек, сумма оплат
  await expect(page.getByTestId('cabinet-mrr')).toHaveText('$49');
  await expect(page.getByTestId('cabinet-paid-clients')).toHaveText('1');
  await expect(page.getByTestId('cabinet-avg-check')).toHaveText('$49');
  await expect(page.getByTestId('cabinet-income')).toHaveText('$49');
  // воронка продаж из шести шагов: посетители wetop.ai от счётчика компании, проценты перехода
  await expect(page.getByTestId('growth-funnel').getByRole('listitem')).toHaveCount(6);
  await expect(page.getByTestId('growth-visitors')).toContainText('400');
  await expect(page.getByTestId('growth-registrations')).toContainText('%');
  await expect(page.getByTestId('growth-active')).toContainText('Активны на пробном');
  await expect(page.getByTestId('growth-paid')).toContainText('Оплатили');
  await expect(page.getByTestId('growth-renewals')).toContainText('Продлили');
  await expect(page.getByTestId('growth-rates')).toContainText('пробный в оплату');
  await expect(page.getByTestId('growth-income')).toContainText('$49');
  await expect(page.getByTestId('cabinet-registrations')).toContainText('Регистрации за месяц');
  await expect(page.getByTestId('cabinet-trial-activity')).toContainText('Активность на пробном');
  await expect(page.getByTestId('cabinet-trial-unpaid')).toContainText('После пробного не оплатили');
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(wide).toBeLessThanOrEqual(0);
  if (process.env.CABINET_SHOTS)
    await page.screenshot({ path: `${process.env.CABINET_SHOTS}/cabinet-1280.png`, fullPage: true });
  // владелец 30.10.2026 («сделай повыше, чтобы не было обрезанного»): на ноутбуке (1440×800 без панелей браузера)
  // цифры, вся воронка и оба графика целиком на первом экране
  await page.setViewportSize({ width: 1440, height: 800 });
  await page.reload();
  await expect(page.getByTestId('growth-renewals')).toBeVisible();
  for (const id of ['cabinet-mrr', 'growth-renewals', 'growth-rates', 'growth-income'])
    await expect(page.getByTestId(id), id).toBeInViewport({ ratio: 1 });
  if (process.env.CABINET_SHOTS) await page.screenshot({ path: `${process.env.CABINET_SHOTS}/cabinet-1440x800.png` });

  // «Клиенты»: строка с LTV, «оплачено до» и кнопкой «Доступ»; своя организация не клиент
  await cabinet.getByRole('navigation', { name: 'Кабинет WETOP' }).getByRole('link', { name: /Клиенты/ }).click();
  await page.waitForURL('**/platform/cabinet/clients');
  const table = page.getByTestId('cabinet-clients-table');
  await expect(table).toContainText('Хостел «Пример»');
  await expect(table).toContainText('$49');
  await expect(table).not.toContainText('Luxx Aparts');
  const access = table.getByRole('link', { name: 'Карточка клиента: Хостел «Пример»' });
  await expect(access).toHaveAttribute('href', '/platform/cabinet/clients/ui-org-2');
  await expect(access).toBeInViewport({ ratio: 1 });
  // «Клиенты» C (30.10.2026): пробный 4 дня, работал 1 день из 7: «под риском», сверху списка
  const first = page.getByTestId('cabinet-client-row').first();
  await expect(first).toContainText('Хостел «Пример»');
  await expect(first.getByTestId('client-risk')).toHaveText('под риском');
  await expect(first).toContainText('1/7');
  // владелец 30.10.2026: «Клиенты» без цифр Главной; сверху «с кем говорить», в строке «Принёс денег» и страна
  await expect(page.getByTestId('clients-tasks')).toBeVisible();
  await expect(page.getByTestId('task-risk')).toContainText('1');
  await expect(page.getByText('Люди у клиентов')).toHaveCount(0);
  await expect(page.getByText('MRR, в месяц')).toHaveCount(0);
  await expect(table.getByRole('columnheader', { name: 'Принёс денег' })).toBeVisible();
  await expect(table.getByRole('columnheader', { name: 'Партнёр' })).toHaveCount(0);
  // ТЗ «две админки» п. 4 (30.10.2026): город, тариф и следующий платёж в строке; партнёр в карточке клиента
  await expect(table.getByRole('columnheader', { name: 'Город' })).toBeVisible();
  await expect(table.getByRole('columnheader', { name: 'Тариф' })).toBeVisible();
  await expect(table.getByRole('columnheader', { name: 'Платёж' })).toBeVisible();
  await expect(first.getByTestId('client-city')).toHaveText('Алматы');
  // фильтр страны и поиск: адрес хранит выбор
  await page.getByTestId('clients-search').fill('Пример');
  await page.getByRole('button', { name: 'Показать' }).click();
  await page.waitForURL(/clients\?.*q=/);
  await expect(page.getByTestId('cabinet-client-row')).toHaveCount(1);
  await page.goto('/platform/cabinet/clients');
  // таблица целиком в панели и после новой отметки
  expect(await page.getByTestId('cabinet-clients-table').evaluate((el) => (el.parentElement ?? el).scrollWidth - (el.parentElement ?? el).clientWidth)).toBeLessThanOrEqual(0);
  await page.getByTestId('clients-filter-risk').click();
  await page.waitForURL('**/clients?show=risk');
  await expect(page.getByTestId('cabinet-client-row')).toHaveCount(1);
  await page.goto('/platform/cabinet/clients');
  // таблица целиком в панели: без прокрутки вбок
  const overflow = await table.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.getByTestId('clients-filter-paying').click();
  await page.waitForURL('**/clients?show=paying');
  await expect(page.getByText('Здесь пока никого нет.')).toBeVisible();
  const wide2 = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(wide2).toBeLessThanOrEqual(0);
  if (process.env.CABINET_SHOTS) {
    await page.goto('/platform/cabinet/clients');
    await page.screenshot({ path: `${process.env.CABINET_SHOTS}/clients-1280.png`, fullPage: true });
  }
});

test('карточка клиента: доступ, люди, филиалы, журнал; «продлить пробный» пишет в журнал', async ({ page, request }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await signIn(page, request, true);
  await page.goto('/platform/cabinet/clients');
  await page.getByTestId('cabinet-clients-table').getByRole('link', { name: 'Карточка клиента: Хостел «Пример»' }).click();
  await page.waitForURL('**/platform/cabinet/clients/ui-org-2');
  const card = page.getByTestId('client-card');
  await expect(card).toContainText('Хостел «Пример»');
  await expect(card).toContainText('пробный до');
  await expect(page.getByTestId('client-members')).toContainText('owner@example.com');
  await expect(page.getByTestId('client-locations')).toContainText('Гостиница');
  await expect(page.getByTestId('client-journal')).toContainText('Зарегистрирован');
  // «Что сделал на пробном» и «Написать» владельцу (вариант C, 30.10.2026)
  await expect(page.getByTestId('client-trial-work')).toContainText('Дней работы на пробном');
  await expect(page.getByTestId('client-trial-days')).toHaveText('1');
  await expect(page.getByTestId('client-card-risk')).toHaveText('под риском');
  await expect(page.getByTestId('client-write')).toHaveAttribute('href', /^mailto:owner@example\.com\?subject=/);
  if (process.env.CABINET_SHOTS)
    await page.screenshot({ path: `${process.env.CABINET_SHOTS}/client-card-1280.png`, fullPage: true });
  await page.getByTestId('client-trial-7').click();
  await expect(page.getByTestId('client-access-result')).toContainText('Пробный продлён до');
  await page.reload();
  await expect(page.getByTestId('client-journal')).toContainText('Продлён пробный');
  await expect(page.getByTestId('client-journal')).toContainText('admin@wetop.test');
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(wide).toBeLessThanOrEqual(0);
  // оплата получена: статус «платит», продлевать пробный больше нечего
  await page.getByTestId('client-access-paid').click();
  await expect(page.getByTestId('client-access-result')).toContainText('Оплата подтверждена');
  await page.reload();
  await expect(card).toContainText('платит');
  await expect(page.getByTestId('client-trial-7')).toHaveCount(0);
});

test('главный администратор после входа сразу в кабинете WETOP, а не в стойке клиента', async ({ page, request }) => {
  await request.post(`${FIXTURE_API}/__test/control`, { data: { platformAdmin: true } });
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/platform/cabinet');
  await expect(page.getByTestId('cabinet')).toBeVisible();
  // уже вошёл и снова открывает app.wetop.ai: опять кабинет, а не гостиница (владелец 30.10.2026)
  await page.goto('/');
  await page.waitForURL('**/platform/cabinet');
  await expect(page.getByTestId('cabinet')).toBeVisible();
  if (process.env.CABINET_SHOTS) await page.screenshot({ path: `${process.env.CABINET_SHOTS}/login-cabinet-home.png` });
});

test('главный администратор без отметки «Кабинет WETOP по умолчанию» (как Вячеслав): входит в свою стойку, кабинет в «Настройках»', async ({
  page,
  request,
}) => {
  await request.post(`${FIXTURE_API}/__test/control`, { data: { platformAdmin: true, cabinetHome: false } });
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL(/\/today$/);
  await page.goto('/');
  await page.waitForURL(/\/today$/);
  expect(new URL(page.url()).pathname).toBe('/today');
  if (process.env.CABINET_SHOTS) await page.screenshot({ path: `${process.env.CABINET_SHOTS}/login-own-hotel.png` });
});

test('кабинет главного администратора без строки разделов стойки: только знак, тема и профиль', async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, request, true);
  await page.goto('/platform/cabinet');
  await expect(page.getByTestId('cabinet')).toBeVisible();
  const header = page.locator('.workspace-header');
  // владелец 29.10.2026: «Главный админ, я не должен это видеть… убери верхнюю строку»
  await expect(header.getByRole('link', { name: 'Журнал', exact: true })).toHaveCount(0);
  await expect(header.locator('.tabnav, .header-clock')).toHaveCount(0);
  await expect(header.locator('.workspace-header__property')).toHaveCount(0);
  await expect(header.getByRole('button', { name: /Найти/ })).toHaveCount(0);
  await expect(header.getByRole('button', { name: 'Открыть меню' })).toHaveCount(0);
  // остаются знак (ведёт в кабинет), тема и профиль с «Выйти»
  await expect(header.getByRole('link', { name: 'WETOP, стартовый экран' })).toHaveAttribute('href', '/platform/cabinet');
  await expect(header.locator('.profile-trigger')).toBeVisible();
  if (process.env.CABINET_SHOTS)
    await page.screenshot({ path: `${process.env.CABINET_SHOTS}/cabinet-1440.png` });
  // в стойке клиента строка разделов на месте
  await page.goto('/today');
  await expect(page.locator('.workspace-header__property')).toHaveCount(1);
});

test('отток месяца: клиент ушёл в «только чтение», в «Клиентах» «ушли за месяц: 1»', async ({ page, request }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await signIn(page, request, true);
  const token = (await page.context().cookies()).find((c) => c.name === 'wetop_session')?.value;
  const asAdmin = { headers: { 'x-wetop-test-client': '1', 'x-wetop-session': token! } };
  // отток живёт в «Клиентах» (главная «B» 30.10.2026 без него)
  await page.goto('/platform/cabinet/clients');
  await expect(page.getByTestId('cabinet')).toContainText('ушли за месяц: 0, в прошлом: 0');
  expect((await request.put(`${FIXTURE_API}/platform/organizations/ui-org-2/status`, { ...asAdmin, data: { status: 'READ_ONLY' } })).ok()).toBe(true);
  await page.reload();
  await expect(page.getByTestId('cabinet')).toContainText('ушли за месяц: 1, в прошлом: 0');
});

test('«Сайт wetop.ai»: посетители, путь к регистрации с процентами, откуда пришли; один экран на 1280', async ({ page, request }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await signIn(page, request, true);
  await page.goto('/platform/cabinet');
  await page.getByTestId('cabinet').getByRole('link', { name: 'Сайт wetop.ai' }).click();
  await expect(page).toHaveURL(/\/platform\/cabinet\/site$/);
  await expect(page.getByTestId('site-visitors')).toContainText('3');
  await expect(page.getByTestId('site-path-open')).toContainText('2');
  await expect(page.getByTestId('site-path-open')).toContainText('66,6%');
  await expect(page.getByTestId('site-path-done')).toContainText('1');
  await expect(page.getByTestId('site-sources')).toContainText('google');
  // число и доля видны в строке источника
  await expect(page.getByTestId('site-sources').getByRole('row', { name: /google/ })).toContainText(/1\s*33,3%/);
  // число в пределах панели, не за краем таблицы (общий минимум ширины таблицы шире половины экрана)
  const fits = await page.getByTestId('site-sources').evaluate((table) => {
    const box = table.parentElement!.getBoundingClientRect();
    const cell = table.querySelector('tbody tr td:last-child')!.getBoundingClientRect();
    return cell.right <= box.right + 1 && table.parentElement!.scrollWidth <= table.parentElement!.clientWidth;
  });
  expect(fits).toBe(true);
  await expect(page.getByTestId('site-sources')).toContainText('Напрямую');
  await expect(page.getByTestId('site-pages')).toContainText('/pricing/');
  // страны посетителей (миграция 169)
  await expect(page.getByTestId('site-countries')).toContainText('Казахстан');
  await expect(page.getByTestId('site-countries')).toContainText('Катар');
  await expect(page.getByTestId('site-countries')).toContainText('Не определена');
  await expect(page.getByTestId('site-daily').locator('li')).toHaveCount(new Date(Number(new Date().toISOString().slice(0, 4)), Number(new Date().toISOString().slice(5, 7)), 0).getDate());
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/cabinet-site-1280.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/cabinet-site-390.png', fullPage: true });
});

test('«Страны»: посетители, новые клиенты, оплаты и доход по стране, итог; без прокрутки вбок на 1280', async ({ page, request }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await signIn(page, request, true);
  await page.goto('/platform/cabinet');
  await page.getByTestId('cabinet').getByRole('link', { name: 'Страны' }).click();
  await expect(page).toHaveURL(/\/platform\/cabinet\/countries$/);
  const kz = page.getByTestId('country-KZ');
  await expect(kz).toContainText('Казахстан');
  await expect(kz).toContainText('120');
  await expect(kz).toContainText('$49');
  // первая строка: больше дохода
  await expect(page.getByTestId('countries-table').locator('tbody tr').first()).toHaveAttribute('data-testid', 'country-KZ');
  await expect(page.getByTestId('country-none')).toContainText('Страна не указана');
  await expect(page.getByTestId('country-AE')).toContainText('8');
  await expect(page.getByTestId('countries-total')).toContainText('162');
  await expect(page.getByTestId('countries-total')).toContainText('$78');
  await expect(page.getByTestId('countries-top-income')).toContainText('Казахстан');
  // в плитке: страна крупно, число посетителей подписью
  await expect(page.getByTestId('countries-top-visitors').locator('..')).toContainText('120');
  const fits = await page.getByTestId('countries-table').evaluate((t) => t.parentElement!.scrollWidth <= t.parentElement!.clientWidth);
  expect(fits).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/cabinet-countries-1280.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/cabinet-countries-390.png', fullPage: true });
});

// РНП (владелец 30.10.2026): полоса итогов, каждый день строкой с итогом, вкладка «Партнёры» с «Принёс денег»
test('РНП: итоги периода, дни строкой, вкладка «Партнёры»; таблица целиком в 1280', async ({ page, request }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await signIn(page, request, true);
  await page.goto('/platform/cabinet');
  await page.getByTestId('cabinet').getByRole('navigation', { name: 'Кабинет WETOP' }).getByRole('link', { name: 'РНП' }).click();
  await expect(page).toHaveURL(/\/platform\/cabinet\/rnp$/);
  await expect(page.getByTestId('rnp-visitors')).toContainText('3');
  await expect(page.getByTestId('rnp-leads')).toContainText('33,3%');
  await expect(page.getByTestId('rnp-income')).toContainText('$49');
  await expect(page.getByTestId('rnp-total')).toContainText('$20');
  const days = page.getByTestId('rnp-day');
  await expect(days.first()).toContainText('01.');
  const over = await page.getByTestId('rnp-days').evaluate((el) => (el.parentElement ?? el).scrollWidth - (el.parentElement ?? el).clientWidth);
  expect(over).toBeLessThanOrEqual(0);
  if (process.env.CABINET_SHOTS) await page.screenshot({ path: `${process.env.CABINET_SHOTS}/rnp-1280.png` });
  await page.getByTestId('rnp-tab-partners').click();
  await expect(page).toHaveURL(/tab=partners/);
  const aidar = page.getByTestId('rnp-partner').filter({ hasText: 'Айдар' });
  await expect(aidar).toContainText('$49');
  await expect(page.getByTestId('rnp-brought')).toContainText('$49');
  if (process.env.CABINET_SHOTS) await page.screenshot({ path: `${process.env.CABINET_SHOTS}/rnp-partners-1280.png` });
});

test('без отметки главного администратора кабинет закрыт', async ({ page, request }) => {
  await signIn(page, request, false);
  await page.goto('/platform/cabinet');
  await expect(page.getByTestId('cabinet-forbidden')).toBeVisible();
  await expect(page.getByTestId('cabinet')).toHaveCount(0);
});
