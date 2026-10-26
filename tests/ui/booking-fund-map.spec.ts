import { FIXTURE_API, expect, test } from './fixtures';

/**
 * Окно «Новая бронь» (владелец 26.10.2026): правая часть как была (свободные номера кнопками по категориям), слева
 * сначала гость, потом даты; при одном размещении категорию и номер ставит кнопка справа, полей слева не видно.
 */
test('новая бронь: гость слева первым, номер кнопкой справа, бронь создаётся', async ({ page, request }) => {
  test.setTimeout(120_000);
  await request.post(`${FIXTURE_API}/__test/reset`);
  for (const theme of ['light', 'dark'] as const) {
    await page.addInitScript((t) => localStorage.setItem('wetop.theme', t), theme);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/reservations');
    await page.getByRole('link', { name: 'Новая бронь', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Новая бронь' });
    await expect(dialog.getByTestId('room-picker')).toBeVisible();
    const name = dialog.getByLabel('Телефон или имя *', { exact: true });
    const arrival = dialog.getByLabel('Заезд', { exact: true }).first();
    expect((await name.boundingBox())!.y).toBeLessThan((await arrival.boundingBox())!.y);
    // категория и номер не занимают место слева: их ставит кнопка справа
    await expect(dialog.getByRole('combobox', { name: 'Номер / койка', exact: true })).not.toBeInViewport();
    const submit = dialog.getByRole('button', { name: 'Создать бронь', exact: true });
    const sb = await submit.boundingBox();
    expect(sb!.y + sb!.height).toBeLessThanOrEqual(800);
    await page.screenshot({ path: `reports/booking-fund-map-2026-10-26/new-booking-1280-${theme}.png` });
  }
  const dialog = page.getByRole('dialog', { name: 'Новая бронь' });
  const room = dialog.getByTestId('room-picker').getByRole('button', { name: /^Номер [A-Z0-9]+$/ }).first();
  const unit = (await room.getAttribute('aria-label'))!.replace('Номер ', '');
  await room.click();
  await expect(room).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog.getByTestId('booking-digest')).toContainText(unit);
  await dialog.getByLabel('Телефон или имя *', { exact: true }).fill('Кнопка Справа');
  const submit = dialog.getByRole('button', { name: 'Создать бронь', exact: true });
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page).toHaveURL(/\/reservations\/20260913-NEW\d+$/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/reservations/new');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: 'reports/booking-fund-map-2026-10-26/new-booking-390.png', fullPage: true });
});

test.afterEach(async ({ request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
});
