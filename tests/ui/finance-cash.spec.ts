import { mkdirSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

/**
 * Касса (DATA_MODEL §21, план `plans/finance-cashbox-2026-10-02.md`): вкладка с остатками по способам,
 * поступление и расход мимо счетов броней, перевод с комиссией, статьи, аннулирование и общая лента
 * операций с отбором по источнику. Данные подставного API вымышленные (ADR-010).
 */
// Порт стенда можно задать (`UI_FIXTURE_API`): дерево делят несколько сессий, 4311 бывает занят
const fixture = process.env['UI_FIXTURE_API'] ?? 'http://127.0.0.1:4311';
const report = 'reports/finance-cash-2026-10-02';
const today = new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
const add = (days: number) =>
  new Date(Date.parse(today) + days * 86400000).toISOString().slice(0, 10);
const url = `/finance?from=${add(-5)}&to=${today}`;

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});
test.afterEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

const tenge = (page: import('@playwright/test').Page, testId: string) =>
  page
    .getByTestId(testId)
    .innerText()
    .then((t) => Number(t.replace(/[^\d−-]/g, '') || 0));

test('касса: плитки остатков — оплаты гостей по способам видны без ручного ввода; axe чисто', async ({
  page,
}) => {
  await page.goto(url);
  await page.getByRole('tab', { name: 'Касса', exact: true }).click();
  const cash = page.getByTestId('finance-cash');
  await expect(cash.getByTestId('cash-tiles')).toBeVisible();
  // способы по умолчанию видны и при нуле (Q-237)
  for (const m of ['cash-CASH', 'cash-KASPI', 'cash-HALYK', 'cash-CARD_TERMINAL'])
    await expect(cash.getByTestId(m)).toBeVisible();
  // гостевые оплаты в кассу не дублируются — остаток уже содержит оплату фикстуры (наличные)
  expect(await tenge(page, 'cash-CASH')).toBeGreaterThan(0);
  await expect(cash.getByTestId('cash-ops-link')).toBeVisible();
  const axe = await new AxeBuilder({ page }).include('[data-testid="finance-cash"]').analyze();
  expect(axe.violations).toEqual([]);
});

test('поступление и расход со статьёй меняют остаток; ошибка словами, введённое не теряется', async ({
  page,
}) => {
  await page.goto(url);
  await page.getByRole('tab', { name: 'Касса', exact: true }).click();
  const was = await tenge(page, 'cash-CASH');

  await page.getByTestId('cash-income-btn').click();
  const form = page.getByTestId('cash-operation-form');
  // нулевая сумма — отказ словами, панель не закрывается
  await form.getByTestId('cash-amount').fill('0');
  await form.getByRole('button', { name: 'Сохранить' }).click();
  await expect(form.getByText(/больше нуля/)).toBeVisible();
  await form.getByTestId('cash-amount').fill('2000');
  await form.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByTestId('cash-saved')).toContainText('Поступление записано');
  expect(await tenge(page, 'cash-CASH')).toBe(was + 2000);

  await page.getByTestId('cash-expense-btn').click();
  const expense = page.getByTestId('cash-operation-form');
  await expense.getByTestId('cash-amount').fill('500');
  await expense.getByTestId('cash-category').selectOption({ label: 'Зарплата' });
  await expense.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByTestId('cash-saved')).toContainText('Расход записан');
  expect(await tenge(page, 'cash-CASH')).toBe(was + 2000 - 500);
});

test('перевод с комиссией: остатки обоих способов, в ленте — перевод и расход «Комиссия банка», аннулирование снимает оба', async ({
  page,
}) => {
  await page.goto(url);
  await page.getByRole('tab', { name: 'Касса', exact: true }).click();
  const cashWas = await tenge(page, 'cash-CASH');
  await page.getByTestId('cash-transfer-btn').click();
  const form = page.getByTestId('cash-transfer-form');
  await form.getByTestId('cash-from').selectOption('CASH');
  await form.getByTestId('cash-to').selectOption('KASPI');
  await form.getByTestId('cash-amount').fill('1000');
  await form.locator('[name="commissionPercent"]').fill('1');
  await form.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByTestId('cash-saved')).toContainText('Перевод записан');
  expect(await tenge(page, 'cash-CASH')).toBe(cashWas - 1000 - 10);
  expect(await tenge(page, 'cash-KASPI')).toBe(1000);

  // общая лента с отбором «Касса»: перевод «Наличные → Kaspi» и комиссия расходом с минусом
  await page.getByTestId('cash-ops-link').click();
  await expect(page).toHaveURL(/src=cash#operations$/);
  const rows = page.getByTestId('op-row');
  await expect(rows).toHaveCount(2);
  const transfer = rows.filter({ hasText: 'Перевод' }).first();
  await expect(transfer).toContainText('Наличные → Kaspi');
  const fee = rows.filter({ hasText: 'Расход' }).first();
  await expect(fee).toContainText('Комиссия банка');
  await expect(fee.getByTestId('op-amount')).toHaveText(/^−/);
  // суммы кассы в строке итога
  await expect(page.getByTestId('ops-meta')).toContainText('касса');

  // аннулирование основной операции снимает и комиссию (вопрос подтверждения — словами)
  await transfer.getByTestId('cash-void').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Аннулировать', exact: true }).click();
  await expect(page.getByTestId('op-row').filter({ hasText: 'аннулирован' })).toHaveCount(2);
  await page.getByRole('tab', { name: 'Касса', exact: true }).click();
  expect(await tenge(page, 'cash-CASH')).toBe(cashWas);
});

