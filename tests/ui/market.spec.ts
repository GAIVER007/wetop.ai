import { mkdirSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import type { APIRequestContext } from '@playwright/test';
import { FIXTURE_API, expect, test, devNoise, type Page, goViaMenu } from './fixtures';

/**
 * «Анализ конкурентов» (ADR-142; редизайн COMP3.2, план `plans/competitor-analysis-comp3-2026-10-09.md`):
 * пункт «Продажи», пустое состояние, добавить конкурента, внести загрузку по ночам, пять плиток,
 * календарь рыночных сигналов, график «вы и рынок», рекомендация по данным, таблица конкурентов
 * со статусами, детализация «По ночам», «убрать из списка», «только чтение».
 * Подставной API считает тем же доменом, что API. Отели вымышленные (ADR-010).
 */
const API = FIXTURE_API;
const SHOTS = 'reports/market-redesign-2026-10-09';
const control = (request: APIRequestContext, body: Record<string, unknown>) =>
  request.post(`${API}/__test/control`, { data: body });

test.beforeEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});
test.afterEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});

const plus = (iso: string, n: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

/** Два соседа: «Алтын» почти полон (вчера 80 %, сегодня 92 %, часть снимков от ИИ), «Сити» 95 % */
async function seed(request: APIRequestContext): Promise<string> {
  const reset = await request.post(`${API}/__test/market`, { data: {} });
  const { today } = (await reset.json()) as { today: string };
  const A = '00000000-0000-4000-8000-00000000000a';
  const B = '00000000-0000-4000-8000-00000000000b';
  const readings = [];
  for (let i = 0; i < 14; i++) {
    const d = plus(today, i);
    readings.push({ competitorId: A, stayDate: d, observedOn: plus(today, -1), occupancyBp: 8000, source: 'MANUAL' });
    readings.push({ competitorId: A, stayDate: d, observedOn: today, occupancyBp: 9200, source: i < 3 ? 'AI_AGENT' : 'MANUAL' });
    readings.push({ competitorId: B, stayDate: d, observedOn: today, occupancyBp: 9500, source: 'MANUAL' });
  }
  await request.post(`${API}/__test/market`, {
    data: {
      competitors: [
        { id: A, name: 'Отель Алтын', distanceM: 200, unitsTotal: 40, url: 'https://example.com/altyn' },
        { id: B, name: 'Хостел Сити', distanceM: 650 },
      ],
      readings,
    },
  });
  return today;
}

async function signIn(page: Page) {
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
}

test('пункт «Конкуренты» в «Продвижении» ведёт в раздел; пусто: «Добавьте ближайших конкурентов»; добавить и внести загрузку', async ({
  page,
}) => {
  await page.goto('/finance');
  await goViaMenu(page, 'Продвижение', 'Анализ конкурентов');
  await page.waitForURL('**/market');
  const main = page.getByRole('main');
  const grid = page.getByTestId('market-table');
  await expect(main.getByRole('heading', { level: 1 })).toHaveText('Анализ конкурентов');
  await expect(main.getByTestId('market-empty')).toContainText('Добавьте ближайших конкурентов');
  // одна кнопка «Добавить» на экране и без строки дат: сравнивать пока не с кем
  await expect(main.getByTestId('market-add')).toHaveCount(1);
  await expect(main.getByTestId('market-form')).toHaveCount(0);
  // шаги без обещаний сбора с площадок (Q-257 открыт)
  await expect(main.getByTestId('market-steps')).toContainText('Загрузка соседей обновляется');
  await expect(main.getByTestId('market-steps')).toContainText('вручную или сборщиком');
  await expect(main.getByTestId('market-steps')).not.toContainText('Booking');

  // отказ словами у формы, введённое не теряется
  await main.getByTestId('market-empty').getByTestId('market-add').click();
  const form = page.getByTestId('market-competitor-form');
  await form.getByTestId('market-name').fill('Отель Тестовый');
  await form.getByTestId('market-distance').fill('-5');
  await form.getByTestId('market-save').click();
  await expect(form.getByRole('alert')).toContainText('Расстояние');
  await expect(form.getByTestId('market-name')).toHaveValue('Отель Тестовый');
  await form.getByTestId('market-distance').fill('300');
  await form.getByTestId('market-save').click();
  await expect(page.getByText('Конкурент добавлен')).toBeVisible();

  const row = grid.getByRole('row', { name: /Отель Тестовый/ });
  await expect(row).toContainText('300 м');
  await expect(row).toContainText('вручную');
  await expect(main.getByTestId('market-add')).toHaveCount(1);
  await expect(main.getByTestId('market-form')).toBeVisible();
  // ссылка на площадку: метка честно говорит, что сбора нет
  await main.getByRole('button', { name: 'Изменить: Отель Тестовый' }).click();
  await expect(page.getByLabel('Ссылка на площадку')).toBeVisible();
  await page.getByTestId('market-url').fill('https://www.booking.com/hotel/kz/test.ru.html');
  await page.getByTestId('market-save').click();
  await expect(row).toContainText('Сбор не подключён');
  await expect(row).not.toContainText('ИИ');
  await expect(row).toContainText('данных нет');
  // единственная подсказка показывается карточкой рекомендации
  await expect(main.getByTestId('market-reco')).toContainText('Нет данных: Отель Тестовый');

  await main.getByRole('button', { name: 'Внести загрузку: Отель Тестовый' }).click();
  const entry = page.getByTestId('market-occupancy-form');
  const fields = entry.locator('input[name^="p:"]');
  await fields.nth(0).fill('150');
  await entry.getByTestId('market-occupancy-save').click();
  await expect(entry.getByRole('alert')).toContainText('от 0 до 100');
  await fields.nth(0).fill('88,5');
  await fields.nth(1).fill('40');
  await entry.getByTestId('market-occupancy-save').click();
  await expect(page.getByText('Загрузка сохранена: 2 ночи')).toBeVisible();
  // в «По ночам» целые проценты, хранится точно: 88,5 % → «89 %»
  const heat = main.getByTestId('market-table').getByRole('row', { name: /Отель Тестовый/ });
  await expect(heat).toContainText('89 %');
  await expect(heat).toContainText('40 %');
  await expect(main.getByTestId('market-row-market')).toContainText('89 %');
  await expect(main.getByTestId('market-row-own')).toBeVisible();
  await expect(main.getByTestId('market-reco')).not.toContainText('Нет данных');
});

test('плитки, календарь сигналов, график, рекомендация и таблица конкурентов; убрать из списка', async ({
  page,
  request,
}) => {
  const today = await seed(request);
  await page.goto('/market');
  const main = page.getByRole('main');
  const grid = page.getByTestId('market-table');
  // «По ночам»: значения, изменение к вчера, метка источника, расстояние и ссылка на соседа
  const altyn = grid.getByRole('row', { name: /Отель Алтын/ });
  await expect(altyn).toContainText('92 %');
  await expect(altyn).toContainText('+12 п.п.');
  await expect(altyn).toContainText('ИИ');
  await expect(altyn).toContainText('200 м');
  await expect(altyn.getByRole('link', { name: 'Отель Алтын' })).toHaveAttribute('href', 'https://example.com/altyn');
  // таблица конкурентов (SALES2.3b) рядом с подсказками: загрузка сегодня и свежесть данных словом
  const listed = main.getByTestId('market-competitors').getByRole('row', { name: /Отель Алтын/ });
  await expect(listed).toContainText('92 %');
  await expect(listed).toContainText('Актуально');

  // плитки: средняя по рынку до десятых, ночи высокого спроса, рыночные сигналы
  await expect(main.getByTestId('market-tile-market')).toHaveText('93,5 %');
  await expect(main.getByTestId('market-tile-high')).toHaveText('14');
  // рынок прыгнул к вчера на +12 п.п.: каждая дата окна — сигнал «резкое изменение»
  await expect(main.getByTestId('market-tile-signals')).toHaveText('14');
  await expect(
    main.getByTestId('market-calendar').locator('.market-calendar__grid .market-day--shift'),
  ).toHaveCount(14);

  // график: обе линии и значения по ночам без наведения
  const chart = main.getByTestId('market-chart');
  await expect(chart).toBeVisible();
  await chart.getByText('Значения по ночам').click();
  await expect(chart.locator('tbody tr')).toHaveCount(14);

  // рекомендация по данным: словами, с основанием и кнопкой к тарифам (цены меняет человек)
  const reco = main.getByTestId('market-reco');
  await expect(reco).toContainText(/Рынок почти полон|Высокий спрос/);
  await expect(reco).toContainText('По данным 2 из 2 конкурентов');
  await expect(reco.getByTestId('market-reco-rates')).toHaveAttribute('href', '/rooms/categories');

  // в «По ночам» изменение к вчера в клетках
  const heat = main.getByTestId('market-table').getByRole('row', { name: /Отель Алтын/ });
  await expect(heat).toContainText('92 %');
  await expect(heat).toContainText('+12 п.п.');
  await expect(main.getByTestId('market-row-market')).toContainText('94 %');

  // без сравнения изменения нет
  await page.goto('/market?compare=0');
  await expect(grid.getByRole('row', { name: /Отель Алтын/ })).not.toContainText('п.п.');
  // снимок «на вчера»: видно вчерашние 80 %, сегодняшних ещё не было
  await page.goto(`/market?asOf=${plus(today, -1)}&compare=0`);
  await expect(grid.getByRole('row', { name: /Отель Алтын/ })).toContainText('80 %');
  await expect(grid.getByRole('row', { name: /Хостел Сити/ })).toContainText('данных нет');

  await page.goto('/market');
  await main.getByTestId('market-edit-00000000-0000-4000-8000-00000000000b').click();
  await page.getByTestId('market-archive').click();
  await page.getByTestId('confirm-dialog').getByRole('button', { name: 'Убрать' }).click();
  await expect(page.getByText('Конкурент убран из списка')).toBeVisible();
  await expect(grid.getByRole('row', { name: /Хостел Сити/ })).toHaveCount(0);
  await expect(main.getByTestId('market-row-market')).toContainText('92 %');
});

test('календарь сигналов: дата открывает «Историю ночи»', async ({ page, request }) => {
  const today = await seed(request);
  await page.goto('/market');
  await page.getByTestId(`market-day-${today}`).click();
  await page.waitForURL(`**night=${today}`);
  await expect(page.getByTestId('market-night-table')).toBeVisible();
});

test('«только чтение»: показатели и таблицы видны, добавлять и вносить нельзя', async ({
  page,
  request,
}) => {
  await seed(request);
  await signIn(page);
  await control(request, { orgTrialDays: 'ended' });
  await page.goto('/market');
  const main = page.getByRole('main');
  const grid = page.getByTestId('market-table');
  await expect(page.getByTestId('read-only-banner')).toBeVisible();
  await expect(grid.getByRole('row', { name: /Отель Алтын/ })).toContainText('92 %');
  await expect(main.getByTestId('market-add')).toHaveCount(0);
  await expect(main.getByTestId('market-table').getByRole('button')).toHaveCount(0);
  await expect(main.getByTestId('market-competitors').getByRole('button')).toHaveCount(0);
});

for (const theme of ['light', 'dark'] as const) {
  test(`снимки и доступность: ${theme}`, async ({ page, request }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      if (!devNoise.test(error.message)) errors.push(error.message);
    });
    mkdirSync(SHOTS, { recursive: true });
    const axe = async () => {
      const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(audit.violations).toEqual([]);
    };
    const shot = async (name: string) => {
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        await page.screenshot({ path: `${SHOTS}/${name}-${theme}-${width}.png`, fullPage: true });
      }
      await page.setViewportSize({ width: 1440, height: 900 });
    };

    await page.goto('/market');
    await expect(page.getByTestId('market-empty')).toBeVisible();
    await axe();
    await shot('empty');

    await seed(request);
    await page.goto('/market');
    await expect(page.getByTestId('market-calendar')).toBeVisible();
    await expect(page.getByTestId('market-chart')).toBeVisible();
    await expect(page.getByTestId('market-competitors')).toBeVisible();
    await expect(page.getByTestId('market-table')).toBeVisible();
    await axe();
    await shot('board');

    await page.getByRole('button', { name: 'Внести загрузку: Отель Алтын' }).click();
    await expect(page.getByTestId('market-occupancy-form')).toBeVisible();
    await axe();
    await page.screenshot({ path: `${SHOTS}/entry-${theme}-1440.png` });
    expect(errors).toEqual([]);
  });
}

