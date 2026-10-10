import { mkdirSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import type { APIRequestContext } from '@playwright/test';
import { FIXTURE_API, expect, test } from './fixtures';

/**
 * Графики «Загрузки конкурентов» (SALES2.3): загрузка по ночам, наличие данных по соседям, изменение к прошлому снимку.
 * Цен у конкурентов нет (ADR-142), поэтому графики про загрузку. Подставной API считает тем же доменом, что API.
 */
const API = FIXTURE_API;
const SHOTS = 'reports/sales2-market-charts-2026-10-09';
const plus = (iso: string, n: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

test.beforeEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});
test.afterEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});

async function seed(request: APIRequestContext): Promise<string> {
  const reset = await request.post(`${API}/__test/market`, { data: {} });
  const { today } = (await reset.json()) as { today: string };
  const A = '00000000-0000-4000-8000-00000000000a';
  const B = '00000000-0000-4000-8000-00000000000b';
  const readings = [];
  for (let i = 0; i < 14; i++) {
    const d = plus(today, i);
    readings.push({ competitorId: A, stayDate: d, observedOn: plus(today, -1), occupancyBp: 8000, source: 'MANUAL' });
    readings.push({ competitorId: A, stayDate: d, observedOn: today, occupancyBp: 9200, source: 'MANUAL' });
    // второй сосед внесён только на первые пять ночей: у остальных «нет данных»
    if (i < 5) readings.push({ competitorId: B, stayDate: d, observedOn: today, occupancyBp: 9500, source: 'MANUAL' });
  }
  await request.post(`${API}/__test/market`, {
    data: {
      competitors: [
        { id: A, name: 'Отель Алтын', distanceM: 200 },
        { id: B, name: 'Хостел Сити', distanceM: 650 },
      ],
      readings,
    },
  });
  return today;
}

test('три графика: линии загрузки, наличие данных и изменение; значения доступны таблицей', async ({
  page,
  request,
}) => {
  await seed(request);
  await page.goto('/market');
  const charts = page.getByTestId('market-charts');
  await expect(charts.locator('figure')).toHaveCount(3);
  const load = page.getByTestId('market-chart-load');
  for (const key of ['own', 'market', 'min', 'max'])
    await expect(load.locator(`path[data-series="${key}"]`)).toHaveCount(1);
  // линия загрузки действительно нарисована: путь не пустой
  expect(await load.locator('path[data-series="market"]').getAttribute('d')).toMatch(/^M/);
  await expect(load).toContainText('внесённые значения, а не измеренная загрузка');

  // таблица значений: открывается и называет числа
  await load.getByText('Значения по ночам').click();
  await expect(load.locator('tbody tr').first()).toContainText('92 %');
  await expect(load.locator('thead')).toContainText('Самый загруженный');

  // наличие данных: сначала 2 из 2, потом 1 из 2 (второй сосед внесён на пять ночей)
  const data = page.getByTestId('market-chart-data');
  await data.getByText('Значения по ночам').click();
  await expect(data.locator('tbody tr').first()).toContainText('2 из 2');
  await expect(data.locator('tbody tr').nth(7)).toContainText('1 из 2');

  // изменение: у «Алтына» вчера 80, сегодня 92: среднее по соседям с сравнением
  const change = page.getByTestId('market-chart-change');
  await change.getByText('Значения по ночам').click();
  await expect(change.locator('tbody tr').first()).toContainText('+12 п.п.');
});

test('без сравнения: график изменения говорит, как его включить, а не рисует нули', async ({
  page,
  request,
}) => {
  await seed(request);
  await page.goto('/market?compare=0');
  const change = page.getByTestId('market-chart-change');
  await expect(change).toContainText('Включите «Изменение»');
  await expect(change.locator('rect[fill*="chart-2"], rect[fill*="danger"]')).toHaveCount(0);
});

test('пока конкурентов нет, графиков нет: пустое состояние как раньше', async ({ page }) => {
  await page.goto('/market');
  await expect(page.getByTestId('market-empty')).toBeVisible();
  await expect(page.getByTestId('market-charts')).toHaveCount(0);
});

for (const theme of ['light', 'dark'] as const) {
  for (const width of [1440, 390]) {
    test(`доступность и снимки: ${theme}, ${width}px`, async ({ page, request }) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.setViewportSize({ width, height: 900 });
      await seed(request);
      await page.goto('/market');
      await expect(page.getByTestId('market-charts')).toBeVisible();
      const scan = await new AxeBuilder({ page }).analyze();
      expect(scan.violations.map((v) => v.id)).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      mkdirSync(SHOTS, { recursive: true });
      await page.getByTestId('market-charts').screenshot({ path: `${SHOTS}/charts-${theme}-${width}.png` });
    });
  }
}
