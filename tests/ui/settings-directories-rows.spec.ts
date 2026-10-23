import type { Page } from '@playwright/test';
import { FIXTURE_API, expect, test } from './fixtures';

/**
 * «Справочники» без разрыва строк (порядок в «Настройках», 22.10.2026): ячейка с кнопками «Выше/Ниже» и
 * «Переименовать/Выключить» была `display: flex` прямо на `<td>`, выпадала из строки таблицы, и разделители строк
 * под кнопками разъезжались с остальными ячейками. Ячейка действий обязана оставаться ячейкой таблицы той же высоты,
 * а кнопки стоять в одну линию на ширине 1440.
 */
const API = FIXTURE_API;
test.use({ extraHTTPHeaders: { 'x-wetop-test-client': '1' } });
test.beforeEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});

async function signIn(page: Page) {
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
}

const rowGeometry = (page: Page, table: string) =>
  page.locator(`[data-testid="${table}"] tbody tr`).evaluateAll((rows) =>
    rows.map((row) => {
      const cells = [...row.querySelectorAll('td')];
      const last = cells.at(-1)!;
      const first = cells[0]!.getBoundingClientRect();
      const box = last.getBoundingClientRect();
      const buttons = [...last.querySelectorAll('button')].map((b) => b.getBoundingClientRect().top);
      return {
        display: getComputedStyle(last).display,
        topDelta: Math.round(Math.abs(box.top - first.top)),
        heightDelta: Math.round(Math.abs(box.height - first.height)),
        oneLine: buttons.length < 2 || Math.max(...buttons) - Math.min(...buttons) < 2,
      };
    }),
  );

test('способы оплаты и статьи кассы: кнопки в ячейке таблицы, строки ровные', async ({ page }) => {
  await signIn(page);
  await page.goto('/hotel-settings/directories');
  for (const table of ['payment-methods-table', 'cash-categories-table']) {
    await expect(page.getByTestId(table)).toBeVisible();
    const rows = await rowGeometry(page, table);
    expect(rows.length, table).toBeGreaterThan(1);
    for (const row of rows) {
      expect(row.display, table).toBe('table-cell');
      expect(row.topDelta, table).toBeLessThanOrEqual(1);
      expect(row.heightDelta, table).toBeLessThanOrEqual(1);
      expect(row.oneLine, table).toBe(true);
    }
  }
});
