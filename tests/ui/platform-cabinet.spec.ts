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
  await page.waitForURL('**/today');
  await request.post(`${FIXTURE_API}/__test/control`, { data: { platformAdmin } });
}

test('главный администратор: 4 цифры, путь клиента с конверсиями, доход по месяцам, сроки; один экран на 1280', async ({
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
  await expect(page.getByTestId('cabinet-clients')).toHaveText('1');
  await expect(page.getByTestId('cabinet-mrr')).toHaveText('$49');
  await expect(page.getByTestId('cabinet-ltv')).toHaveText('$49');
  // посетители wetop.ai от счётчика компании и процент перехода в регистрацию
  await expect(page.getByTestId('growth-visitors')).toContainText('400');
  await expect(page.getByTestId('growth-registrations')).toContainText('%');
  await expect(page.getByTestId('growth-paid')).toContainText('Первая оплата');
  await expect(page.getByTestId('growth-income')).toContainText('$49');
  await expect(page.getByTestId('cabinet-deadlines')).toContainText('Хостел «Пример»');
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(wide).toBeLessThanOrEqual(0);
  if (process.env.CABINET_SHOTS)
    await page.screenshot({ path: `${process.env.CABINET_SHOTS}/cabinet-1280.png`, fullPage: true });

  // «Клиенты»: строка с LTV, «оплачено до» и кнопкой «Доступ»; своя организация не клиент
  await cabinet.getByRole('navigation', { name: 'Кабинет WETOP' }).getByRole('link', { name: /Клиенты/ }).click();
  await page.waitForURL('**/platform/cabinet/clients');
  const table = page.getByTestId('cabinet-clients-table');
  await expect(table).toContainText('Хостел «Пример»');
  await expect(table).toContainText('$49');
  await expect(table).not.toContainText('Luxx Aparts');
  const access = table.getByRole('link', { name: 'Доступ: Хостел «Пример»' });
  await expect(access).toHaveAttribute('href', /org=ui-org-2/);
  await expect(access).toBeInViewport({ ratio: 1 });
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

test('без отметки главного администратора кабинет закрыт', async ({ page, request }) => {
  await signIn(page, request, false);
  await page.goto('/platform/cabinet');
  await expect(page.getByTestId('cabinet-forbidden')).toBeVisible();
  await expect(page.getByTestId('cabinet')).toHaveCount(0);
});
