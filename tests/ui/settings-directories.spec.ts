import AxeBuilder from '@axe-core/playwright';
import type { APIRequestContext, Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { FIXTURE_API, expect, test } from './fixtures';

/**
 * «Настройки объекта → Справочники» (DATA_MODEL §21.6, ADR-152, план plans/property-directories-2026-10-07.md):
 * способы оплаты объекта (включить, выключить, порядок) и статьи кассы (добавить, переименовать, выключить).
 * Выключенный способ уходит из форм приёма оплаты, запросов оплаты и кассы, API отказывает словами.
 * Стенд: подставной API, данные вымышленные (ADR-010).
 */
const API = FIXTURE_API;
const SHOTS = 'reports/property-directories-2026-10-07';
const NUMBER = '20260913-TESTAA';
const H = { 'x-wetop-test-client': '1' };
const ALL = [
  'CASH',
  'CARD_TERMINAL',
  'KASPI',
  'HALYK',
  'BANK_TRANSFER_PERSON',
  'BANK_TRANSFER_LEGAL',
  'DEPOSIT',
  'CARD_GUARANTEE',
];

test.beforeEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});
test.afterEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});

async function signIn(page: Page) {
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
}
const control = (request: APIRequestContext, body: Record<string, unknown>) =>
  request.post(`${API}/__test/control`, { data: body });
/** выключить способы прямо в подставном API, как это сделал бы владелец на вкладке */
const disable = (request: APIRequestContext, ...off: string[]) =>
  request.put(`${API}/hotel/payment-methods`, {
    headers: H,
    data: { methods: ALL.map((method) => ({ method, enabled: !off.includes(method) })) },
  });

