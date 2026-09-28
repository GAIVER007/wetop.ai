import { expect, test } from './fixtures';

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
    // Next сохраняет скрытое дерево при потоковом redirect; проверяем единственный видимый main.
    const main = page.getByRole('main');
    await expect(main).toHaveCount(1);
    await expect(main.getByLabel('Пароль', { exact: true })).toBeVisible();
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

test('ссылка из письма подтверждает почту при включённом замке', async ({ page }) => {
  await page.goto('/register');
  const main = page.getByRole('main');
  await main.getByLabel('Email').fill('novyj@example.com');
  await main.getByLabel('Имя').fill('Вячеслав Петров');
  await main.getByLabel('Название отеля').fill('Хостел на Абая');
  await main.getByLabel('Пароль', { exact: true }).fill('novyj-parol-2026');
  await main.getByRole('button', { name: 'Создать организацию' }).click();
  await page.waitForURL('**/login/check-email**');

  await page.goto('/login/verify?token=ui-verify-1');
  await expect(page).toHaveURL(/\/today/);
  await expect(page.getByRole('heading', { name: 'Главная' })).toBeVisible();
});
