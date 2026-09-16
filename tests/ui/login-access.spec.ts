import { expect, test } from '@playwright/test';

/**
 * Вход в стойку (DATA_MODEL §13.8, ADR-049, решение владельца 15.09.2026 по Q-139).
 *
 * До 15.09 форма на этом экране ничего не делала, а входом был только Cloudflare Access — почта и
 * одноразовый код. Теперь замка два: Access снаружи (ADR-045) и свой логин с паролем внутри. Почта из
 * заголовка Access сама никуда не пускает — она только подставляется в поле.
 *
 * Сотрудник и пароль — вымышленные, из фикстуры интерфейса (ADR-010).
 */
const EMAIL = 'admin@wetop.test';
const PASSWORD = 'ui-test-parol';

test('форма входа просит почту и пароль', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('main')).toContainText('Войдите в рабочее пространство');
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Пароль', { exact: true })).toBeVisible();
});

test('верный пароль пускает на рабочее место, «Выйти» возвращает на экран входа', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(EMAIL);
  await page.getByLabel('Пароль', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();

  await expect(page).toHaveURL(/\/today/);

  // кто на смене — видно в меню профиля, и оттуда же выход
  await page.getByRole('button', { name: 'Меню администратора' }).click();
  const menu = page.locator('#profile-dropdown');
  await expect(menu).toContainText('Дана Тестова');
  await expect(menu).toContainText(EMAIL);
  await menu.getByRole('button', { name: 'Выйти' }).click();

  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByLabel('Пароль', { exact: true })).toBeVisible();
});

test('неверный пароль не пускает и не говорит, что именно не так', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(EMAIL);
  await page.getByLabel('Пароль', { exact: true }).fill('не тот пароль');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();

  await expect(page.getByRole('main').getByRole('alert')).toContainText('Неверная почта или пароль');
  await expect(page).toHaveURL(/\/login/);
});

test('за Cloudflare Access почта подставлена в поле, но вход всё равно спрашивают', async ({ page }) => {
  await page.setExtraHTTPHeaders({ 'cf-access-authenticated-user-email': 'admin@example.invalid' });
  await page.goto('/login');
  const main = page.getByRole('main');

  await expect(main.getByLabel('Email', { exact: true })).toHaveValue('admin@example.invalid');
  await expect(main).toContainText('Cloudflare Access пропустил admin@example.invalid');
  await expect(main.getByRole('link', { name: 'Выйти из Access' })).toHaveAttribute(
    'href',
    '/cdn-cgi/access/logout',
  );
  await expect(main.getByLabel('Пароль', { exact: true })).toBeVisible();
});

test('после входа экран входа показывает, кто вошёл, и даёт открыть рабочее место', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(EMAIL);
  await page.getByLabel('Пароль', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL(/\/today/);

  await page.goto('/login');
  const main = page.getByRole('main');
  await expect(main).toContainText('Вы вошли');
  await expect(main).toContainText('Дана Тестова');
  await expect(main.getByRole('link', { name: 'Открыть рабочее место' })).toHaveAttribute(
    'href',
    '/today',
  );
  await expect(main.getByRole('button', { name: 'Выйти' })).toBeVisible();
});
