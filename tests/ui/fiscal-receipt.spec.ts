import AxeBuilder from '@axe-core/playwright';
import { FIXTURE_API, expect, test } from './fixtures';

/**
 * Фискальный чек по запросу гостя (DATA_MODEL §26, ADR-144): касса объекта пробивает чек, администратор отмечает его
 * номер у платежа в «Счетах» брони. Пустой номер — отказ словами; после отметки форма уступает место номеру.
 */
const fixture = FIXTURE_API;
const NUMBER = '20260913-TESTAA';
test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

async function paidBooking(page: import('@playwright/test').Page) {
  await page.goto(`/reservations/${NUMBER}`);
  await page.getByRole('tab', { name: 'Счета', exact: true }).click();
  const panel = page.getByTestId('payment-requests');
  await panel.getByTestId('payment-request-amount').fill('12000');
  await panel.getByTestId('payment-request-create').click();
  await panel.getByTestId('payment-request-paid').click();
  await page.getByRole('button', { name: 'Оплачено', exact: true }).last().click();
  await expect(panel.getByTestId('payment-request')).toHaveAttribute('data-status', 'PAID');
  return page.getByTestId('payment-row').filter({ hasText: 'Оплата по запросу' });
}

test('гость попросил чек: номер из кассы ложится к платежу', async ({ page }) => {
  const row = await paidBooking(page);
  const form = row.getByTestId('receipt-form');
  await form.getByLabel('Номер чека из кассы').fill('  ФП 0001234  ');
  await form.getByRole('button', { name: 'чек выдан' }).click();
  await expect(row.getByTestId('payment-receipt')).toHaveText('№ ФП 0001234');
  await expect(row.getByTestId('receipt-form')).toHaveCount(0);
});

for (const scheme of ['light', 'dark'] as const)
  for (const width of [1440, 390])
    test(`доступность «Счетов» с колонкой чека: ${scheme}, ${width}px`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize({ width, height: 900 });
      const row = await paidBooking(page);
      await expect(row.getByTestId('receipt-form')).toBeVisible();
      const axe = await new AxeBuilder({ page })
        .include('[data-testid="payment-row"]')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(axe.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    });