test('статьи: стартовый набор, добавление и выключение; выключенная уходит из формы расхода', async ({
  page,
}) => {
  await page.goto(url);
  await page.getByRole('tab', { name: 'Касса', exact: true }).click();
  await page.getByTestId('cash-categories-btn').click();
  const panel = page.getByTestId('cash-categories');
  await expect(panel.getByRole('row', { name: /Комиссия банка/ })).toBeVisible();
  await panel.getByTestId('cash-category-name').fill('Реклама');
  await panel.getByRole('button', { name: 'Добавить' }).click();
  const added = panel.getByRole('row', { name: /Реклама/ });
  await expect(added).toBeVisible();
  await added.getByRole('button', { name: 'Выключить' }).click();
  await expect(added.getByText('выключена')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByTestId('cash-expense-btn').click();
  const options = page.getByTestId('cash-category').locator('option');
  await expect(options.filter({ hasText: 'Зарплата' })).toHaveCount(1);
  await expect(options.filter({ hasText: 'Реклама' })).toHaveCount(0);
});

test('«только чтение»: кнопок кассы нет, остатки видны', async ({ page, request }) => {
  // как в finance-f1: пробный срок истёк, «только чтение» видит вошедший
  await request.post(`${fixture}/__test/control`, { data: { orgTrialDays: 'ended' } });
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
  await page.goto(url);
  await page.getByRole('tab', { name: 'Касса', exact: true }).click();
  await expect(page.getByTestId('cash-tiles')).toBeVisible();
  await expect(page.getByTestId('cash-income-btn')).toHaveCount(0);
  await expect(page.getByTestId('cash-transfer-btn')).toHaveCount(0);
  await expect(page.getByTestId('cash-categories-btn')).toHaveCount(0);
});

for (const theme of ['light', 'dark'] as const) {
  test(`касса, снимки для владельца, ${theme}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(url);
    await page.getByRole('tab', { name: 'Касса', exact: true }).click();
    await expect(page.getByTestId('cash-tiles')).toBeVisible();
    await page.mouse.move(0, 0);
    mkdirSync(report, { recursive: true });
    await page.screenshot({ path: `${report}/${theme}-1440-cash.png`, fullPage: true });
    await page.getByTestId('cash-income-btn').click();
    await expect(page.getByTestId('cash-operation-form')).toBeVisible();
    await page.screenshot({ path: `${report}/${theme}-1440-income-form.png` });
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('tab', { name: 'Касса', exact: true }).click();
    await expect(page.getByTestId('cash-tiles')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({ path: `${report}/${theme}-390-cash.png`, fullPage: true });
  });
}

test('сверка (§21.4): «по системе» в панели, недостача поправкой, строка состояния и лента', async ({
  page,
}) => {
  await page.goto(url);
  await page.getByRole('tab', { name: 'Касса', exact: true }).click();
  const was = await tenge(page, 'cash-CASH');
  await expect(page.getByTestId('finance-cash')).toContainText('не сверялись');
  await page.getByTestId('cash-reconcile-btn').click();
  const form = page.getByTestId('cash-reconcile-form');
  // «по системе» показывает текущий остаток выбранного способа (группировка formatMoney — обычный пробел)
  await expect(form.getByTestId('cash-expected')).toContainText(
    String(was).replace(/\B(?=(\d{3})+(?!\d))/g, ' '),
  );
  await form.getByTestId('cash-counted').fill(String(was - 500));
  await form.getByRole('button', { name: 'Записать сверку' }).click();
  await expect(page.getByTestId('cash-saved')).toContainText('Сверка записана');
  // поправка выровняла остаток, строка состояния — о последней сверке
  expect(await tenge(page, 'cash-CASH')).toBe(was - 500);
  const status = page.getByTestId('cash-reconciliation-status');
  await expect(status).toContainText('Наличные');
  await expect(status).toContainText('−500');
  // поправка видна в ленте кассы со статьёй «Недостача кассы»
  await page.getByTestId('cash-ops-link').click();
  const fee = page.getByTestId('op-row').filter({ hasText: 'Недостача кассы' });
  await expect(fee).toHaveCount(1);
  await expect(fee.getByTestId('op-amount')).toHaveText(/^−/);
});

test('сверка без галочки поправки: остаток не меняется, расхождение видно в строке состояния', async ({
  page,
}) => {
  await page.goto(url);
  await page.getByRole('tab', { name: 'Касса', exact: true }).click();
  const was = await tenge(page, 'cash-CASH');
  await page.getByTestId('cash-reconcile-btn').click();
  const form = page.getByTestId('cash-reconcile-form');
  await form.getByLabel('Выровнять остаток поправкой').uncheck();
  await form.getByTestId('cash-counted').fill(String(was + 70));
  await form.getByRole('button', { name: 'Записать сверку' }).click();
  await expect(page.getByTestId('cash-saved')).toContainText('Сверка записана');
  expect(await tenge(page, 'cash-CASH')).toBe(was);
  await expect(page.getByTestId('cash-reconciliation-status')).toContainText('+70');
});
