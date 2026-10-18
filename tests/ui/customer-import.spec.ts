import AxeBuilder from '@axe-core/playwright';
import { FIXTURE_API, expect, test } from './fixtures';
import type { APIRequestContext, Locator, Page } from '@playwright/test';

const REPORTS = 'reports/salons-m4b2-2026-10-18';

test('M4-B2: владелец импортирует CSV, восстанавливает результат и безопасно отменяет', async ({ page, request }) => {
  test.setTimeout(180_000);
  await openSalon(page, request);
  await page.goto('/customers');
  const main = page.getByRole('main');
  const customerTable = main.getByRole('table', { name: '', exact: true });
  await main.getByRole('button', { name: 'Проверить CSV', exact: true }).click();
  let panel = page.getByRole('dialog', { name: 'Проверка CSV клиентов' });
  const csv = [
    'Имя;Фамилия;Телефон',
    'Импорт Тест;Первый;+7 700 000 71 01',
    'Повтор не заменяет;Карточку;87000007101',
    'Строка с ошибкой;;не телефон',
  ].join('\r\n');
  await panel.getByLabel('CSV с клиентами').setInputFiles({
    name: 'synthetic-import.csv', mimeType: 'text/csv', buffer: Buffer.from(csv),
  });
  await panel.getByRole('button', { name: 'Проверить строки', exact: true }).click();
  await expect(panel.getByText('Проверка завершена. Данные ещё не импортированы.', { exact: true })).toBeVisible();
  const repeatImport = panel.getByRole('button', { name: 'Импортировать 3 строк', exact: true });
  await repeatImport.click();
  await expect(repeatImport).toBeEnabled();
  await expect(panel.getByRole('heading', { name: 'Последний импорт: Завершён' })).toBeVisible();
  await expect(panel.getByText('Проверка завершена. Данные ещё не импортированы.', { exact: true })).not.toBeVisible();
  await expect(panel.getByText('Созданы').locator('..')).toContainText('1');
  await expect(panel.getByText('Уже были в салоне').locator('..')).toContainText('1');
  await expect(panel.getByText('Пропущены').locator('..')).toContainText('1');
  await expect(customerTable.getByRole('row').filter({ hasText: 'Импорт Тест Первый' })).toHaveCount(1);
  await expect(customerTable.getByRole('row').filter({ hasText: 'Повтор не заменяет' })).toHaveCount(0);
  // Повтор той же команды с тем же clientRequestId возвращает завершённый job и не открывает upload заново.
  await repeatImport.click();
  await expect(repeatImport).toBeEnabled();
  await expect(panel.getByRole('heading', { name: 'Последний импорт: Завершён' })).toBeVisible();
  await expect(panel.getByRole('alert')).toHaveCount(0);
  await expect(panel.getByText('Созданы').locator('..')).toContainText('1');

  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate((dark) => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; }, width === 375);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).include('dialog, [role="dialog"]').analyze()).violations).toEqual([]);
    await page.screenshot({ path: `${REPORTS}/customer-import-${width}.png`, fullPage: true });
  }

  await page.keyboard.press('Escape');
  await page.reload();
  await main.getByRole('button', { name: 'Проверить CSV', exact: true }).click();
  panel = page.getByRole('dialog', { name: 'Проверка CSV клиентов' });
  await expect(panel.getByRole('heading', { name: 'Последний импорт: Завершён' })).toBeVisible();
  await panel.getByRole('button', { name: 'Отменить импорт', exact: true }).click();
  const confirm = page.getByRole('dialog', { name: 'Отменить импорт клиентов?' });
  await confirm.getByRole('button', { name: 'Отменить импорт', exact: true }).click();
  await expect(panel.getByRole('heading', { name: 'Последний импорт: Отменён' })).toBeVisible();
  await expect(customerTable.getByRole('row').filter({ hasText: 'Импорт Тест Первый' })).toHaveCount(0);
});