test('«Заполнить все ночи» ставит одно значение во все поля; сохранить без правок подтверждает снимок сегодняшним днём', async ({
  page,
  request,
}) => {
  const today = await seed(request);
  await page.goto('/market');
  const main = page.getByRole('main');
  const grid = page.getByTestId('market-table');
  const city = grid.getByRole('row', { name: /Хостел Сити/ });
  await main.getByRole('button', { name: 'Внести загрузку: Хостел Сити' }).click();
  const entry = page.getByTestId('market-occupancy-form');
  await entry.getByTestId('market-fill-value').fill('70');
  await entry.getByTestId('market-fill').click();
  await expect(entry.getByTestId(`market-p-${today}`)).toHaveValue('70');
  await expect(entry.getByTestId(`market-p-${plus(today, 13)}`)).toHaveValue('70');
  await entry.getByTestId('market-occupancy-save').click();
  await expect(page.getByText('Загрузка сохранена: 14 ночей')).toBeVisible();
  await expect(city).toContainText('70 %');
  await expect(city).not.toContainText('95 %');

  // у «Алтына» снимок вчера 80 %, сегодня 92 %: без правок «Сохранить» подтверждает сегодняшние 92 %
  const altyn = grid.getByRole('row', { name: /Отель Алтын/ });
  await main.getByRole('button', { name: 'Внести загрузку: Отель Алтын' }).click();
  await page.getByTestId('market-occupancy-save').click();
  await expect(page.getByText('Загрузка сохранена: 14 ночей')).toBeVisible();
  await expect(altyn).toContainText('92 %');
  await expect(altyn).toContainText('+12 п.п.');
});

