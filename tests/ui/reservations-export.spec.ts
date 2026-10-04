import { readFile } from 'node:fs/promises';
import { expect, test, FIXTURE_API } from './fixtures';

/**
 * «Скачать CSV» на экране «Брони» (H11, ADR-144): тот же отбор в файл для Excel, без имён и контактов гостей.
 */
const fixture = FIXTURE_API;
test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

test('отбор экрана уходит в CSV: номер брони есть, имени гостя нет', async ({ page }) => {
  await page.goto('/reservations');
  await page.getByLabel('Статус брони', { exact: true }).selectOption('CONFIRMED');
  await page.getByLabel('Поиск броней').fill('Тестовый');
  await page.getByRole('button', { name: 'Показать', exact: true }).click();
  await expect(page.getByTestId('reservations-table').locator('tbody tr')).toHaveCount(1);
  const link = page.getByRole('main').getByTestId('reservations-export');
  await expect(link).toHaveAttribute('href', /status=CONFIRMED/);
  const [download] = await Promise.all([page.waitForEvent('download'), link.click()]);
  const csv = await readFile((await download.path())!, 'utf8');
  const [head, ...lines] = csv.replace(/^\uFEFF/, '').split('\r\n');
  expect(head).toBe(
    'Бронь;Статус;Источник;Канал;Заезд;Выезд;Ночей;Размещений;Места;Сумма, ₸;Оплачено, ₸;Остаток, ₸',
  );
  expect(lines).toHaveLength(1);
  expect(lines[0]).toMatch(/^20260913-TESTAA;подтверждена;/);
  expect(csv).not.toContain('Тестовый');
});
