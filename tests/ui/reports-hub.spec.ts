import { mkdirSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { FIXTURE_API, expect, test } from './fixtures';

/**
 * Хаб «Отчёты» (REP1, план `plans/reports-hub-2026-10-02.md`): один вход ко всем отчётам. Карточки
 * сгруппированы по вопросу («Деньги», «Загрузка и продажи», «День», «Сайт»), на каждой — живое число
 * за выбранный период из того же API, что и целевой экран, и ссылка туда с тем же периодом в адресе.
 * Хаб не считает ничего сам: числа — ровно те, что отдают `/finance/report`, `/finance/debts`,
 * `/desk/dashboard` и `/desk/today` подставного API. Плюс выгрузка CSV долгов со вкладки «Долги».
 */
// адрес подставного API настраиваем: прогон на своём стенде не трогает общий 4311
const fixture = FIXTURE_API;
const report = 'reports/reports-hub-2026-10-02';

// «сегодня» объекта — Алматы (+5), как в finance-f1.spec
const today = new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const now = new Date(`${today}T00:00:00Z`);
const monthFrom = iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
const monthTo = iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)));

const digits = (text: string) => text.replace(/[^\d]/g, '');

async function json<T>(
  request: import('@playwright/test').APIRequestContext,
  path: string,
): Promise<T> {
  const res = await request.get(`${fixture}${path}`, { headers: { 'x-wetop-test-client': '1' } });
  expect(res.ok(), `фикстура не ответила на ${path}`).toBe(true);
  return (await res.json()) as T;
}

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});
test.afterEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

test('хаб: заголовок, период месяцем, группы и числа — те же, что отдаёт API', async ({
  page,
  request,
}) => {
  const [fin, debts, dash, day] = await Promise.all([
    json<{ chargedMinor: string; paidMinor: string }>(
      request,
      `/finance/report?from=${monthFrom}&to=${monthTo}`,
    ),
    json<{ balanceMinor: string; count: number }>(
      request,
      `/finance/debts?from=${monthFrom}&to=${monthTo}`,
    ),
    json<{
      current: {
        occupancy: { percent: number };
        bookings: { total: number };
        sources: Array<{ count: number }>;
      };
    }>(request, `/desk/dashboard?from=${monthFrom}&to=${monthTo}`),
    json<{ counts: { arrivals: number; departures: number; inHouse: number } }>(
      request,
      '/desk/today',
    ),
  ]);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/reports');
  const main = page.getByRole('main');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Отчёты');
  // «31 день» / «2 дня» / «7 дней» — любое из слов периода
  await expect(main.getByTestId('reports-period')).toContainText(/д(ень|ня|ней)/);

  // группы — по вопросу, на который отвечает отчёт
  await expect(main.locator('.reports-group h2')).toHaveText([
    'Деньги',
    'Загрузка и продажи',
    'День',
    'Сайт',
  ]);

  // числа карточек — из тех же ответов API, что и целевые экраны
  const value = (card: string) => main.getByTestId(card).locator('.report-card__value');
  expect(digits(await value('report-finance').innerText()) || '0').toBe(
    String(BigInt(fin.chargedMinor) / 100n),
  );
  expect(digits(await value('report-operations').innerText()) || '0').toBe(
    String(BigInt(fin.paidMinor) / 100n),
  );
  expect(digits(await value('report-debts').innerText()) || '0').toBe(
    String(BigInt(debts.balanceMinor) / 100n),
  );
  expect(digits(await value('report-occupancy').innerText())).toBe(
    digits(String(dash.current.occupancy.percent)),
  );
  expect(digits(await value('report-overview').innerText())).toBe(
    String(dash.current.bookings.total),
  );
  await expect(value('report-day')).toHaveText(`${day.counts.arrivals} / ${day.counts.departures}`);
  expect(digits(await value('report-inhouse').innerText())).toBe(String(day.counts.inHouse));
  // долг есть — карточка предупреждает тоном, а не только числом
  if (BigInt(debts.balanceMinor) > 0n)
    await expect(main.getByTestId('report-debts')).toHaveClass(/report-card--warn/);
  // у «Аналитики сайта» своего периода и числа нет — карточка-ссылка
  await expect(main.getByTestId('report-website')).toBeVisible();
});

