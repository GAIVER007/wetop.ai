import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createPrismaClient } from '@pms/database';
import { instantOf } from '../../apps/web/src/app/beauty/time';
const api = `http://127.0.0.1:${process.env.BRANCHES_UI_API_PORT ?? '55864'}`;
const db = createPrismaClient(process.env.DATABASE_URL, 'pms_test');
const setScope = (page: Page, business: string, location: string) =>
  page.context().addCookies([
    {
      name: 'wetop_scope',
      value: encodeURIComponent(`business=${business};location=${location}`),
      domain: '127.0.0.1',
      path: '/',
    },
  ]);
async function seed(request: import('@playwright/test').APIRequestContext) {
  const f = await (await request.post(`${api}/__test/reset`)).json();
  const r = await request.post(`${api}/__test/seed-today`, {
    // Analytics fixtures use one local date in both verticals, independent of wall-clock hour.
    data: { timezone: 'Pacific/Kiritimati', analyticsStable: true },
  });
  expect(r.ok()).toBe(true);
  return { ...f, ...(await r.json()) };
}
test.afterAll(async () => {
  await db.$disconnect();
});
test('MV9 Beauty numbers reconcile with API and independent database aggregates after reload', async ({
  page,
  request,
}) => {
  const f = await seed(request);
  await setScope(page, f.beauty, f.salon);
  const response = await request.get(`${api}/beauty/appointments?date=${f.localDay}`, {
    headers: { 'x-wetop-scope': `business=${f.beauty};location=${f.salon}` },
  });
  expect(response.ok()).toBe(true);
  const day = await response.json();
  const from = new Date(instantOf(`${f.localDay}T00:00`, day.location.timezone));
  const next = new Date(Date.parse(f.localDay) + 86400000).toISOString().slice(0, 10);
  const to = new Date(instantOf(`${next}T00:00`, day.location.timezone));
  const aggregates = await db.appointment.groupBy({
    by: ['status', 'currency'],
    where: { locationId: f.salon, startsAt: { gte: from, lt: to } },
    _sum: { price: true },
    _count: { _all: true },
  });
  await page.goto(`/management/analytics?from=${f.localDay}&to=${f.localDay}`);
  await expect(page.getByTestId('vertical-analytics')).toBeVisible();
  for (const status of ['BOOKED', 'CONFIRMED', 'DONE', 'CANCELLED', 'NO_SHOW']) {
    const count = day.appointments.filter((r: { status: string }) => r.status === status).length;
    expect(
      aggregates.filter((a) => a.status === status).reduce((sum, a) => sum + a._count._all, 0),
    ).toBe(count);
    await expect(page.getByTestId(`period-${status}`)).toHaveText(String(count));
  }
  const apiMoney = day.appointments
    .filter((r: { status: string }) => r.status === 'DONE')
    .reduce((sum: bigint, r: { priceMinor: string }) => sum + BigInt(r.priceMinor), 0n);
  expect(
    aggregates
      .filter((a) => a.status === 'DONE')
      .reduce((sum, a) => sum + (a._sum.price ?? 0n), 0n),
  ).toBe(apiMoney);
  expect(apiMoney).toBe(1200000n);
  await expect(page.getByTestId('revenue-KZT')).toHaveText(/^12\s000,00 KZT$/);
  await page.reload();
  await expect(page.getByTestId('period-DONE')).toHaveText('1');
});
test('MV9 Food pagination, overlap boundaries, mixed Organization groups and unavailable finance', async ({
  page,
  request,
}) => {
  const f = await seed(request);
  await setScope(page, f.business, f.food);
  await page.goto(`/management/analytics?from=${f.localDay}&to=${f.localDay}`);
  const rows: Array<{ status: string; startsAt: string }> = [];
  let cursor: string | null = null;
  let pages = 0;
  do {
    const q = new URLSearchParams({ date: f.localDay, limit: '100' });
    if (cursor) q.set('cursor', cursor);
    const res = await request.get(`${api}/food-service/reservations?${q}`, {
      headers: { 'x-wetop-scope': `business=${f.business};location=${f.food}` },
    });
    expect(res.ok()).toBe(true);
    const data = await res.json();
    rows.push(...data.items);
    cursor = data.nextCursor;
    pages++;
  } while (cursor);
  expect(pages).toBeGreaterThan(1);
  const from = new Date(instantOf(`${f.localDay}T00:00`, f.timezone));
  const next = new Date(Date.parse(f.localDay) + 86400000).toISOString().slice(0, 10);
  const to = new Date(instantOf(`${next}T00:00`, f.timezone));
  const aggregates = await db.restaurantReservation.groupBy({
    by: ['status'],
    where: { locationId: f.food, startsAt: { gte: from, lt: to } },
    _count: { _all: true },
  });
  for (const status of ['BOOKED', 'CONFIRMED', 'SEATED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']) {
    const count = rows.filter(
      (r) =>
        r.status === status &&
        Date.parse(r.startsAt) >= from.getTime() &&
        Date.parse(r.startsAt) < to.getTime(),
    ).length;
    expect(aggregates.find((a) => a.status === status)?._count._all ?? 0).toBe(count);
    await expect(page.getByTestId(`period-${status}`)).toHaveText(String(count));
  }
  await expect(page.getByTestId('period-BOOKED')).toHaveText('53');
  await expect(page.getByTestId('period-CONFIRMED')).toHaveText('52');
  await expect(page.getByTestId('food-finance-unavailable')).toBeVisible();
  await expect(page.locator('[data-testid^="revenue-"]')).toHaveCount(0);
  await page.getByRole('link', { name: 'Все филиалы', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Салоны', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Рестораны', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Гостиницы', exact: true })).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Салоны', exact: true }).getByTestId('revenue-KZT'),
  ).toBeVisible();
  await request.post(`${api}/__test/control`, { data: { unavailable: true } });
  await page.reload();
  await expect(
    page.getByText('Данные филиала недоступны. Обновите страницу.').first(),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Салоны', exact: true }).getByTestId('revenue-KZT'),
  ).toBeVisible();
});
test('MV9 scope switching, read-only and invalid Hospitality tab never show foreign metrics', async ({
  page,
  request,
}) => {
  const f = await seed(request);
  await setScope(page, f.beauty, f.salon);
  await page.goto('/management/analytics');
  await expect(page.getByTestId('revenue-KZT')).toBeVisible();
  const choose = async (name: string) => {
    await page.getByRole('button', { name: 'Выбрать филиал', exact: true }).click();
    await page
      .getByRole('region', { name: 'Выбор филиала' })
      .getByRole('button')
      .filter({ hasText: name })
      .click();
  };
  await choose('Тестовый филиал Центр');
  await expect(page.getByTestId('food-finance-unavailable')).toBeVisible();
  await expect(page.getByTestId('revenue-KZT')).toHaveCount(0);
  await choose('Тестовый салон');
  await expect(page.getByTestId('revenue-KZT')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('revenue-KZT')).toBeVisible();
  await request.post(`${api}/__test/control`, { data: { readOnly: true, role: 'STAFF' } });
  await page.reload();
  await expect(page.locator('.vertical-report:visible')).toHaveCount(1);
  await expect(page.locator('.vertical-report:visible').getByTestId('period-DONE')).toHaveText('1');
  const before = ((await (await request.get(`${api}/__test/calls`)).json()) as string[]).length;
  await page.goto('/management/analytics/units');
  await expect(page).toHaveURL(/\/today$/);
  const calls = ((await (await request.get(`${api}/__test/calls`)).json()) as string[]).slice(
    before,
  );
  expect(
    calls.some(
      (p) => p.startsWith('/dashboard') || p.startsWith('/reports') || p.startsWith('/hotel'),
    ),
  ).toBe(false);
});
for (const width of [1440, 390])
  for (const theme of ['light', 'dark'] as const)
    for (const vertical of ['beauty', 'food'] as const) {
      test(`MV9 ${vertical} ${width} ${theme}: accessibility, keyboard and screenshot`, async ({
        page,
        request,
      }) => {
        const f = await seed(request);
        await setScope(
          page,
          vertical === 'beauty' ? f.beauty : f.business,
          vertical === 'beauty' ? f.salon : f.food,
        );
        await page.setViewportSize({ width, height: 1000 });
        await page.emulateMedia({ colorScheme: theme });
        await page.goto(`/management/analytics?from=${f.localDay}&to=${f.localDay}`);
        await expect(page.getByTestId('vertical-analytics')).toBeVisible();
        const violations = (await new AxeBuilder({ page }).analyze()).violations;
        expect(violations).toEqual([]);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        ).toBe(true);
        const input = page.getByLabel('С даты', { exact: true });
        await input.focus();
        await expect(input).toBeFocused();
        const end = page.getByLabel('По дату', { exact: true });
        for (let i = 0; i < 10 && !(await end.evaluate((el) => el === document.activeElement)); i++)
          await page.keyboard.press('Tab');
        await expect(end).toBeFocused();
        await page.screenshot({
          path: `reports/mv9-analytics-finance-2026-10-07/screenshots/${vertical}-${width}-${theme}.png`,
          fullPage: true,
        });
      });
    }
