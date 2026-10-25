import { FIXTURE_API, test, expect } from './fixtures';
test('C-P1-1: failed access structure blocks invitations', async ({ page, request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
  await request.post(`${FIXTURE_API}/__test/control`, {
    data: { failPath: '/auth/access-structure', failStatus: 503 },
  });
  await page.goto('/team');
  await expect(page.getByTestId('team-invite')).toBeDisabled();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('структуру доступа');
  await page.keyboard.press('Enter');
  const hits = await (await request.get(`${FIXTURE_API}/__test/hits`)).json();
  expect(hits.byRequest['POST /auth/invites'] ?? 0).toBe(0);
});

test('C-P1-1: recovery allows explicit organization scope', async ({ page, request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
  await request.post(`${FIXTURE_API}/__test/control`, {
    data: { failPath: '/auth/access-structure', failStatus: 503 },
  });
  await page.goto('/team');
  await expect(page.getByTestId('team-invite')).toBeDisabled();
  await request.post(`${FIXTURE_API}/__test/control`, { data: { failPath: null } });
  await page.getByRole('button', { name: 'Повторить загрузку', exact: true }).click();
  await expect(page.getByTestId('team-invite')).toBeEnabled();
  await page.getByTestId('team-invite').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Имя', { exact: true }).fill('Тестовый');
  await dialog.getByLabel('Почта для входа').fill('ui-fix-01@example.invalid');
  await dialog.getByRole('button', { name: 'Отправить приглашение' }).click();
  await expect(page.getByTestId('invite-list')).toContainText('ui-fix-01@example.invalid');
});

test('C-P1-1 malformed successful response does not allow a broad invitation', async ({
  page,
  request,
}) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
  await request.post(`${FIXTURE_API}/__test/control`, {
    data: { failPath: '/auth/access-structure', failStatus: 200 },
  });
  await page.goto('/team');
  await expect(page.getByTestId('team-invite')).toBeDisabled();
  const hits = await (await request.get(`${FIXTURE_API}/__test/hits`)).json();
  expect(hits.byRequest['POST /auth/invites'] ?? 0).toBe(0);
});

test('scope switch closes the old invitation and blocks commands until recovery', async ({
  page,
  request,
}) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
  await page.goto('/team');
  await page.getByTestId('team-invite').click();
  const form = page.locator('form.team-invite-form');
  await expect(form).toBeVisible();
  await form.getByLabel('Имя', { exact: true }).fill('Тестовый');
  await form.getByLabel('Почта для входа').fill('switch-pending@example.invalid');
  await page.evaluate(() => window.dispatchEvent(new Event('wetop-scope-switch')));
  await expect(form).not.toBeVisible();
  await expect(form).toHaveCount(0);
  await expect(page.getByTestId('team-invite')).toBeDisabled();
  await page.keyboard.press('Enter');
  const hits = await (await request.get(`${FIXTURE_API}/__test/hits`)).json();
  expect(hits.byRequest['POST /auth/invites'] ?? 0).toBe(0);
  await page.evaluate(() => window.dispatchEvent(new Event('wetop-scope-switch-failed')));
  await expect(page.getByTestId('team-invite')).toBeEnabled();
});
