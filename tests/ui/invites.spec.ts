import { expect, test } from '@playwright/test';

/**
 * Приглашения (срез 13, этап 7). Синтетический API (`scripts/preview/fixture-api.ts`) знает пароль
 * сотрудника, код 123456, один живой ключ приглашения — `fixture-invite-token` — и одно ожидающее.
 * Код остался только здесь: принявший приглашение попадает на шаг кода, и пока приглашения не
 * переведены на пароль, этот путь живой (ADR-053).
 * Это проверка экранов и серверных действий стойки; правила API закрыты тестами контроллера.
 */
// Вход по коду с экрана снят 20.09.2026 (ADR-053): входим паролем, как все.
async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
}

test('вошедший видит ожидающие приглашения и зовёт по почте; ошибки формы — текстом', async ({
  page,
}) => {
  await login(page);
  await page.goto('/login');
  const main = page.getByRole('main');
  await expect(main).toContainText('Пригласить администратора');
  const list = main.getByTestId('invite-list');
  await expect(list).toContainText('zhdet@example.com');
  await expect(list).toContainText('ждёт ответа до');

  // «уже в организации» стенд отвечает на почту самого вошедшего; входим теперь паролем, значит и адрес свой
  await main.getByLabel('Почта приглашённого').fill('admin@wetop.test');
  await main.getByRole('button', { name: 'Отправить приглашение' }).click();
  await expect(main.getByRole('alert')).toHaveText('Этот человек уже в организации.');

  await main.getByLabel('Почта приглашённого').fill('Novyj@Example.com');
  await main.getByRole('button', { name: 'Отправить приглашение' }).click();
  await expect(list).toContainText('novyj@example.com');
  await expect(list).toContainText('приглашение отправлено');
  await expect(main.getByLabel('Почта приглашённого')).toHaveValue('');
});

test('без сессии формы приглашения нет', async ({ page }) => {
  await page.goto('/login');
  const main = page.getByRole('main');
  await expect(main.getByRole('button', { name: 'Войти', exact: true })).toBeVisible();
  await expect(main).not.toContainText('Пригласить администратора');
});

test('ссылка из письма: кто зовёт и кого → принять → форма входа сразу на шаге кода с этой почтой', async ({
  page,
}) => {
  await page.goto('/invite/fixture-invite-token');
  const main = page.getByRole('main');
  await expect(main).toContainText('Вас приглашают');
  await expect(main).toContainText('Хостел «Пример»');
  await expect(main).toContainText('novyj@example.com');
  await main.getByRole('button', { name: 'Принять приглашение' }).click();
  await page.waitForURL('**/login?email=novyj%40example.com&step=code');
  await expect(main).toContainText('Код отправлен');
  await expect(main).toContainText('novyj@example.com');
  await main.getByLabel('Код из письма').fill('123456');
  await main.getByRole('button', { name: 'Войти' }).click();
  await page.waitForURL('**/today');
});

test('мёртвая ссылка — один текст и путь на форму входа', async ({ page }) => {
  await page.goto('/invite/net-takogo');
  const main = page.getByRole('main');
  await expect(main.getByRole('alert')).toHaveText(
    'Приглашение не найдено, уже принято или его срок истёк.',
  );
  await expect(main.getByRole('link', { name: 'войдите по коду' })).toHaveAttribute(
    'href',
    '/login',
  );
  await expect(main.getByRole('button', { name: 'Принять приглашение' })).toHaveCount(0);
});
