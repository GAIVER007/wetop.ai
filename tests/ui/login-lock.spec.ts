import { expect, openProfileMenu, test } from './fixtures';
import { authPorts } from './worker-ports';

/**
 * Пять проверок замка из исходного порядка включения, обновленные под единый вход на публичном сайте.
 * Стойка работает с `APP_AUTH_REQUIRED=1`, а синтетический API отвечает 401 без сессии.
 * Все учетные записи и данные вымышленные, из локальной UI-фикстуры (ADR-010).
 */
const worker = Number(process.env.TEST_PARALLEL_INDEX || '0');
const ports = authPorts()[worker]!;
const SITE = `http://127.0.0.1:${ports.site}`;
const APP = `http://127.0.0.1:${ports.web}`;
const API = `http://127.0.0.1:${ports.api}`;
const PROXY = `http://127.0.0.1:${ports.proxy}`;
const EMAIL = 'admin@wetop.test';
const PASSWORD = 'ui-test-parol';

test.beforeEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
  await request.post(`${PROXY}/__a27/network`, { data: { unavailable: false } });
});

async function signIn(page: import('@playwright/test').Page): Promise<void> {
  await page.goto(`${APP}/login`);
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Почта').fill(EMAIL);
  await dialog.getByLabel('Пароль', { exact: true }).fill(PASSWORD);
  await dialog.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL(`${APP}/today`); // гостиница садится на «Главную» (vertical-landing.ts, ADR-180)
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
  await expect(page.getByRole('heading', { name: 'Главная', exact: true })).toBeVisible();
  await page.goto(`${APP}/chessboard`);
  await expect(page.getByRole('heading', { name: 'Журнал', exact: true })).toBeVisible();

  await openProfileMenu(page);
  await page.locator('#profile-dropdown').getByRole('button', { name: 'Выйти' }).click();
  await expect(page).toHaveURL(`${SITE}/?next=%2Ftoday#login`);

  await page.goto(`${APP}/today`);
  await expect(page).toHaveURL(`${SITE}/?next=%2Ftoday#login`);
});

test('ссылка из письма подтверждает почту при включенном замке', async ({ page, context }) => {
  await page.goto(`${APP}/register`);
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Почта').fill('new-login-lock@example.invalid');
  await dialog.getByLabel('Имя', { exact: true }).fill('Тестовый Пользователь');
  await dialog.getByLabel('Название бизнеса').fill('Тестовый объект');
  await dialog.getByLabel('Страна', { exact: true }).selectOption('KZ');
  await dialog.getByRole('textbox', { name: 'Телефон', exact: true }).fill('7015554433');
  await dialog.getByLabel('Пароль', { exact: true }).fill('synthetic-password');
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: /Создать/ }).click();

  await expect(dialog.getByRole('heading', { name: 'Проверьте почту' })).toBeVisible();
  expect((await context.cookies(APP)).some((cookie) => cookie.name === 'wetop_session')).toBe(
    false,
  );

  await page.goto(`${APP}/login/verify?token=ui-verify-1`);
  await expect(page).toHaveURL(`${APP}/today`); // гостиница садится на «Главную» (vertical-landing.ts, ADR-180)
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Главная', exact: true })).toBeVisible();
});