test('M4-B2: незавершённая загрузка после reload продолжает тот же job и сверяет пакеты с offset 0', async ({ page, request }) => {
  test.setTimeout(180_000);
  await openSalon(page, request);
  await page.goto('/customers');
  const main = page.getByRole('main');
  const customerTable = main.getByRole('table', { name: '', exact: true });
  await main.getByRole('button', { name: 'Проверить CSV', exact: true }).click();
  let panel = page.getByRole('dialog', { name: 'Проверка CSV клиентов' });
  const originalCsv = [
    'Имя;Телефон',
    'Восстановление Один;+7 700 000 72 01',
    'Восстановление Два;+7 700 000 72 02',
    'Восстановление Три;+7 700 000 72 03',
  ].join('\r\n');
  await selectAndCheck(panel, originalCsv, 'resume-original.csv');

  const firstActions: string[] = [];
  let command = 0;
  await page.route('**/*', async (route) => {
    const action = route.request().headers()['next-action'];
    if (route.request().method() === 'POST' && action) {
      command += 1;
      firstActions.push(action);
      // start и PUT rows прошли, submit не отправляем: на сервере остаётся UPLOADING 3/3.
      if (command === 3) return route.abort('failed');
    }
    return route.continue();
  });
  await panel.getByRole('button', { name: 'Импортировать 3 строк', exact: true }).click();
  await expect(panel.getByRole('heading', { name: 'Последний импорт: Загрузка файла' })).toBeVisible();
  await expect(panel.getByText('3 из 3 строк', { exact: true })).toBeVisible();
  await expect.poll(() => firstActions.length).toBe(3);
  const [startAction, uploadAction] = firstActions;
  expect(startAction).toBeTruthy();
  expect(uploadAction).toBeTruthy();
  await page.unroute('**/*');

  await page.reload();
  await main.getByRole('button', { name: 'Проверить CSV', exact: true }).click();
  panel = page.getByRole('dialog', { name: 'Проверка CSV клиентов' });
  await expect(panel.getByRole('heading', { name: 'Последний импорт: Загрузка файла' })).toBeVisible();

  const resumedActions: string[] = [];
  page.on('request', (browserRequest) => {
    const action = browserRequest.headers()['next-action'];
    if (browserRequest.method() === 'POST' && action) resumedActions.push(action);
  });
  const wrongCsv = 'Имя;Телефон\r\nДругой Один;+7 700 000 73 01\r\nДругой Два;+7 700 000 73 02';
  await selectAndCheck(panel, wrongCsv, 'resume-wrong.csv');
  await panel.getByRole('button', { name: 'Импортировать 2 строк', exact: true }).click();
  await expect(panel.getByRole('alert')).toContainText('другого числа строк');
  await expect(panel.getByRole('button', { name: 'Начать отдельный импорт', exact: true })).toBeVisible();
  expect(resumedActions).toEqual([]);

  await selectAndCheck(panel, originalCsv, 'resume-original.csv');
  await panel.getByRole('button', { name: 'Импортировать 3 строк', exact: true }).click();
  await expect(panel.getByRole('heading', { name: 'Последний импорт: Завершён' })).toBeVisible();
  await expect(customerTable.getByRole('row').filter({ hasText: 'Восстановление Один' })).toHaveCount(1);
  // Если бы UI создал новый job, первым снова пришёл бы startAction. Успешный replay uploadAction
  // одновременно доказывает, что сервер получил тот же job и receipt пакета с offset 0 совпал.
  expect(resumedActions).not.toContain(startAction);
  expect(resumedActions).toContain(uploadAction);
});

async function selectAndCheck(panel: Locator, csv: string, name: string) {
  await panel.getByLabel('CSV с клиентами').setInputFiles({
    name, mimeType: 'text/csv', buffer: Buffer.from(csv),
  });
  await panel.getByRole('button', { name: 'Проверить строки', exact: true }).click();
  await expect(panel.getByText('Проверка завершена. Данные ещё не импортированы.', { exact: true })).toBeVisible();
}

async function openSalon(page: Page, request: APIRequestContext) {
  await request.post(`${FIXTURE_API}/__test/reset`);
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
  await page.goto('/branches');
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Добавить', exact: true }).click();
  const creation = page.getByRole('dialog', { name: 'Добавить бизнес или филиал' });
  await creation.getByLabel('Новый бизнес или бренд').check();
  await creation.getByRole('radio', { name: 'Салон красоты или студия' }).check();
  await creation.getByLabel('Название бизнеса', { exact: true }).fill('Студия Импорт');
  await creation.getByRole('button', { name: 'Создать бизнес', exact: true }).click();
  await expect(creation.getByRole('status')).toContainText('Салон создан');
  await page.reload();
  await main.getByRole('button', { name: 'Открыть объект: Студия Импорт', exact: true }).click();
  await page.waitForURL('**/today');
}
