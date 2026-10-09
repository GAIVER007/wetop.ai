import { mkdirSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import type { APIRequestContext } from '@playwright/test';
import { FIXTURE_API, expect, test } from './fixtures';

/**
 * Список конкурентов с ценами (SALES2.3b, DATA_MODEL §23.1): район, тип, загрузка сегодня, средняя цена, изменение
 * цены, статус свежести; отбор по району; цены вносятся панелью и попадают на график; карточка хранит район и
 * настройки мониторинга. Подставной API считает тем же доменом, что API.
 */
const API = FIXTURE_API;
const SHOTS = 'reports/sales2-competitors-2026-10-09';
const plus = (iso: string, n: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';

test.beforeEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});
test.afterEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});

async function seed(request: APIRequestContext, withRates = true): Promise<string> {
  const reset = await request.post(`${API}/__test/market`, { data: {} });
  const { today } = (await reset.json()) as { today: string };
  const readings = [{ competitorId: A, stayDate: today, observedOn: today, occupancyBp: 9200, source: 'MANUAL' }];
  const rates = [];
  if (withRates)
    for (let i = 0; i < 3; i++) {
      const d = plus(today, i);
      // вчерашняя цена Алтына 40 000, сегодняшняя 42 000: +5 %
      rates.push({ competitorId: A, stayDate: d, observedOn: plus(today, -1), priceMinor: '4000000', currency: 'KZT', source: 'MANUAL' });
      rates.push({ competitorId: A, stayDate: d, observedOn: today, priceMinor: '4200000', currency: 'KZT', source: 'MANUAL' });
      rates.push({ competitorId: B, stayDate: d, observedOn: today, priceMinor: '2800000', currency: 'KZT', source: 'MANUAL' });
    }
  await request.post(`${API}/__test/market`, {
    data: {
      competitors: [
        { id: A, name: 'Отель Алтын', distanceM: 200, district: 'Медеу', category: 'Отель 4★' },
        { id: B, name: 'Хостел Сити', distanceM: 650, district: 'Алмалы', category: 'Хостел' },
      ],
      readings,
      rates,
    },
  });
  return today;
}

test('список: район, тип, загрузка сегодня, средняя цена, изменение и статус', async ({ page, request }) => {
  await seed(request);
  await page.goto('/market');
  const a = page.getByTestId(`market-list-row-${A}`);
  await expect(a).toContainText('Медеу');
  await expect(a).toContainText('Отель 4★');
  await expect(a.getByTestId('market-list-now')).toHaveText('92 %');
  await expect(a.getByTestId('market-list-price')).toContainText('42 000');
  await expect(a.getByTestId('market-list-change')).toHaveText('+5 %');
  await expect(a).toContainText('Актуально');
  // у второго отеля загрузки сегодня нет, вчерашней цены тоже: тире, а не нули
  const b = page.getByTestId(`market-list-row-${B}`);
  await expect(b.getByTestId('market-list-now')).toHaveText('–');
  await expect(b.getByTestId('market-list-price')).toContainText('28 000');
  await expect(b.getByTestId('market-list-change')).toHaveText('–');
});

test('отбор по району оставляет одну строку и сбрасывается', async ({ page, request }) => {
  await seed(request);
  await page.goto('/market');
  await page.getByTestId('market-filter-district').selectOption('Алмалы');
  await page.getByTestId('market-list-filters').getByRole('button', { name: 'Показать' }).click();
  await expect(page).toHaveURL(/district=/);
  await expect(page.getByTestId(`market-list-row-${B}`)).toBeVisible();
  await expect(page.getByTestId(`market-list-row-${A}`)).toHaveCount(0);
  await page.getByRole('link', { name: 'Сбросить' }).click();
  await expect(page.getByTestId(`market-list-row-${A}`)).toBeVisible();
});

