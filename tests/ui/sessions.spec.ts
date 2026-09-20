import { expect, test } from '@playwright/test';

test.beforeEach(async ({ request }) => {
  await request.post('http://127.0.0.1:4311/__test/reset');
});

/**
 * «Где я вошёл» и «выйти везде» (срез 13, §3 п. 3; DATA_MODEL §13.5). Синтетический API
 * (`scripts/preview/fixture-api.ts`) принимает код 123456 и отдаёт две живые сессии: эту и телефон.
 * Проверка экрана и серверных действий стойки; правила API закрыты тестами контроллера.
 */
async function login(page: import('@playwright/test').Page) {
  // Вход по коду остался на пути приглашения (ADR-053), переключателя на /login больше нет.
  await page.goto('/invite/fixture-invite-token');
  await page.getByRole('button', { name: 'Принять приглашение' }).click();
  await page.waitForURL('**/login?email=novyj%40example.com&step=code');
  const main = page.getByRole('main');
  await main.getByLabel('Код из письма').fill('123456');
  await main.getByRole('button', { name: 'Войти' }).click();
  await page.waitForURL('**/today');
}

test('вошедший видит, где он вошёл, — устройство словами и пометку своего сеанса', async ({
  page,
}) => {
  await login(page);
  await page.goto('/login');
  const main = page.getByRole('main');
  const list = main.getByTestId('session-list');
  await expect(list).toContainText('Chrome, macOS');
  await expect(list).toContainText('Safari, iPhone');
  await expect(list).toContainText('этот сеанс');
  await expect(list.locator('li')).toHaveCount(2);
  // ни ключей, ни сырых строк агента
  await expect(list).not.toContainText('Mozilla');
});

test('«Завершить все сеансы» гасит вход и возвращает форму; куки больше нет', async ({
  page,
  context,
}) => {
  await login(page);
  await page.goto('/login');
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Завершить все сеансы' }).click();
  await page.waitForURL('**/login');
  await expect(main.getByRole('button', { name: 'Войти', exact: true })).toBeVisible();
  expect((await context.cookies()).find((c) => c.name === 'wetop_session')).toBeUndefined();
});

test('вошедший по паролю видит тот же список и ту же кнопку: сеансы — про человека, не про способ входа', async ({
  page,
}) => {
  await page.goto('/login');
  const main = page.getByRole('main');
  await main.getByLabel('Email').fill('admin@wetop.test');
  await main.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await main.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
  await page.goto('/login');
  await expect(main.getByTestId('session-list')).toContainText('этот сеанс');
  await expect(main.getByRole('button', { name: 'Завершить все сеансы' })).toBeVisible();
});

test('без сессии списка сеансов нет', async ({ page }) => {
  await page.goto('/login');
  const main = page.getByRole('main');
  await expect(main.getByRole('button', { name: 'Войти', exact: true })).toBeVisible();
  await expect(main.getByTestId('session-list')).toHaveCount(0);
  await expect(main.getByRole('button', { name: 'Завершить все сеансы' })).toHaveCount(0);
});

test('кука сессии выписывается заново при работе: срок отсчитывается от последней страницы', async ({
  page,
  context,
}) => {
  await login(page);
  const seen = async () =>
    (await context.cookies()).find((c) => c.name === 'wetop_session')!.expires;
  const first = await seen();
  expect(first).toBeGreaterThan(0);
  // на сервере срок сессии двигает сама работа (§13.5); в браузере — эта же кука с новым сроком
  await page.waitForTimeout(1100);
  await page.goto('/chessboard');
  await expect(page.getByRole('main').getByTestId('unit-row').first()).toBeVisible();
  expect(await seen()).toBeGreaterThan(first);
  const cookie = (await context.cookies()).find((c) => c.name === 'wetop_session')!;
  expect(cookie.httpOnly).toBe(true);
  expect(cookie.sameSite).toBe('Lax');
});
