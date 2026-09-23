import { expect, test } from './fixtures';

/**
 * ADR-072: пока база не в Казахстане, WETOP не хранит имя, контакты, заметки и документы гостя. Формы стойки их
 * не спрашивают — режим читается у API заранее (`/system/pii-storage`), а не узнаётся отказом после ввода.
 * Фикстура по умолчанию отдаёт `real` (как в базе в РК), здесь переключается на `pseudonymized`.
 */
const fixture = 'http://127.0.0.1:4311';

test.afterEach(async ({ request }) => {
  await request.post(`${fixture}/__test/control`, { data: {} });
});

test('новая бронь без имени и контактов: объяснение на месте, бронь создаётся', async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/control`, { data: { piiStorage: 'pseudonymized' } });
  await page.goto('/reservations/new?unit=M03');
  const form = page.getByTestId('new-reservation-form');
  await expect(form.getByTestId('guest-pseudonymized')).toContainText('не в Казахстане');
  for (const name of ['firstName', 'lastName', 'middleName', 'email', 'phone'])
    await expect(form.locator(`[name="${name}"]`)).toHaveCount(0);
  await expect(form.getByTestId('booking-summary')).toContainText('без имени');
  await form.locator('[name="source"]').selectOption('PHONE');
  await form.getByRole('button', { name: 'Создать бронь' }).click();
  await expect(page).toHaveURL(/\/reservations\/20260913-NEW\d+$/);
  const commands = (await (await request.get(`${fixture}/__test/commands`)).json()) as Array<{
    path: string;
    body: { guest?: Record<string, unknown> };
  }>;
  const guest = commands.filter((c) => c.path === '/reservations').at(-1)?.body.guest ?? {};
  expect(guest['firstName']).toBeUndefined();
  expect(guest['lastName']).toBeUndefined();
});

test('карточка гостя: меняются только гражданство и пол, документы не вносятся', async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/control`, { data: { piiStorage: 'pseudonymized' } });
  await page.goto('/guests/ui-guest');
  const form = page.getByTestId('guest-form');
  await expect(form.getByTestId('guest-pseudonymized')).toContainText('не в Казахстане');
  for (const name of [
    'firstName',
    'lastName',
    'middleName',
    'birthDate',
    'phone',
    'email',
    'notes',
  ])
    await expect(form.locator(`[name="${name}"]`)).toHaveCount(0);
  await expect(page.getByTestId('document-form')).toHaveCount(0);
  await expect(page.getByTestId('documents-pseudonymized')).toBeVisible();
  await form.locator('[name="citizenship"]').fill('KAZ');
  await form.getByRole('button', { name: 'Сохранить' }).click();
  await expect
    .poll(async () => {
      const commands = (await (await request.get(`${fixture}/__test/commands`)).json()) as Array<{
        method: string;
        path: string;
        body: Record<string, unknown>;
      }>;
      const patch = commands
        .filter((c) => c.method === 'PATCH' && c.path === '/guests/ui-guest')
        .at(-1);
      return patch ? Object.keys(patch.body).sort() : null;
    })
    .toEqual(['citizenship', 'gender']);
});
