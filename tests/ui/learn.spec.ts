import { FIXTURE_API, expect, test } from './fixtures';

/**
 * «Обучение» (владелец 30.10.2026, вариант B): раздел в меню и в меню профиля, список инструкций, одна инструкция
 * страницами, переключение языка и «Скачать PDF». Стенд, вымышленные данные. Скрины в ZZ_OUT.
 */
const OUT = process.env.ZZ_OUT;
// скрины только при ручном прогоне (ZZ_OUT), на GitHub проверки без файлов
const snap = async (page: import('@playwright/test').Page, name: string, fullPage = false) => {
  if (OUT) await page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
};
test.describe.configure({ timeout: 300_000 });

test('обучение: список, инструкция, язык', async ({ page, request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
  // вход: «Помощь» → блок «Обучение» (строка разделов шапки не растёт)
  await page.goto('/help');
  await page.getByTestId('help-learn').getByRole('link', { name: 'Открыть инструкции', exact: true }).click();
  await page.waitForURL('**/learn');
  const rows = page.getByTestId('learn-row');
  await expect(rows).toHaveCount(4);
  await expect(rows.first()).toContainText('Администратор салона');
  await expect(rows.nth(1)).toContainText('Касса и зарплата');
  await expect(page.locator('.learn-row__cover').first()).toHaveJSProperty('complete', true);
  await snap(page, 'ru-01-list', true);

  await rows.nth(1).click();
  await page.waitForURL('**/learn/cash-payroll');
  await expect(page.getByTestId('learn-pages').locator('img')).toHaveCount(9);
  await expect(page.getByTestId('learn-download')).toHaveAttribute('href', '/guides/ru/cash-payroll.pdf');
  const pdf = await request.get(await page.getByTestId('learn-download').getAttribute('href') as string);
  expect(pdf.headers()['content-type']).toContain('pdf');
  await page.waitForTimeout(800);
  await snap(page, 'ru-02-guide');

  await page.getByRole('link', { name: 'English', exact: true }).click();
  await page.waitForURL('**/learn/cash-payroll?lang=en');
  await expect(page.getByTestId('learn-download')).toHaveAttribute('href', '/guides/en/cash-payroll.pdf');
  await page.waitForTimeout(800);
  await snap(page, 'ru-03-guide-en');

  // телефон: строки в столбик
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/learn');
  await expect(page.getByTestId('learn-row')).toHaveCount(4);
  await snap(page, 'ru-04-phone', true);
});
