import { mkdirSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import type { APIRequestContext } from '@playwright/test';
import { expect, test, devNoise, type Page } from './fixtures';

/**
 * «Загрузка конкурентов» (ADR-142, план `plans/market-competitor-occupancy-2026-10-03.md`): пункт «Продажи»,
 * пустое состояние, добавить конкурента, внести загрузку по ночам, таблица «вы и рынок» с изменением к вчера,
 * подсказки к цене, «убрать из списка», «только чтение». Подставной API считает тем же доменом, что API.
 * Отели вымышленные (ADR-010).
 */
const API = process.env.UI_FIXTURE_API ?? 'http://127.0.0.1:4311';
const SHOTS = 'reports/market-competitors-2026-10-03';
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

test('пункт в «Продажах» ведёт в раздел; пусто: «Добавьте ближайших конкурентов»; добавить и внести загрузку', async ({
  page,
}) => {
  await page.goto('/today');
  await page.locator('.topmenu').getByRole('button', { name: 'Продажи' }).click();
  await page.locator('.topmenu').getByRole('link', { name: 'Загрузка конкурентов' }).click();
  await page.waitForURL('**/market');
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { level: 1 })).toHaveText('Загрузка конкурентов');
  await expect(main.getByTestId('market-empty')).toContainText('Добавьте ближайших конкурентов');

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

  const row = main.getByRole('row', { name: /Отель Тестовый/ });
  await expect(row).toContainText('300 м');
  await expect(row).toContainText('данных нет');
  await expect(main.getByTestId('market-insights')).toContainText('Нет данных: Отель Тестовый');

  await row.getByRole('button', { name: 'Внести загрузку: Отель Тестовый' }).click();
  const entry = page.getByTestId('market-occupancy-form');
  const fields = entry.locator('input[name^="p:"]');
  await fields.nth(0).fill('150');
  await entry.getByTestId('market-occupancy-save').click();
  await expect(entry.getByRole('alert')).toContainText('от 0 до 100');
  await fields.nth(0).fill('88,5');
  await fields.nth(1).fill('40');
  await entry.getByTestId('market-occupancy-save').click();
  await expect(page.getByText('Загрузка сохранена: 2 ночи')).toBeVisible();
  // в таблице целые проценты, хранится точно: 88,5 % → «89 %»
  await expect(row).toContainText('89 %');
  await expect(row).toContainText('40 %');
  await expect(main.getByTestId('market-row-market')).toContainText('89 %');
  await expect(main.getByTestId('market-row-own')).toBeVisible();
  await expect(main.getByTestId('market-insights')).not.toContainText('Нет данных');
});

test('таблица «вы и рынок»: изменение к вчера, метка ИИ, средняя, подсказка ведёт к ценам; убрать из списка', async ({
  page,
  request,
}) => {
  const today = await seed(request);
  await page.goto('/market');
  const main = page.getByRole('main');
  const altyn = main.getByRole('row', { name: /Отель Алтын/ });
  await expect(altyn).toContainText('92 %');
  await expect(altyn).toContainText('+12 п.п.');
  await expect(altyn).toContainText('ИИ');
  await expect(altyn).toContainText('200 м');
  await expect(altyn.getByRole('link', { name: 'Отель Алтын' })).toHaveAttribute('href', 'https://example.com/altyn');
  // средняя по рынку: (92 + 95) / 2 = 93,5 %; в таблице целыми, на плитке до десятых
  await expect(main.getByTestId('market-row-market')).toContainText('94 %');
  await expect(main.getByTestId('market-tile-market')).toHaveText('93,5 %');
  await expect(main.getByTestId('market-tile-high')).toHaveText('14');
  // подсказка: высокий спрос, ссылка в календарь цен месяца первой ночи
  const insight = main.getByTestId('market-insights').locator('li').first();
  await expect(insight).toContainText(/Рынок почти полон|Высокий спрос/);
  await expect(insight.getByRole('link', { name: 'Открыть цены' })).toHaveAttribute(
    'href',
    `/rates?month=${today.slice(0, 7)}`,
  );

  // без сравнения изменения нет
  await page.goto('/market?compare=0');
  await expect(main.getByRole('row', { name: /Отель Алтын/ })).not.toContainText('п.п.');
  // снимок «на вчера»: видно вчерашние 80 %, сегодняшних ещё не было
  await page.goto(`/market?asOf=${plus(today, -1)}&compare=0`);
  await expect(main.getByRole('row', { name: /Отель Алтын/ })).toContainText('80 %');
  await expect(main.getByRole('row', { name: /Хостел Сити/ })).toContainText('данных нет');

  await page.goto('/market');
  await main.getByTestId('market-edit-00000000-0000-4000-8000-00000000000b').click();
  await page.getByTestId('market-archive').click();
  await page.getByTestId('confirm-dialog').getByRole('button', { name: 'Убрать' }).click();
  await expect(page.getByText('Конкурент убран из списка')).toBeVisible();
  await expect(main.getByRole('row', { name: /Хостел Сити/ })).toHaveCount(0);
  await expect(main.getByTestId('market-row-market')).toContainText('92 %');
});

test('«только чтение»: таблица и подсказки видны, добавлять и вносить нельзя', async ({
  page,
  request,
}) => {
  await seed(request);
  await signIn(page);
  await control(request, { orgTrialDays: 'ended' });
  await page.goto('/market');
  const main = page.getByRole('main');
  await expect(page.getByTestId('read-only-banner')).toBeVisible();
  await expect(main.getByRole('row', { name: /Отель Алтын/ })).toContainText('92 %');
  await expect(main.getByTestId('market-add')).toHaveCount(0);
  await expect(main.getByTestId('market-table').getByRole('button')).toHaveCount(0);
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
  const city = main.getByRole('row', { name: /Хостел Сити/ });
  await city.getByRole('button', { name: 'Внести загрузку: Хостел Сити' }).click();
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
  const altyn = main.getByRole('row', { name: /Отель Алтын/ });
  await altyn.getByRole('button', { name: 'Внести загрузку: Отель Алтын' }).click();
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
