import { mkdirSync } from 'node:fs';
import { FIXTURE_API, expect, test } from './fixtures';

/** Вход и филиал гостиницы стенда (DEFAULT_FIXTURE_BRANCH): «График» и «Зарплата» гостиницы работают в филиале */
async function openHotelBranch(page: import('@playwright/test').Page) {
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
  await page.context().addCookies([
    {
      name: 'wetop_scope',
      value: encodeURIComponent('business=33333333-3333-4333-8333-333333333333;location=22222222-2222-4222-8222-222222222222'),
      url: new URL(page.url()).origin,
      httpOnly: true,
    },
  ]);
}

/**
 * «График работы» гостиницы (владелец 31.10.2026: «добавь выбор месяца, чтобы видеть график на следующую неделю,
 * удобный выбор, и в салонах, и в гостиницах»): ‹ неделя ›, «Эта неделя», «Следующая», месяц списком; даты в шапке,
 * отсутствие на выбранной неделе отмечено. Данные стенда вымышленные.
 */
test('график гостиницы: следующая неделя, месяц и отсутствие на неделе', async ({ page, request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
  await page.setViewportSize({ width: 1280, height: 800 });
  await openHotelBranch(page);
  await page.goto('/staff-schedule');
  const main = page.getByRole('main');
  const week = main.getByRole('navigation', { name: 'Неделя', exact: true });
  await expect(week.getByRole('link', { name: 'Эта неделя', exact: true })).toHaveAttribute('aria-current', 'page');
  const range = await main.getByTestId('beauty-week-range').textContent();
  await week.getByRole('link', { name: 'Следующая', exact: true }).click();
  await expect(page).toHaveURL(/\/staff-schedule\?week=\d{4}-\d{2}-\d{2}$/);
  await expect(main.getByTestId('beauty-week-range')).not.toHaveText(range ?? '');
  await expect(week.getByRole('link', { name: 'Следующая', exact: true })).toHaveAttribute('aria-current', 'page');
  const grid = main.getByTestId('hotel-shifts');
  // в среду выбранной недели у первой горничной отсутствие
  await expect(grid.getByRole('row', { name: /Айгерим/ })).toContainText('Отсутствует');
  await expect(grid.getByRole('columnheader').nth(1)).toHaveText(/^Пн \d{1,2}$/);
  // месяц списком: неделя с 1-м числом выбранного месяца
  const month = week.getByRole('combobox', { name: 'Месяц', exact: true });
  const options = await month.locator('option').evaluateAll((o) => o.map((x) => (x as HTMLOptionElement).value));
  await month.selectOption(options.at(-1)!);
  await expect(page).toHaveURL(/\?week=\d{4}-\d{2}-\d{2}$/);
  await expect(month).toHaveValue(options.at(-1)!);
  await week.getByRole('link', { name: 'Эта неделя', exact: true }).click();
  await expect(main.getByTestId('beauty-week-range')).toHaveText(range ?? '');
  if (process.env.SCHEDULE_SHOTS) {
    mkdirSync(process.env.SCHEDULE_SHOTS, { recursive: true });
    await page.screenshot({ path: `${process.env.SCHEDULE_SHOTS}/hotel-schedule-1280.png` });
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});
