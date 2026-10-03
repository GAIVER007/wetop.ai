import { expect, test } from './fixtures';

/**
 * D4 (ADR-128): в форме брони стойки есть необязательное поле «Промокод». Заполненное — уходит в
 * POST /reservations как `promoCode`; пустое в запрос не попадает.
 */
const fixture = 'http://127.0.0.1:4311';

// подставной API один на все спеки: журнал команд общий, поэтому тесты идут по очереди
test.describe.configure({ mode: 'serial' });

type Command = { path: string; body: Record<string, unknown> };

async function createBooking(
  page: import('@playwright/test').Page,
  request: import('@playwright/test').APIRequestContext,
  promo: string,
): Promise<Record<string, unknown> | undefined> {
  // первая бронь занимает M03 на те же даты: без сброса вторая форма не даст «Создать бронь»
  await request.post(`${fixture}/__test/reset`);
  await request.post(`${fixture}/__test/control`, { data: {} });
  await page.goto('/reservations/new?unit=M03');
  const form = page.getByTestId('new-reservation-form');
  await form.getByText('Дополнительно', { exact: true }).click();
  if (promo) await form.getByLabel('Промокод', { exact: true }).fill(promo);
  await form.getByLabel('Имя *', { exact: true }).fill('Промо');
  await form.getByLabel('Фамилия *', { exact: true }).fill('Тест');
  await form.getByRole('button', { name: 'Создать бронь' }).click();
  await expect(page).toHaveURL(/\/reservations\/20260913-NEW\d+$/);
  const commands = (await (await request.get(`${fixture}/__test/commands`)).json()) as Command[];
  return commands.filter((c) => c.path === '/reservations').at(-1)?.body;
}

test('промокод из формы уходит в запрос брони', async ({ page, request }) => {
  const body = await createBooking(page, request, 'RANNIY10');
  expect(body).toMatchObject({ promoCode: 'RANNIY10' });
});

test('пустой промокод в запрос не попадает', async ({ page, request }) => {
  const body = await createBooking(page, request, '');
  expect(body).toBeDefined();
  expect(body).not.toHaveProperty('promoCode');
});
