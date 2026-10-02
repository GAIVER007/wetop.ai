import { expect, test } from './fixtures';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ request, page }) => {
  await request.post('http://127.0.0.1:4311/__test/reset');
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
});

test('сотрудники: приглашение управляющего сохраняется после перезагрузки и сразу отзывается', async ({
  page,
}) => {
  await page.goto('/staff');
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { name: 'Сотрудники', exact: true })).toBeVisible();
  await expect(page.locator('.workspace-header .topmenu a[href="/staff"]')).toHaveCount(1);
  await main.getByLabel('Почта приглашённого').fill('new.team@example.com');
  await main.getByLabel('Роль приглашённого').selectOption('MANAGER');
  await expect(main.locator('.team-role-help')).toContainText('Права владельца не передаются');
  await main.getByRole('button', { name: 'Отправить приглашение' }).click();
  const row = main.getByTestId('invite-list').locator('li', { hasText: 'new.team@example.com' });
  await expect(row.getByRole('button', { name: 'Отозвать' })).toBeVisible();
  await row.getByRole('button', { name: 'Отозвать' }).click();
  await expect(row).toHaveCount(0);
  await main.getByLabel('Почта приглашённого').fill('new.team@example.com');
  await main.getByRole('button', { name: 'Отправить приглашение' }).click();
  await page.reload();
  await expect(row).toContainText('управляющий');
  await row.getByRole('button', { name: 'Отозвать' }).click();
  await expect(row).toHaveCount(0);
  await page.reload();
  await expect(row).toHaveCount(0);
});

test('сотрудники: компактный экран и доступность на desktop и mobile', async ({ page }) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/staff');
    await expect(
      page.getByRole('main').getByRole('button', { name: 'Отправить приглашение' }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    const result = await new AxeBuilder({ page }).include('main').analyze();
    expect(result.violations).toEqual([]);
    await page.screenshot({ path: `reports/staff-2026-10-01/staff-${width}.png`, fullPage: false });
  }
});

test('администратор не получает список сотрудников по прямому адресу', async ({
  page,
  request,
}) => {
  await request.post('http://127.0.0.1:4311/__test/control', { data: { role: 'STAFF' } });
  await page.goto('/staff');
  await expect(page.getByTestId('team')).toHaveCount(0);
  await expect(page.locator('.workspace-header .topmenu a[href="/staff"]')).toHaveCount(0);
});

test('выбор роли показывает конкретные разрешения', async ({ page }) => {
  await page.goto('/staff');
  const form = page.locator('.team-invite-form');
  const refunds = form.locator('.role-access > div', {
    hasText: 'Возвраты и уменьшение начислений',
  });
  await expect(refunds).toContainText('Недоступно');
  await expect(
    form.locator('.role-access > div', { hasText: 'Финансы и аналитика' }),
  ).toContainText('Просмотр');
  await form.getByLabel('Роль приглашённого').selectOption('MANAGER');
  await expect(refunds).toContainText('Доступно');
  await expect(
    form.locator('.role-access > div', { hasText: 'Управляющие и платные расширения' }),
  ).toContainText('Недоступно');
});

test('навигация разделяет задачи и сохраняет единый экран подключения', async ({ page }) => {
  await page.goto('/today');
  const nav = page.locator('.workspace-header .topmenu');
  await expect(nav.getByRole('button', { name: 'Контроль', exact: true })).toHaveCount(0);
  await expect(nav.getByRole('link', { name: 'Главная', exact: true })).toBeVisible();
  await expect(nav.locator('a[href="/finance"]')).toBeVisible();
  await expect(nav.locator('a[href="/management/analytics"]')).toBeVisible();
  await page.goto('/channels/connections');
  await expect(page).toHaveURL(/\/connections\/channex$/);
  await expect(page.getByTestId('channel-connection')).toBeVisible();
});
