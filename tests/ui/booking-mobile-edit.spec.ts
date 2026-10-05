import { mkdirSync } from 'node:fs';
import { FIXTURE_API, expect, test } from './fixtures';

test.beforeEach(async ({ request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
});

test('guest editing is explicit and stays inside the mobile booking', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/reservations/20260913-TESTAA');
  const original = page.url();
  await page.getByRole('button', { name: 'Изменить гостя', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Данные гостя', exact: true });
  await expect(editor).toBeVisible();
  await expect(editor.getByTestId('guest-form')).toBeVisible();
  await expect(page).toHaveURL(original);
  await editor.locator('[name="citizenship"]').fill('KGZ');
  await editor.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByTestId('booking-head')).toContainText('гражданство KGZ');
  await editor.getByRole('button', { name: 'Закрыть: Данные гостя', exact: true }).click();
  await expect(editor).not.toBeVisible();
  await expect(page.getByTestId('booking-head')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('booking-head')).toContainText('гражданство KGZ');
  const actions = page.getByTestId('booking-next');
  expect(await actions.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  for (const button of await actions.locator('a').all()) {
    expect(await button.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  }
  mkdirSync('reports/booking-price-mobile-2026-10-05', { recursive: true });
  await page.screenshot({ path: 'reports/booking-price-mobile-2026-10-05/booking-390.png' });
});

for (const [width, height] of [
  [320, 740],
  [390, 844],
  [768, 1024],
  [1440, 900],
] as const) {
  test(`essential new booking controls fit ${width}x${height}`, async ({ page, request }) => {
    await request.post(`${FIXTURE_API}/__test/control`, { data: { piiStorage: 'pseudonymized' } });
    await page.addInitScript(() => localStorage.setItem('wetop.theme', 'dark'));
    await page.setViewportSize({ width, height });
    await page.goto('/reservations');
    await page.getByRole('link', { name: 'Новая бронь', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Новая бронь', exact: true });
    const submit = dialog.getByRole('button', { name: 'Создать бронь', exact: true });
    await expect(submit).toBeEnabled();
    const bounds = await submit.boundingBox();
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(height);
    const room = dialog.getByRole('combobox', { name: 'Номер / койка', exact: true });
    await expect(room).toBeVisible();
    const roomBounds = await room.boundingBox();
    expect(roomBounds!.y + roomBounds!.height).toBeLessThan(bounds!.y);
    expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    expect(
      await dialog
        .locator('.overlay-content')
        .evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
    ).toBe(true);
    mkdirSync('reports/booking-price-mobile-2026-10-05', { recursive: true });
    await page.screenshot({ path: `reports/booking-price-mobile-2026-10-05/new-${width}.png` });
  });
}

test('Escape closes the guest editor without closing the booking drawer', async ({ page }) => {
  await page.goto('/reservations');
  await page.getByRole('link', { name: 'Открыть бронь 20260913-TESTAA', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'Бронирование', exact: true });
  await drawer.getByRole('button', { name: 'Изменить гостя', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Данные гостя', exact: true });
  await expect(editor.getByTestId('guest-form')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(editor).not.toBeVisible();
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole('button', { name: 'Изменить гостя', exact: true })).toBeFocused();
});

test('read-only booking does not allow guest editing', async ({ page, request }) => {
  await request.post(`${FIXTURE_API}/__test/control`, { data: { orgTrialDays: 'ended' } });
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
  await page.goto('/reservations/20260913-TESTAA');
  await expect(page.getByRole('button', { name: 'Изменить гостя', exact: true })).toBeDisabled();
});

test.afterEach(async ({ request }) => {
  await request.post(`${FIXTURE_API}/__test/control`, { data: {} });
});