test('цены на графике: четвёртый график появляется, когда цены внесены', async ({ page, request }) => {
  await seed(request);
  await page.goto('/market');
  const price = page.getByTestId('market-chart-price');
  await expect(price).toBeVisible();
  expect(await price.locator('path[data-series="avg"]').getAttribute('d')).toMatch(/^M/);
  await price.getByText('Значения по ночам').click();
  // сегодня: Алтын 42 000 и Хостел 28 000, средняя 35 000
  await expect(price.locator('tbody tr').first()).toContainText('35 000');
  await expect(price).toContainText('внесённые значения, а не измеренные цены');
  await seed(request, false);
  await page.goto('/market');
  await expect(page.getByTestId('market-chart-price')).toHaveCount(0);
});

test('цены вносятся панелью: сохранённое видно в списке, очищенное снимает', async ({ page, request }) => {
  const today = await seed(request, false);
  await page.goto('/market');
  await expect(page.getByTestId(`market-list-row-${A}`).getByTestId('market-list-price')).toHaveText('–');
  await page.getByTestId(`market-rates-${A}`).click();
  await page.getByTestId(`market-r-${today}`).fill('39 500,50');
  await page.getByTestId('market-rates-save').click();
  await expect(page.getByTestId('market-rates-form')).toHaveCount(0);
  await expect(page.getByTestId(`market-list-row-${A}`).getByTestId('market-list-price')).toContainText('39 500,50');
  // очистили: сегодняшнее значение снято
  await page.getByTestId(`market-rates-${A}`).click();
  await page.getByTestId(`market-r-${today}`).fill('');
  await page.getByTestId('market-rates-save').click();
  await expect(page.getByTestId(`market-list-row-${A}`).getByTestId('market-list-price')).toHaveText('–');
});

test('цена словами ошибки: ввод не теряется', async ({ page, request }) => {
  const today = await seed(request, false);
  await page.goto('/market');
  await page.getByTestId(`market-rates-${A}`).click();
  await page.getByTestId(`market-r-${today}`).fill('много');
  await page.getByTestId('market-rates-save').click();
  await expect(page.getByTestId('market-rates-form')).toContainText('Цена: число');
  await expect(page.getByTestId(`market-r-${today}`)).toHaveValue('много');
});

test('карточка: район, тип и настройки мониторинга сохраняются; автообновление честно названо будущим', async ({
  page,
  request,
}) => {
  await seed(request, false);
  await page.goto('/market');
  await page.getByTestId('market-add').click();
  await page.getByTestId('market-name').fill('Almaty Residence');
  await page.getByTestId('market-district').fill('Бостандык');
  await page.getByTestId('market-category').fill('Апартаменты');
  await page.getByTestId('market-monitoring-kind').selectOption('PRICE');
  await expect(page.getByTestId('market-auto-note')).toContainText('когда подключён разрешённый источник');
  await page.getByTestId('market-save').click();
  await expect(page.getByTestId('market-competitor-form')).toHaveCount(0);
  const row = page.locator('[data-testid^="market-list-row-"]', { hasText: 'Almaty Residence' });
  await expect(row).toContainText('Бостандык');
  await expect(row).toContainText('Апартаменты');
  // правка открывает то, что сохранили
  await row.getByRole('button', { name: /Изменить/ }).click();
  await expect(page.getByTestId('market-district')).toHaveValue('Бостандык');
  await expect(page.getByTestId('market-monitoring-kind')).toHaveValue('PRICE');
});

for (const theme of ['light', 'dark'] as const) {
  for (const width of [1440, 390]) {
    test(`доступность и снимки: ${theme}, ${width}px`, async ({ page, request }) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.setViewportSize({ width, height: 900 });
      await seed(request);
      await page.goto('/market');
      await expect(page.getByTestId('market-competitors')).toBeVisible();
      const scan = await new AxeBuilder({ page }).analyze();
      expect(scan.violations.map((v) => v.id)).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      mkdirSync(SHOTS, { recursive: true });
      await page.getByTestId('market-competitors').screenshot({ path: `${SHOTS}/list-${theme}-${width}.png` });
    });
  }
}
