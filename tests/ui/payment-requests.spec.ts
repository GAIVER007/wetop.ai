import AxeBuilder from '@axe-core/playwright';
import { expect, test, FIXTURE_API } from './fixtures';

/**
 * «Запросы оплаты» в «Счетах» брони (DATA_MODEL §24, ADR-144): администратор выставляет счёт Kaspi по телефону или
 * вставляет ссылку банка, копирует гостю готовый текст на нужном языке, «Оплачено» превращает запрос в платёж на
 * счёт проживания; оплаченный не отменяется; ссылка не https — отказ словами, ввод не теряется.
 */
const fixture = FIXTURE_API;
const NUMBER = '20260913-TESTAA';
test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

async function open(page: import('@playwright/test').Page) {
  await page.goto(`/reservations/${NUMBER}`);
  await page.getByRole('tab', { name: 'Счета', exact: true }).click();
  return page.getByTestId('payment-requests');
}

test('Kaspi: запрос с остатком по умолчанию, текст гостю, «Оплачено» даёт платёж на счёт', async ({
  page,
}) => {
  const panel = await open(page);
  await expect(panel.getByTestId('payment-request-amount')).not.toHaveValue('');
  await panel.getByTestId('payment-request-amount').fill('12000');
  await panel.getByTestId('payment-request-create').click();
  await expect(panel.getByTestId('payment-request-done')).toContainText('12 000 ₸');
  const row = panel.getByTestId('payment-request');
  await expect(row).toHaveAttribute('data-status', 'PENDING');
  await expect(panel.getByTestId('payment-requests-pending')).toHaveText('ждут оплаты: 1');
  await expect(row.getByTestId('payment-request-text')).toContainText(
    `счёт на оплату брони ${NUMBER}, 12 000 ₸. Счёт выставлен в Kaspi на ваш номер телефона`,
  );
  // язык текста гостю
  await panel.getByTestId('payment-request-lang').selectOption('en');
  await expect(row.getByTestId('payment-request-text')).toContainText(
    'payment request for booking',
  );
  await row.getByTestId('payment-request-paid').click();
  await page.getByRole('button', { name: 'Оплачено', exact: true }).last().click();
  await expect(row).toHaveAttribute('data-status', 'PAID');
  await expect(row).toContainText('оплачен');
  await expect(page.getByTestId('folio-panel').first()).toContainText('Оплата по запросу');
});

test('ссылка банка не https — отказ словами, ссылка и сумма остаются в форме', async ({ page }) => {
  const panel = await open(page);
  await panel.getByTestId('payment-request-method').selectOption('HALYK');
  await panel.getByTestId('payment-request-amount').fill('5000');
  // type=url пропускает http: проверку держит сервер
  await panel.getByTestId('payment-request-link').fill('http://bank.example/p/1');
  await panel.getByTestId('payment-request-create').click();
  await expect(panel.getByTestId('payment-request-error')).toContainText('https://');
  await expect(panel.getByTestId('payment-request-link')).toHaveValue('http://bank.example/p/1');
  await expect(panel.getByTestId('payment-request-amount')).toHaveValue('5000');
  await expect(panel.getByTestId('payment-request')).toHaveCount(0);
});

test('отмена ожидающего запроса с подтверждением; ссылка банка попадает в текст', async ({
  page,
}) => {
  const panel = await open(page);
  await panel.getByTestId('payment-request-method').selectOption('HALYK');
  await panel.getByTestId('payment-request-amount').fill('5000');
  await panel.getByTestId('payment-request-link').fill('https://epay.example/p/1');
  await panel.getByTestId('payment-request-create').click();
  const row = panel.getByTestId('payment-request');
  await expect(row.getByTestId('payment-request-text')).toContainText('https://epay.example/p/1');
  await row.getByTestId('payment-request-cancel').click();
  await page.getByRole('button', { name: 'Отменить запрос', exact: true }).click();
  await expect(row).toHaveAttribute('data-status', 'CANCELLED');
  await expect(row.getByTestId('payment-request-text')).toHaveCount(0);
});

for (const theme of ['light', 'dark'] as const) {
  for (const width of [1440, 390]) {
    test(`доступность блока: ${theme}, ${width} px`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.setViewportSize({ width, height: 900 });
      const panel = await open(page);
      await panel.getByTestId('payment-request-amount').fill('12000');
      await panel.getByTestId('payment-request-create').click();
      await expect(panel.getByTestId('payment-request')).toHaveCount(1);
      const result = await new AxeBuilder({ page })
        .include('[data-testid="payment-requests"]')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
      // на телефоне раздел «Счета» не уезжает вбок (до 03.10 формы счёта давали 434 px при 390)
      const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(pageWidth).toBeLessThanOrEqual(page.viewportSize()!.width);
      if (width === 390)
        await panel.screenshot({
          path: `reports/payment-requests-2026-10-03/panel-${theme}-390.png`,
        });
      else
        await panel.screenshot({
          path: `reports/payment-requests-2026-10-03/panel-${theme}-1440.png`,
        });
    });
  }
}
