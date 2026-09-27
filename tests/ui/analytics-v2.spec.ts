import { expect, test, type Page } from './fixtures';
import { mkdirSync } from 'node:fs';

/**
 * «Аналитика v2», срез AN1 (ADR-108, план `plans/analytics-v2-an1-2026-09-27.md`): модуль «Аналитика»
 * вместо «Статистики», экран «Обзор» за период. Проверяет критерии ТЗ владельца (§4–§9, §16–§17, §25,
 * §27) на стенде с историей за три месяца (`analyticsHistory` фикстуры: номера растут, койки падают)
 * и снимает стоп-гейт §34 — обе темы, «Все / Номера / Койки», прошлый месяц, база сравнения ноль, телефон.
 */
const fixture = 'http://127.0.0.1:4311';
const report = 'reports/analytics-v2-an1-2026-09-27';

async function withHistory(page: Page) {
  await page.request.post(`${fixture}/__test/reset`);
  const r = await page.request.post(`${fixture}/__test/control`, {
    data: { analyticsHistory: true },
  });
  expect(r.ok()).toBe(true);
}

test.beforeEach(async ({ page }) => {
  await withHistory(page);
});
test.afterEach(async ({ page }) => {
  await page.request.post(`${fixture}/__test/reset`);
});

test('меню: «Статистика» стала «Аналитикой», старый экран — вкладка «Загрузка»', async ({
  page,
}) => {
  const main = page.getByRole('main');
  await page.goto('/management/analytics');
  await expect(main.getByRole('heading', { level: 1 })).toHaveText('Аналитика');
  const tabs = main.getByTestId('pa-tabs');
  await expect(tabs.getByRole('link', { name: 'Обзор' })).toHaveAttribute('aria-current', 'page');
  await tabs.getByRole('link', { name: 'Загрузка' }).click();
  await expect(page).toHaveURL(/\/management\/analytics\/occupancy$/);
  await expect(main.getByTestId('statistics-table').locator('tbody tr').first()).toBeVisible();
  // в меню нет пункта «Статистика», зато есть «Аналитика» и отдельная «Аналитика сайта»
  await expect(page.locator('a[href="/management/statistics"]')).toHaveCount(0);
  await expect(page.locator('a[href="/management/analytics"]').first()).toBeAttached();
  // старый адрес ведёт на вкладку «Загрузка»
  await page.goto('/management');
  await expect(page).toHaveURL(/\/management\/analytics$/);
});

