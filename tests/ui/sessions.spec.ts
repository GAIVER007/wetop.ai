import { expect, test } from '@playwright/test';

/**
 * «Где я вошёл» и «выйти везде» (срез 13, §3 п. 3; DATA_MODEL §13.5). Синтетический API
 * (`scripts/preview/fixture-api.ts`) принимает код 123456 и отдаёт две живые сессии: эту и телефон.
 * Проверка экрана и серверных действий стойки; правила API закрыты тестами контроллера.
 */
async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  const main = page.getByRole('main');
  await main.getByLabel('Email').fill('urij@example.com');
  await main.getByRole('button', { name: 'Получить код' }).click();
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
  await expect(main.getByRole('button', { name: 'Получить код' })).toBeVisible();
  expect((await context.cookies()).find((c) => c.name === 'wetop_session')).toBeUndefined();
});

test('без сессии списка сеансов нет', async ({ page }) => {
  await page.goto('/login');
  const main = page.getByRole('main');
  await expect(main.getByRole('button', { name: 'Получить код' })).toBeVisible();
  await expect(main.getByTestId('session-list')).toHaveCount(0);
  await expect(main.getByRole('button', { name: 'Завершить все сеансы' })).toHaveCount(0);
});
