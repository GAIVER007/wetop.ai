import { expect, test } from './fixtures';

/**
 * ADR-072: пока база не в Казахстане, WETOP не хранит имя, контакты, заметки и документы гостя. Формы стойки их
 * не спрашивают — режим читается у API заранее (`/system/pii-storage`), а не узнаётся отказом после ввода.
 * Фикстура по умолчанию отдаёт `real` (как в базе в РК), здесь переключается на `pseudonymized`.
 */
const fixture = 'http://127.0.0.1:4311';

// чистый стенд: бронь соседнего спека на M03 заняла бы те же даты, и форма не дала бы создать эту
test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});
test.afterEach(async ({ request }) => {
  await request.post(`${fixture}/__test/control`, { data: {} });
});

test('новая бронь без имени и контактов: компактная форма, бронь создаётся', async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/control`, { data: { piiStorage: 'pseudonymized' } });
  await page.goto('/reservations/new?unit=M03');
  const form = page.getByTestId('new-reservation-form');
  await expect(form.getByTestId('guest-pseudonymized')).toHaveCount(0);
  for (const name of ['firstName', 'lastName', 'middleName', 'email', 'phone'])
    await expect(form.locator(`[name="${name}"]`)).toHaveCount(0);
  await expect(form.getByTestId('booking-summary')).toContainText('Автоматическая карточка');
  await form.getByText('Дополнительно', { exact: true }).click();
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

test('бронь существующему гостю (G6) — без имён: гость показан, нового псевдонима нет', async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/control`, { data: { piiStorage: 'pseudonymized' } });
  await page.goto('/reservations/new?guest=ui-guest');
  const form = page.getByTestId('new-reservation-form');
  await expect(form.getByTestId('booking-guest')).toContainText('Гость Тестовый');
  await expect(form.getByTestId('guest-pseudonymized')).toHaveCount(0);
  await form.getByText('Дополнительно', { exact: true }).click();
  await form.locator('[name="source"]').selectOption('PHONE');
  await form.getByRole('button', { name: 'Создать бронь' }).click();
  await expect(page).toHaveURL(/\/reservations\/20260913-NEW\d+$/);
  const commands = (await (await request.get(`${fixture}/__test/commands`)).json()) as Array<{
    path: string;
    body: Record<string, unknown>;
  }>;
  const body = commands.filter((c) => c.path === '/reservations').at(-1)?.body ?? {};
  expect(body['guestId']).toBe('ui-guest');
  expect(body).not.toHaveProperty('guest');
});

test('карточка гостя: меняются только гражданство и пол, документы не вносятся', async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/control`, { data: { piiStorage: 'pseudonymized' } });
  await page.goto('/guests/ui-guest#guest-profile');
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
  // G5: документы — своя вкладка карточки
  await page.getByRole('tab', { name: 'Документы', exact: true }).click();
  await expect(page.getByTestId('document-form')).toHaveCount(0);
  await expect(page.getByTestId('documents-pseudonymized')).toBeVisible();
  await page.getByRole('tab', { name: 'Данные гостя', exact: true }).click();
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

test('Q-169: у заметки на карточке брони — подсказка без имён и телефонов; база в РК — без неё', async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/control`, { data: { piiStorage: 'pseudonymized' } });
  await page.goto('/reservations/20260913-TESTAA');
  await page.getByRole('tab', { name: 'Действия', exact: true }).click();
  const notes = page.getByTestId('edit-reservation-form').locator('textarea[name="notes"]');
  await expect(notes).toHaveAttribute('placeholder', /без имён и телефонов гостя/);

  await request.post(`${fixture}/__test/control`, { data: { piiStorage: 'real' } });
  await page.reload();
  await page.getByRole('tab', { name: 'Действия', exact: true }).click();
  await expect(
    page.getByTestId('edit-reservation-form').locator('textarea[name="notes"]'),
  ).toHaveAttribute('placeholder', 'Заметки');
});
