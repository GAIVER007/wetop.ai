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

test('главный администратор: путь клиента, клиенты без своей организации, сроки; один экран на 1280', async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await signIn(page, request, true);
  await page.goto('/platform/cabinet');
  const cabinet = page.getByTestId('cabinet');
  await expect(cabinet.getByRole('navigation', { name: 'Кабинет WETOP' })).toBeVisible();
  await expect(page.getByTestId('cabinet-clients')).toHaveText('1');
  const funnel = page.getByTestId('cabinet-funnel');
  await expect(funnel).toContainText('Пробный период');
  await expect(funnel).toContainText('Платят');
  const table = page.getByTestId('cabinet-clients-table');
  await expect(table).toContainText('Хостел «Пример»');
  await expect(table).toContainText('сегодня');
  // своя организация главного администратора не клиент
  await expect(table).not.toContainText('Luxx Aparts');
  await expect(page.getByTestId('cabinet-deadlines')).toContainText('Хостел «Пример»');
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(wide).toBeLessThanOrEqual(0);
  if (process.env.CABINET_SHOTS)
    await page.screenshot({ path: `${process.env.CABINET_SHOTS}/cabinet-1280.png`, fullPage: true });
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
  await expect(header.getByRole('button', { name: 'Меню администратора' })).toBeVisible();
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
