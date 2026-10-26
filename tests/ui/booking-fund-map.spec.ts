import { FIXTURE_API, expect, test } from './fixtures';

/**
 * Окно «Новая бронь», карта фонда (решение владельца 26.10.2026, вариант C «весь фонд одной картой»):
 * слева сначала гость (имя, фамилия, телефон), потом даты; справа все номера всех категорий квадратами, занятые
 * серые и не нажимаются; окно на один экран 1280×800 без прокрутки; нажатие на номер выбирает его для брони.
 */
test('карта фонда: гость слева первым, весь фонд справа без прокрутки, выбор номера и бронь', async ({ page, request }) => {
  test.setTimeout(120_000);
  await request.post(`${FIXTURE_API}/__test/reset`);
  for (const theme of ['light', 'dark'] as const) {
    await page.addInitScript((t) => localStorage.setItem('wetop.theme', t), theme);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/reservations');
    await page.getByRole('link', { name: 'Новая бронь', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Новая бронь' });
    await expect(dialog).toBeVisible();
    const map = dialog.getByTestId('room-picker');
    await expect(map).toBeVisible();
    // гость стоит выше дат
    const name = dialog.getByLabel('Имя *', { exact: true });
    const arrival = dialog.getByLabel('Заезд', { exact: true }).first();
    expect((await name.boundingBox())!.y).toBeLessThan((await arrival.boundingBox())!.y);
    // все категории на карте, у каждой «свободно N из M»
    const rows = map.getByTestId('room-group');
    await expect(rows.first()).toContainText(/свободно \d+ из \d+/);
    const count = await rows.count();
    expect(count).toBeGreaterThan(1);
    // весь фонд виден без прокрутки: последняя категория и кнопка «Создать бронь» внутри экрана
    const last = await rows.nth(count - 1).boundingBox();
    expect(last!.y + last!.height).toBeLessThanOrEqual(800);
    const submit = dialog.getByRole('button', { name: 'Создать бронь', exact: true });
    const sb = await submit.boundingBox();
    expect(sb!.y + sb!.height).toBeLessThanOrEqual(800);
    await page.screenshot({ path: `reports/booking-fund-map-2026-10-26/new-booking-1280-${theme}.png` });
  }
  const dialog = page.getByRole('dialog', { name: 'Новая бронь' });
  const map = dialog.getByTestId('room-picker');
  // занятая ячейка серая и не нажимается, свободная выбирается и попадает в итог
  const free = map.getByRole('button', { name: /^Номер [A-Z0-9]+$/ }).first();
  const label = (await free.getAttribute('aria-label'))!;
  const unit = label.replace('Номер ', '');
  await free.click();
  await expect(free).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog.getByTestId('booking-digest')).toContainText(unit);
  await dialog.getByLabel('Имя *', { exact: true }).fill('Карта');
  await dialog.getByLabel('Фамилия *', { exact: true }).fill('Фонда');
  const submit = dialog.getByRole('button', { name: 'Создать бронь', exact: true });
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page).toHaveURL(/\/reservations\/20260913-NEW\d+$/);
  // после брони этот номер на те же даты уже занят: ячейка отключена
  await page.goto('/reservations/new');
  const again = page.getByTestId('room-picker').getByRole('button', { name: `Номер ${unit}, занят`, exact: true });
  await expect(again).toBeDisabled();
  // телефон: одна колонка, без выхода за экран
  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: 'reports/booking-fund-map-2026-10-26/new-booking-390.png', fullPage: true });
});

test.afterEach(async ({ request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
});
