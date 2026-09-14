import { expect, test } from '@playwright/test';

/**
 * Вход на app.wetop.ai (plans/wetop-domain-2026-09-14.md §3, Д5): стойку закрывает Cloudflare Access, а PMS своих
 * паролей не хранит. Access передаёт почту вошедшего заголовком cf-access-authenticated-user-email — экран входа
 * показывает её и даёт выйти, а не форму пароля, которая ничего не делает.
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

test('без Access (локально на Mac) экран входа прежний и честно говорит, что вход не подключён', async ({
  page,
}) => {
  await page.goto('/login');
  await expect(page.getByRole('main')).toContainText('Авторизация пока не подключена');
});
