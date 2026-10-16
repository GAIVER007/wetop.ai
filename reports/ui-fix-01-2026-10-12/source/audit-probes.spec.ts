import { test, expect } from '../../tests/ui/fixtures';
import type { Page } from '@playwright/test';

// Audit-only probes. Synthetic loopback API, no production writes, no application changes.
const API = 'http://127.0.0.1:4311';
async function signIn(page: Page) {
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/finance');
}
test.beforeEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});

test('audit: access structure failure must block invitation rather than remove scope choice', async ({ page, request }) => {
  await signIn(page);
  await request.post(`${API}/__test/control`, { data: { failPath: '/auth/access-structure', failStatus: 503 } });
  await page.goto('/team');
  await expect(page.getByRole('heading', { name: 'Сотрудники и доступ', exact: true })).toBeVisible();
  const invite = page.getByRole('main').getByRole('button', { name: 'Пригласить сотрудника', exact: true });
  if (await invite.isVisible()) await expect(invite).toBeDisabled();
  else await expect(page.getByRole('main').getByRole('alert')).toBeVisible();
});

test('audit: publish must use the text currently confirmed by the editor', async ({ page, request }) => {
  await signIn(page);
  await request.post(`${API}/__test/control`, { data: { platformAdmin: true } });
  await page.goto('/platform/support/base?status=DRAFT');
  await page.getByTestId('kb-catalog').getByRole('link', { name: /только чтение/ }).click();
  const currentText = 'AUDIT synthetic updated knowledge content 2026-10-11';
  const editor = page.getByTestId('kb-entry');
  await editor.getByLabel('Текст знания').fill(currentText);
  await editor.getByRole('button', { name: 'Опубликовать', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Опубликовать', exact: true }).click();
  await expect(page.getByTestId('kb-result')).toContainText('Опубликовано');
  await page.reload();
  await expect(page.getByTestId('kb-entry').getByLabel('Текст знания')).toHaveValue(currentText);
});

test('audit: read-only hotel must disable adding inventory', async ({ page, request }) => {
  await signIn(page);
  await request.post(`${API}/__test/control`, { data: { orgTrialDays: 'ended' } });
  await page.goto('/inventory');
  await expect(page.getByRole('heading', { name: 'Номерной фонд', exact: true })).toBeVisible();
  await expect(page.getByTestId('read-only-banner')).toBeVisible();
  const add = page.getByRole('button', { name: 'Добавить номер', exact: true });
  if (await add.isVisible()) await expect(add).toBeDisabled();
  else await expect(add).toHaveCount(0);
});

test('audit: Hospitality help must not contain salon instructions', async ({ page }) => {
  await signIn(page);
  await page.goto('/help');
  await expect(page.getByRole('heading', { name: 'Помощь', exact: true })).toBeVisible();
  await expect(page.getByRole('main')).not.toContainText('Начало работы в салоне');
});
