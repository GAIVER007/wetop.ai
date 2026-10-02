import { mkdirSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

/**
 * Отчёт по услугам (REP2, план `plans/reports-hub-2026-10-02.md` §3): вкладка «Услуги» на «Финансах» —
 * свод начислений-услуг периода из `/finance/services-report`, «Итого» равно строке «Услуги» в обзоре
 * (то же окно, те же правила), начисления без услуги справочника — строкой «Начислено вручную»;
 * CSV без обрезки; на хабе «Отчёты» — карточка из уже загруженной сводки.
 */
const fixture = 'http://127.0.0.1:4311';
const report = 'reports/finance-services-2026-10-02';

const today = new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const now = new Date(`${today}T00:00:00Z`);
const monthFrom = iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
const monthTo = iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)));
const url = `/finance?from=${monthFrom}&to=${monthTo}`;

const digits = (text: string) => text.replace(/[^\d]/g, '');

interface Services {
  count: number;
  totalMinor: string;
  rows: Array<{ name: string | null; group: string | null; charges: number; quantity: number; amountMinor: string }>;
}

async function servicesOf(request: import('@playwright/test').APIRequestContext): Promise<Services> {
  const res = await request.get(
    `${fixture}/finance/services-report?from=${monthFrom}&to=${monthTo}`,
    { headers: { 'x-wetop-test-client': '1' } },
  );
  expect(res.ok()).toBe(true);
  return (await res.json()) as Services;
}

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});
test.afterEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

test('вкладка «Услуги»: строки из API, «вручную» словами, «Итого» равно строке «Услуги» обзора', async ({
  page,
  request,
}) => {
  const data = await servicesOf(request);
  expect(data.rows.length, 'в фикстуре нужны услуги').toBeGreaterThan(1);
  expect(data.rows.some((x) => x.name === null), 'и начисление вручную').toBe(true);
  await page.goto(url);
  const main = page.getByRole('main');

  // строка «Услуги» в «По видам начислений» — ссылка на вкладку
  const serviceLink = main
    .getByTestId('charges-table')
    .getByRole('link', { name: 'Услуги', exact: true });
  const serviceAmount = digits(
    await main
      .getByTestId('charges-table')
      .getByTestId('report-row')
      .nth(1)
      .locator('td:last-child')
      .innerText(),
  );
  await serviceLink.click();
  await expect(page).toHaveURL(/#services$/);

  const table = main.getByTestId('services-table');
  await expect(table.getByRole('columnheader')).toHaveText([
    'Услуга',
    'Группа',
    'Начислений',
    'Штук',
    'Сумма',
  ]);
  await expect(main.getByTestId('service-row')).toHaveCount(data.rows.length);
  // крупные первыми; начисления без услуги справочника — словами
  await expect(main.getByTestId('service-row').first()).toContainText(data.rows[0]!.name!);
  await expect(table).toContainText('Начислено вручную');
  // итог вкладки равен сумме API и строке «Услуги» обзора
  const total = digits(await main.getByTestId('services-total').innerText());
  expect(total).toBe(String(BigInt(data.totalMinor) / 100n));
  expect(total).toBe(serviceAmount);
  await expect(main.getByTestId('services-meta')).toContainText(`${data.count} начисления`);
});

test('CSV услуг: кнопка на вкладке, файл со сводом и строкой «вручную»', async ({ page }) => {
  await page.goto(`${url}#services`);
  const link = page.getByTestId('services-export');
  await expect(link).toHaveAttribute(
    'href',
    `/finance/export-services?from=${monthFrom}&to=${monthTo}`,
  );
  const res = await page.request.get(`/finance/export-services?from=${monthFrom}&to=${monthTo}`);
  expect(res.ok()).toBe(true);
  expect(res.headers()['content-type']).toContain('text/csv');
  const body = await res.text();
  expect(body.split('\r\n')[0]).toBe('﻿Услуга;Группа;Начислений;Штук;Сумма, ₸');
  expect(body).toContain('Начислено вручную');
});

test('хаб «Отчёты»: карточка услуг с суммой из сводки ведёт на вкладку', async ({
  page,
  request,
}) => {
  const data = await servicesOf(request);
  await page.goto('/reports');
  const card = page.getByTestId('report-services');
  await expect(card).toHaveAttribute('href', `/finance?from=${monthFrom}&to=${monthTo}#services`);
  expect(digits(await card.locator('.report-card__value').innerText())).toBe(
    String(BigInt(data.totalMinor) / 100n),
  );
  await card.click();
  await expect(page).toHaveURL(new RegExp('/finance\\?from=.*#services$'));
  await expect(page.getByTestId('services-table')).toBeVisible();
});

test('пустая база: вкладка честно говорит, что начислений нет', async ({ page, request }) => {
  await request.post(`${fixture}/__test/control`, { data: { noBookings: true } });
  await page.goto(`${url}#services`);
  await expect(page.getByTestId('services-empty')).toContainText('Начислений за услуги');
  await expect(page.getByTestId('services-export')).toHaveCount(0);
});

for (const theme of ['light', 'dark'] as const) {
  test(`доступность и снимки, ${theme}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${url}#services`);
    await expect(page.getByTestId('services-table')).toBeVisible();
    const scan = await new AxeBuilder({ page }).analyze();
    expect(scan.violations.map((v) => v.id)).toEqual([]);
    await page.mouse.move(0, 0);
    mkdirSync(report, { recursive: true });
    await page.screenshot({ path: `${report}/${theme}-1440.png`, caret: 'initial', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId('services-table')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({ path: `${report}/${theme}-390.png`, caret: 'initial', fullPage: true });
  });
}