test('«История ночи»: дата в шапке открывает панель с днями снимков и темпом рынка; закрытие убирает её из адреса', async ({
  page,
  request,
}) => {
  const today = await seed(request);
  await page.goto('/market');
  await page.getByTestId(`market-night-${today}`).click();
  await page.waitForURL(`**night=${today}`);
  const table = page.getByTestId('market-night-table');
  // два дня снимков: вчера «Алтын» 80 %, «Сити» ещё нет; сегодня 92 % и 95 %
  await expect(table.locator('tbody tr')).toHaveCount(2);
  await expect(table.locator('tbody tr').first()).toContainText('92 %');
  await expect(table.locator('tbody tr').nth(1)).toContainText('80 %');
  // рынок вчера 80 %, сегодня 93,5 %: темп +13,5 п.п., целыми +14
  await expect(page.getByTestId('market-night-pickup')).toContainText('+14 п.п.');
  // панель выезжает анимацией 180 мс (`drawer-in`, premium.css) и всё это время полупрозрачна: axe
  // мерит контраст сквозь неё и видит `--muted` как #6c7b8f (4,23 вместо 4,5). Ждём конца анимации,
  // а не «видно ли панель»: тот же приём, что в графике мастера (B4, 03.10)
  // на странице три `Overlay`, нужен тот, в котором лежит таблица истории
  await page
    .locator('.ui-overlay')
    .filter({ has: page.getByTestId('market-night-table') })
    .evaluate(async (el) => {
      await Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished));
    });
  const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(audit.violations).toEqual([]);
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/night-light-1440.png` });
  await page.keyboard.press('Escape');
  await expect(page).not.toHaveURL(/night=/);
  await expect(table).toHaveCount(0);

  // ночь без снимков: честная пустая история
  await page.goto(`/market?night=${plus(today, 20)}`);
  await expect(page.getByTestId('market-night-empty')).toBeVisible();
});

// Сборщик видит на странице только «мест нет» или «осталось 2»: снимок без процента, одним уровнем (DATA_MODEL §23.1).
// До мастер-прохода UI 11.10.2026 такая ночь рисовалась прочерком «нет данных».
test('снимок сборщика только уровнем: ячейка словом, строка рынка считает почти полных', async ({
  page,
  request,
}) => {
  const reset = await request.post(`${API}/__test/market`, { data: {} });
  const { today } = (await reset.json()) as { today: string };
  const A = '00000000-0000-4000-8000-0000000000c1';
  const B = '00000000-0000-4000-8000-0000000000c2';
  await request.post(`${API}/__test/market`, {
    data: {
      competitors: [
        { id: A, name: 'Отель Полный', distanceM: 300 },
        { id: B, name: 'Хостел Свободный', distanceM: 500 },
      ],
      readings: [
        { competitorId: A, stayDate: today, observedOn: today, occupancyBp: null, level: 'SOLD_OUT', source: 'AI_AGENT' },
        { competitorId: B, stayDate: today, observedOn: today, occupancyBp: null, level: 'AVAILABLE', source: 'AI_AGENT' },
      ],
    },
  });
  await page.goto('/market');
  const grid = page.getByTestId('market-table');
  await expect(grid.getByRole('row', { name: /Отель Полный/ })).toContainText('Нет мест');
  await expect(grid.getByRole('row', { name: /Хостел Свободный/ })).toContainText('Есть места');
  await expect(grid.getByTestId('market-row-market')).toContainText('почти полны 1 из 2');
});

for (const width of [390, 1440]) {
  test(`форма конкурента: подписи слева и детали свёрнуты (${width})`, async ({ page, request }) => {
    await request.post(`${API}/__test/market`, { data: {} });
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/market');
    await page.getByTestId('market-add').click();
    const form = page.getByTestId('market-competitor-form');
    await expect(form).toBeVisible();
    expect(await form.evaluate((el) => getComputedStyle(el).textAlign)).toBe('left');
    await expect(form.getByLabel('Район', { exact: true })).not.toBeVisible();
    await form.getByText('Дополнительные сведения', { exact: true }).click();
    await expect(form.getByLabel('Район', { exact: true })).toBeVisible();
    await form.getByText('Дополнительные сведения', { exact: true }).click();
    const grid = form.locator('.market-form-grid').first();
    expect(await grid.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await form.evaluate((el) => { const scroller = el.closest('.overlay-content'); if (scroller) scroller.scrollTop = 0; });
    await page.screenshot({ path: `${SHOTS}/competitor-form-${width}.png` });
    await form.getByRole('button', { name: 'Отмена', exact: true }).click();
    await expect(form).not.toBeVisible();
  });
}
