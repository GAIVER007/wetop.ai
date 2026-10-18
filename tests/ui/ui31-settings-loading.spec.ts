import { FIXTURE_API, expect, test } from './fixtures';

test('UI3.1: переход в настройки показывает загрузку до ответа API', async ({ page, request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
  // панель кнопки ☰ живёт до 1280 px (решение владельца 18.10.2026)
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto('/hotel-settings');
  await expect(page.locator('#main-content')).toBeVisible();
  await page.goto('/chessboard');
  await request.post(`${FIXTURE_API}/__test/control`, { data: { holdHotel: true } });
  try {
    await page.getByRole('button', { name: 'Открыть меню', exact: true }).click();
    const panel = page.locator('.sidenav__panel');
    await panel.getByRole('button', { name: 'Настройки', exact: true }).click();
    await panel.getByRole('link', { name: 'Объект', exact: true }).click();
    await expect(page.getByTestId('settings-loading')).toBeVisible();
    await expect(page).toHaveURL(/\/hotel-settings$/);
    await expect(panel).toBeHidden();
  } finally {
    await request.post(`${FIXTURE_API}/__test/control`, { data: { holdHotel: false } });
  }
  await expect(page.getByTestId('settings-loading')).toHaveCount(0);
  await expect(page.locator('#main-content')).toBeFocused();
});
