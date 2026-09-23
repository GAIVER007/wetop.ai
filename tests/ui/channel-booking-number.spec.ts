import { expect, test } from './fixtures';

/**
 * ADR-071: ручная бронь OTA несёт канал и номер брони в канале. По номеру WETOP узнает бронь, когда канал
 * подключат к Channex, и не создаст вторую. Поля появляются только у источника OTA.
 */
const fixture = 'http://127.0.0.1:4311';

test('новая бронь OTA: канал и номер брони в канале обязательны и уходят в API', async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/control`, { data: {} });
  await page.goto('/reservations/new?unit=M03');
  const form = page.getByTestId('new-reservation-form');
  await form.locator('[name="source"]').selectOption('PHONE');
  await expect(form.locator('[name="externalId"]')).toHaveCount(0);
  await form.locator('[name="source"]').selectOption('OTA');
  await expect(form.getByTestId('channel-number-hint')).toContainText('из экстранета');
  await form.locator('[name="channel"]').selectOption('Booking.com');
  await form.locator('[name="externalId"]').fill('999 601 3801');
  await form.getByLabel('Имя *', { exact: true }).fill('Канал');
  await form.getByLabel('Фамилия *', { exact: true }).fill('Тест');
  await form.getByRole('button', { name: 'Создать бронь' }).click();
  await expect(page).toHaveURL(/\/reservations\/20260913-NEW\d+$/);
  const commands = (await (await request.get(`${fixture}/__test/commands`)).json()) as Array<{
    path: string;
    body: Record<string, unknown>;
  }>;
  expect(commands.filter((c) => c.path === '/reservations').at(-1)?.body).toMatchObject({
    source: 'OTA',
    channel: 'Booking.com',
    externalId: '999 601 3801',
  });
});
