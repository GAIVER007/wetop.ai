import { mkdirSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

/**
 * Оболочка «Отчёты» (RPT2.2c-1, план `plans/reports-2-0-overview-2026-10-09.md`): вкладки раздела, «Обзор», «Загрузка» и
 * «По номерам» под адресами `/reports/*` теми же экранами, что в «Аналитике»; все ссылки внутри остаются в разделе.
 * Подставной API без базы (`tests/ui/README.md`): доказывает интерфейс и разбор адреса, не расчёты.
 */
const report = 'reports/reports-2-0-rpt2-1-2026-10-09/shell';

test('вкладки раздела и переходы между ними', async ({ page }) => {
  await page.goto('/reports/overview');
  const tabs = page.getByRole('navigation', { name: 'Отчёты' });
  await expect(tabs.getByRole('link')).toHaveText([
    'Обзор',
    'Загрузка',
    'По номерам',
    'Каналы',
    'Документы',
  ]);
  await expect(tabs.getByRole('link', { name: 'Обзор' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByTestId('pa-kpis')).toBeVisible();
  await tabs.getByRole('link', { name: 'Загрузка' }).click();
  await expect(page).toHaveURL(/\/reports\/occupancy/);
  await tabs.getByRole('link', { name: 'По номерам' }).click();
  await expect(page).toHaveURL(/\/reports\/units/);
  await tabs.getByRole('link', { name: 'Документы' }).click();
  await expect(page).toHaveURL(/\/reports$/);
  await expect(page.getByTestId('report-finance')).toBeVisible();
});

test('полоса периода не уводит из раздела: пресет, фонд и сравнение остаются на /reports', async ({
  page,
}) => {
  await page.goto('/reports/overview');
  const toolbar = page.getByTestId('pa-toolbar');
  await toolbar.getByRole('link', { name: 'Прошлый месяц' }).click();
  await expect(page).toHaveURL(/\/reports\/overview\?period=last-month/);
  await page.getByTestId('pa-fund').getByRole('link', { name: 'Номера' }).click();
  await expect(page).toHaveURL(/\/reports\/overview\?.*fund=rooms/);
  await page.getByTestId('pa-compare-toggle').click();
  await expect(page).toHaveURL(/compare=0/);
  expect(page.url()).not.toContain('/management/');
});

for (const theme of ['light', 'dark'] as const) {
  test(`обзор: доступность и снимки, ${theme}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.goto('/reports/overview');
    await expect(page.getByTestId('pa-kpis')).toBeVisible();
    const scan = await new AxeBuilder({ page }).analyze();
    expect(scan.violations.map((v) => v.id)).toEqual([]);
    mkdirSync(report, { recursive: true });
    await page.screenshot({ path: `${report}/overview-${theme}-1440.png`, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({ path: `${report}/overview-${theme}-390.png`, fullPage: true });
  });
}

/** Ответ сводки прямо из подставного API: как его читает стойка (вход тестовым сотрудником) */
async function dashboardJson(page: import('@playwright/test').Page, qs: Record<string, string>) {
  const api = 'http://127.0.0.1:4311';
  const login = await page.request.post(`${api}/auth/login`, {
    data: { email: 'admin@wetop.test', password: 'ui-test-parol' },
    headers: { 'x-wetop-test-client': '1' },
  });
  const { token } = await login.json();
  const r = await page.request.get(`${api}/desk/dashboard?${new URLSearchParams(qs)}`, {
    headers: { authorization: `Bearer ${token}`, 'x-wetop-test-client': '1' },
  });
  expect(r.ok()).toBe(true);
  return r.json();
}

test('категория: фильтр в адресе, в сводке одна категория, список выбора остаётся полным', async ({
  page,
}) => {
  const today = new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
  const from = `${today.slice(0, 7)}-01`;
  const to = new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7), 0))
    .toISOString()
    .slice(0, 10);
  const all = await dashboardJson(page, { from, to });
  const options = all.current.categoryOptions as Array<{ code: string; name: string }>;
  expect(options.length).toBeGreaterThan(1);
  const pick = options[0]!;
  const one = await dashboardJson(page, { from, to, category: pick.code });
  expect(one.current.units).toBeLessThan(all.current.units);
  expect(one.current.categoryOptions).toEqual(all.current.categoryOptions);

  await page.goto('/reports/overview');
  const nav = page.getByTestId('pa-category');
  await expect(nav.getByRole('link')).toHaveCount(options.length + 1);
  await nav.getByRole('link', { name: pick.name, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`category=${pick.code}`));
  await expect(page.getByTestId('pa-category').getByRole('link')).toHaveCount(options.length + 1);
  await expect(
    page.getByTestId('pa-category').getByRole('link', { name: pick.name, exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  // подпись выбранного дня на графике загрузки сходится с ответом API по этой категории
  const d =
    one.current.daily.find((x: { date: string }) => x.date === today) ?? one.current.daily.at(-1);
  await expect(page.getByTestId('pa-chart-occupancy-day')).toContainText(
    `занято ${d.occupied}, свободно ${d.free}, заблокировано ${d.blocked}`,
  );
  // пресет периода не теряет категорию
  await page.getByTestId('pa-toolbar').getByRole('link', { name: '7 дней' }).click();
  await expect(page).toHaveURL(new RegExp(`category=${pick.code}`));
  // сброс
  await page.getByTestId('pa-category').getByRole('link', { name: 'Все категории' }).click();
  await expect(page).not.toHaveURL(/category=/);
});

test('детализация: по неделям столбиков столько же, сколько недель, подпись говорит про период', async ({
  page,
}) => {
  await page.goto('/reports/overview?by=week');
  const bars = page.getByTestId('pa-chart-occupancy').locator('.bar');
  const today = new Date(Date.now() + 5 * 3600_000);
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const mondays = new Set<number>();
  for (let day = 1; day <= last; day++) {
    const dt = new Date(Date.UTC(y, m, day));
    mondays.add(day - ((dt.getUTCDay() + 6) % 7));
  }
  await expect(bars).toHaveCount(mondays.size);
  await expect(page.getByRole('button', { name: 'Следующий период' }).first()).toBeVisible();
  await expect(
    page.getByTestId('pa-granularity').getByRole('link', { name: 'По неделям' }),
  ).toHaveAttribute('aria-current', 'page');
  await page.goto('/reports/overview?by=month');
  await expect(page.getByTestId('pa-chart-occupancy').locator('.bar')).toHaveCount(1);
  await page.getByTestId('pa-granularity').getByRole('link', { name: 'По дням' }).click();
  await expect(page).not.toHaveURL(/by=/);
});
