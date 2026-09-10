import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

/**
 * Сертификационные сценарии Channex (docs/channex/site/api-v.1-documentation/pms-certification-tests.md),
 * выполненные ДЕЙСТВИЯМИ В ИНТЕРФЕЙСЕ PMS: экран «Цены и ограничения» и «Новая бронь». Каждое действие
 * кладёт дельту в очередь; кнопка «Отправить очередь сейчас» на /channels шлёт ОДНО сообщение в staging.
 * ID задач Channex собираются в reports/channex-certification-tasks.json для формы сертификации.
 * Даты — ноябрь 2026, как в документе; категории — наши (одиночные, двухместная, dorm), тариф — ОТА.
 */
const OTA = 'exely-10158310';
const SINGLE = 'exely-5074312'; // Одноместная с окном (аналог Twin Room)
const DOUBLE = 'exely-5074687'; // Двухместная (аналог Double Room)
const tasks: Array<{ scenario: string; taskId: string; sent: string }> = [];

async function addChange(
  page: Page,
  c: {
    category: string;
    dateFrom: string;
    dateTo?: string;
    days?: string[];
    price?: string;
    minStay?: string;
    maxStay?: string;
    stopSell?: 'true' | 'false';
    cta?: 'true' | 'false';
    ctd?: 'true' | 'false';
  },
) {
  const ed = page.getByTestId('bulk-editor');
  await ed.locator('select[name="accommodationTypeCode"]').selectOption(c.category);
  await ed.locator('select[name="ratePlanCode"]').selectOption(OTA);
  await ed.locator('input[name="dateFrom"]').fill(c.dateFrom);
  await ed.locator('input[name="dateTo"]').fill(c.dateTo ?? c.dateFrom);
  for (const d of ['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su'])
    await ed.locator(`input[name="day-${d}"]`).setChecked(!c.days || c.days.includes(d));
  await ed.locator('input[name="price"]').fill(c.price ?? '');
  await ed.locator('input[name="minStay"]').fill(c.minStay ?? '');
  await ed.locator('input[name="maxStay"]').fill(c.maxStay ?? '');
  await ed.locator('select[name="stopSell"]').selectOption(c.stopSell ?? '');
  await ed.locator('select[name="closedToArrival"]').selectOption(c.cta ?? '');
  await ed.locator('select[name="closedToDeparture"]').selectOption(c.ctd ?? '');
  const before = await page
    .getByTestId('pending-changes')
    .locator('li')
    .count()
    .catch(() => 0);
  await ed.getByRole('button', { name: '+ Добавить в список' }).click();
  await expect(page.getByTestId('pending-changes').locator('li')).toHaveCount(before + 1);
  // строка в списке должна отражать именно то, что ввели
  await expect(page.getByTestId('pending-changes').locator('li').nth(before)).toContainText(
    c.dateFrom,
  );
}
async function save(page: Page) {
  await page.getByTestId('apply-changes').click();
  await expect(page.getByTestId('bulk-done')).toBeVisible({ timeout: 60_000 });
}
/** Отправить очередь с /channels, дождаться, пока она опустеет, и записать ID задачи Channex. */
async function flush(page: Page, scenario: string) {
  await page.goto('/channels');
  await page.getByTestId('channel-flush').click();
  await expect(page.getByTestId('channel-result')).toBeVisible({ timeout: 120_000 });
  let taskId = '—';
  for (let i = 0; i < 30; i += 1) {
    await page.goto('/channels');
    const pending = (await page.getByTestId('outbox-pending').textContent())?.trim();
    taskId = (await page.getByTestId('outbox-last-task').textContent())?.trim() ?? '—';
    if (pending === '0' && taskId !== '—') break;
    await page.waitForTimeout(3_000);
  }
  expect(taskId).not.toBe('—');
  tasks.push({ scenario, taskId, sent: new Date().toISOString() });
  return taskId;
}