test('вкладка «Справочники»: восемь способов; Kaspi выключен и Halyk поднят, сохранение из шапки, после перечитывания то же', async ({
  page,
  request,
}) => {
  await signIn(page);
  await page.goto('/hotel-settings/directories');
  const main = page.getByRole('main');
  await expect(main.getByRole('link', { name: 'Справочники' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  const rows = main.getByTestId('payment-method-row');
  await expect(rows).toHaveCount(8);
  await expect(rows.first()).toHaveAttribute('data-method', 'CASH');
  const save = main.getByRole('button', { name: 'Сохранить изменения' });
  await expect(save).toBeDisabled();

  await main.getByLabel('Принимаем: Kaspi').uncheck();
  await main.getByRole('button', { name: 'Выше: Halyk' }).click();
  await main.getByRole('button', { name: 'Выше: Halyk' }).click();
  await expect(rows.nth(1)).toHaveAttribute('data-method', 'HALYK');
  await expect(main.getByTestId('settings-save-state')).toHaveText('• Есть несохранённые изменения');
  await save.click();
  await expect(main.getByTestId('settings-save-state')).toHaveText('✓ Изменения сохранены');

  const saved = (await (await request.get(`${API}/hotel/payment-methods`, { headers: H })).json()) as {
    methods: Array<{ method: string; enabled: boolean }>;
  };
  expect(saved.methods.slice(0, 3).map((m) => m.method)).toEqual(['CASH', 'HALYK', 'CARD_TERMINAL']);
  expect(saved.methods.find((m) => m.method === 'KASPI')?.enabled).toBe(false);

  await page.reload();
  await expect(main.getByTestId('payment-method-row').nth(1)).toHaveAttribute('data-method', 'HALYK');
  await expect(main.getByLabel('Принимаем: Kaspi')).not.toBeChecked();
  await expect(main.getByRole('button', { name: 'Сохранить изменения' })).toBeDisabled();
});

test('все способы выключены: сохранить нельзя, причина словами', async ({ page }) => {
  await signIn(page);
  await page.goto('/hotel-settings/directories');
  const main = page.getByRole('main');
  const toggles = main.getByTestId('payment-method-toggle');
  await expect(toggles).toHaveCount(8);
  for (let i = 0; i < 8; i += 1) await toggles.nth(i).uncheck();
  await expect(main.getByText('Хотя бы один способ оплаты должен быть включён')).toBeVisible();
  await main.getByRole('button', { name: 'Сохранить изменения' }).click();
  // форма не ушла: разбор домена остановил запрос, список по-прежнему весь выключен
  await expect(main.getByTestId('settings-save-state')).toHaveText('• Есть несохранённые изменения');
});
test('выключенный Kaspi: нет в форме оплаты, запросах оплаты и кассе; API отказывает словами', async ({
  page,
  request,
}) => {
  await disable(request, 'KASPI');
  await page.goto(`/reservations/${NUMBER}`);
  await page.getByRole('tab', { name: 'Счета', exact: true }).click();
  const pay = page.getByTestId('payment-form').first();
  await expect(pay.getByRole('option', { name: 'Kaspi', exact: true })).toHaveCount(0);
  await expect(pay.getByRole('option', { name: 'Halyk', exact: true })).toHaveCount(1);
  const requests = page.getByTestId('payment-requests');
  await requests.getByTestId('payment-requests-toggle').click();
  await expect(requests.getByRole('option', { name: /Kaspi/ })).toHaveCount(0);
  await expect(requests.getByRole('option', { name: /Halyk/ })).toHaveCount(1);
  const refused = await request.post(`${API}/finance/payments`, {
    headers: H,
    data: {
      method: 'KASPI',
      amount: '1000',
      allocations: [{ folioId: 'ui-folio-1', amount: '1000' }],
    },
  });
  expect(refused.status()).toBe(400);
  expect((await refused.json()).message).toBe('Способ оплаты «Kaspi» выключен в настройках объекта');

  await page.goto('/finance#cash');
  await page.getByRole('tab', { name: 'Касса', exact: true }).click();
  const cash = page.getByTestId('finance-cash');
  await expect(cash.getByTestId('cash-CASH')).toBeVisible();
  await expect(cash.getByTestId('cash-KASPI')).toHaveCount(0);
  await cash.getByTestId('cash-income-btn').click();
  const options = page.getByTestId('cash-method').locator('option');
  await expect(options.filter({ hasText: 'Kaspi' })).toHaveCount(0);
  await expect(options.filter({ hasText: 'Наличные' })).toHaveCount(1);
});

test('статьи кассы: ссылка из «Кассы» ведёт в справочники; добавить, переименовать, выключить; выключенная уходит из расхода', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/finance#cash');
  await page.getByRole('tab', { name: 'Касса', exact: true }).click();
  await page.getByTestId('cash-categories-btn').click();
  await expect(page).toHaveURL(/\/hotel-settings\/directories#cash-categories$/);
  const editor = page.getByTestId('cash-categories-editor');
  await expect(editor.getByRole('row', { name: /Комиссия банка/ })).toBeVisible();
  await editor.getByTestId('cash-category-name').fill('Реклама');
  await editor.getByRole('button', { name: 'Добавить', exact: true }).click();
  const added = editor.getByRole('row', { name: /Реклама/ });
  await expect(added).toBeVisible();
  await added.getByRole('button', { name: 'Переименовать' }).click();
  const rename = added.getByTestId('cash-category-rename');
  await rename.getByLabel(/Новое название/).fill('Реклама в соцсетях');
  await rename.getByRole('button', { name: 'Сохранить', exact: true }).click();
  const renamed = editor.getByRole('row', { name: /Реклама в соцсетях/ });
  await expect(renamed).toBeVisible();
  await renamed.getByRole('button', { name: 'Выключить' }).click();
  // точное слово: строка под названием на телефоне повторяет статус («Расход, выключена»)
  await expect(renamed.getByText('выключена', { exact: true })).toBeVisible();

  await page.goto('/finance#cash');
  await page.getByRole('tab', { name: 'Касса', exact: true }).click();
  await page.getByTestId('cash-expense-btn').click();
  const options = page.getByTestId('cash-category').locator('option');
  await expect(options.filter({ hasText: 'Зарплата' })).toHaveCount(1);
  await expect(options.filter({ hasText: 'Реклама' })).toHaveCount(0);
});

test('управляющий правит; «только чтение» видит факты без кнопок', async ({ page, request }) => {
  await signIn(page);
  await control(request, { role: 'MANAGER' });
  await page.goto('/hotel-settings/directories');
  const main = page.getByRole('main');
  await expect(main.getByTestId('payment-method-toggle').first()).toBeVisible();
  await expect(main.getByTestId('cash-category-form')).toBeVisible();

  await control(request, { role: 'OWNER', orgTrialDays: 'ended' });
  await page.goto('/hotel-settings/directories');
  await expect(main.getByTestId('payment-method-row')).toHaveCount(8);
  await expect(main.getByTestId('payment-method-toggle')).toHaveCount(0);
  await expect(main.getByTestId('cash-category-form')).toHaveCount(0);
  await expect(main.getByRole('button', { name: 'Сохранить изменения' })).toHaveCount(0);
});

for (const scheme of ['light', 'dark'] as const)
  for (const width of [1440, 390])
    test(`доступность «Справочников»: ${scheme}, ${width}px`, async ({ page }) => {
      mkdirSync(SHOTS, { recursive: true });
      await signIn(page);
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/hotel-settings/directories');
      const main = page.getByRole('main');
      await expect(main.getByTestId('payment-method-row')).toHaveCount(8);
      await main
        .getByRole('row', { name: /Комиссия банка/ })
        .getByRole('button', { name: 'Переименовать' })
        .click();
      await expect(main.getByTestId('cash-category-rename')).toBeVisible();
      const result = await new AxeBuilder({ page }).include('main').analyze();
      expect(result.violations).toEqual([]);
      const widths = await page.evaluate(() => [
        document.documentElement.scrollWidth,
        document.documentElement.clientWidth,
      ]);
      expect(widths[0]).toBeLessThanOrEqual(widths[1]!);
      await page.screenshot({
        path: `${SHOTS}/directories-${scheme}-${width}.png`,
        fullPage: width === 1440,
      });
    });
