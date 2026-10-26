import { test, expect, type Page, type APIRequestContext } from './fixtures';
import AxeBuilder from '@axe-core/playwright';

/**
 * Способы оплаты филиала салона и ресторана (DATA_MODEL §21.7, миграция 151, решение владельца 23.10.2026): экран
 * «Настройки → Способы оплаты» как у гостиницы; убранный способ пропадает из формы оплаты заказа и прихода кассы,
 * API отказывает словами; настройка ресторана не задевает салон. Настоящие контроллеры и база (pms_test).
 */
const api = `http://127.0.0.1:${process.env.FOOD_UI_API_PORT ?? '55824'}`;
type Fixture = { business: string; beauty: string; locations: string[] };
const pointer = (b: string, l: string) => `business=${b};location=${l}`;
async function scope(page: Page, b: string, l: string) {
  await page.context().addCookies([
    { name: 'wetop_scope', value: encodeURIComponent(pointer(b, l)), domain: '127.0.0.1', path: '/' },
  ]);
}
async function reset(page: Page, request: APIRequestContext) {
  const res = await request.post(`${api}/__test/reset`);
  expect(res.ok()).toBe(true);
  const f: Fixture = await res.json();
  await scope(page, f.business, f.locations[0]!);
  return f;
}
const rows = (page: Page) => page.getByRole('main').getByTestId('payment-method-row');

test('ресторан: убрать Halyk, поднять Kaspi, сохранить; в кассе Halyk нет, API отказывает словами', async ({ page, request }) => {
  const f = await reset(page, request);
  const headers = { 'x-wetop-scope': pointer(f.business, f.locations[0]!) };
  await page.goto('/today');
  await page.goto('/settings');
  await page.getByRole('main').getByRole('link', { name: 'Способы оплаты', exact: true }).click();
  await page.waitForURL('**/branch-payment-methods');
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { name: 'Способы оплаты', level: 1 })).toBeVisible();
  await expect(rows(page)).toHaveCount(6);
  // все шесть включены, «Добавить» предлагает только выключенное по умолчанию «Другое»
  await expect(main.getByTestId('payment-method-add')).toBeVisible();
  await expect(main.getByLabel('Добавить способ оплаты').locator('option')).toHaveText(['Другое']);
  const save = main.getByRole('button', { name: 'Сохранить изменения' });
  await expect(save).toBeDisabled();

  await main.getByRole('button', { name: 'Убрать: Halyk' }).click();
  await main.getByRole('button', { name: 'Выше: Kaspi' }).click();
  await expect(rows(page)).toHaveCount(5);
  await expect(rows(page).nth(1)).toHaveAttribute('data-method', 'KASPI');
  // в «Добавить» первым Halyk (только что убран), за ним выключенное по умолчанию «Другое»
  await expect(main.getByLabel('Добавить способ оплаты')).toHaveValue('HALYK');
  await expect(main.getByLabel('Добавить способ оплаты').locator('option')).toHaveText(['Halyk', 'Другое']);
  await save.click();
  await expect(main.getByTestId('settings-save-state')).toHaveText('✓ Изменения сохранены');

  const saved = await (await request.get(`${api}/food-service/payment-methods`, { headers })).json();
  expect(saved.methods.filter((m: { enabled: boolean }) => m.enabled).map((m: { method: string }) => m.method)).toEqual([
    'CASH',
    'KASPI',
    'CARD_TERMINAL',
    'BANK_TRANSFER_PERSON',
    'BANK_TRANSFER_LEGAL',
  ]);
  await page.reload();
  await expect(rows(page)).toHaveCount(5);

  // касса: в приходе Halyk нет; в расходе тоже, пока по нему нет денег
  await page.goto('/cashbox');
  const ops = page.getByRole('region', { name: 'Операция кассы' });
  await ops.getByRole('button', { name: 'Приход' }).click();
  const income = ops.getByLabel('Способ');
  await expect(income.locator('option')).toHaveText(['Наличные', 'Kaspi', 'Карта (терминал)', 'Перевод от физлица', 'Перевод от юрлица']);
  await ops.getByRole('button', { name: 'Расход' }).click();
  // расход включёнными способами и теми, где есть деньги (ТЗ салона 25.10.2026, п. 1): Halyk выключен и пуст,
  // «Другое» не включено и остатка по нему нет, обоих в списке нет
  await expect(ops.getByLabel('Способ').locator('option')).toHaveText([
    'Наличные',
    'Kaspi',
    'Карта (терминал)',
    'Перевод от физлица',
    'Перевод от юрлица',
  ]);

  const refused = await request.post(`${api}/food-service/cash/operations`, {
    headers,
    data: { kind: 'INCOME', method: 'HALYK', amount: 100 },
  });
  expect(refused.status()).toBe(400);
  expect((await refused.json()).message).toBe('Способ оплаты «Halyk» выключен в настройках филиала');

  // салон той же организации не задет
  await scope(page, f.beauty, f.locations[3]!);
  await page.goto('/today');
  await page.goto('/branch-payment-methods');
  await expect(rows(page)).toHaveCount(6);
});

test('«Другое» (PAYMENT-OTHER-20261025): выключено по умолчанию, включается и принимает деньги в кассу', async ({
  page,
  request,
}) => {
  const f = await reset(page, request);
  const headers = { 'x-wetop-scope': pointer(f.business, f.locations[0]!) };
  const before = await (await request.get(`${api}/food-service/payment-methods`, { headers })).json();
  expect(before.methods.find((m: { method: string }) => m.method === 'OTHER')).toEqual({ method: 'OTHER', enabled: false });
  const refused = await request.post(`${api}/food-service/cash/operations`, {
    headers,
    data: { kind: 'INCOME', method: 'OTHER', amount: 100 },
  });
  expect(refused.status()).toBe(400);
  expect((await refused.json()).message).toBe('Способ оплаты «Другое» выключен в настройках филиала');

  await page.goto('/today');
  await page.goto('/branch-payment-methods');
  const main = page.getByRole('main');
  await main.getByLabel('Добавить способ оплаты').selectOption('OTHER');
  await main.getByRole('button', { name: 'Добавить способ: Другое', exact: true }).click();
  await expect(rows(page)).toHaveCount(7);
  await main.getByRole('button', { name: 'Сохранить изменения' }).click();
  await expect(main.getByTestId('settings-save-state')).toHaveText('✓ Изменения сохранены');

  await page.goto('/cashbox');
  const ops = page.getByRole('region', { name: 'Операция кассы' });
  await ops.getByRole('button', { name: 'Приход' }).click();
  await expect(ops.getByLabel('Способ').locator('option')).toContainText(['Другое']);
  const taken = await request.post(`${api}/food-service/cash/operations`, {
    headers,
    data: { kind: 'INCOME', method: 'OTHER', amount: 100 },
  });
  expect(taken.status()).toBeLessThan(300);
  await page.reload();
  await expect(page.getByTestId('cash-OTHER')).toBeVisible();
});

test('способы оплаты: доступность и телефон, светлая и тёмная', async ({ page, request }) => {
  await reset(page, request);
  await page.goto('/today');
  for (const scheme of ['light', 'dark'] as const)
    for (const width of [1440, 390]) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/branch-payment-methods');
      await expect(rows(page)).toHaveCount(6);
      const result = await new AxeBuilder({ page }).include('main').analyze();
      expect(result.violations, `${scheme} ${width}`).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${scheme} ${width}`).toBeLessThanOrEqual(width);
      await page.screenshot({ path: `test-results/branch-payment-methods-${scheme}-${width}.png` });
    }
});
