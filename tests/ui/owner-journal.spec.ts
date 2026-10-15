import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
import { FIXTURE_API, expect, test } from './fixtures';

test.beforeEach(async ({ request, page }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
});

test('владелец: вкладка, суммы, было/стало, фильтры и вся история', async ({ page, request }) => {
  await request.post(`${FIXTURE_API}/__test/control`, { data: { journalFinance: true } });
  await page.goto('/team');
  await page.getByRole('main').getByRole('link', { name: 'Журнал операций', exact: true }).click();
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { level: 1 })).toHaveText('Журнал операций');
  await expect(main.getByTestId('journal-row')).toHaveCount(50);
  const first = main.getByTestId('journal-row').first();
  await expect(first).toContainText('Тестовый кассир');
  await expect(first).toContainText('1 500,50 ₸');
  await first.getByText('Подробности операции').click();
  await expect(first.getByRole('table', { name: 'Изменения операции' })).toContainText(
    'Отмена',
  );
  await expect(first).toContainText('Наличные');
  await main.getByRole('link', { name: 'Более ранние операции' }).click();
  await expect(main.getByTestId('journal-row')).toHaveCount(15);
  await main.getByRole('link', { name: 'К новым операциям' }).click();
  await main.getByText('Фильтры журнала', { exact: true }).click();
  await main.getByLabel('Действие', { exact: true }).selectOption('finance.cash.operation.void');
  await main
    .getByLabel('Сотрудник', { exact: true })
    .selectOption('11111111-1111-4111-8111-111111111111');
  await main.getByRole('button', { name: 'Найти', exact: true }).click();
  await expect(main.getByTestId('journal-row')).toHaveCount(1);
  await main.getByTestId('journal-row').getByText('Подробности операции').click();
  mkdirSync('reports/staff-owner-journal-2026-10-05', { recursive: true });
  await page.screenshot({
    path: 'reports/staff-owner-journal-2026-10-05/desktop.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: 'reports/staff-owner-journal-2026-10-05/mobile.png',
    fullPage: true,
  });
  expect(await page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')).toBe(true);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({
    path: 'reports/staff-owner-journal-2026-10-05/mobile-dark.png',
    fullPage: true,
  });
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
});

for (const role of ['MANAGER', 'STAFF'] as const) {
  test(`${role}: журнал скрыт и прямой адрес закрыт`, async ({ page, request }) => {
    await request.post(`${FIXTURE_API}/__test/control`, { data: { role } });
    await page.goto('/team');
    await expect(
      page.getByRole('main').getByRole('link', { name: 'Журнал операций', exact: true }),
    ).toHaveCount(0);
    await page.goto('/journal');
    await expect(page.getByRole('main').getByTestId('journal-table')).toHaveCount(0);
    await expect(page.getByRole('main')).toContainText('владельц');
  });
}
