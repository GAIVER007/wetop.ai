import { mkdirSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import type { APIRequestContext } from '@playwright/test';
import { FIXTURE_API, expect, test, type Page } from './fixtures';

/**
 * Хаб «Продажи» (SALES2.2, `plans/sales2-audit-2026-10-09.md`): шесть чисел, две карточки модулей, период, состояния.
 * Подставной API считает сводку по заданным парам «текущий и прошлый отрезок» (`/__test/sales`). Отели вымышленные.
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
async function seedMarket(request: APIRequestContext): Promise<string> {
  const reset = await request.post(`${API}/__test/market`, { data: {} });
  const { today } = (await reset.json()) as { today: string };
  await request.post(`${API}/__test/market`, {
    data: {
      competitors: [{ id: A, name: 'Отель Алтын', distanceM: 200 }],
      readings: [{ competitorId: A, stayDate: today, observedOn: today, occupancyBp: 9000, source: 'MANUAL' }],
    },
  });
  return today;
}

test('пункт «Обзор продаж» первым в «Продажах»; шесть чисел с изменением к прошлому отрезку', async ({
  page,
  request,
}) => {
  await seedMarket(request);
  await page.goto('/today');
  const menu = page.locator('.topmenu');
  await menu.getByRole('button', { name: 'Продажи', exact: true }).click();
  await expect(menu.getByRole('link', { name: 'Обзор продаж', exact: true })).toBeVisible();
  await menu.getByRole('link', { name: 'Обзор продаж', exact: true }).click();
  await expect(page).toHaveURL(/\/sales$/);
  await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toHaveText('Продажи');

  const kpis = page.getByTestId('sales-kpis');
  await expect(kpis.locator('.stat')).toHaveCount(6);
  await expect(page.getByTestId('sales-kpi-bookings')).toHaveText('3');
  await expect(kpis.locator('.stat', { hasText: 'Брони из диалогов' })).toContainText('+50 %');
  await expect(page.getByTestId('sales-kpi-conversion')).toHaveText('37,5 %');
  await expect(kpis.locator('.stat', { hasText: 'Конверсия' })).toContainText('3 из 8 предложений');
  await expect(kpis.locator('.stat', { hasText: 'Конверсия' })).toContainText('+17,5 п.п.');
  await expect(page.getByTestId('sales-kpi-revenue')).toContainText('90 000');
  await expect(kpis.locator('.stat', { hasText: 'Выручка' })).toContainText('+125 %');
  await expect(page.getByTestId('sales-kpi-competitors')).toHaveText('1');
  await expect(kpis.locator('.stat', { hasText: 'Конкуренты' })).toContainText('обновлено');
  // карточка конкурентов: число не задваивается, рынок это внесённое значение с пометкой, а не «измеренная загрузка»
  const market = page.getByTestId('sales-card-market');
  await expect(market).toContainText('1 конкурент');
  await expect(market).not.toContainText('1 1 конкурент');
  await expect(page.getByTestId('sales-market-bp')).toHaveText(/\d+\s?%/);
  await expect(market).toContainText('не измеренная загрузка');
  await expect(page.getByTestId('sales-seller-channels')).toContainText('Сайт: домены заданы');
});

test('нет предложений: конверсия это знак пропуска, а не 0 %; нет базы: сравнения нет', async ({
  page,
  request,
}) => {
  await seedMarket(request);
  await request.post(`${API}/__test/sales`, {
    data: { offered: [0, 0], booked: [0, 0], revenueMinor: ['0', '0'] },
  });
  await page.goto('/sales');
  await expect(page.getByTestId('sales-kpi-conversion')).toHaveText('–');
  await expect(page.getByTestId('sales-kpis')).toContainText('За период бот не делал предложений');
  await expect(page.getByTestId('sales-kpi-conversion')).not.toContainText('0 %');
});

test('сводка не посчиталась: сказано словами, числа броней и конкурентов это пропуск, карточки живы', async ({
  page,
  request,
}) => {
  await request.post(`${API}/__test/control`, { data: { failPath: '/sales/summary' } });
  await page.goto('/sales');
  await expect(page.getByTestId('sales-summary-error')).toContainText('Не удалось посчитать');
  await expect(page.getByTestId('sales-kpi-bookings')).toHaveText('–');
  await expect(page.getByTestId('sales-kpi-revenue')).toHaveText('–');
  await expect(page.getByTestId('sales-kpi-competitors')).toHaveText('–');
  await expect(page.getByTestId('sales-card-market')).toBeVisible();
  await expect(page.getByTestId('sales-card-seller')).toBeVisible();
});

test('период: «7 дней» меняет адрес и подпись, неверные даты в адресе возвращают 30 дней', async ({
  page,
  request,
}) => {
  await seedMarket(request);
  await page.goto('/sales');
  const thirty = page.getByRole('link', { name: '30 дней', exact: true });
  await expect(thirty).toHaveAttribute('aria-current', 'page');
  await page.getByRole('link', { name: '7 дней', exact: true }).click();
  await expect(page).toHaveURL(/days=7/);
  await expect(page.getByRole('link', { name: '7 дней', exact: true })).toHaveAttribute('aria-current', 'page');
  await page.goto('/sales?from=мусор&to=2026-10-05');
  await expect(page.getByRole('link', { name: '30 дней', exact: true })).toHaveAttribute('aria-current', 'page');
  await page.goto('/sales?from=2026-10-01&to=2026-10-05');
  await expect(page.getByRole('link', { name: '30 дней', exact: true })).not.toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('link', { name: '7 дней', exact: true })).not.toHaveAttribute('aria-current', 'page');
});

test('расширение «ИИ-продавец» выключено: карточка объясняет, диалоги это пропуск, конкуренты работают', async ({
  page,
  request,
}) => {
  await seedMarket(request);
  await control(request, { sellerExtension: 'off' });
  await page.goto('/sales');
  await expect(page.getByTestId('sales-card-seller')).toContainText('не подключено');
  await expect(page.getByTestId('sales-kpi-dialogs')).toHaveText('–');
  await expect(page.getByTestId('sales-kpis')).toContainText('ИИ-продавец не подключён');
  await expect(page.getByTestId('sales-card-market')).toContainText('1 конкурент');
});

test('карточка конкурентов: устаревшие данные помечены; «Добавить конкурента» открывает окно', async ({
  page,
  request,
}) => {
  const today = await seedMarket(request);
  const old = new Date(Date.parse(`${today}T00:00:00Z`) - 10 * 86400000).toISOString().slice(0, 10);
  await request.post(`${API}/__test/market`, {
    data: {
      competitors: [{ id: A, name: 'Отель Алтын' }],
      readings: [{ competitorId: A, stayDate: today, observedOn: old, occupancyBp: 9000, source: 'MANUAL' }],
    },
  });
  await page.goto('/sales');
  await expect(page.getByTestId('sales-card-market')).toContainText('данные устарели');
  await page.getByTestId('sales-card-market').getByRole('link', { name: 'Добавить конкурента' }).click();
  await expect(page).toHaveURL(/\/market\?add=1/);
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('администратор смены видит хаб, но без кнопки «Настроить»; владелец с ней', async ({ page, request }) => {
  await seedMarket(request);
  await signIn(page);
  await control(request, { role: 'STAFF' });
  await page.goto('/sales');
  await expect(page.getByTestId('sales-kpis')).toBeVisible();
  await expect(page.getByTestId('sales-card-seller').getByRole('link', { name: 'Настроить' })).toHaveCount(0);
  await control(request, { role: 'OWNER' });
  await page.reload();
  await expect(page.getByTestId('sales-card-seller').getByRole('link', { name: 'Настроить' })).toBeVisible();
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
      await page.screenshot({ path: `${SHOTS}/hub-${theme}-${width}.png`, caret: 'initial' });
    });
  }
}
