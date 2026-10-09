import AxeBuilder from '@axe-core/playwright';
import { FIXTURE_API, expect, test, type Page } from './fixtures';

/**
 * «Отчёты → Финансы» (RPT2.4a, `plans/reports-2-0-rpt24-cashflow-2026-10-09.md`): деньги за период по дням.
 * Подставной API без базы: проверяет, что экран показывает ответ API без пересчёта и что итоги таблицы равны плиткам.
 */
const today = new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
const monthFrom = `${today.slice(0, 7)}-01`;
const monthTo = new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7), 0))
  .toISOString()
  .slice(0, 10);

/** «1 500 000 ₸», «−50 000,50 ₸» → минорные единицы строкой */
function minorOf(text: string): string {
  const clean = text.replace(/[\s ₸]/g, '').replace('−', '-');
  const neg = clean.startsWith('-');
  const [whole = '0', frac = ''] = clean.replace('-', '').split(',');
  const v = BigInt(whole || '0') * 100n + BigInt((frac + '00').slice(0, 2));
  return (neg ? -v : v).toString();
}

async function apiFlow(page: Page, from: string, to: string) {
  const login = await page.request.post(`${FIXTURE_API}/auth/login`, {
    data: { email: 'admin@wetop.test', password: 'ui-test-parol' },
    headers: { 'x-wetop-test-client': '1' },
  });
  const { token } = await login.json();
  const r = await page.request.get(
    `${FIXTURE_API}/finance/cashflow?${new URLSearchParams({ from, to })}`,
    {
      headers: { authorization: `Bearer ${token}`, 'x-wetop-test-client': '1' },
    },
  );
  expect(r.ok()).toBe(true);
  return r.json();
}

test('плитки равны ответу API, итог таблицы равен плиткам, вкладка «Финансы» в разделе', async ({
  page,
}) => {
  const api = await apiFlow(page, monthFrom, monthTo);
  await page.goto('/reports/finance');
  const tabs = page.getByRole('navigation', { name: 'Отчёты' });
  await expect(tabs.getByRole('link', { name: 'Финансы' })).toHaveAttribute('aria-current', 'page');
  const kpi = (id: string) => page.getByTestId(`pa-kpi-${id}`);
  const t = api.totals;
  expect(minorOf(await kpi('cf-receipts').innerText())).toBe(t.receiptsMinor);
  expect(minorOf(await kpi('cf-refunds').innerText())).toBe(t.refundsMinor);
  expect(minorOf(await kpi('cf-net').innerText())).toBe(t.netReceiptsMinor);
  expect(minorOf(await kpi('cf-income').innerText())).toBe(t.incomeMinor);
  expect(minorOf(await kpi('cf-expense').innerText())).toBe(t.expenseMinor);
  expect(minorOf(await kpi('cf-flow').innerText())).toBe(t.cashFlowMinor);
  // четыре разных показателя не выводятся друг из друга: чистые это поступления минус возвраты, не «прибыль»
  expect(BigInt(t.netReceiptsMinor)).toBe(BigInt(t.receiptsMinor) - BigInt(t.refundsMinor));
  const total = page.getByTestId('cf-total').locator('td');
  expect(minorOf(await total.nth(0).innerText())).toBe(t.receiptsMinor);
  expect(minorOf(await total.nth(1).innerText())).toBe(t.refundsMinor);
  expect(minorOf(await total.nth(5).innerText())).toBe(t.cashFlowMinor);
  await expect(page.getByTestId('cf-days').locator('tbody tr')).toHaveCount(api.days.length);
  await expect(page.getByTestId('cf-basis')).toContainText('По дате операции');
});

test('период в адресе: пресет меняет числа, раздел не теряется', async ({ page }) => {
  await page.goto('/reports/finance');
  await page.getByTestId('pa-toolbar').getByRole('link', { name: 'Сегодня' }).click();
  await expect(page).toHaveURL(/\/reports\/finance\?period=today|\/reports\/finance\?date=/);
  const api = await apiFlow(page, today, today);
  expect(minorOf(await page.getByTestId('pa-kpi-cf-receipts').innerText())).toBe(
    api.totals.receiptsMinor,
  );
  // выбора типа фонда у денег нет: их не разделить на номера и койки
  await expect(page.getByTestId('pa-fund')).toHaveCount(0);
});

test('пустой период: словами, без нулевых таблиц', async ({ page }) => {
  await page.goto('/reports/finance?period=custom&from=2020-01-01&to=2020-01-03');
  await expect(page.getByTestId('cf-empty')).toBeVisible();
  await expect(page.getByTestId('cf-days')).toHaveCount(0);
});

for (const theme of ['light', 'dark'] as const) {
  test(`доступность, ${theme}, и телефон без прокрутки вбок`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.goto('/reports/finance');
    await expect(page.getByTestId('cf-kpis')).toBeVisible();
    const scan = await new AxeBuilder({ page }).analyze();
    expect(scan.violations.map((v) => v.id)).toEqual([]);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
  });
}
