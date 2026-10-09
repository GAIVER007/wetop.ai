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
