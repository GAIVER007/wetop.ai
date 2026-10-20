import { mkdirSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import type { APIRequestContext } from '@playwright/test';
import { FIXTURE_API, expect, test, devNoise, type Page } from './fixtures';

/**
 * «Бюджет и аналитика → Сводка» (решение владельца 20.10.2026, `docs/decisions/2026-10-20-budget-analytics-summary.md`):
 * один пункт меню, сводка первой вкладкой: расход вручную и расход кабинета Meta раздельно, заявки, цена заявки и ROMI
 * по каналам. Числа сверяются с ручным расчётом ниже; подставной API отдаёт те же формы, что настоящий. Данные
 * вымышленные (ADR-010).
 */
const API = FIXTURE_API;
const SHOTS = 'reports/budget-analytics-2026-10-20';

test.beforeEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});
test.afterEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});

/**
 * Месяц: сайт 4 000 ₸, WhatsApp 2 000 ₸, Meta в журнале 7 200 ₸, Google 4 800 ₸ (итого 18 000 ₸), Instagram 1 200 ₸ вне
 * бюджета. Заявки: сайт 10 (выручка 12 000 ₸), WhatsApp 3 (1 000 ₸). Кабинет Meta: 120 $ и 45 лидов площадки за день.
 */
async function seed(request: APIRequestContext, opts: { supported?: boolean } = {}) {
  const reset = await request.post(`${API}/__test/marketing-budget`, { data: {} });
  const { today } = (await reset.json()) as { today: string };
  const month = today.slice(0, 7);
  await request.post(`${API}/__test/marketing-budget`, {
    data: {
      expenses: [
        { date: today, platform: 'SITE', category: 'Реклама', amount: '4000' },
        { date: today, platform: 'WHATSAPP', category: 'Реклама', amount: '2000' },
        { date: today, platform: 'META', category: 'Оплата счёта Meta', amount: '7200' },
        { date: today, platform: 'GOOGLE', category: 'Реклама', amount: '4800' },
        { date: today, platform: 'INSTAGRAM', category: 'Реклама', amount: '1200', countedInBudget: false },
      ],
      campaigns: [
        {
          id: 'cabinet-summary',
          platform: 'META',
          name: 'Meta: брони осень',
          external: true,
          cabinetDaySpend: 12000,
          days: [{ date: today, impressions: 30000, clicks: 400, leads: 45 }],
        },
      ],
      results:
        opts.supported === false
          ? { month, supported: false }
          : {
              month,
              channels: [
                { channel: 'SITE', leads: 10, bookings: 4, revenue: '1200000' },
                { channel: 'WHATSAPP', leads: 3, bookings: 1, revenue: '100000' },
                { channel: 'INSTAGRAM', leads: 0, bookings: 0, revenue: '0' },
                { channel: 'PHONE', leads: 0, bookings: 0, revenue: '0' },
              ],
              days: [{ date: today, leads: 13, bookings: 5, newGuests: 2, revenue: '1300000' }],
            },
    },
  });
  return { today, month };
}

async function openSummary(page: Page, month: string) {
  await page.goto(`/marketing/budget?month=${month}`);
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { level: 1 })).toHaveText('Бюджет и аналитика');
  await expect(main.getByTestId('budget-summary')).toBeVisible();
  return main;
}