test('обзор за месяц: шесть плиток со сравнением, график загрузки и выручки, категории', async ({
  page,
}) => {
  const main = page.getByRole('main');
  await page.goto('/management/analytics');
  // по умолчанию — этот месяц; подпись словами
  await expect(main.getByTestId('pa-period')).toContainText(/\d+ \S+ — \d+ \S+, 3[01] д/);
  await expect(main.getByRole('link', { name: 'Этот месяц' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  const kpis = main.getByTestId('pa-kpis');
  for (const label of [
    'Загрузка',
    'Выручка проживания',
    'Продано ночей',
    'Брони',
    'Отмены',
    'Средний чек брони',
  ])
    await expect(kpis).toContainText(label);
  await expect(kpis.locator('.kpi')).toHaveCount(6);
  // стенд: весь фонд в этом месяце загружен слабее прошлого — падение в п.п.
  await expect(kpis.locator('.kpi--occupancy .kpi-delta--down')).toContainText('п.п.');
  // средняя цена при «Всех» не показывается — ссылки на номера и койки (ТЗ §6)
  await expect(main.getByTestId('pa-unit-economics')).toContainText('считаются отдельно');
  await expect(main.getByTestId('pa-compare')).toContainText('Сравнение с');
  await expect(main.getByTestId('pa-chart-occupancy')).toBeVisible();
  await expect(main.getByTestId('pa-chart-occupancy-day')).toContainText(
    /загрузка [\d,]+ %, занято \d+, свободно \d+, заблокировано \d+/,
  );
  await expect(main.getByTestId('pa-chart-revenue-day')).toContainText('начислено за проживание');
  await expect(main.getByTestId('pa-sources')).toContainText('Booking.com');
  const categories = main.getByTestId('pa-categories');
  await expect(categories.locator('tbody tr')).toHaveCount(3);
  await expect(categories).toContainText('Ср. цена за ночь');
});

test('номера и койки считаются раздельно: своя средняя цена, свой рост и падение', async ({
  page,
}) => {
  const main = page.getByRole('main');
  await page.goto('/management/analytics');
  await main.getByTestId('pa-fund').getByRole('link', { name: 'Номера' }).click();
  await expect(page).toHaveURL(/fund=rooms/);
  const economics = main.getByTestId('pa-unit-economics');
  await expect(economics).toContainText('Средняя цена номера (ADR)');
  await expect(economics).toContainText('Доход на номер (RevPAR)');
  await expect(main.locator('.kpi--occupancy .kpi-delta--up')).toBeVisible();
  await expect(main.getByTestId('pa-categories').locator('tbody tr')).toHaveCount(1);

  await main.getByTestId('pa-fund').getByRole('link', { name: 'Койки' }).click();
  await expect(page).toHaveURL(/fund=beds/);
  await expect(economics).toContainText('Средняя цена койки');
  await expect(economics).toContainText('Доход на койку');
  await expect(main.locator('.kpi--occupancy .kpi-delta--down')).toBeVisible();
  await expect(main.getByTestId('pa-categories').locator('tbody tr')).toHaveCount(2);
  // тип фонда не теряется при смене периода
  await main.getByRole('link', { name: 'Прошлый месяц' }).click();
  await expect(page).toHaveURL(/period=last-month/);
  await expect(page).toHaveURL(/fund=beds/);
});

test('рост отмен — красный, падение — зелёный; сравнение выключается', async ({ page }) => {
  const main = page.getByRole('main');
  await page.goto('/management/analytics');
  // на стенде доля отмен в этом месяце выше прошлого: стрелка вверх, но тон «плохо»
  const cancelled = main.locator('.kpi--cancelled .kpi-delta');
  await expect(cancelled).toContainText('▲');
  await expect(cancelled).toHaveClass(/kpi-delta--down/);
  await main.getByTestId('pa-compare-toggle').click();
  await expect(page).toHaveURL(/compare=0/);
  await expect(main.locator('.kpi-delta')).toHaveCount(0);
  await expect(main.getByTestId('pa-compare')).toHaveCount(0);
});

test('база сравнения ноль — «нет данных», а не ±100 %; пустой период — словами', async ({
  page,
}) => {
  const main = page.getByRole('main');
  const today = new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
  const [y, m] = today.split('-').map(Number) as [number, number];
  const first = (shift: number) =>
    new Date(Date.UTC(y, m - 1 + shift, 1)).toISOString().slice(0, 10);
  const last = (shift: number) => new Date(Date.UTC(y, m + shift, 0)).toISOString().slice(0, 10);
  // позапрошлый месяц — первый с историей: до него данных нет
  await page.goto(`/management/analytics?period=custom&from=${first(-2)}&to=${last(-2)}`);
  const kpis = main.getByTestId('pa-kpis');
  await expect(kpis.locator('.kpi-delta--none')).toHaveCount(6);
  await expect(kpis).not.toContainText('100 %');
  await expect(kpis.locator('.kpi-delta--none').first()).toContainText('нет данных для сравнения');
  // ещё раньше — ни ночей, ни броней, ни начислений
  await page.goto(`/management/analytics?period=custom&from=${first(-4)}&to=${last(-4)}`);
  await expect(main.getByTestId('pa-empty')).toContainText('Недостаточно данных');
  await expect(main.getByTestId('pa-toolbar')).toBeVisible();
});

test('сбой API не уносит полосу периода; неизвестный тип фонда — весь фонд', async ({ page }) => {
  const main = page.getByRole('main');
  await page.request.post(`${fixture}/__test/control`, {
    data: { analyticsHistory: true, failPath: '/desk/dashboard' },
  });
  await page.goto('/management/analytics?period=week');
  await expect(main.getByTestId('pa-toolbar')).toBeVisible();
  await expect(main.getByTestId('pa-error')).toContainText('Повторить загрузку');
  await page.request.post(`${fixture}/__test/control`, { data: { analyticsHistory: true } });
  await page.goto('/management/analytics?fund=apartments');
  await expect(main.getByTestId('pa-fund').getByRole('link', { name: 'Все' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(main.getByTestId('pa-kpis')).toBeVisible();
});

test('телефон: без прокрутки вбок, плитки в две колонки', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/management/analytics');
  await expect(page.getByTestId('pa-kpis')).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, 'обзор шире экрана телефона').toBeLessThanOrEqual(1);
});

/** Стоп-гейт §34: снимки для владельца — в `reports/analytics-v2-an1-2026-09-27/` */
test('снимки для визуального гейта AN1', async ({ page }) => {
  test.setTimeout(180_000);
  mkdirSync(report, { recursive: true });
  const shot = async (name: string, url: string, full = true) => {
    await page.goto(url);
    await expect(page.getByTestId('pa-kpis').or(page.getByTestId('pa-empty'))).toBeVisible();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${report}/${name}.png`, fullPage: full, caret: 'initial' });
  };
  for (const theme of ['dark', 'light'] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await shot(`${theme}-1440-month-all`, '/management/analytics');
    await shot(`${theme}-1440-month-rooms`, '/management/analytics?fund=rooms');
    await shot(`${theme}-1440-month-beds`, '/management/analytics?fund=beds');
    await shot(`${theme}-1440-last-month`, '/management/analytics?period=last-month');
    await shot(`${theme}-1440-today`, '/management/analytics?period=today');
    await page.setViewportSize({ width: 390, height: 844 });
    await shot(`${theme}-390-month-all`, '/management/analytics');
  }
  const today = new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
  const [y, m] = today.split('-').map(Number) as [number, number];
  const from = new Date(Date.UTC(y, m - 3, 1)).toISOString().slice(0, 10);
  const to = new Date(Date.UTC(y, m - 2, 0)).toISOString().slice(0, 10);
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await shot('dark-1440-base-zero', `/management/analytics?period=custom&from=${from}&to=${to}`);
  await page.goto('/management/analytics');
  await page.getByText('Период', { exact: true }).click();
  await page.screenshot({ path: `${report}/dark-1440-custom-period.png`, caret: 'initial' });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.goto('/management/analytics/occupancy');
  await expect(page.getByTestId('statistics-table')).toBeVisible();
  await page.screenshot({ path: `${report}/light-1440-occupancy-tab.png`, fullPage: true });
});
