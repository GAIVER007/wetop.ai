import { FIXTURE_API, expect, test } from './fixtures';

/**
 * Потоковый редирект Next (корневой `app/loading.tsx` начинает отдачу раньше, чем страница зовёт `redirect()`):
 * Next кладёт в документ `<meta id="__next-page-redirect" http-equiv="refresh">`, и браузер переходит на цель уже
 * ПОСЛЕ события `load`. `goto` возвращался на исходном адресе, а следующий `goto` обрывал этот отложенный переход:
 * `net::ERR_ABORTED` (profile-menu-readiness, system-screens, roles, 12.10.2026). Корень `/` гостиницы уводит на `/today` именно так.
 */
test('goto на адрес с потоковым редиректом отдаёт конечную страницу, следующий goto не обрывается', async ({
  page,
  request,
}) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Главная', exact: true })).toBeVisible();
  await page.goto('/');
  // без автоожидания: адрес сразу после goto
  expect(new URL(page.url()).pathname).toBe('/today');
  await expect(page.locator('meta#__next-page-redirect')).toHaveCount(0);
  await page.goto('/chessboard', { waitUntil: 'commit' });
  await expect(page).toHaveURL(/\/chessboard/);
});
