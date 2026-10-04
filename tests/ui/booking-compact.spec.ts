import { expect, test } from './fixtures';

test('быстрые даты сохраняют гостя, заметки и позволяют создать бронь', async ({
  page,
  request,
}) => {
  // чистый стенд: бронь соседнего спека на M03 заняла бы эти даты, и форма не дала бы создать эту
  await request.post('http://127.0.0.1:4311/__test/reset');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/reservations/new?unit=M03');
  const form = page.getByTestId('new-reservation-form');
  await form.getByLabel('Имя *', { exact: true }).fill('Компакт');
  await form.getByLabel('Фамилия *', { exact: true }).fill('Тест');
  await form.getByText('Дополнительно', { exact: true }).click();
  await form.getByLabel('Заметки', { exact: true }).fill('Тестовая заметка');
  await form.getByRole('button', { name: '3 ночи', exact: true }).click();
  await expect(form.getByTestId('availability')).toContainText('3 ночи');
  await expect(form.getByLabel('Имя *', { exact: true })).toHaveValue('Компакт');
  await expect(form.getByLabel('Заметки', { exact: true })).toHaveValue('Тестовая заметка');
  await form.getByText('Дополнительно', { exact: true }).click();
  const submit = form.getByRole('button', { name: 'Создать бронь', exact: true });
  await expect(submit).toBeEnabled();
  const box = await submit.boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(900);
  await page.screenshot({ path: 'reports/booking-compact-desktop.png' });
  await submit.click();
  await expect(page).toHaveURL(/\/reservations\/20260913-NEW\d+$/);
});

test('боковое окно компактно, псевдонимная бронь и мобильный экран', async ({ page, request }) => {
  await request.post('http://127.0.0.1:4311/__test/control', {
    data: { piiStorage: 'pseudonymized' },
  });
  await page.addInitScript(() => localStorage.setItem('wetop.theme', 'dark'));
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/reservations');
  await page.getByRole('link', { name: 'Новая бронь', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Новая бронь' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Новая бронь', exact: true })).toHaveCount(1);
  await expect(dialog.getByText(/Пока база WETOP/)).toHaveCount(0);
  const submit = dialog.getByRole('button', { name: 'Создать бронь', exact: true });
  await expect(submit).toBeEnabled();
  const box = await submit.boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(768);
  await page.screenshot({ path: 'reports/booking-compact-drawer.png' });
  await dialog.getByLabel('Выезд', { exact: true }).fill('2020-01-01');
  await expect(submit).toBeDisabled();
  await dialog.getByRole('button', { name: 'Завтра', exact: true }).click();
  await expect(submit).toBeEnabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(dialog).toBeVisible();
  const overflow = await dialog.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
  await page.screenshot({ path: 'reports/booking-compact-mobile.png' });
  expect(overflow).toBe(false);
  await submit.click();
  await expect(page).toHaveURL(/\/reservations\/20260913-NEW\d+$/);
});

test.afterEach(async ({ request }) => {
  await request.post('http://127.0.0.1:4311/__test/control', { data: {} });
});

test('пустой филиал не позволяет создать бронь без категории', async ({ page, request }) => {
  await request.post('http://127.0.0.1:4311/__test/control', { data: { empty: true } });
  await page.goto('/reservations/new');
  await expect(page.getByTestId('availability')).toContainText(/свободно|Не удалось/);
  await expect(page.getByRole('button', { name: 'Создать бронь', exact: true })).toBeDisabled();
  await expect(
    page.getByText('Сначала добавьте категории и номера в разделе «Номерной фонд».', {
      exact: true,
    }),
  ).toBeVisible();
});
