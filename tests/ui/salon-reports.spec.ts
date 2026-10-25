import { test, expect, FIXTURE_API } from './fixtures';
import type { APIRequestContext, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const api = FIXTURE_API;
test.use({ extraHTTPHeaders: { 'x-wetop-test-client': '1' } });
const location = '44444444-4444-4444-8444-444444444444';
const business = '55555555-5555-4555-8555-555555555555';
const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' }).format(new Date());
async function setup(page: Page, request: APIRequestContext) {
  expect((await request.post(`${api}/__test/reset`)).ok()).toBeTruthy();
  await request.post(`${api}/__test/control`, { data: { role: 'OWNER' } });
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
  expect(
    (
      await request.post(`${api}/branches`, {
        data: {
          id: location,
          name: 'Салон Пример',
          newBusinessId: business,
          businessName: 'Салон Пример',
          vertical: 'BEAUTY',
        },
      })
    ).ok(),
  ).toBeTruthy();
  await page
    .context()
    .addCookies([
      {
        name: 'wetop_scope',
        value: encodeURIComponent(`business=${business};location=${location}`),
        domain: '127.0.0.1',
        path: '/',
      },
    ]);
  const headers = { 'x-wetop-scope': `business=${business};location=${location}` };
  const serviceResponse = await request.post(`${api}/beauty/services`, {
    headers,
    data: { name: 'Услуга отчёта', durationMinutes: 30, priceMinor: '1200000', currency: 'KZT' },
  });
  expect(serviceResponse.ok()).toBeTruthy();
  const service = await serviceResponse.json();
  expect(
    (
      await request.put(`${api}/beauty/services/${service.id}/location`, {
        headers,
        data: { enabled: true },
      })
    ).ok(),
  ).toBeTruthy();
  const employee = await (
    await request.post(`${api}/beauty/employees`, { headers, data: { name: 'Мастер Пример' } })
  ).json();
  expect(
    (
      await request.put(`${api}/beauty/employees/${employee.id}/services`, {
        headers,
        data: { serviceIds: [service.id] },
      })
    ).ok(),
  ).toBeTruthy();
  expect(
    (
      await request.put(`${api}/beauty/employees/${employee.id}/working-hours`, {
        headers,
        data: {
          intervals: [
            {
              weekday: new Date(`${date}T00:00:00Z`).getUTCDay(),
              timeFrom: '00:00',
              timeTo: '23:55',
            },
          ],
        },
      })
    ).ok(),
  ).toBeTruthy();
  const booking = await request.post(`${api}/beauty/appointments`, {
    headers,
    data: {
      employeeId: employee.id,
      serviceId: service.id,
      startsAt: `${date}T04:00:00Z`,
      firstName: 'Клиент Пример',
      durationMinutes: 30,
    },
  });
  expect(booking.ok(), await booking.text()).toBeTruthy();
  const view = await booking.json();
  const appointment = view.appointments[0];
  expect(
    (
      await request.post(`${api}/beauty/appointments/${appointment.id}/status`, {
        headers,
        data: { status: 'DONE' },
      })
    ).ok(),
  ).toBeTruthy();
}
for (const width of [1440, 390])
  for (const theme of ['light', 'dark'] as const) {
    test(`salon reports ${width} ${theme}: API values, reload, tabs, geometry`, async ({
      page,
      request,
    }, info) => {
      await page.setViewportSize({ width, height: 1000 });
      await setup(page, request);
      await page.goto(`/reports?from=${date}&to=${date}`);
      await page.emulateMedia({ colorScheme: theme });
      const main = page.getByRole('main');
      await expect(main.getByRole('heading', { name: 'Отчёты', exact: true })).toBeVisible();
      await expect(page.getByTestId('salon-report-cost-KZT')).toHaveText('12 000,00 KZT');
      await expect(
        main.getByRole('table', { name: 'Завершённые услуги', exact: true }),
      ).toContainText('Услуга отчёта');
      await main.getByRole('link', { name: 'Специалисты', exact: true }).click();
      await expect(page).toHaveURL(new RegExp('view=team'));
      await expect(main.getByRole('table')).toContainText('Мастер Пример');
      await page.reload();
      await page.emulateMedia({ colorScheme: theme });
      await expect(main.getByRole('table')).toContainText('Мастер Пример');
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBeTruthy();
      expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
      await page.screenshot({
        path: info.outputPath(`salon-reports-${width}-${theme}.png`),
        fullPage: true,
      });
    });
  }

test('salon reports overview fits one laptop screen and presets switch the period', async ({
  page,
  request,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await setup(page, request);
  await page.goto(`/reports?from=${date}&to=${date}`);
  const main = page.getByRole('main');
  await expect(page.getByTestId('salon-report-cost-KZT')).toBeVisible();
  await page.screenshot({ path: info.outputPath('salon-reports-one-screen.png') });
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(900);
  await main.getByRole('link', { name: '7 дней', exact: true }).click();
  await expect(page).toHaveURL(/from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}&view=overview/);
  await expect(page.getByTestId('salon-report-cost-KZT')).toHaveText('12 000,00 KZT');
});

// Пульт владельца (вариант A, решение владельца 25.10.2026) заменил правило «аналитика на один экран»: главные цифры
// и подсказки в первом экране ноутбука, разборы по мастерам, услугам и оплатам ниже прокруткой.
test('salon analytics owner dashboard: four key figures and what-to-do in the first laptop screen', async ({
  page,
  request,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await setup(page, request);
  await page.goto(`/management/analytics?from=${date}&to=${date}`);
  const main = page.getByRole('main');
  await expect(main.getByTestId('vertical-analytics')).toBeVisible();
  await expect(main.getByTestId('period-DONE')).toHaveText('1');
  await expect(main.getByTestId('revenue-KZT')).toHaveText('12 000,00 KZT');
  for (const id of ['revenue', 'average', 'load', 'repeat'])
    await expect(main.getByTestId(`pa-kpi-${id}`)).toBeInViewport();
  await expect(main.getByTestId('pult-insights')).toBeInViewport();
  await page.screenshot({ path: info.outputPath('salon-analytics-pult.png'), fullPage: true });
  await main.getByRole('link', { name: 'Вчера', exact: true }).click();
  await expect(page).toHaveURL(/from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}/);
  await main.getByRole('link', { name: 'Все филиалы', exact: true }).click();
  await expect(page).toHaveURL(/scope=organization/);
});
