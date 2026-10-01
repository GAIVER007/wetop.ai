import { expect, test } from './fixtures';
test('филиалы: создание, сохранение после reload и обзор', async ({ page, request }) => {
  await request.post('http://127.0.0.1:4311/__test/reset');
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
  await page.getByRole('link', { name: 'Все филиалы', exact: true }).click();
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { name: 'Организация и филиалы' })).toBeVisible();
  await main.locator('summary').filter({ hasText: 'Добавить филиал' }).click();
  await main.getByLabel('Название филиала').fill('Тестовый филиал у парка');
  await main.getByRole('button', { name: 'Добавить филиал', exact: true }).click();
  await expect(main.getByRole('status')).toContainText('Филиал создан');
  await page.reload();
  await expect(main.getByRole('heading', { name: 'Тестовый филиал у парка' })).toBeVisible();
  await expect(main.getByRole('heading', { name: 'Все филиалы', exact: true })).toBeVisible();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `reports/branches-2026-10-01/branches-${width}.png`, fullPage: true });
  }
});
