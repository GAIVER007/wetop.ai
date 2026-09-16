import { expect, test } from '@playwright/test';

/**
 * Стойка с включённым замком: `APP_AUTH_REQUIRED=1`, а синтетический API отвечает 401 без сессии.
 * Это ручной шаг 5 порядка включения (`plans/slice-13-accounts-saas.md` §7а), сделанный тестом:
 * без входа человек попадает на экран входа, после входа работает, «Выйти» снова закрывает двери.
 *
 * Сотрудник и пароль — вымышленные, из фикстуры интерфейса (ADR-010).
 */
const EMAIL = 'admin@wetop.test';
const PASSWORD = 'ui-test-parol';

async function signIn(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(EMAIL);
  await page.getByLabel('Пароль', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL(/\/today/);
}

for (const path of ['/today', '/chessboard', '/reservations']) {
  test(`без входа ${path} уводит на экран входа`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByLabel('Пароль', { exact: true })).toBeVisible();
  });
}

test('после входа рабочее место открывается, «Выйти» закрывает двери снова', async ({ page }) => {
  await signIn(page);
  await expect(page.getByRole('heading', { name: 'Главная' })).toBeVisible();
  await page.goto('/chessboard');
  await expect(page.getByRole('heading', { name: 'Шахматка' })).toBeVisible();

  await page.getByRole('button', { name: 'Меню администратора' }).click();
  await page.locator('#profile-dropdown').getByRole('button', { name: 'Выйти' }).click();
  await expect(page).toHaveURL(/\/login/);

  // сессия отозвана: обратно в рабочий день по адресу уже не попасть
  await page.goto('/today');
  await expect(page).toHaveURL(/\/login/);
});