test('сводка: расход вручную и кабинета раздельно, заявки, цена заявки и ROMI сходятся с расчётом', async ({
  page,
  request,
}) => {
  const { month } = await seed(request);
  const main = await openSummary(page, month);
  const tabs = main.getByRole('navigation', { name: 'Разделы бюджета и аналитики' });
  await expect(tabs.getByRole('link')).toHaveText(['Сводка', 'План', 'Расходы', 'Аналитика']);
  await expect(tabs.getByRole('link', { name: 'Сводка' })).toHaveAttribute('aria-current', 'page');

  // 4 000 + 2 000 + 7 200 + 4 800 = 18 000 ₸; Instagram вне бюджета не входит
  await expect(main.getByTestId('summary-manual')).toHaveText('18 000 ₸');
  // кабинет в своей валюте и отдельно: 12 000 центов = 120 $, к ручному не прибавлен
  await expect(main.getByTestId('summary-cabinet')).toHaveText('120 USD');
  await expect(main.getByTestId('summary-separate-note')).toContainText('не складываются');
  // заявки 10 + 3 = 13 (лиды площадки отдельно), цена 1 800 000 / 13 = 138 461,5 → 1 384,62 ₸
  await expect(main.getByTestId('summary-requests')).toHaveText('13');
  await expect(main.getByText('Заявки на бронирование', { exact: true })).toBeVisible();
  await expect(main.getByTestId('summary-cpr')).toHaveText('1 384,62 ₸');
  // ROMI (13 000 − 18 000) / 18 000 = −27,8 % → −28 %
  await expect(main.getByTestId('summary-romi')).toHaveText('-28 %');

  const table = main.getByTestId('summary-channels');
  await expect(table.locator('tbody tr')).toHaveCount(4);
  await expect(table.locator('tbody tr td:first-child .budget-cell-main')).toHaveText([
    'Сайт',
    'WhatsApp',
    'Meta Ads',
    'Google Ads',
  ]);
  // сайт: 4 000 ₸, 10 заявок, 400 ₸ за заявку, выручка 12 000 ₸, ROMI +200 %
  const site = main.getByTestId('summary-row-SITE');
  for (const text of ['4 000 ₸', '10', '400 ₸', '12 000 ₸', '+200 %']) await expect(site).toContainText(text);
  // WhatsApp: 200 000 / 3 = 66 666,7 → 666,67 ₸; ROMI (1 000 − 2 000) / 2 000 = −50 %
  const wa = main.getByTestId('summary-row-WHATSAPP');
  for (const text of ['2 000 ₸', '666,67 ₸', '1 000 ₸', '-50 %']) await expect(wa).toContainText(text);
  // Meta: журнал 7 200 ₸ и кабинет 120 $ в одной строке отдельными колонками, 45 лидов площадки,
  // цена лида по кабинету 12 000 / 45 = 266,7 → 2,67 USD, выручки и ROMI нет
  const meta = main.getByTestId('summary-row-META');
  for (const text of ['Кабинет', '7 200 ₸', '120 USD', '45', 'лиды площадки', '2,67 USD'])
    await expect(meta).toContainText(text);
  await expect(meta.locator('td').nth(5)).toContainText('Нет данных');
  await expect(meta.locator('td').nth(6)).toContainText('Нет данных');
  // Google: только расход
  const google = main.getByTestId('summary-row-GOOGLE');
  await expect(google).toContainText('4 800 ₸');
  await expect(google.locator('td').nth(3)).toContainText('Нет данных');
  // итог равен плиткам
  const total = main.getByTestId('summary-total');
  for (const text of ['18 000 ₸', '120 USD', '13', '1 384,62 ₸', '13 000 ₸', '-28 %']) await expect(total).toContainText(text);

  // «Аналитика» вкладкой того же раздела: те же расход и ROMI
  await tabs.getByRole('link', { name: 'Аналитика' }).click();
  await page.waitForURL(`**/marketing/analytics?month=${month}`);
  await expect(main.getByTestId('man-spent')).toContainText('18 000');
  await expect(main.getByTestId('man-romi')).toHaveText('-28 %');
});

