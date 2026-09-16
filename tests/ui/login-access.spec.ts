import { expect, test } from '@playwright/test';

/**
 * Экран входа. Два входа сосуществуют (ADR-046): свой — по коду на почту (срез 13, этап 6), и
 * Cloudflare Access на app.wetop.ai (plans/wetop-domain-2026-09-14.md §3, Д5), который передаёт почту
 * вошедшего заголовком cf-access-authenticated-user-email.
 *
 * Синтетический API (`scripts/preview/fixture-api.ts`) принимает один код — 123456. Это проверка экрана и
 * серверных действий стойки, а не правил API: те закрыты тестами контроллера.
 */
test('за Cloudflare Access экран входа показывает почту и выход, без формы пароля', async ({
  page,
}) => {
  await page.setExtraHTTPHeaders({ 'cf-access-authenticated-user-email': 'admin@example.invalid' });
  await page.goto('/login');
  const main = page.getByRole('main');
  await expect(main).toContainText('admin@example.invalid');
  await expect(main.getByRole('link', { name: 'Выйти' })).toHaveAttribute(
    'href',
    '/cdn-cgi/access/logout',
  );
  await expect(main.getByRole('link', { name: 'Открыть рабочее место' })).toHaveAttribute(
    'href',
    '/today',
  );
  await expect(page.getByLabel('Пароль', { exact: true })).toHaveCount(0);
});

test('без Access: почта → код из письма → рабочее место; кука HttpOnly; выход гасит сессию', async ({
  page,
  context,
}) => {
  await page.goto('/login');
  const main = page.getByRole('main');
  await expect(page.getByLabel('Пароль', { exact: true })).toHaveCount(0);
  await main.getByLabel('Email').fill('Urij@Example.com');
  await main.getByRole('button', { name: 'Получить код' }).click();
  await expect(main).toContainText('Код отправлен');

  await main.getByLabel('Код из письма').fill('123456');
  await main.getByRole('button', { name: 'Войти' }).click();
  await page.waitForURL('**/today');

  const cookie = (await context.cookies()).find((c) => c.name === 'wetop_session');
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe('Lax');

  await page.goto('/login');
  await expect(main).toContainText('Вы вошли');
  await expect(main).toContainText('urij@example.com');
  await expect(main).toContainText('Хостел «Пример»');
  await expect(main).toContainText('Пробный период');
  await main.getByRole('button', { name: 'Выйти' }).click();
  await page.waitForURL('**/login');
  await expect(main.getByRole('button', { name: 'Получить код' })).toBeVisible();
  expect((await context.cookies()).find((c) => c.name === 'wetop_session')).toBeUndefined();
});

test('неверный код — один и тот же текст отказа, форма остаётся на шаге кода', async ({ page }) => {
  await page.goto('/login');
  const main = page.getByRole('main');
  await main.getByLabel('Email').fill('urij@example.com');
  await main.getByRole('button', { name: 'Получить код' }).click();
  await main.getByLabel('Код из письма').fill('000000');
  await main.getByRole('button', { name: 'Войти' }).click();
  await expect(main.getByRole('alert')).toHaveText('Код не подошёл. Запросите новый.');
  await expect(main.getByLabel('Код из письма')).toBeVisible();
});

test('регистрация с /register: название и почта → код → рабочее место', async ({ page }) => {
  await page.goto('/register');
  const main = page.getByRole('main');
  await expect(main).toContainText('Попробовать бесплатно');
  await main.getByLabel('Название организации').fill('Хостел «Новый»');
  await main.getByLabel('Email').fill('novyj@example.com');
  await main.getByRole('button', { name: 'Создать организацию' }).click();
  await expect(main).toContainText('Код отправлен');
  await main.getByLabel('Код из письма').fill('123456');
  await main.getByRole('button', { name: 'Войти' }).click();
  await page.waitForURL('**/today');
});

test('регистрация: ошибка формы приходит текстом из API и не уводит со страницы', async ({ page }) => {
  await page.goto('/register');
  const main = page.getByRole('main');
  await main.getByLabel('Название организации').fill('   ');
  await main.getByLabel('Email').fill('novyj@example.com');
  await main.getByRole('button', { name: 'Создать организацию' }).click();
  await expect(main.getByRole('alert')).toHaveText('Укажите название организации, до 200 знаков.');
});
