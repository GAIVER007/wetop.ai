import { expect, test, type Page } from './fixtures';
import { mkdirSync } from 'node:fs';

/**
 * «Аналитика v2», срез AN2 (ADR-114, план `plans/analytics-v2-an2-2026-09-28.md`): вкладка «Загрузка» —
 * бывшая «Статистика» в системе модуля. Проверяет поручение владельца от 28.09: дата и период, «Все / Номера /
 * Койки», занято, свободно, заблокировано, без размещения, загрузка и сравнение категорий, «Открыть календарь»,
 * знаменатель прежний (заблокированные места — в фонде). Снимает стоп-гейт AN2.
 */
const fixture = 'http://127.0.0.1:4311';
const report = 'reports/unified-sections-2026-10-01/analytics-v2-an2-2026-09-28';
const asClient = { headers: { 'x-wetop-test-client': '1' } };
const today = new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
const add = (days: number, from = today) =>
  new Date(Date.parse(`${from}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const numeric = (date: string) => date.split('-').reverse().join('.');
const int = (text: string) => Number(text.replace(/\D/g, ''));

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

test('по умолчанию — сегодняшний день: пять плиток, категории и шахматка на этот день', async ({
  page,
}) => {
  const main = page.getByRole('main');
  await page.goto('/management/analytics/occupancy');
  await expect(main.getByTestId('pa-tabs').getByRole('link', { name: 'Загрузка' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(main.getByRole('link', { name: 'Сегодня' })).toHaveAttribute('aria-current', 'page');
  await expect(main.getByTestId('statistics-meta')).toContainText(`Загрузка на ${numeric(today)}`);
  const kpis = main.getByTestId('pa-occupancy-kpis');
  for (const label of ['Загрузка', 'Занято', 'Свободно', 'Заблокировано', 'Без размещения'])
    await expect(kpis).toContainText(label);
  await expect(kpis.locator('.kpi')).toHaveCount(5);
  const table = main.getByTestId('statistics-table');
  await expect(table.locator('tbody tr')).toHaveCount(3);
  await expect(table.locator('thead')).toContainText('Мест');
  await expect(table.locator('thead')).toContainText('Без места');
  // сравнение по умолчанию включено — со вчерашним днём
  await expect(main.getByTestId('pa-compare')).toContainText('Сравнение с');
  await expect(table.locator('thead')).toContainText('К прошлому');
  // «Открыть календарь» — на тот же день; название категории — её строки
  await expect(main.getByTestId('pa-open-chessboard')).toHaveAttribute(
    'href',
    `/chessboard?from=${today}&to=${today}`,
  );
  await expect(table.getByRole('link', { name: 'Мужской общий номер' })).toHaveAttribute(
    'href',
    `/chessboard?from=${today}&to=${today}&category=MALE`,
  );
  // сравнение категорий — три полосы, сверху самая загруженная, черта средней в каждой
  const rank = main.getByTestId('pa-category-rank');
  await expect(rank.locator('li')).toHaveCount(3);
  await expect(rank.locator('.pa-rank__avg')).toHaveCount(3);
  await expect(rank).toContainText('к среднему');
});

test('знаменатель прежний: заблокированное место остаётся в фонде загрузки', async ({ page }) => {
  const main = page.getByRole('main');
  // закрываем одну свободную на сегодня койку женского номера
  const board = await (
    await page.request.get(`${fixture}/chessboard?from=${today}&to=${today}`, asClient)
  ).json();
  const free = (
    board.rows as Array<{
      unit: { code: string; accommodationTypeCode: string };
      cells: Array<{ state: string }>;
    }>
  ).find((r) => r.unit.accommodationTypeCode === 'FEMALE' && r.cells[0]!.state === 'FREE')!;
  const blocked = await page.request.post(`${fixture}/units/${free.unit.code}/blocks`, {
    ...asClient,
    // «по» не включается, как у API: одна ночь сегодня — dateTo завтра
    data: { dateFrom: today, dateTo: add(1), type: 'MAINTENANCE', reason: 'проверка знаменателя' },
  });
  expect(blocked.ok()).toBe(true);

  await page.goto('/management/analytics/occupancy?fund=beds');
  const row = main
    .getByTestId('statistics-table')
    .locator('tbody tr')
    .filter({ hasText: 'Женский общий номер' });
  const cells = row.locator('td');
  const units = int(await cells.nth(1).innerText());
  const occupied = int(await cells.nth(2).innerText());
  const freeNow = int(await cells.nth(3).innerText());
  const block = int(await cells.nth(4).innerText());
  expect(units).toBe(36);
  expect(block).toBeGreaterThanOrEqual(1);
  // места категории не теряются: занято + свободно + блок = весь фонд категории
  expect(occupied + freeNow + block).toBe(units);
  // загрузка = занято / весь фонд, а не занято / (фонд − блок)
  const expected = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(
    Math.round((occupied / units) * 1000) / 10,
  );
  await expect(cells.nth(6)).toContainText(`${expected} %`);
  await expect(main.getByTestId('pa-kpi-blocked')).not.toHaveText('0');
  await expect(main.locator('.kpi--occupancy .kpi__hint')).toContainText('из 72 мест фонда');
});

test('без размещения: групповая бронь на три койки без места — три проживания и ссылка разместить', async ({
  page,
}) => {
  const main = page.getByRole('main');
  const group = await page.request.post(`${fixture}/reservations`, {
    ...asClient,
    data: {
      arrivalDate: today,
      departureDate: add(2),
      source: 'DESK',
      guest: { firstName: 'Группа', lastName: 'Аналитики' },
      items: [null, null, null].map((unitCode) => ({
        accommodationTypeCode: 'MALE',
        quantity: 1,
        adults: 1,
        unitCode,
      })),
    },
  });
  expect(group.ok()).toBe(true);
  await page.goto('/management/analytics/occupancy');
  const before = int(await main.getByTestId('pa-kpi-unassigned').innerText());
  expect(before).toBeGreaterThanOrEqual(3);
  const male = main
    .getByTestId('statistics-table')
    .locator('tbody tr')
    .filter({ hasText: 'Мужской общий номер' });
  expect(int(await male.locator('td').nth(5).innerText())).toBeGreaterThanOrEqual(3);
  await expect(
    main.locator('.kpi--unassigned').getByRole('link', { name: 'разместить' }),
  ).toHaveAttribute('href', '/reservations?allocation=missing');
});

test('номера и койки: свои категории, своя средняя, шахматка открывается на том же типе', async ({
  page,
}) => {
  const main = page.getByRole('main');
  await page.goto('/management/analytics/occupancy');
  await main.getByTestId('pa-fund').getByRole('link', { name: 'Номера' }).click();
  await expect(page).toHaveURL(/occupancy\?fund=rooms$/);
  await expect(main.getByTestId('statistics-table').locator('tbody tr')).toHaveCount(1);
  // одной категории сравнивать не с чем — панели нет
  await expect(main.getByTestId('pa-category-rank')).toHaveCount(0);
  await expect(main.getByTestId('pa-open-chessboard')).toHaveAttribute(
    'href',
    `/chessboard?from=${today}&to=${today}&kind=ROOM`,
  );

  await main.getByTestId('pa-fund').getByRole('link', { name: 'Койки' }).click();
  await expect(page).toHaveURL(/fund=beds/);
  await expect(main.getByTestId('statistics-table').locator('tbody tr')).toHaveCount(2);
  await expect(main.getByTestId('pa-category-rank').locator('li')).toHaveCount(2);
  // тип фонда переходит на «Обзор» и обратно
  await expect(main.getByTestId('pa-tabs').getByRole('link', { name: 'Обзор' })).toHaveAttribute(
    'href',
    '/management/analytics?fund=beds',
  );
  await main.getByTestId('pa-open-chessboard').click();
  await expect(page).toHaveURL(new RegExp(`/chessboard\\?from=${today}&to=${today}&kind=BED$`));
  // тип места с PR 7 «Шахматки v2» — в окошке «Фильтры»; заданный из адреса виден чипом
  await expect(
    page.getByRole('main').getByRole('button', { name: 'Убрать условие: Койки', exact: true }),
  ).toBeVisible();
  // в календаре остались только койки: номеров (R…) нет
  await expect(page.locator('[data-testid="unit-row"][data-unit-code^="R"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="unit-row"][data-unit-code^="M"]').first()).toBeVisible();
});

test('период: ночи вместо мест, стрелки дня, сравнение выключается', async ({ page }) => {
  const main = page.getByRole('main');
  await page.goto('/management/analytics/occupancy');
  // стрелки: вчера, потом снова сегодня
  await main.getByTestId('pa-day-prev').click();
  await expect(page).toHaveURL(new RegExp(`occupancy\\?date=${add(-1)}$`));
  await expect(main.getByTestId('statistics-meta')).toContainText(
    `Загрузка на ${numeric(add(-1))}`,
  );
  await main.getByTestId('pa-day-next').click();
  await expect(page).toHaveURL(/occupancy$/);

  await main.getByRole('link', { name: 'Этот месяц' }).click();
  await expect(page).toHaveURL(/occupancy\?period=month$/);
  await expect(main.getByTestId('pa-day-prev')).toHaveCount(0);
  await expect(main.getByTestId('statistics-meta')).toContainText('в ночах');
  const table = main.getByTestId('statistics-table');
  await expect(table.locator('thead')).toContainText('Ночей фонда');
  await expect(main.locator('.kpi--occupied .kpi__hint')).toContainText('ночей');
  // прошлый отрезок той же длины — с данными: у плиток есть стрелки
  await expect(main.locator('.pa-kpis .kpi-delta:not(.kpi-delta--none)').first()).toBeVisible();

  await main.getByTestId('pa-compare-toggle').click();
  await expect(page).toHaveURL(/period=month&compare=0/);
  await expect(main.locator('.kpi-delta')).toHaveCount(0);
  await expect(table.locator('thead')).not.toContainText('К прошлому');
});

test('старые адреса: «Статистика» с датой и некорректная дата', async ({ page }) => {
  const main = page.getByRole('main');
  await page.goto(`/management/statistics?date=${add(-3)}`);
  await expect(page).toHaveURL(new RegExp(`/management/analytics/occupancy\\?date=${add(-3)}$`));
  await expect(main.getByTestId('statistics-meta')).toContainText(
    `Загрузка на ${numeric(add(-3))}`,
  );
  await expect(main.getByRole('link', { name: 'Сегодня' })).not.toHaveAttribute('aria-current');
  await page.goto('/management/analytics/occupancy?date=2026-13-45');
  await expect(main.getByRole('alert').first()).toContainText('Некорректная дата');
  await expect(main.getByTestId('statistics-meta')).toContainText(`Загрузка на ${numeric(today)}`);
});

test('сбой API не уносит полосу периода и повторяет тот же день', async ({ page }) => {
  const main = page.getByRole('main');
  await page.request.post(`${fixture}/__test/control`, {
    data: { analyticsHistory: true, failPath: '/desk/dashboard' },
  });
  await page.goto(`/management/analytics/occupancy?date=${add(-2)}`);
  await expect(main.getByTestId('pa-toolbar')).toBeVisible();
  const failure = main.getByTestId('statistics-error');
  await expect(failure).toContainText('Повторить загрузку');
  await expect(main.locator('.kpi__value')).toHaveCount(0);
  await page.request.post(`${fixture}/__test/control`, { data: { analyticsHistory: true } });
  await failure.getByRole('button', { name: 'Повторить загрузку' }).click();
  await expect(main.getByTestId('statistics-table').locator('tbody tr').first()).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`date=${add(-2)}`));
});

test('телефон: без прокрутки вбок, строка категории — карточкой', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/management/analytics/occupancy');
  await expect(page.getByTestId('pa-occupancy-kpis')).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, 'вкладка «Загрузка» шире экрана телефона').toBeLessThanOrEqual(1);
  // полосы сравнения видны: в колонке `auto` пустая полоса схлопывалась в ноль (снимок гейта AN2)
  const rank = page.getByTestId('pa-category-rank').locator('.hbars__track').first();
  expect((await rank.boundingBox())!.width, 'полоса сравнения категорий').toBeGreaterThan(100);
  // на телефоне число несёт своё слово — шапка таблицы скрыта
  await expect(
    page
      .getByTestId('statistics-table')
      .locator('tbody tr')
      .first()
      .locator('.dash-cell-word')
      .first(),
  ).toBeVisible();
  // тот же приём у «Обзора» за один день: полосы «Загрузки по категориям»
  await page.goto('/management/analytics?period=today');
  const bar = page.getByTestId('pa-chart-categories').locator('.hbars__track').first();
  expect((await bar.boundingBox())!.width, 'полоса загрузки категории в «Обзоре»').toBeGreaterThan(
    100,
  );
});

/** Стоп-гейт AN2: снимки для владельца — в `reports/analytics-v2-an2-2026-09-28/` */
test('снимки для визуального гейта AN2', async ({ page }) => {
  test.setTimeout(240_000);
  mkdirSync(report, { recursive: true });
  // одна закрытая койка и группа без места — чтобы на снимке были все пять чисел
  await page.request.post(`${fixture}/units/F36/blocks`, {
    ...asClient,
    data: { dateFrom: today, dateTo: add(3), type: 'MAINTENANCE', reason: 'ремонт кровати' },
  });
  await page.request.post(`${fixture}/reservations`, {
    ...asClient,
    data: {
      arrivalDate: today,
      departureDate: add(2),
      source: 'DESK',
      guest: { firstName: 'Группа', lastName: 'Аналитики' },
      items: [null, null, null].map((unitCode) => ({
        accommodationTypeCode: 'MALE',
        quantity: 1,
        adults: 1,
        unitCode,
      })),
    },
  });
  const shot = async (name: string, url: string, ready: string, full = true) => {
    await page.goto(url);
    await expect(page.getByTestId(ready)).toBeVisible();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${report}/${name}.png`, fullPage: full, caret: 'initial' });
  };
  const tab = '/management/analytics/occupancy';
  for (const theme of ['dark', 'light'] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await shot(`${theme}-1440-today-all`, tab, 'pa-occupancy-kpis');
    await shot(`${theme}-1440-today-rooms`, `${tab}?fund=rooms`, 'pa-occupancy-kpis');
    await shot(`${theme}-1440-today-beds`, `${tab}?fund=beds`, 'pa-occupancy-kpis');
    await shot(`${theme}-1440-month-all`, `${tab}?period=month`, 'pa-occupancy-kpis');
    await shot(
      `${theme}-1440-last-month-no-compare`,
      `${tab}?period=last-month&compare=0`,
      'pa-occupancy-kpis',
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await shot(`${theme}-390-today-all`, tab, 'pa-occupancy-kpis');
  }
  // «Обзор» после решений Q-208 и Q-209: «Выручка по заездам», брони и размещения, один день без двойной загрузки
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await shot('dark-1440-overview-month', '/management/analytics', 'pa-kpis');
  await shot('dark-1440-overview-today', '/management/analytics?period=today', 'pa-kpis');
  await page.setViewportSize({ width: 390, height: 844 });
  await shot('dark-390-overview-today', '/management/analytics?period=today', 'pa-kpis');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${tab}?fund=beds`);
  await page.getByTestId('pa-open-chessboard').click();
  await expect(page.getByTestId('chessboard')).toBeVisible();
  await page.screenshot({ path: `${report}/dark-1440-chessboard-from-beds.png`, caret: 'initial' });
});
