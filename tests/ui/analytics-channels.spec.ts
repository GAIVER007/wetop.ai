import { expect, test, FIXTURE_API } from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';

/**
 * «Аналитика → Каналы» (ADR-141): эффективность каналов продаж: доход и доля, ночи и доля, средняя стоимость
 * ночи, «Итого». Числа страницы сверяются с ответом подставного API (он считает тем же доменным расчётом,
 * что настоящий): итог равен сумме строк, отбор, сортировка, сравнение и CSV живут в адресе.
 */
const fixture = FIXTURE_API;
const report = 'reports/analytics-channels-2026-10-03';
const today = new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
const monthFrom = `${today.slice(0, 8)}01`;
const monthTo = (() => {
  const [y, m] = today.split('-').map(Number);
  return new Date(Date.UTC(y!, m!, 0)).toISOString().slice(0, 10);
})();
const digits = (text: string) => Number(text.replace(/\D/g, ''));

interface Row {
  label: string;
  source: string;
  revenueMinor: string;
  nights: number;
  adrMinor: string | null;
}
interface Report {
  rows: Row[];
  channels: Array<{ label: string; source: string }>;
  totals: { revenueMinor: string; nights: number; bookings: number };
}

async function api(
  request: import('@playwright/test').APIRequestContext,
  extra = '',
): Promise<{ current: Report; previous: Report | null }> {
  const res = await request.get(
    `${fixture}/desk/dashboard/channels?from=${monthFrom}&to=${monthTo}${extra}`,
    { headers: { 'x-wetop-test-client': '1' } },
  );
  expect(res.ok()).toBe(true);
  return (await res.json()) as { current: Report; previous: Report | null };
}

test.beforeEach(async ({ page }) => {
  await page.request.post(`${fixture}/__test/reset`);
});