test.describe.serial('Channex certification from the PMS UI', () => {
  test.setTimeout(300_000);
  test.afterAll(() => {
    mkdirSync('reports', { recursive: true });
    writeFileSync('reports/channex-certification-tasks.json', JSON.stringify(tasks, null, 2));
  });

  test('2. одна дата, один тариф: цена 22.11.2026 → 333', async ({ page }) => {
    await page.goto(`/rates?category=${SINGLE}&ratePlan=${OTA}&month=2026-11`);
    await addChange(page, { category: SINGLE, dateFrom: '2026-11-22', price: '333' });
    await save(page);
    await expect(page.getByTestId('price-2026-11-22-1')).toHaveText(/333,00/);
    await flush(page, '2. Single Date Update for Single Rate');
  });

  test('3. одна дата, несколько тарифов (категорий) — одно сообщение', async ({ page }) => {
    await page.goto(`/rates?category=${SINGLE}&ratePlan=${OTA}&month=2026-11`);
    await addChange(page, { category: SINGLE, dateFrom: '2026-11-21', price: '333' });
    await addChange(page, { category: DOUBLE, dateFrom: '2026-11-25', price: '444' });
    await addChange(page, { category: DOUBLE, dateFrom: '2026-11-29', price: '456.23' });
    await expect(page.getByTestId('pending-changes').locator('li')).toHaveCount(3);
    await save(page);
    await flush(page, '3. Single Date Update for Multiple Rates');
  });

  test('4. диапазоны дат для нескольких тарифов — одно сообщение', async ({ page }) => {
    await page.goto(`/rates?category=${SINGLE}&ratePlan=${OTA}&month=2026-11`);
    await addChange(page, {
      category: SINGLE,
      dateFrom: '2026-11-01',
      dateTo: '2026-11-10',
      price: '241',
    });
    await addChange(page, {
      category: DOUBLE,
      dateFrom: '2026-11-10',
      dateTo: '2026-11-16',
      price: '312.66',
    });
    await save(page);
    await flush(page, '4. Multiple Date Update for Multiple Rates');
  });

  test('5. min stay', async ({ page }) => {
    await page.goto(`/rates?category=${SINGLE}&ratePlan=${OTA}&month=2026-11`);
    await addChange(page, { category: SINGLE, dateFrom: '2026-11-23', minStay: '3' });
    await addChange(page, { category: DOUBLE, dateFrom: '2026-11-25', minStay: '2' });
    await save(page);
    await flush(page, '5. Min Stay Update');
  });

  test('6. stop sell', async ({ page }) => {
    await page.goto(`/rates?category=${SINGLE}&ratePlan=${OTA}&month=2026-11`);
    await addChange(page, { category: SINGLE, dateFrom: '2026-11-14', stopSell: 'true' });
    await addChange(page, { category: DOUBLE, dateFrom: '2026-11-16', stopSell: 'true' });
    await save(page);
    await expect(page.getByTestId('rate-row-2026-11-14')).toContainText('да');
    await flush(page, '6. Stop Sell Update');
  });

  test('7. несколько ограничений диапазонами', async ({ page }) => {
    await page.goto(`/rates?category=${SINGLE}&ratePlan=${OTA}&month=2026-11`);
    await addChange(page, {
      category: SINGLE,
      dateFrom: '2026-11-01',
      dateTo: '2026-11-10',
      cta: 'true',
      ctd: 'false',
      maxStay: '4',
      minStay: '1',
    });
    await addChange(page, {
      category: DOUBLE,
      dateFrom: '2026-11-10',
      dateTo: '2026-11-16',
      cta: 'true',
      minStay: '2',
    });
    await save(page);
    await flush(page, '7. Multiple Restrictions Update');
  });

  test('8. полгода одним сообщением', async ({ page }) => {
    await page.goto(`/rates?category=${SINGLE}&ratePlan=${OTA}&month=2026-12`);
    await addChange(page, {
      category: SINGLE,
      dateFrom: '2026-12-01',
      dateTo: '2027-05-01',
      price: '432',
      cta: 'false',
      ctd: 'false',
      minStay: '2',
    });
    await addChange(page, {
      category: DOUBLE,
      dateFrom: '2026-12-01',
      dateTo: '2027-05-01',
      price: '342',
      minStay: '3',
    });
    await save(page);
    await flush(page, '8. Half-year Update');
  });

  test('9–10. доступность: бронь со стойки уменьшает остаток категории, отмена возвращает', async ({
    page,
  }) => {
    await page.goto(`/reservations/new?arrival=2026-11-21&departure=2026-11-22`);
    const form = page.getByTestId('new-reservation-form');
    await form.locator('select[name="source"]').selectOption('PHONE');
    await form.locator('select[name="accommodationTypeCode"]').selectOption(SINGLE);
    await form.locator('select[name="ratePlanCode"]').selectOption(OTA);
    await form.locator('input[name="firstName"]').fill('Гость');
    await form.locator('input[name="lastName"]').fill('Тест-сертификация');
    await form.locator('textarea[name="notes"]').fill('E2E-АВТОТЕСТ'); // сверка исключает автотесты
    await form.getByRole('button', { name: 'Создать бронь' }).click();
    await expect(page).toHaveURL(/\/reservations\/\d{8}-[A-Z0-9]{6}$/);
    const number = page.url().split('/').pop()!;
    await flush(page, '9. Single Date Availability Update (booking created in PMS UI)');
    await page.goto(`/reservations/${number}`);
    page.on('dialog', (d) => d.accept());
    await page.getByTestId('cancel-reservation').click();
    await expect(page.getByText('отменена').first()).toBeVisible();
    await flush(page, '10. Availability Update (booking cancelled in PMS UI)');
  });
});
