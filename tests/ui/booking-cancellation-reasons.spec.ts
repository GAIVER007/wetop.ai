import { FIXTURE_API, expect, test } from './fixtures';
const number = '20260913-TESTAA';
const headers = { 'x-wetop-test-client': '1' };

test.beforeEach(async ({ request }) => { await request.post(`${FIXTURE_API}/__test/reset`); });

test('единая отмена предлагает незаезд как причину и сохраняет статус', async ({ page, request }) => {
  await page.goto(`/reservations/${number}#booking-actions`);
  const actions = page.getByTestId('reservation-actions');
  await expect(actions.getByRole('button', { name: 'Незаезд', exact: true })).toHaveCount(0);
  await actions.getByTestId('cancel-stay-ui-item').click();
  const dialog = page.getByRole('dialog', { name: `Отменить бронь ${number}?` });
  await dialog.getByLabel('Причина отмены').selectOption('no_show');
  await expect(dialog.getByTestId('no-show-penalty')).toContainText('Штраф');
  const before = await (await request.get(`${FIXTURE_API}/reservations/${number}`, { headers })).json();
  expect(before.items[0].status).toBe('CONFIRMED');
  await dialog.getByRole('button', { name: 'Подтвердить незаезд', exact: true }).click();
  await expect.poll(async () => (await (await request.get(`${FIXTURE_API}/reservations/${number}`, { headers })).json()).items[0].status).toBe('NO_SHOW');
});

test('закрытие окна отмены сохраняет бронь, подтверждение отменяет', async ({ page, request }) => {
  await page.goto(`/reservations/${number}#booking-actions`);
  const cancel = page.getByTestId('cancel-reservation');
  await cancel.click();
  const dialog = page.getByRole('dialog', { name: `Отменить бронь ${number}?` });
  await expect(dialog.getByLabel('Причина отмены')).toHaveValue('cancel');
  await dialog.getByRole('button', { name: 'Оставить', exact: true }).click();
  const before = await (await request.get(`${FIXTURE_API}/reservations/${number}`, { headers })).json();
  expect(before.status).toBe('CONFIRMED');
  await cancel.click();
  await expect(dialog.getByTestId('cancel-penalty')).toContainText('Штраф');
  await dialog.getByRole('button', { name: 'Подтвердить отмену', exact: true }).click();
  await expect.poll(async () => (await (await request.get(`${FIXTURE_API}/reservations/${number}`, { headers })).json()).status).toBe('CANCELLED');
});
