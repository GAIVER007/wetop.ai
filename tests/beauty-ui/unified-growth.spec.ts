import { test, expect } from '../ui/fixtures';
import type { Page, APIRequestContext } from '@playwright/test';
import type { BeautyDay } from '../../apps/web/src/lib/api';

type Fixture = { business: string; locations: string[] };
type CreatedEntity = { id: string };

/**
 * Единая система направлений (14.10.2026): «Продажи», «Финансы» и «Маркетинг» салона на настоящем API салона и
 * базе стенда. Записи заводятся на прошедшие дни периода и проводятся до «Выполнено»: хаб продаж и финансы считают
 * выручку из снимков цен, мастера и услуги по выручке. Снимки экранов: reports/unified-growth-2026-10-14.
 */
const api = `http://127.0.0.1:${process.env.BEAUTY_UI_API_PORT || '26814'}`;
const shots = 'reports/unified-growth-2026-10-14';
const pointer = (business: string, location: string) => `business=${business};location=${location}`;
const almatyToday = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' }).format(new Date());
const minus = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};

async function ok<T = unknown>(res: Awaited<ReturnType<APIRequestContext['post']>>, what: string) {
  expect(res.ok(), `${what}: ${res.status()} ${await res.text()}`).toBe(true);
  return (await res.json()) as T;
}

async function seed(page: Page, request: APIRequestContext) {
  const f = await ok<Fixture>(await request.post(`${api}/__test/reset`), 'reset');
  const location = f.locations[0];
  if (!location) throw new Error('В стенде отсутствует филиал');
  const headers = { 'x-wetop-scope': pointer(f.business, location) };
  await page.context().addCookies([
    { name: 'wetop_scope', value: encodeURIComponent(pointer(f.business, location)), domain: '127.0.0.1', path: '/' },
  ]);
  const services = [];
  for (const [name, price] of [
    ['Стрижка женская', '1200000'],
    ['Окрашивание', '2500000'],
    ['Маникюр', '800000'],
  ] as const) {
    const s = await ok<CreatedEntity>(
      await request.post(`${api}/beauty/services`, {
        headers,
        data: { name, durationMinutes: 60, priceMinor: price, currency: 'KZT' },
      }),
      'service',
    );
    await ok(await request.put(`${api}/beauty/services/${s.id}/location`, { headers, data: { enabled: true } }), 'enable');
    services.push(s);
  }
  const masters = [];
  for (const name of ['Мария Ким', 'Дина Абенова']) {
    const e = await ok<CreatedEntity>(await request.post(`${api}/beauty/employees`, { headers, data: { name } }), 'employee');
    await ok(
      await request.put(`${api}/beauty/employees/${e.id}/services`, {
        headers,
        data: { serviceIds: services.map((s) => s.id) },
      }),
      'employee services',
    );
    await ok(
      await request.put(`${api}/beauty/employees/${e.id}/working-hours`, {
        headers,
        data: { expectedRevision: (await (await request.get(`${api}/beauty/schedule?employee=${e.id}`, { headers })).json()).weekRevision, intervals: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, timeFrom: '09:00', timeTo: '21:00' })) },
      }),
      'hours',
    );
    masters.push(e);
  }
  const today = almatyToday();
  const plan: Array<[number, number, number, string, 'DONE' | 'NO_SHOW' | 'CANCELLED' | 'BOOKED']> = [
    // [дней назад, мастер, услуга, время по Алматы, итог]
    [6, 0, 0, '10:00', 'DONE'],
    [5, 1, 1, '11:00', 'DONE'],
    [4, 0, 2, '12:00', 'DONE'],
    [3, 1, 1, '13:00', 'DONE'],
    [2, 0, 0, '14:00', 'NO_SHOW'],
    [1, 1, 1, '15:00', 'DONE'],
    [1, 0, 2, '16:00', 'CANCELLED'],
    [0, 0, 0, '20:00', 'BOOKED'],
  ];
  let n = 0;
  for (const [ago, m, s, time, final] of plan) {
    const date = minus(today, ago);
    // Алматы UTC+5: местное время в UTC
    const [hh, mm] = time.split(':').map(Number);
    const startsAt = new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10), hh! - 5, mm)).toISOString();
    const master = masters[m];
    const service = services[s];
    if (!master || !service) throw new Error('Не найдены мастер или услуга сценария');
    const day = await ok<BeautyDay>(
      await request.post(`${api}/beauty/appointments`, {
        headers,
        data: {
          employeeId: master.id,
          serviceId: service.id,
          startsAt,
          firstName: ['Анна', 'Алия', 'Карина', 'Жанна', 'Сауле', 'Мадина', 'Лаура', 'Ирина'][n++],
          phone: `+7 701 000-00-${String(n).padStart(2, '0')}`,
        },
      }),
      'appointment',
    );
    const row = day.appointments.find((a: { startsAt: string }) => a.startsAt === startsAt);
    if (!row) throw new Error('Созданная запись отсутствует в ответе API');
    const path: string[] = final === 'DONE' ? ['CONFIRMED', 'DONE'] : final === 'BOOKED' ? [] : [final];
    for (const status of path)
      await ok(await request.post(`${api}/beauty/appointments/${row.id}/status`, { headers, data: { status } }), status);
  }
  // бюджет маркетинга филиала: план месяца и два расхода, хаб показывает потраченное
  const month = today.slice(0, 7);
  await ok(await request.put(`${api}/marketing/budget`, { headers, data: { month, amount: '150000' } }), 'plan');
  for (const [platform, amount] of [['INSTAGRAM', '45000'], ['GOOGLE', '18000']] as const)
    await ok(
      await request.post(`${api}/marketing/expenses`, {
        headers,
        data: { date: today, platform, category: 'ADS', amount, currency: 'KZT', countedInBudget: true },
      }),
      'expense',
    );
  return f;
}