test('«Откуда берутся цифры»: состояние каждого источника и как его добавить прямо со сводки', async ({
  page,
  request,
}) => {
  const { month } = await seed(request);
  const main = await openSummary(page, month);
  const sources = main.getByTestId('summary-sources');
  await expect(sources.getByRole('heading', { level: 3 })).toHaveText([
    'Расходы вручную',
    'Кабинет Meta (Facebook и Instagram)',
    'Заявки и выручка',
    'Другая реклама',
  ]);
  // пять строк журнала, одна из них вне бюджета
  await expect(main.getByTestId('source-manual-status')).toHaveText('5 расходов за месяц');
  await expect(main.getByTestId('source-manual-state')).toHaveText('Работает');
  // кабинет в засеве не подключён: «нужно добавить» и вход через Facebook прямо здесь
  await expect(main.getByTestId('source-meta-state')).toHaveText('Нужно добавить');
  await expect(main.getByTestId('source-meta').getByTestId('meta-connect')).toBeVisible();
  await expect(main.getByTestId('source-results-status')).toHaveText('Подтягиваются сами');
  await expect(main.getByTestId('source-other-ads')).toContainText('Google Ads');

  // расход добавляется со сводки, и сводка пересчитывается: +1 000 ₸ на сайт
  await main.getByTestId('source-manual').getByTestId('budget-add').click();
  const form = page.getByTestId('budget-expense-form');
  await form.getByTestId('budget-platform').selectOption('SITE');
  await form.getByTestId('budget-amount').fill('1000');
  await form.getByTestId('budget-category').fill('Реклама');
  await form.getByTestId('budget-save').click();
  await expect(page.getByText('Расход добавлен')).toBeVisible();
  await expect(main.getByTestId('summary-manual')).toHaveText('19 000 ₸');
  await expect(main.getByTestId('source-manual-status')).toHaveText('6 расходов за месяц');
  await expect(main.getByTestId('summary-row-SITE')).toContainText('5 000 ₸');

  // CSV открывается той же панелью, что в журнале
  await main.getByTestId('source-manual').getByTestId('budget-import').click();
  await expect(page.getByRole('dialog', { name: 'Загрузка расходов' })).toBeVisible();
});

test('один пункт меню «Бюджет и аналитика»; прежние адреса работают и подсвечивают его', async ({ page, request }) => {
  // четыре экрана подряд: в режиме разработки каждый собирается при первом заходе
  test.setTimeout(120_000);
  const { month } = await seed(request);
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const path of [
    `/marketing/budget?month=${month}`,
    `/marketing/budget/plan?month=${month}`,
    `/marketing/budget/expenses?month=${month}`,
    `/marketing/analytics?month=${month}`,
  ]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toHaveText('Бюджет и аналитика');
    const current = page.locator('.sidenav__items [aria-current="page"]');
    await expect(current).toHaveCount(1);
    await expect(current).toHaveText('Бюджет и аналитика');
  }
  // старого пункта «Аналитика маркетинга» в меню нет
  await expect(page.locator('.sidenav__items a', { hasText: 'Аналитика маркетинга' })).toHaveCount(0);
  // старый адрес аналитики бюджета по-прежнему перенаправляет с месяцем
  await page.goto(`/marketing/budget/analytics?month=${month}`);
  await expect(page).toHaveURL(`/marketing/analytics?month=${month}`, { timeout: 30_000 });
});

test('без результатов каналов (как у салона и ресторана): заявки и ROMI «Нет данных», расходы видны', async ({
  page,
  request,
}) => {
  const { month } = await seed(request, { supported: false });
  const main = await openSummary(page, month);
  await expect(main.getByTestId('summary-manual')).toHaveText('18 000 ₸');
  await expect(main.getByTestId('summary-cabinet')).toHaveText('120 USD');
  await expect(main.getByTestId('summary-requests')).toHaveText('Нет данных');
  await expect(main.getByTestId('summary-cpr')).toHaveText('Нет данных');
  await expect(main.getByTestId('summary-romi')).toHaveText('Нет данных');
  // не ноль и не −100 %
  await expect(main.getByTestId('summary-romi')).not.toContainText('%');
  await expect(main.getByTestId('summary-row-SITE')).toContainText('4 000 ₸');
  // у Meta цена лида по кабинету считается и без своих результатов
  await expect(main.getByTestId('summary-row-META')).toContainText('2,67 USD');
});

for (const theme of ['light', 'dark'] as const) {
  test(`сводка: снимки 1440 и 390, без прокрутки вбок, доступность: ${theme}`, async ({ page, request }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      if (!devNoise.test(error.message)) errors.push(error.message);
    });
    mkdirSync(SHOTS, { recursive: true });
    const { month } = await seed(request);
    await page.setViewportSize({ width: 1440, height: 900 });
    const main = await openSummary(page, month);
    await expect(main.getByTestId('summary-total')).toContainText('18 000 ₸');
    const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(audit.violations).toEqual([]);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await expect(main.getByTestId('summary-manual')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await page.screenshot({ path: `${SHOTS}/summary-${theme}-${width}.png`, fullPage: true });
    }
    expect(errors).toEqual([]);
  });
}
