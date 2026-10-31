import { FIXTURE_API, expect, test } from './fixtures';

test('UI3.1: переход в настройки показывает загрузку до ответа API', async ({ page, request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
  // панель кнопки ☰ живёт до 1280 px (решение владельца 18.10.2026)
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto('/hotel-settings');
  await expect(page.locator('#main-content')).toBeVisible();
  await page.goto('/chessboard');
  // 31.10.2026: меню «Настройки» ведёт во «Все настройки», «Объект» там карточкой
  // кнопка меню доступна после загрузки скриптов (как у меню профиля)
  await expect(page.getByRole('button', { name: 'Открыть меню', exact: true })).toBeEnabled({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Открыть меню', exact: true }).click();
  const panel = page.locator('.sidenav__panel');
  await panel.getByRole('button', { name: 'Настройки', exact: true }).click();
  await panel.getByRole('link', { name: 'Все настройки', exact: true }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(panel).toBeHidden();
  await request.post(`${FIXTURE_API}/__test/control`, { data: { holdHotel: true } });
  try {
    await page.getByRole('main').getByRole('link', { name: 'Карточка объекта', exact: true }).click();
    await expect(page.getByTestId('settings-loading')).toBeVisible();
    await expect(page).toHaveURL(/\/hotel-settings$/);
  } finally {
    await request.post(`${FIXTURE_API}/__test/control`, { data: { holdHotel: false } });
  }
  await expect(page.getByTestId('settings-loading')).toHaveCount(0);
  // переход ссылкой страницы (не из меню): фокус остаётся у браузера, проверяем, что объект открылся
  await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toHaveText('Настройки объекта');
});
