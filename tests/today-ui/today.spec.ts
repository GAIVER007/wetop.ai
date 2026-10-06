import { expect, test, type Page, type APIRequestContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const api = 'http://127.0.0.1:55854';
type Fixture = {
  business: string;
  otherBusiness: string;
  beauty: string;
  hotel: string;
  locations: string[];
};
async function setup(page: Page, request: APIRequestContext, options = {}) {
  const r = await request.post(`${api}/__test/reset`);
  expect(r.ok()).toBe(true);
  const f: Fixture = await r.json();
  const seed = await request.post(`${api}/__test/seed`, { data: options });
  expect(seed.ok(), await seed.text()).toBe(true);
  await scope(page, f.business, f.locations[0]!);
  return f;
}
async function scope(page: Page, business: string, location: string) {
  await page.context().addCookies([
    {
      name: 'wetop_scope',
      value: encodeURIComponent(`business=${business};location=${location}`),
      domain: '127.0.0.1',
      path: '/',
    },
  ]);
}
async function choose(page: Page, name: string) {
  await page.getByRole('button', { name: 'Выбрать филиал', exact: true }).click();
  await page
    .getByRole('region', { name: 'Выбор филиала' })
    .getByRole('button')
    .filter({ hasText: name })
    .click();
}
test('real vertical Today: statuses, overnight, scope switching and foreign API isolation', async ({
  page,
  request,
}) => {
  const f = await setup(page, request);
  await page.goto('/today');
  await expect(page.getByTestId('food-today')).toBeVisible();
  for (const [label, n] of [
    ['Запланировано', 3],
    ['За столом', 1],
    ['Завершено', 1],
    ['Свободных столов', 1],
  ] as const)
    await expect(page.getByTestId(`today-${label}`)).toHaveText(String(n));
  await expect(page.getByText('Без стола: 1', { exact: true })).toBeVisible();
  await expect(page.getByText('До 01:30', { exact: true })).toBeVisible();
  const calls: string[] = await (await request.get(`${api}/__test/calls`)).json();
  expect(
    calls.filter((c) =>
      /^\/(beauty|desk|finance|chessboard|hotel|inventory|reservations|guests|rates|channels|bar)(?:\/|\?|\||$)/.test(
        c,
      ),
    ),
  ).toEqual([]);
  expect(calls.filter((c) => c.startsWith('/food-service/areas'))).toHaveLength(1);
  expect(calls.filter((c) => c.startsWith('/food-service/tables'))).toHaveLength(1);
  expect(calls.filter((c) => c.startsWith('/food-service/reservations'))).toHaveLength(2);
  expect(calls.some((c) => c.includes('date=2026-10-04'))).toBe(true);
  expect(calls.some((c) => c.includes('date=2026-10-05'))).toBe(true);
  await request.post(`${api}/__test/control`, { data: { delayReads: true } });
  await choose(page, 'Тестовый филиал Парк');
  await expect(page.getByTestId('food-today')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Выбрать филиал', exact: true })).toBeDisabled();
  await expect(page.getByTestId('food-today')).toContainText('Клиент Тестовый филиал Парк');
  await expect(page.getByTestId('food-today')).not.toContainText('Клиент Тестовый филиал Центр');
  await choose(page, 'Другой тестовый бизнес');
  await expect(page.getByTestId('food-today')).toContainText('Клиент Другой тестовый бизнес');
  await request.post(`${api}/__test/control`, { data: {} });
  await request.post(`${api}/__test/clear-calls`);
  await choose(page, 'Тестовый салон');
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByTestId('beauty-today')).toBeVisible();
  for (const [label, n] of [
    ['Запланировано', 3],
    ['Подтверждено', 1],
    ['Завершено', 1],
    ['Мастеров сегодня', 1],
  ] as const)
    await expect(page.getByTestId(`today-${label}`)).toHaveText(String(n));
  await expect(page.getByTestId('beauty-today')).toContainText('Тестовый маникюр');
  const beautyCalls: string[] = await (await request.get(`${api}/__test/calls`)).json();
  expect(beautyCalls.filter((c) => c.startsWith('/beauty/appointments'))).toHaveLength(1);
  expect(beautyCalls.filter((c) => /^\/beauty\/(customers|employees|services)/.test(c))).toEqual(
    [],
  );
  expect(
    beautyCalls.filter((c) =>
      /^\/(food-service|desk|finance|chessboard|hotel|inventory|reservations|guests|rates|channels|bar)(?:\/|\?|\||$)/.test(
        c,
      ),
    ),
  ).toEqual([]);
  await page.reload();
  await expect(page.getByTestId('beauty-today')).toBeVisible();
  await page.goto('/');
  await expect(page).toHaveURL(/\/today$/);
  await page.getByRole('link', { name: 'WETOP, Главная', exact: true }).click();
  await expect(page).toHaveURL(/\/today$/);
  await page.goto('/floor-plan');
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByTestId('beauty-today')).toBeVisible();
  await page.getByRole('button', { name: 'Выбрать филиал', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('region', { name: 'Выбор филиала' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Выбрать филиал', exact: true })).toBeFocused();
  await choose(page, 'Тестовый отель');
  await expect(page.getByTestId('owner-dashboard')).toBeVisible();
  expect(
    decodeURIComponent(
      (await page.context().cookies()).find((c) => c.name === 'wetop_scope')!.value,
    ),
  ).toBe(`business=${f.hotel};location=${f.locations[4]}`);
});
test('pagination and mandatory-source failure', async ({ page, request }) => {
  await setup(page, request, { pagination: true });
  await page.goto('/today');
  await expect(page.getByTestId('today-Запланировано')).toHaveText('104');
  await expect(page.getByText('Без стола: 102', { exact: true })).toBeVisible();
  await request.post(`${api}/__test/control`, { data: { unavailable: true } });
  await page.reload();
  await expect(page.getByTestId('food-today-error')).toBeVisible();
  await expect(page.getByTestId('food-today')).toHaveCount(0);
});
test('empty, STAFF, READ_ONLY and failed verified scope', async ({ page, request }) => {
  const f = await setup(page, request, { empty: true });
  await request.post(`${api}/__test/control`, { data: { role: 'STAFF', readOnly: true } });
  await page.goto('/today');
  await expect(page.getByTestId('food-today')).toBeVisible();
  await expect(page.getByTestId('today-Запланировано')).toHaveText('0');
  await expect(page.getByText('Режим только для чтения', { exact: true })).toBeVisible();
  await expect(page.getByText('Всё спокойно на сегодня', { exact: true })).toBeVisible();
  await scope(page, f.beauty, f.locations[3]!);
  await page.goto('/today');
  await expect(page.getByTestId('beauty-today')).toBeVisible();
  await expect(page.getByTestId('today-Запланировано')).toHaveText('0');
  await request.post(`${api}/__test/control`, { data: { unavailable: true } });
  await page.reload();
  await expect(page.getByTestId('beauty-today-error')).toBeVisible();
  await request.post(`${api}/__test/control`, { data: { failAuth: true } });
  await request.post(`${api}/__test/clear-calls`);
  await page.reload();
  await expect(page.getByTestId('today-scope-error')).toBeVisible();
  const calls: string[] = await (await request.get(`${api}/__test/calls`)).json();
  expect(
    calls.filter((c) =>
      /\/food-service|\/^\/(beauty|desk|finance|chessboard|hotel|inventory|reservations|guests|rates|channels|bar)(?:\/|\?|\||$)/.test(
        c,
      ),
    ),
  ).toEqual([]);
});
test('absent Location can recover by branch selection and signed-out Today has no domain reads', async ({
  page,
  request,
}) => {
  await setup(page, request);
  await page.context().clearCookies();
  await request.post(`${api}/__test/clear-calls`);
  await page.goto('/today');
  await expect(page.getByTestId('today-scope-error')).toBeVisible();
  const calls: string[] = await (await request.get(`${api}/__test/calls`)).json();
  expect(calls.filter((c) => /^\/(food-service|beauty|hotel|desk|chessboard)/.test(c))).toEqual([]);
  await choose(page, 'Тестовый филиал Центр');
  await expect(page.getByTestId('food-today')).toBeVisible();
  await request.post(`${api}/__test/control`, { data: { signedOut: true } });
  await request.post(`${api}/__test/clear-calls`);
  await page.reload();
  await expect(page.getByTestId('today-scope-error')).toBeVisible();
  const out: string[] = await (await request.get(`${api}/__test/calls`)).json();
  expect(out.filter((c) => /^\/(food-service|beauty|hotel|desk|chessboard)/.test(c))).toEqual([]);
});
test('12 real API screenshots and accessibility', async ({ page, request }) => {
  const f = await setup(page, request);
  for (const [vertical, business, index, ready] of [
    ['food', f.business, 0, 'food-today'],
    ['beauty', f.beauty, 3, 'beauty-today'],
    ['hospitality', f.hotel, 4, 'owner-dashboard'],
  ] as const) {
    await scope(page, business, f.locations[index]!);
    for (const width of [1440, 390])
      for (const theme of ['light', 'dark'] as const) {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto('/today');
        await expect(page.getByTestId(ready)).toBeVisible();
        if ((await page.locator('html').getAttribute('data-theme')) !== theme)
          await page.getByRole('button', { name: 'Переключить тему', exact: true }).click();
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await page.screenshot({
          path: `reports/mv8-vertical-today-20261006/screenshots/${vertical}-${theme}-${width}.png`,
          fullPage: true,
          animations: 'disabled',
        });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      }
  }
  await request.post(`${api}/__test/cleanup`);
});
