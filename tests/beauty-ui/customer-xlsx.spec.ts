import { test, expect } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { seed } from './tz11-helpers';

const file = (rows: string[][]) => {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Клиенты');
  return {
    name: 'synthetic-customers.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }),
  };
};

test('customers: real XLSX preview, import, duplicate detection and filtered export', async ({
  page,
  request,
}) => {
  test.setTimeout(180000);
  const f = await seed(page, request);
  await page.goto('/customers');
  await page.getByRole('button', { name: 'Импортировать клиентов', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Импортировать клиентов', exact: true });
  const upload = dialog.getByLabel('Файл с клиентами: CSV или Excel', { exact: true });
  // Один импорт на окно (решение владельца 20.10.2026): Excel идёт тем же надёжным путём, что CSV
  await expect(dialog.locator('input[type="file"]')).toHaveCount(1);
  await expect(dialog.getByRole('status')).toHaveCount(1);
  const source = file([
    ['Имя', 'Телефон'],
    ['Тестовый Первый', '+77000000001'],
    ['Тестовый Второй', '+77000000002'],
  ]);
  await upload.setInputFiles(source);
  await dialog.getByRole('button', { name: 'Проверить строки', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Готовы: 2', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Импортировать 2 строк', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Последний импорт: Завершён' })).toBeVisible({ timeout: 20000 });
  await expect(dialog.getByText('Созданы').locator('..')).toContainText('2');
  await dialog.getByRole('button', { name: /^Закрыть:/ }).click();
  // импортированные без визита в «Пока без визита» (владелец 02.11.2026, #1029: «Клиенты» = пришли и оплатили)
  await page.getByRole('combobox', { name: 'Сегмент' }).selectOption('pending');
  await expect(page.locator('.beauty-customers-table')).toContainText('Тестовый Первый');
  await expect(page.locator('.beauty-customers-table')).toContainText('Тестовый Второй');
  // тот же файл ещё раз: сервер узнаёт клиентов по телефону и не создаёт вторые карточки
  await page.getByRole('button', { name: 'Импортировать клиентов', exact: true }).click();
  await upload.setInputFiles(source);
  await dialog.getByRole('button', { name: 'Проверить строки', exact: true }).click();
  await dialog.getByRole('button', { name: 'Импортировать 2 строк', exact: true }).click();
  await expect(dialog.getByText('Уже были в салоне').locator('..')).toContainText('2', { timeout: 20000 });
  await expect(dialog.getByText('Созданы').locator('..')).toContainText('0');
  await dialog.getByRole('button', { name: /^Закрыть:/ }).click();
  expect(f.locations.length).toBeGreaterThan(0);
  await page.getByRole('searchbox', { name: 'Поиск по имени или телефону' }).fill('Первый');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Скачать Excel', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();
  const book = XLSX.read(readFileSync(downloadPath!), { type: 'buffer' });
  const rows = XLSX.utils.sheet_to_json<string[]>(book.Sheets[book.SheetNames[0]!]!, { header: 1 });
  expect(rows).toHaveLength(2);
  expect(rows[1]?.[0]).toBe('Тестовый Первый');
  expect(rows[1]?.[1]).toBe('+77000000001');
  expect(page.url()).not.toContain('Первый');
  const evidence = process.env.ZAPIS_EVIDENCE || 'test-results/zapis-report';
  mkdirSync(evidence, { recursive: true });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBeTruthy();
    await page.screenshot({ path: `${evidence}/customers-${width}.png`, fullPage: true });
  }
});
