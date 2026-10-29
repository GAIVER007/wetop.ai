import { expect, openProfileMenu, test } from './fixtures';
import { authPorts } from './worker-ports';

const worker = Number(process.env.TEST_PARALLEL_INDEX || '0');
const ports = authPorts()[worker]!;
const SITE = `http://127.0.0.1:${ports.site}`;
const APP = `http://127.0.0.1:${ports.web}`;
const API = `http://127.0.0.1:${ports.api}`;
const PROXY = `http://127.0.0.1:${ports.proxy}`;
// Только синтетическая учётная запись локального fixture API, без базы и отправки писем.
test.beforeEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
  await request.post(`${PROXY}/__a27/network`, { data: { unavailable: false } });
  await request.get(`${SITE}/`);
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
    await page.goto(`${APP}${path}`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(`${SITE}/?next=${encodeURIComponent(path)}#login`);
    await login(page);
    // После входа возвращаемся на исходный защищённый экран, включая отдельную главную /today.
    const landed = path;
    await expect(page).toHaveURL(`${APP}${landed}`);
    const cookie = (await context.cookies(APP)).find((c) => c.name === 'wetop_session');
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe('Lax');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(`${APP}${landed}`);
  });
}
test('старые адреса открывают только формы на главной', async ({ page }) => {
  await page.goto(`${APP}/login`, { waitUntil: 'domcontentloaded' });
  await expect(
    page.getByRole('dialog').getByRole('heading', { name: 'Вход в WETOP' }),
  ).toBeVisible();
  await expect(page).toHaveURL(`${SITE}/?next=%2Ftoday#login`);
  await page.goto(`${APP}/register`, { waitUntil: 'domcontentloaded' });
  await expect(
    page.getByRole('dialog').getByRole('heading', { name: 'Новый аккаунт' }),
  ).toBeVisible();
});
test('сессия работает в новой вкладке; выход возвращает на главную и закрывает доступ', async ({
  page,
  context,
}) => {
  await page.goto(`${APP}/login`, { waitUntil: 'domcontentloaded' });
  await login(page);
  await expect(page).toHaveURL(`${APP}/today`);
  const tab = await context.newPage();
  await tab.goto(`${APP}/profile/access`, { waitUntil: 'domcontentloaded' });
  await expect(
    tab.getByRole('heading', { name: 'Управление доступом', exact: true }),
  ).toBeVisible();
  // next dev оставляет скрытую копию потокового фрагмента вне области (TESTING.md, release-checks #188/#189)
  await expect(tab.getByRole('region', { name: 'Где вы вошли' }).getByTestId('session-list')).toBeVisible();
  await tab.getByRole('button', { name: 'Завершить все сеансы' }).click();
  await expect(tab).toHaveURL(`${SITE}/?next=%2Ftoday#login`);
  await page.goto(`${APP}/today`, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(`${SITE}/?next=%2Ftoday#login`);
  await tab.close();
});
test('выход через меню снимает сессию и снова закрывает защищённые страницы', async ({
  page,
  context,
}) => {
  await page.goto(`${APP}/login`);
  await login(page);
  await expect(page).toHaveURL(`${APP}/today`);
  await openProfileMenu(page);
  await page.locator('#profile-dropdown').getByRole('button', { name: 'Выйти', exact: true }).click();
  await expect(page).toHaveURL(`${SITE}/?next=%2Ftoday#login`);
  expect((await context.cookies(APP)).some((c) => c.name === 'wetop_session')).toBe(false);
  for (const path of ['/today', '/chessboard', '/reservations']) {
    await page.goto(`${APP}${path}`);
    await expect(page).toHaveURL(`${SITE}/?next=${encodeURIComponent(path)}#login`);
  }
});
test('регистрация на главной → письмо → подтверждение → рабочее место', async ({
  page,
  context,
}) => {
  await page.goto(`${APP}/register`);
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Почта').fill('new@example.invalid');
  await dialog.getByLabel('Имя', { exact: true }).fill('Тестовый Пользователь');
  await dialog.getByLabel('Название бизнеса').fill('Тестовый объект');
  // страну не выбирают: её узнаёт номер с кодом (29.10.2026)
  await dialog.getByRole('textbox', { name: 'Телефон', exact: true }).fill('+77015554433');
  await dialog.getByLabel('Пароль', { exact: true }).fill('synthetic-password');
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: /Создать/ }).click();
  await expect(dialog.getByRole('heading', { name: 'Проверьте почту' })).toBeVisible();
  expect((await context.cookies(APP)).some((c) => c.name === 'wetop_session')).toBe(false);
  await page.goto(`${APP}/login/verify?token=ui-verify-1`);
  await expect(page).toHaveURL(`${APP}/today`);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Главная', exact: true })).toBeVisible();
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
