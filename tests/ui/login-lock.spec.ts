import { expect, test } from './fixtures';

/**
 * Пять проверок замка из исходного порядка включения, обновленные под единый вход на публичном сайте.
 * Стойка работает с `APP_AUTH_REQUIRED=1`, а синтетический API отвечает 401 без сессии.
 * Все учетные записи и данные вымышленные, из локальной UI-фикстуры (ADR-010).
 */
const worker = Number(process.env.TEST_PARALLEL_INDEX || '0');
const SITE = `http://127.0.0.1:${Number(process.env.AUTH_SITE_PORT || '3002') + worker}`;
const APP = `http://127.0.0.1:${Number(process.env.AUTH_WEB_PORT || '3102') + worker}`;
const API = `http://127.0.0.1:${Number(process.env.AUTH_API_PORT || '4313') + worker}`;
const PROXY = `http://127.0.0.1:${Number(process.env.AUTH_PROXY_PORT || '4323') + worker}`;
const EMAIL = 'admin@wetop.test';
const PASSWORD = 'ui-test-parol';

test.beforeEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
  await request.post(`${PROXY}/__a27/network`, { data: { unavailable: false } });
});

async function signIn(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(EMAIL);
  await page.getByLabel('Пароль', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL(/\/finance/);
}

for (const path of ['/today', '/chessboard', '/reservations']) {
  test(`без входа ${path} уводит на канонический экран входа`, async ({ page }) => {
    await page.goto(`${APP}${path}`);

    await expect(page).toHaveURL(`${SITE}/?next=${encodeURIComponent(path)}#login`);
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Вход в WETOP' })).toBeVisible();
    await expect(dialog.getByLabel('Пароль', { exact: true })).toBeVisible();
  });
}

test('после входа рабочее место открывается, обычный выход снова закрывает доступ', async ({
  page,
}) => {
  await signIn(page);
  await expect(page.getByRole('heading', { name: 'Обзор бизнеса' })).toBeVisible();
  await page.goto('/chessboard');
  await expect(page.getByRole('heading', { name: 'Календарь' })).toBeVisible();

  await page.getByRole('button', { name: 'Меню администратора' }).click();
  await page.locator('#profile-dropdown').getByRole('button', { name: 'Выйти' }).click();
  await expect(page).toHaveURL(`${SITE}/?next=%2Ftoday#login`);

  await page.goto(`${APP}/today`);
  await expect(page).toHaveURL(`${SITE}/?next=%2Ftoday#login`);
});

test('ссылка из письма подтверждает почту при включенном замке', async ({ page }) => {
  await page.goto(`${APP}/register`);
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Почта').fill('new-login-lock@example.invalid');
  await dialog.getByLabel('Имя', { exact: true }).fill('Тестовый Пользователь');
  await dialog.getByLabel('Название бизнеса').fill('Тестовый объект');
  await dialog.getByLabel('Код страны').selectOption('KZ');
  await dialog.getByLabel('Телефон', { exact: true }).fill('7015554433');
  await dialog.getByLabel('Пароль', { exact: true }).fill('synthetic-password');
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: /Создать/ }).click();

  await page.goto('/login/verify?token=ui-verify-1');
  await expect(page).toHaveURL(/\/finance/);
  await expect(page.getByRole('heading', { name: 'Обзор бизнеса' })).toBeVisible();
});