test('карточки ведут в готовые экраны с тем же периодом', async ({ page }) => {
  await page.goto('/reports');
  const main = page.getByRole('main');
  await expect(main.getByTestId('report-finance')).toHaveAttribute(
    'href',
    `/finance?from=${monthFrom}&to=${monthTo}#charges`,
  );
  await expect(main.getByTestId('report-debts')).toHaveAttribute(
    'href',
    `/finance?from=${monthFrom}&to=${monthTo}#debts`,
  );
  // REP2: карточка услуг (сумма из сводки — проверяет finance-services.spec)
  await expect(main.getByTestId('report-services')).toHaveAttribute(
    'href',
    `/finance?from=${monthFrom}&to=${monthTo}#services`,
  );
  await expect(main.getByTestId('report-operations')).toHaveAttribute(
    'href',
    `/finance?from=${monthFrom}&to=${monthTo}#operations`,
  );
  await expect(main.getByTestId('report-overview')).toHaveAttribute(
    'href',
    `/management/analytics?period=custom&from=${monthFrom}&to=${monthTo}`,
  );
  await expect(main.getByTestId('report-occupancy')).toHaveAttribute(
    'href',
    `/management/analytics/occupancy?period=custom&from=${monthFrom}&to=${monthTo}`,
  );
  await expect(main.getByTestId('report-inhouse')).toHaveAttribute(
    'href',
    '/reservations?view=inhouse',
  );
  await expect(main.getByTestId('report-day')).toHaveAttribute('href', '/today');
  await expect(main.getByTestId('report-website')).toHaveAttribute('href', '/website/analytics');
  // загрузка конкурентов (ADR-142): карточка-ссылка без своего запроса, бюджет хаба не растёт
  await expect(main.getByTestId('report-market')).toHaveAttribute('href', '/market');

  // переход действительно открывает целевой экран с тем же периодом
  await main.getByTestId('report-occupancy').click();
  await expect(page).toHaveURL(
    `/management/analytics/occupancy?period=custom&from=${monthFrom}&to=${monthTo}`,
  );
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Аналитика');
});

test('пресет «Сегодня» и свой период меняют адрес и числа', async ({ page }) => {
  await page.goto('/reports');
  const main = page.getByRole('main');
  await main.getByRole('navigation', { name: 'Готовые периоды' }).getByText('Сегодня').click();
  await expect(page).toHaveURL(`/reports?from=${today}&to=${today}`);
  await expect(main.getByTestId('report-finance')).toHaveAttribute(
    'href',
    `/finance?from=${today}&to=${today}#charges`,
  );

  // свой период — та же форма С/По, что на «Финансах»
  const form = main.getByTestId('reports-period-form');
  await form.getByLabel('Период: с').fill('2026-09-01');
  await form.getByLabel('Период: по').fill('2026-09-10');
  await form.getByRole('button', { name: 'Показать', exact: true }).click();
  await expect(page).toHaveURL('/reports?from=2026-09-01&to=2026-09-10');
  await expect(main.getByTestId('reports-period')).toContainText('10 дней');
});

test('сбой одного запроса не роняет хаб: карточка говорит «не загрузилось», остальные живут', async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/control`, { data: { failPath: '/finance/report' } });
  await page.goto('/reports');
  const main = page.getByRole('main');
  await expect(main.getByTestId('report-finance').locator('.report-card__value')).toHaveText('—');
  await expect(main.getByTestId('report-finance')).toContainText('не загрузилось');
  // загрузка из /desk/dashboard живёт
  await expect(main.getByTestId('report-occupancy').locator('.report-card__value')).toContainText(
    '%',
  );
});

test('CSV долгов: кнопка на вкладке «Долги», файл без имён гостей', async ({ page }) => {
  await page.goto(`/finance?from=${monthFrom}&to=${monthTo}`);
  await page.getByRole('button', { name: 'Отчёты и управление' }).click();
  await page.getByRole('tab', { name: 'Долги', exact: true }).click();
  const link = page.getByTestId('debts-export');
  await expect(link).toHaveAttribute(
    'href',
    `/finance/export-debts?from=${monthFrom}&to=${monthTo}`,
  );
  const res = await page.request.get(`/finance/export-debts?from=${monthFrom}&to=${monthTo}`);
  expect(res.ok()).toBe(true);
  expect(res.headers()['content-type']).toContain('text/csv');
  const body = await res.text();
  expect(body.startsWith('﻿')).toBe(true);
  expect(body.split('\r\n')[0]).toBe(
    '﻿Бронь;Статус;Заезд;Выезд;Ночей;Начислено, ₸;Оплачено, ₸;Возвращено, ₸;Остаток, ₸;Просрочено',
  );
  // имён гостей в файле нет: он уходит из системы, бронь находится по номеру
  expect(body).not.toContain('Гость');
});

test('телефон: карточки без горизонтальной прокрутки', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/reports');
  await expect(page.getByTestId('report-finance')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
});

for (const theme of ['light', 'dark'] as const) {
  test(`доступность и снимки, ${theme}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/reports');
    await expect(page.getByTestId('report-finance')).toBeVisible();
    const scan = await new AxeBuilder({ page }).analyze();
    expect(scan.violations.map((v) => v.id)).toEqual([]);
    await page.mouse.move(0, 0);
    mkdirSync(report, { recursive: true });
    await page.screenshot({
      path: `${report}/${theme}-1440.png`,
      caret: 'initial',
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `${report}/${theme}-390.png`, caret: 'initial', fullPage: true });
  });
}
