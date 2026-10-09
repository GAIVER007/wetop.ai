import { mkdirSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import type { APIRequestContext } from '@playwright/test';
import { FIXTURE_API, expect, test, type Page } from './fixtures';

/**
 * Хаб «Продажи» по макету владельца (экран 1): шесть плиток показателей и три карточки (конкуренты, ИИ-продавец,
 * рекомендации). Подставной API считает сводку по заданным парам «текущий и прошлый отрезок» (`/__test/sales`).
 * Отели вымышленные (ADR-010).
 */
const API = FIXTURE_API;
const SHOTS = 'reports/sales2-hub-2026-10-09';
const control = (request: APIRequestContext, body: Record<string, unknown>) =>
  request.post(`${API}/__test/control`, { data: body });

test.beforeEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});
test.afterEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});

async function signIn(page: Page) {
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
}

const A = '00000000-0000-4000-8000-00000000000a';
const plus = (iso: string, n: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
async function seedMarket(request: APIRequestContext): Promise<string> {
  const reset = await request.post(`${API}/__test/market`, { data: {} });
  const { today } = (await reset.json()) as { today: string };
  const readings = [];
  // рынок почти полон на три ближайшие ночи: даёт подсказку «можно поднять цену»
  for (let i = 0; i < 14; i++)
    readings.push({ competitorId: A, stayDate: plus(today, i), observedOn: today, occupancyBp: i < 3 ? 9500 : 6000, source: 'MANUAL' });
  await request.post(`${API}/__test/market`, {
    data: { competitors: [{ id: A, name: 'Отель Алтын', distanceM: 200 }], readings },
  });
  return today;
}

test('пункт «Обзор продаж» первым в «Продажах»; шесть плиток по макету', async ({ page, request }) => {
  await seedMarket(request);
  await page.goto('/today');
  const menu = page.locator('.topmenu');
  await menu.getByRole('button', { name: 'Продажи', exact: true }).click();
  await menu.getByRole('link', { name: 'Обзор продаж', exact: true }).click();
  await expect(page).toHaveURL(/\/sales$/);
  await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toHaveText('Продажи');

  const kpis = page.getByTestId('sales-kpis');
  await expect(kpis.locator('.kpi-tile')).toHaveCount(6);
  await expect(page.getByTestId('sales-kpi-competitors')).toHaveText('1');
  await expect(kpis.locator('.kpi-tile', { hasText: 'Конкурентов в отслеживании' })).toContainText('+1');
  await expect(kpis.locator('.kpi-tile', { hasText: 'Конкурентов в отслеживании' })).toContainText('с прошлого месяца');
  await expect(page.getByTestId('sales-kpi-market')).toHaveText(/\d+\s?%/);
  await expect(page.getByTestId('sales-kpi-own')).toHaveText(/\d+\s?%/);
  await expect(page.getByTestId('sales-kpi-conversion')).toHaveText('37,5 %');
  await expect(kpis.locator('.kpi-tile', { hasText: 'Конверсия' })).toContainText('+17,5 п.п.');
  await expect(kpis.locator('.kpi-tile', { hasText: 'Конверсия' })).toContainText('3 из 8 предложений');
  await expect(page.getByTestId('sales-kpi-dialogs')).toHaveText(/^\d+$/);
  await expect(page.getByTestId('sales-kpi-leads')).toHaveText(/^\d+$/);
});

test('три карточки: конкуренты, ИИ-продавец, рекомендации; кнопки ведут в модули', async ({ page, request }) => {
  await seedMarket(request);
  await page.goto('/sales');
  const market = page.getByTestId('sales-card-market');
  await expect(market.getByRole('heading', { name: 'Загрузка конкурентов' })).toBeVisible();
  await expect(market.locator('.sales-card__checks li')).toHaveCount(3);
  await expect(market.locator('svg[role="img"]')).toBeVisible();
  await expect(market.getByRole('link', { name: /Открыть аналитику/ })).toHaveAttribute('href', '/market');
  const seller = page.getByTestId('sales-card-seller');
  await expect(seller.getByRole('heading', { name: 'ИИ-продавец' })).toBeVisible();
  await expect(seller.getByRole('link', { name: /ИИ-продавца/ })).toBeVisible();
  const recs = page.getByTestId('sales-card-recs');
  await expect(recs.getByRole('heading', { name: 'Рекомендации сегодня' })).toBeVisible();
  await expect(page.getByTestId('sales-recs').locator('li').first()).toBeVisible();
  await expect(page.getByTestId('sales-recs')).toContainText('Рынок почти полон');
  await recs.getByRole('link', { name: /Добавить конкурента/ }).click();
  await expect(page).toHaveURL(/\/market\?add=1/);
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('нет конкурентов: рекомендации зовут добавить, плитки не рисуют нули', async ({ page, request }) => {
  await request.post(`${API}/__test/market`, { data: {} });
  await page.goto('/sales');
  await expect(page.getByTestId('sales-recs-empty')).toContainText('Добавьте ближайших конкурентов');
  await expect(page.getByTestId('sales-kpi-market')).toHaveText('–');
  await expect(page.getByTestId('sales-kpi-own').or(page.getByTestId('sales-kpi-own'))).toBeVisible();
  await expect(page.getByTestId('sales-card-market').locator('svg[role="img"]')).toHaveCount(0);
});

test('нет предложений: конверсия это знак пропуска, а не 0 %', async ({ page, request }) => {
  await seedMarket(request);
  await request.post(`${API}/__test/sales`, {
    data: { offered: [0, 0], booked: [0, 0], revenueMinor: ['0', '0'] },
  });
  await page.goto('/sales');
  await expect(page.getByTestId('sales-kpi-conversion')).toHaveText('–');
  await expect(page.getByTestId('sales-kpis')).toContainText('за период предложений не было');
});

test('сводка не посчиталась: сказано словами, плитки броней и конкурентов это пропуск, карточки живы', async ({
  page,
  request,
}) => {
  await request.post(`${API}/__test/control`, { data: { failPath: '/sales/summary' } });
  await page.goto('/sales');
  await expect(page.getByTestId('sales-summary-error')).toContainText('Не удалось посчитать');
  await expect(page.getByTestId('sales-kpi-competitors')).toHaveText('–');
  await expect(page.getByTestId('sales-kpi-conversion')).toHaveText('–');
  await expect(page.getByTestId('sales-card-market')).toBeVisible();
  await expect(page.getByTestId('sales-card-seller')).toBeVisible();
});

test('период: «7 дней» меняет адрес, неверные даты в адресе возвращают 30 дней', async ({ page, request }) => {
  await seedMarket(request);
  await page.goto('/sales');
  await expect(page.getByRole('link', { name: '30 дней', exact: true })).toHaveAttribute('aria-current', 'page');
  await page.getByRole('link', { name: '7 дней', exact: true }).click();
  await expect(page).toHaveURL(/days=7/);
  await expect(page.getByRole('link', { name: '7 дней', exact: true })).toHaveAttribute('aria-current', 'page');
  await page.goto('/sales?from=мусор&to=2026-10-05');
  await expect(page.getByRole('link', { name: '30 дней', exact: true })).toHaveAttribute('aria-current', 'page');
});

test('расширение «ИИ-продавец» выключено: плитки диалогов это пропуск с причиной, карточка объясняет', async ({
  page,
  request,
}) => {
  await seedMarket(request);
  await control(request, { sellerExtension: 'off' });
  await page.goto('/sales');
  await expect(page.getByTestId('sales-kpi-dialogs')).toHaveText('–');
  await expect(page.getByTestId('sales-kpis')).toContainText('ИИ-продавец не подключён');
  await expect(page.getByTestId('sales-seller-off')).toContainText('не подключено');
  await expect(page.getByTestId('sales-kpi-competitors')).toHaveText('1');
});

test('администратор смены открывает хаб', async ({ page, request }) => {
  await seedMarket(request);
  await signIn(page);
  await control(request, { role: 'STAFF' });
  await page.goto('/sales');
  await expect(page.getByTestId('sales-kpis')).toBeVisible();
});

for (const theme of ['light', 'dark'] as const) {
  for (const width of [1440, 390]) {
    test(`доступность и снимки: ${theme}, ${width}px`, async ({ page, request }) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.setViewportSize({ width, height: 900 });
      await seedMarket(request);
      await page.goto('/sales');
      await expect(page.getByTestId('sales-kpis')).toBeVisible();
      const scan = await new AxeBuilder({ page }).analyze();
      expect(scan.violations.map((v) => v.id)).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      mkdirSync(SHOTS, { recursive: true });
      await page.screenshot({ path: `${SHOTS}/hub-${theme}-${width}.png`, caret: 'initial', fullPage: true });
    });
  }
}
