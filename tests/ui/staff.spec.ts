import { expect, test } from './fixtures';

/**
 * Параллельный раздел /staff (01.10) при интеграции 02.10 заменён «Сотрудниками» TEAM1 (ADR-136):
 * адрес живёт переадресацией на /team, сам экран команды проверяет tests/ui/team.spec.ts,
 * пункт меню — tests/ui/navigation.spec.ts и top-menu.spec.ts.
 */
test.beforeEach(async ({ request }) => {
  await request.post('http://127.0.0.1:4311/__test/reset');
});

test('/staff ведёт на «Сотрудников»: старые ссылки живут', async ({ page }) => {
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
  await page.goto('/staff');
  await expect(page).toHaveURL(/\/team$/);
  await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toHaveText('Сотрудники');
});
