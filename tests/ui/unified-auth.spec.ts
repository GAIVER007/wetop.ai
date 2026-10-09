import { expect, test } from './fixtures';

const SITE = 'http://127.0.0.1:3002';
const APP = 'http://127.0.0.1:3102';
const API = 'http://127.0.0.1:4313';
// Только синтетическая учётная запись локального fixture API, без базы и отправки писем.
test.beforeEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});
async function login(page: import('@playwright/test').Page) {
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Почта').fill('admin@wetop.test');
  await dialog.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await dialog.getByRole('button', { name: 'Войти', exact: true }).click();
}
for (const path of ['/today', '/chessboard', '/reservations']) {
  test(`защищённая ${path}: главная → реальная cookie → исходный экран`, async ({
    page,
    context,
  }) => {
    await page.goto(path);
    await expect(page).toHaveURL(`${SITE}/?next=${encodeURIComponent(path)}#login`);
    await login(page);
    // гостиничный /today с 09.10 ведёт в единые «Финансы» (plans/finance-home-merge-2026-10-09.md)
    const landed = path === '/today' ? '/finance' : path;
    await expect(page).toHaveURL(`${APP}${landed}`);
    const cookie = (await context.cookies(APP)).find((c) => c.name === 'wetop_session');
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe('Lax');
    await page.reload();
    await expect(page).toHaveURL(`${APP}${landed}`);
  });
}
test('старые адреса открывают только формы на главной', async ({ page }) => {
  await page.goto('/login');
  await expect(
    page.getByRole('dialog').getByRole('heading', { name: 'Вход в WETOP' }),
  ).toBeVisible();
  await expect(page).toHaveURL(`${SITE}/?next=%2Ftoday#login`);
  await page.goto(`${APP}/register`);
  await expect(
    page.getByRole('dialog').getByRole('heading', { name: 'Новый аккаунт' }),
  ).toBeVisible();
});
test('сессия работает в новой вкладке; выход возвращает на главную и закрывает доступ', async ({
  page,
  context,
}) => {
  await page.goto('/login');
  await login(page);
  await expect(page).toHaveURL(`${APP}/finance`);
  const tab = await context.newPage();
  await tab.goto(`${APP}/profile/access`);
  await expect(
    tab.getByRole('heading', { name: 'Управление доступом', exact: true }),
  ).toBeVisible();
  await expect(tab.getByTestId('session-list')).toBeVisible();
  await tab.getByRole('button', { name: 'Завершить все сеансы' }).click();
  await expect(tab).toHaveURL(`${SITE}/?next=%2Ftoday#login`);
  await page.goto('/today');
  await expect(page).toHaveURL(`${SITE}/?next=%2Ftoday#login`);
  await tab.close();
});
test('регистрация на главной → письмо → подтверждение → рабочее место', async ({
  page,
  context,
}) => {
  await page.goto('/register');
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Почта').fill('new@example.invalid');
  await dialog.getByLabel('Имя', { exact: true }).fill('Тестовый Пользователь');
  await dialog.getByLabel('Название бизнеса').fill('Тестовый объект');
  await dialog.getByLabel('Код страны').selectOption('KZ');
  await dialog.getByLabel('Телефон', { exact: true }).fill('7015554433');
  await dialog.getByLabel('Пароль', { exact: true }).fill('synthetic-password');
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: /Создать/ }).click();
  await expect(dialog.getByRole('heading', { name: 'Проверьте почту' })).toBeVisible();
  expect((await context.cookies(APP)).some((c) => c.name === 'wetop_session')).toBe(false);
  await page.goto(`${APP}/login/verify?token=ui-verify-1`);
  await expect(page).toHaveURL(`${APP}/finance`);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Финансы', exact: true })).toBeVisible();
});
test('резервный вход без JavaScript сохраняет сессию и возвращает на исходный экран', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${SITE}/`);
  await expect(
    page.locator('noscript').getByRole('link', { name: 'Войти', exact: true }),
  ).toHaveAttribute('href', `${APP}/auth/fallback`);
  await page.goto(`${APP}/auth/fallback?next=%2Fjournal`);
  await page.getByLabel('Email').fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL(`${APP}/journal`);
  expect((await context.cookies(APP)).some((c) => c.name === 'wetop_session' && c.httpOnly)).toBe(
    true,
  );
  await context.close();
});