test.afterAll(async ({ request }) => {
  await request.post(`${api}/__test/cleanup`);
});

test('салон: продажи, финансы и маркетинг на данных филиала', async ({ page, request }) => {
  await seed(page, request);

  await page.goto('/sales');
  const hub = page.getByTestId('business-sales');
  await expect(hub).toBeVisible();
  // 12 000 + 25 000 + 8 000 + 25 000 + 25 000 = 95 000 ₸ выполненных записей
  await expect(page.getByTestId('sales-kpi-revenue')).toContainText('95');
  await expect(page.getByTestId('sales-kpi-sold')).toContainText('5');
  await expect(page.getByTestId('sales-kpi-lost')).toContainText('2');
  await expect(page.getByTestId('sales-card-top')).toContainText('Окрашивание');
  await expect(page.getByTestId('sales-card-team')).toContainText('Дина Абенова');
  await expect(hub).not.toContainText('Нет данных рынка');
  await page.screenshot({ path: `${shots}/beauty-sales.png`, fullPage: true });

  await page.goto('/sales?days=30');
  await expect(page.getByTestId('sales-period').getByRole('link', { name: '30 дней' })).toHaveAttribute('aria-current', 'page');

  await page.goto('/finance');
  await expect(page.getByTestId('beauty-finance')).toBeVisible();
  await expect(page.getByTestId('beauty-revenue')).toContainText('95');
  await expect(page.getByTestId('beauty-lost')).toContainText('20 000');
  await page.screenshot({ path: `${shots}/beauty-finance.png`, fullPage: true });

  await page.goto('/marketing');
  const marketing = page.getByTestId('business-marketing');
  await expect(marketing).toBeVisible();
  await expect(page.getByTestId('marketing-budget-status')).toHaveText('Доступно');
  // SITE-1: «Сайт и SEO» открыт всем направлениям
  // аудит 21.10.2026 P0-4: без лицензии конструктора карточка пишет «Подключает WETOP» (правило `siteBadge`).
  // В этом стенде модуль сайта не подключён (`GET /marketing/site` отвечает 404): состояние лицензии неизвестно,
  // и карточка по правилу остаётся с прежним «Доступно»
  await expect(page.getByTestId('marketing-site-status')).toHaveText('Доступно');
  await expect(marketing).toContainText('сайт салона');
  await expect(page.getByTestId('marketing-result-spent')).toContainText('63 000');
  await expect(page.getByTestId('marketing-plan')).toContainText('150 000');
  await expect(marketing).not.toContainText('гостиниц');
  await page.screenshot({ path: `${shots}/beauty-marketing.png`, fullPage: true });

  await page.goto('/marketing/budget');
  await expect(page.locator('main')).toContainText('63 000');
  await page.screenshot({ path: `${shots}/beauty-budget.png`, fullPage: true });

  await page.goto('/marketing/content');
  await expect(page.getByTestId('marketing-content-formats')).toContainText('Фото работы мастера');
  await expect(page.locator('main')).not.toContainText('номер');
  await page.screenshot({ path: `${shots}/beauty-content.png`, fullPage: true });

  // гостиничный рынок салон не видит: уводит на его «Сегодня»
  await page.goto('/market');
  await expect(page).toHaveURL(/\/today/);
  // SITE-1: «Сайт и SEO» салону открыт, на «Сегодня» не уводит (шаблоны салона проверяет `tests/ui/site-start.spec.ts`)
  await page.goto('/marketing/site/editor');
  await expect(page).toHaveURL(/\/marketing\/site\/editor/);
});
