import { expect, test, type Page } from './fixtures';

/**
 * Пробный период 14 дней и «только чтение» после него (Q-144 — Б, Q-141 — А, ADR-102). Стойка показывает полосу на
 * каждом экране, вход не закрыт; главный администратор подтверждает оплату в «Платформа → Организации».
 * Сам запрет записи проверяет API (`apps/api/src/auth/auth.guard.test.ts`), здесь — что видит человек.
 */
const API = 'http://127.0.0.1:4311';

test.beforeEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});
test.afterEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
}

test('пробный срок вышел — полоса «оплатите подписку» на рабочих экранах; в срок её нет', async ({ page, request }) => {
  await request.post(`${API}/__test/control`, { data: { orgTrialDays: 10 } });
  await signIn(page);
  await expect(page.getByTestId('read-only-banner')).toHaveCount(0);

  await request.post(`${API}/__test/control`, { data: { orgTrialDays: 'ended' } });
  for (const path of ['/today', '/chessboard', '/reservations']) {
    await page.goto(path);
    const banner = page.getByTestId('read-only-banner');
    await expect(banner).toContainText('Пробный период закончился — оплатите подписку');
    await expect(banner).toContainText('Данные доступны для просмотра');
  }
  await page.goto('/today');
  await page.screenshot({ path: 'test-results/trial-read-only-banner.png' });
});

test('главный администратор: «Оплата получена» — организация работает; «Только чтение» — обратно', async ({
  page,
  request,
}) => {
  await request.post(`${API}/__test/control`, { data: { platformAdmin: true } });
  await signIn(page);
  await page.goto('/platform?org=ui-org-2');
  const form = page.getByTestId('platform-status-form');
  await expect(form).toBeVisible();
  await form.getByLabel('Заметка — номер счёта').fill('Счёт № 1, WETOP Core');
  await form.getByTestId('platform-status-active').click();
  await expect(form.getByTestId('platform-status-result')).toContainText('Оплата подтверждена');
  await expect(page.getByTestId('platform-organization')).toContainText('работает');
  await page.screenshot({ path: 'test-results/trial-platform-paid.png', fullPage: true });

  await page.getByTestId('platform-status-form').getByTestId('platform-status-readonly').click();
  await expect(page.getByTestId('platform-organization')).toContainText('только чтение');
});