test('вкладка «Каналы»: строки по каналам за месяц, итог равен сумме строк и ответу API', async ({
  page,
  request,
}) => {
  const { current } = await api(request);
  expect(current.rows.length).toBeGreaterThan(0);
  const main = page.getByRole('main');
  await page.goto('/management/analytics/channels');
  await expect(main.getByTestId('pa-tabs').getByRole('link', { name: 'Каналы' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(main.getByTestId('pa-channels-meta')).toContainText('Брони с заездом с');
  const rows = main.getByTestId('pa-channels-row');
  await expect(rows).toHaveCount(current.rows.length);
  // порядок по доходу: первая строка: канал с наибольшим доходом
  expect(BigInt(current.rows[0]!.revenueMinor)).toBeGreaterThanOrEqual(
    BigInt(current.rows.at(-1)!.revenueMinor),
  );
  const total = main.getByTestId('pa-channels-total');
  await expect(total).toContainText('Итого');
  await expect(total).toContainText('100 %');
  const nightsCell = (await total.locator('td').nth(1).innerText()).split('\n')[0]!;
  expect(digits(nightsCell)).toBe(current.totals.nights);
  expect(current.totals.nights).toBe(current.rows.reduce((s, r) => s + r.nights, 0));
  expect(BigInt(current.totals.revenueMinor)).toBe(
    current.rows.reduce((s, r) => s + BigInt(r.revenueMinor), 0n),
  );
  // сортировка: заголовком колонки, адрес несёт порядок
  await main.getByRole('link', { name: 'Сортировать по ночам' }).click();
  await expect(page).toHaveURL(/sort=nights/);
  await expect(
    main.locator('th', { has: page.getByRole('link', { name: 'Сортировать по ночам' }) }),
  ).toHaveAttribute(
    'aria-sort',
    'descending',
  );
});

test('отбор по каналу, каналы без броней и сравнение: из полосы отбора', async ({
  page,
  request,
}) => {
  const { current } = await api(request);
  const pick = current.channels[0]!;
  const main = page.getByRole('main');
  await page.goto('/management/analytics/channels');
  await main.getByTestId('pa-channels-select').selectOption(pick.label);
  await main.getByRole('button', { name: 'Применить' }).click();
  await expect(page).toHaveURL(new RegExp(`channel=${encodeURIComponent(pick.label)}`));
  await expect(main.getByTestId('pa-channels-row')).toHaveCount(1);
  // список каналов при отборе не сокращается
  await expect(main.getByTestId('pa-channels-select').locator('option')).toHaveCount(
    current.channels.length + 1,
  );

  await page.goto('/management/analytics/channels?empty=1');
  const withEmpty = await api(request, '&empty=1');
  expect(withEmpty.current.rows.length).toBeGreaterThan(current.rows.length);
  await expect(main.getByTestId('pa-channels-row')).toHaveCount(withEmpty.current.rows.length);
  await expect(main.getByText('броней нет').first()).toBeVisible();

  await page.goto('/management/analytics/channels');
  await main.getByLabel('Сравнить с периодом').check();
  await main.getByRole('button', { name: 'Применить' }).click();
  await expect(page).toHaveURL(/compare=1/);
  await expect(main.getByTestId('pa-channels-meta')).toContainText('сравнение с');
  await expect(main.getByTestId('pa-channels-total')).toContainText('было');
});

test('CSV: те же строки и итог, с разделителем «;» и BOM', async ({ page, request }) => {
  const { current } = await api(request);
  await page.goto('/management/analytics/channels');
  const href = await page.getByTestId('pa-channels-export').getAttribute('href');
  expect(href).toContain('/management/analytics/channels/export?');
  const res = await page.request.get(href!);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('text/csv');
  const text = await res.text();
  expect(text.charCodeAt(0)).toBe(0xfeff);
  const lines = text.trim().split('\r\n');
  expect(lines[0]).toContain('Канал;Брони;Доход');
  expect(lines).toHaveLength(current.rows.length + 2);
  expect(lines.at(-1)).toMatch(/^Итого;/);
});

test('пустой период и отказ API: словами, не падение страницы', async ({ page }) => {
  const main = page.getByRole('main');
  await page.goto('/management/analytics/channels?from=2001-01-01&to=2001-01-31');
  await expect(main.getByTestId('pa-channels-empty')).toContainText('нет броней');
  await page.goto('/management/analytics/channels?from=2026-13-01&to=2026-01-01');
  await expect(main.getByRole('alert').or(main.locator('.alert')).first()).toContainText(
    'Показан текущий месяц',
  );
  const down = await page.request.post(`${fixture}/__test/control`, {
    data: { failPath: '/desk/dashboard/channels' },
  });
  expect(down.ok()).toBe(true);
  await page.goto('/management/analytics/channels');
  await expect(main.getByTestId('pa-channels-error')).toBeVisible();
  // полоса отбора остаётся: можно сменить период
  await expect(main.getByTestId('pa-channels-form')).toBeVisible();
});

test('телефон: страница без горизонтальной прокрутки', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/management/analytics/channels');
  await expect(page.getByTestId('pa-channels-table')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
});

for (const theme of ['light', 'dark'] as const) {
  test(`доступность и снимки, ${theme}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/management/analytics/channels?compare=1');
    await expect(page.getByTestId('pa-channels-total')).toBeVisible();
    const scan = await new AxeBuilder({ page }).analyze();
    expect(scan.violations.map((v) => v.id)).toEqual([]);
    await page.mouse.move(0, 0);
    mkdirSync(report, { recursive: true });
    await page.screenshot({ path: `${report}/${theme}-1440.png`, caret: 'initial', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    const phone = await new AxeBuilder({ page }).analyze();
    expect(phone.violations.map((v) => v.id)).toEqual([]);
    await page.screenshot({ path: `${report}/${theme}-390.png`, caret: 'initial', fullPage: true });
  });
}

test('вход в отчёт: из раздела «Каналы» и с хаба «Отчёты» с тем же периодом', async ({ page }) => {
  await page.goto('/channels/list');
  await expect(
    page.getByTestId('channel-efficiency-link').getByRole('link', { name: /Эффективность каналов/ }),
  ).toHaveAttribute('href', '/management/analytics/channels');
  await page.goto(`/reports?from=${monthFrom}&to=${monthTo}`);
  await expect(page.getByTestId('report-sources')).toHaveAttribute(
    'href',
    `/management/analytics/channels?from=${monthFrom}&to=${monthTo}`,
  );
});
