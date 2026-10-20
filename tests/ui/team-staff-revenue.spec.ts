import AxeBuilder from '@axe-core/playwright';
import { FIXTURE_API, expect, test } from './fixtures';

/**
 * «Сколько принёс» гостиницы в «Персонал → Сотрудники» (решение владельца 20.10.2026,
 * docs/decisions/2026-10-20-personnel-revenue.md): по создавшему бронь, брони из каналов и сайта отдельной строкой.
 */
test.describe.configure({ timeout: 180_000 });
test.beforeEach(async ({ request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
});

test('колонка «Принёс» и переключатель периода у сотрудников гостиницы', async ({ page }) => {
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
  await page.goto('/team');
  const main = page.getByRole('main');
  const table = main.getByTestId('team-table');
  await expect(table.locator('thead')).toContainText('Принёс сегодня');
  const yuri = table.getByTestId('member-row').filter({ hasText: 'Юрий Тестов' });
  await expect(yuri.getByTestId('member-earned')).toHaveText('25 000 ₸');
  const marat = table.getByTestId('member-row').filter({ hasText: 'Марат Тестов' });
  await expect(marat.getByTestId('member-earned')).toHaveText('—');
  await expect(main.getByTestId('team-unattributed')).toHaveText('Брони из каналов и сайта: 12 000 ₸');
  // плитки: деньги команды и рост к вчера, лучший сотрудник с долей, возвраты
  const stats = main.getByTestId('team-stats');
  await expect(stats.getByTestId('staff-total')).toHaveText('37 000 ₸');
  await expect(stats).toContainText('+25 % к вчера');
  await expect(stats.getByTestId('staff-best')).toHaveText('Юрий Тестов');
  await expect(stats).toContainText('25 000 ₸, 68 % от всех денег');
  await expect(stats.getByTestId('staff-refunds')).toHaveText('5 000 ₸');
  await expect(stats).not.toContainText('На смене');
  await main.getByRole('navigation', { name: 'Период для «Принёс»' }).getByRole('link', { name: 'Месяц' }).click();
  await expect(page).toHaveURL(/\/team\?period=month$/, { timeout: 90_000 });
  await expect(table.locator('thead')).toContainText('Принёс за месяц');
  await expect(yuri.getByTestId('member-earned')).toHaveText('500 000 ₸');
  // все действия строки видны целиком, ни одно не обрезано краем таблицы
  const tableBox = (await table.boundingBox())!;
  for (const button of await marat.locator('.team-row-actions button:visible').all()) {
    const box = (await button.boundingBox())!;
    expect(box.x + box.width, await button.innerText()).toBeLessThanOrEqual(tableBox.x + tableBox.width + 1);
  }
  // действия строки в один ряд: «Изменить», «Доступ» и меню «⋯» с «Приостановить» и «Отключить»
  await expect(marat.locator('.team-row-actions button:visible')).toHaveText(['Изменить', 'Доступ', '']);
  const rowBox = (await marat.boundingBox())!;
  expect(rowBox.height).toBeLessThan(70);
  await page.screenshot({ path: 'reports/personnel-kind-2026-10-20/team-earned-1440.png', fullPage: true });
  const audit = await new AxeBuilder({ page }).include('main').analyze();
  expect(audit.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'reports/personnel-kind-2026-10-20/team-earned-390.png', fullPage: true });
});
