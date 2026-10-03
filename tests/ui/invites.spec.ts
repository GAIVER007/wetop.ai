import { expect, test, FIXTURE_API } from './fixtures';

test.beforeEach(async ({ request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
});

/**
 * Приглашения (срез 13, этап 7). Синтетический API (`scripts/preview/fixture-api.ts`) знает пароль
 * сотрудника, код 123456, один живой ключ приглашения — `fixture-invite-token` — и одно ожидающее.
 * Принявший приглашение задаёт пароль по одноразовой ссылке (ADR-053).
 * Это проверка экранов и серверных действий стойки; правила API закрыты тестами контроллера.
 */
// Вход по коду с экрана снят 20.09.2026 (ADR-053): входим паролем, как все.
async function login(page: import('@playwright/test').Page) {
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
}

test('вошедший видит ожидающие приглашения и зовёт по почте; ошибки формы — текстом', async ({
  page,
}) => {
  await login(page);
  await page.goto('/profile/access');
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { name: 'Сотрудники' })).toBeVisible();
  await expect(main).not.toContainText('войдёт по коду');
  const list = main.getByTestId('invite-list');
  await expect(list).toContainText('zhdet@example.com');
  await expect(list).toContainText('ждёт ответа до');

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
  await page.goto('/auth/fallback');
  const main = page.getByRole('main');
  await expect(main.getByRole('button', { name: 'Войти', exact: true })).toBeVisible();
  await expect(main.getByTestId('team')).toHaveCount(0);
});

test('ссылка из письма: кто зовёт и кого → принять → человек задаёт себе пароль и входит им', async ({
  page,
}) => {
  await page.goto('/invite/fixture-invite-token');
  const main = page.getByRole('main');
  await expect(main).toContainText('Вас приглашают');
  await expect(main).toContainText('Хостел «Пример»');
  await expect(main).toContainText('novyj@example.com');
  await expect(main).not.toContainText('придёт код для входа');
  await main.getByRole('button', { name: 'Принять приглашение' }).click();
  // с 20.09.2026 вход один — по паролю (ADR-053): вместо кода на почту приглашённый сразу задаёт пароль
  await page.waitForURL('**/login/set-password?token=*');
  await page.getByLabel('Пароль', { exact: true }).fill('novyj-parol-2026');
  await page.getByLabel('Пароль ещё раз', { exact: true }).fill('novyj-parol-2026');
  await page.getByRole('button', { name: 'Сохранить пароль' }).click();
  await page.waitForURL('http://127.0.0.1:3002/?next=%2Ftoday&password=set#login');
  await expect(page.getByRole('dialog')).toContainText('Пароль сохранён');
});

test('мёртвая ссылка — один текст и путь на форму входа', async ({ page }) => {
  await page.goto('/invite/net-takogo');
  const main = page.getByRole('main');
  await expect(main.getByRole('alert')).toHaveText(
    'Приглашение не найдено, уже принято или его срок истёк.',
  );
  await expect(main.getByRole('link', { name: 'войдите по паролю' })).toHaveAttribute(
    'href',
    '/login',
  );
  await expect(main.getByRole('button', { name: 'Принять приглашение' })).toHaveCount(0);
});
