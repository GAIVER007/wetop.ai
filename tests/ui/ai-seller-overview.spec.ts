import { mkdirSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import type { APIRequestContext } from '@playwright/test';
import { FIXTURE_API, expect, test } from './fixtures';

/**
 * «Обзор» и «Аналитика» ИИ-продавца (SALES2.4, макет владельца 09.10.2026). Диалоги и лиды отдаёт подставной бот,
 * предложения и брони из чата считает сводка продаж (`/__test/sales` задаёт пары «текущий и прошлый отрезок»).
 */
const API = FIXTURE_API;
const SHOTS = 'reports/sales2-seller-2026-10-09';
const sales = (request: APIRequestContext, data: Record<string, unknown>) =>
  request.post(`${API}/__test/sales`, { data });
const control = (request: APIRequestContext, data: Record<string, unknown>) =>
  request.post(`${API}/__test/control`, { data });

test.beforeEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});
test.afterEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});

test('вкладки по макету: обзор, настройка, диалоги, знания, подключения, сценарии, аналитика', async ({ page }) => {
  await page.goto('/ai-seller/overview');
  const tabs = page.getByRole('navigation', { name: 'ИИ-продавец' }).getByRole('link');
  await expect(tabs).toHaveText(['Обзор', 'Настройка', 'Диалоги', 'Знания', 'Подключения', 'Сценарии', 'Аналитика']);
  await expect(page.getByRole('link', { name: 'Обзор', exact: true })).toHaveAttribute('aria-current', 'page');
});

test('обзор: восемь плиток, числа из бота и из сводки продаж', async ({ page, request }) => {
  await page.goto('/ai-seller/overview');
  const view = page.getByTestId('seller-overview');
  await expect(view.locator('.kpi-tile')).toHaveCount(8);
  await expect(page.getByTestId('seller-kpi-dialogs')).toHaveText(/^\d+$/);
  await expect(page.getByTestId('seller-kpi-offers')).toHaveText('8');
  await expect(page.getByTestId('seller-kpi-bookings')).toHaveText('3');
  await expect(view.locator('.kpi-tile', { hasText: 'Броней из чата' })).toContainText('+50 %');
  await expect(page.getByTestId('seller-kpi-conversion')).toHaveText('37,5 %');
  await expect(page.getByTestId('seller-kpi-revenue')).toContainText('90 000');
  await sales(request, { offered: [0, 0], booked: [0, 0], revenueMinor: ['0', '0'] });
  await page.reload();
  // без предложений конверсия это знак пропуска, а не 0 %
  await expect(page.getByTestId('seller-kpi-conversion')).toHaveText('–');
  await expect(page.getByTestId('seller-kpi-offers')).toHaveText('0');
});

test('обзор: диалог, которому нужен человек, виден списком и ведёт в диалоги', async ({ page }) => {
  await page.goto('/ai-seller/dialogs?mode=needs_human');
  const waiting = await page.getByRole('main').locator('a[href*="id="]').count();
  await page.goto('/ai-seller/overview');
  const panel = page.getByTestId('seller-overview-human');
  if (waiting === 0) await expect(panel).toContainText('Сейчас никто не ждёт');
  else {
    await expect(page.getByTestId('seller-overview-human-table').locator('tbody tr')).not.toHaveCount(0);
    await expect(page.getByTestId('seller-kpi-human')).not.toHaveText('–');
  }
});

test('сводка продаж не посчиталась: сказано словами, плитки бота живы', async ({ page, request }) => {
  await control(request, { failPath: '/sales/summary' });
  await page.goto('/ai-seller/overview');
  await expect(page.getByTestId('seller-overview-sales-error')).toContainText('Не удалось посчитать брони из чата');
  await expect(page.getByTestId('seller-kpi-offers')).toHaveText('–');
  await expect(page.getByTestId('seller-kpi-dialogs')).toHaveText(/^\d+$/);
});

test('аналитика: таблица периода и прошлого такого же, период переключается', async ({ page }) => {
  await page.goto('/ai-seller/analytics');
  const table = page.getByTestId('seller-analytics-table');
  await expect(table.locator('tbody tr').nth(0)).toContainText('Предложений брони');
  await expect(table.locator('tbody tr').nth(0)).toContainText('8');
  await expect(table.locator('tbody tr').nth(0)).toContainText('10');
  await expect(table.locator('tbody tr').nth(2)).toContainText('37,5 %');
  await expect(table.locator('tbody tr').nth(2)).toContainText('20 %');
  await expect(table.locator('tbody tr').nth(3)).toContainText('90 000');
  await expect(page.getByRole('link', { name: '30 дней', exact: true })).toHaveAttribute('aria-current', 'page');
  await page.getByRole('link', { name: '7 дней', exact: true }).click();
  await expect(page).toHaveURL(/days=7/);
  await expect(page.getByRole('link', { name: '7 дней', exact: true })).toHaveAttribute('aria-current', 'page');
});

test('аналитика: работа продавца за сутки, доля без человека, передачи и время первого ответа', async ({ page }) => {
  await page.goto('/ai-seller/analytics');
  await expect(page.getByTestId('seller-metric-automated')).toHaveText('66,7 %');
  await expect(page.getByTestId('seller-metric-handoffs')).toHaveText('1');
  await expect(page.getByTestId('seller-metric-reply-time')).toHaveText('42 с');
  await expect(page.getByTestId('seller-analytics-day')).toContainText('тире, а не 0');
});

test('аналитика: сводка недоступна, сказано словами', async ({ page, request }) => {
  await control(request, { failPath: '/sales/summary' });
  await page.goto('/ai-seller/analytics');
  await expect(page.getByTestId('seller-analytics-error')).toContainText('Не удалось посчитать аналитику');
});

for (const view of ['overview', 'scenarios', 'analytics'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    for (const width of [1440, 390]) {
      test(`доступность и снимки: ${view}, ${theme}, ${width}px`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: theme });
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`/ai-seller/${view}`);
        await expect(page.getByTestId(`seller-${view}`)).toBeVisible();
        const scan = await new AxeBuilder({ page }).analyze();
        expect(scan.violations.map((v) => v.id)).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        mkdirSync(SHOTS, { recursive: true });
        await page.screenshot({ path: `${SHOTS}/${view}-${theme}-${width}.png`, fullPage: true });
      });
    }
  }
}

test('сценарии: работает «Продажи», «Поддержка сайта» помечена «скоро», конструктор честно назван будущим', async ({
  page,
}) => {
  await page.goto('/ai-seller/scenarios');
  const sales = page.getByTestId('seller-scenario-sales');
  await expect(sales).toContainText('Продажи');
  await expect(sales.getByRole('link', { name: 'Инструкция' })).toHaveAttribute('href', '/ai-seller');
  await expect(sales.getByRole('link', { name: 'знания' })).toHaveAttribute('href', '/ai-seller/knowledge');
  await expect(page.getByTestId('seller-scenario-support')).toContainText('скоро');
  await expect(page.getByTestId('seller-scenarios')).toContainText('конструктор поведения готовится');
  await expect(page.getByRole('link', { name: 'Сценарии', exact: true })).toHaveAttribute('aria-current', 'page');
});
