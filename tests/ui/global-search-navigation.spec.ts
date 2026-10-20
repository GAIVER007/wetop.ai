import { FIXTURE_API, expect, test } from './fixtures';
import { mkdirSync } from 'node:fs';

test.beforeEach(async ({ request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
});

test('поиск гостиницы предлагает гостиничные разделы и открывает календарь', async ({ page }) => {
  await page.goto('/finance');
  await page.getByRole('button', { name: 'Найти гостя или бронь', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Быстрый поиск' });
  await expect(dialog.getByRole('link', { name: 'План зала', exact: true })).toHaveCount(0);
  await expect(dialog.getByRole('link', { name: 'Кухня', exact: true })).toHaveCount(0);
  // The common «Журнал» label must not hide a foreign vertical's destination.
  await expect(dialog.locator('a[href="/floor-plan"], a[href="/calendar"]')).toHaveCount(0);
  // одно меню у всех направлений (17.10.2026): шахматка гостиницы это «Журнал»
  await dialog.getByRole('textbox', { name: 'Запрос' }).fill('Журнал');
  const calendar = dialog.getByRole('link', { name: 'Журнал', exact: true });
  await expect(calendar).toHaveAttribute('href', '/chessboard');
  mkdirSync('reports/navigation-qa-2026-10-11', { recursive: true });
  await page.screenshot({ path: 'reports/navigation-qa-2026-10-11/search-fixed.png' });
  await calendar.click();
  await expect(page).toHaveURL(/\/chessboard$/);
  await expect(dialog).toBeHidden();
});

test('поиск не предлагает закрытый роли журнал', async ({ page, request }) => {
  await request.post(`${FIXTURE_API}/__test/control`, { data: { role: 'STAFF' } });
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
  await page.goto('/finance');
  await page.getByRole('button', { name: 'Найти гостя или бронь', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Быстрый поиск' });
  // журнал операций с 17.10.2026 называется «История действий»
  await dialog.getByRole('textbox', { name: 'Запрос' }).fill('История');
  await expect(dialog.locator('a[href="/journal"], a[href="/audit"]')).toHaveCount(0);
  await expect(dialog).toContainText('Нет разделов с таким названием');
  await dialog.getByRole('textbox', { name: 'Запрос' }).press('Escape');
  await expect(dialog).toBeHidden();
});

test('быстрый поиск это только строка: без выбора вида, кнопки и статичного списка', async ({
  page,
}) => {
  await page.goto('/finance');
  await page.getByRole('button', { name: 'Найти гостя или бронь', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Быстрый поиск' });
  const query = dialog.getByRole('textbox', { name: 'Запрос' });
  await expect(query).toBeFocused();
  await expect(dialog.getByRole('combobox')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Найти', exact: true })).toHaveCount(0);
  await expect(dialog.getByText('Быстрый переход')).toHaveCount(0);
  await expect(dialog.getByRole('link')).toHaveCount(0);
  await query.fill('1042');
  await expect(dialog.getByRole('link', { name: 'Гость: 1042' })).toHaveAttribute(
    'href',
    '/guests?q=1042',
  );
  await expect(dialog.getByRole('link', { name: 'Бронь №1042' })).toHaveAttribute(
    'href',
    '/reservations/1042',
  );
  await query.press('Enter');
  await expect(page).toHaveURL(/\/guests\?q=1042$/);
});
