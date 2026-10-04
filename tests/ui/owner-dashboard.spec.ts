import { expect, test } from './fixtures';

/*
 * Главная владельца (03.10.2026, поручение владельца со снимком «Статистики» прежней PMS): сверху три
 * виджета «на сегодня», ниже деньги и аналитика за период. Кнопок смены («Новая бронь», «Работа с
 * гостями») и плитки «Расходы бизнеса» без учёта расходов на экране нет.
 */
const fixture = process.env['UI_FIXTURE_API'] ?? 'http://127.0.0.1:4311';

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});
test('owner dashboard: today widgets and money, no desk buttons, no expenses tile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/today');
  const main = page.getByRole('main');
  for (const name of ['Загрузка на сегодня', 'Гости сегодня', 'Состояние номеров'])
    await expect(main.getByRole('article', { name })).toBeVisible();
  await expect(main.getByTestId('owner-paid')).toBeVisible();
  await expect(main.getByTestId('owner-adr')).toBeVisible();
  await expect(main.getByTestId('owner-expenses')).toHaveCount(0);
  await expect(main.getByRole('link', { name: /Новая бронь/ })).toHaveCount(0);
  await expect(main.getByRole('link', { name: 'Все филиалы' })).toHaveCount(0);
  await expect(main.getByRole('button', { name: 'Работа с гостями' })).toHaveCount(0);
  // деньги по умолчанию за месяц: «сегодня» уже показывают виджеты сверху
  await expect(page.getByRole('link', { name: 'Месяц', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await page.screenshot({ path: 'reports/owner-home-2026-10-03/desktop.png', fullPage: true });
});
test('dashboard period changes and mobile retains content', async ({ page }) => {
  await page.goto('/today');
  await page.getByRole('link', { name: '7 дней', exact: true }).click();
  await expect(page).toHaveURL(/period=week/);
  await expect(page.getByTestId('owner-paid')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate('document.documentElement.scrollWidth-innerWidth'),
  ).toBeLessThanOrEqual(1);
});

test('owner dashboard keeps operations visible when finance fails', async ({ page, request }) => {
  await request.post(`${fixture}/__test/control`, {
    data: { failPath: '/desk/dashboard' },
  });
  await page.goto('/today');
  await expect(
    page.getByText('Финансовая аналитика не загрузилась.', { exact: false }),
  ).toBeVisible();
  await expect(page.getByTestId('owner-guests')).toBeVisible();
  await expect(page.getByTestId('owner-paid')).toHaveCount(0);
});

test('owner dashboard dark desktop and mobile remain usable', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/today?period=week');
  await expect(page.getByTestId('owner-paid')).toBeVisible();
  await page.screenshot({ path: 'reports/owner-home-2026-10-03/desktop-dark.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  // на телефоне первым экраном — загрузка дня
  await expect(page.getByRole('article', { name: 'Загрузка на сегодня' })).toBeInViewport();
  await page.getByRole('button', { name: 'Требуют внимания', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Требуют внимания', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.screenshot({ path: 'reports/owner-home-2026-10-03/mobile-dark.png', fullPage: true });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.screenshot({ path: 'reports/owner-home-2026-10-03/mobile.png', fullPage: true });
});
