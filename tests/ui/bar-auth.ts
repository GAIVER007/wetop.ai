import { expect, type Page } from './fixtures';

/** Use the existing synthetic login flow: recovery must have a real fixture owner/session. */
export async function signInForBar(page: Page) {
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
  await expect(page.getByRole('heading', { name: 'Главная', exact: true })).toBeVisible();
}
