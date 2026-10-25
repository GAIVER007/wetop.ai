import { FIXTURE_API, expect, test } from './fixtures';
import { cardTab } from '../e2e/card-tabs';

/**
 * Гражданство на заселении из карточки брони (решение владельца 24.10.2026): без гражданства «Заселить» не уходит в
 * тупик с ошибкой, а открывает окно выбора страны; после «Сохранить и заселить» гость заселён, страна в карточке гостя.
 * Гость вымышленный (фикстура `ui-guest`).
 */
const fixture = FIXTURE_API;
const BOOKING = '20260913-TESTAA';
const headers = { 'x-wetop-test-client': '1' };

test.beforeEach(async ({ page, request }) => {
  await request.post(`${fixture}/__test/reset`);
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
});

test.afterEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

test('карточка брони: нет гражданства, окно выбора страны, затем заселение', async ({ page, request }) => {
  const cleared = await request.patch(`${fixture}/guests/ui-guest`, { headers, data: { citizenship: null } });
  expect(cleared.ok()).toBe(true);
  await page.goto(`/reservations/${BOOKING}`);
  await expect(page.getByTestId('booking-head')).toContainText('гражданство не указано');
  await cardTab(page, 'Действия');
  await page.getByRole('main').getByTestId('check-in-ui-item').click();
  await page
    .getByRole('dialog', { name: 'Номер R01 ещё не проверен. Заселить?' })
    .getByRole('button', { name: 'Заселить всё равно' })
    .click();
  const ask = page.getByRole('dialog', { name: 'Укажите гражданство гостя' });
  await expect(ask).toBeVisible();
  await expect(ask).toContainText('eQonaq');
  await ask.getByLabel('Гражданство').selectOption('UZB');
  await ask.getByRole('button', { name: 'Сохранить и заселить', exact: true }).click();
  await expect(ask).toHaveCount(0);
  await expect(page.getByRole('main').getByTestId('check-out-ui-item')).toBeVisible();
  await expect(page.getByTestId('booking-head')).toContainText('гражданство: Узбекистан');
  const stored = await request.get(`${fixture}/guests/ui-guest`, { headers });
  expect(await stored.json()).toMatchObject({ citizenship: 'UZB' });
});

test('карточка брони: «Не сейчас» оставляет гостя незаселённым и показывает причину', async ({ page, request }) => {
  await request.patch(`${fixture}/guests/ui-guest`, { headers, data: { citizenship: null } });
  await page.goto(`/reservations/${BOOKING}`);
  await cardTab(page, 'Действия');
  await page.getByRole('main').getByTestId('check-in-ui-item').click();
  await page
    .getByRole('dialog', { name: 'Номер R01 ещё не проверен. Заселить?' })
    .getByRole('button', { name: 'Заселить всё равно' })
    .click();
  const ask = page.getByRole('dialog', { name: 'Укажите гражданство гостя' });
  await ask.getByRole('button', { name: 'Не сейчас', exact: true }).click();
  await expect(ask).toHaveCount(0);
  await expect(page.getByRole('main').getByTestId('check-in-ui-item')).toBeVisible();
  await expect(page.getByRole('main')).toContainText('Укажите гражданство');
});
