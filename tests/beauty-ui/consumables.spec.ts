import { expect, test, type APIRequestContext } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const api = `http://127.0.0.1:${process.env.BEAUTY_UI_API_PORT || '26814'}`;
const evidence = process.env.ZAPIS_EVIDENCE || 'test-results/zapis-report';

type Fixture = { business: string; locations: string[] };

test.afterEach(async ({ request }) => {
  const cleanup = await request.post(`${api}/__test/cleanup`);
  expect(cleanup.ok(), await cleanup.text()).toBe(true);
});

async function jsonCall(
  request: APIRequestContext,
  headers: Record<string, string>,
  method: 'get' | 'post' | 'put',
  path: string,
  data?: Record<string, unknown>,
) {
  const response = await request[method](`${api}${path}`, { headers, ...(data ? { data } : {}) });
  const text = await response.text();
  expect(response.ok(), `${path}: ${text}`).toBe(true);
  return text ? JSON.parse(text) : null;
}

test('consumable receipt feeds a service techcard and DONE consumes the same stock', async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const reset = await request.post(`${api}/__test/reset`);
  const resetText = await reset.text();
  expect(reset.ok(), resetText).toBe(true);
  const fixture = JSON.parse(resetText) as Fixture;
  const pointer = `business=${fixture.business};location=${fixture.locations[0]}`;
  const headers = { 'x-wetop-scope': pointer };
  await page.context().addCookies([{
    name: 'wetop_scope',
    value: encodeURIComponent(pointer),
    domain: '127.0.0.1',
    path: '/',
  }]);

  {
    await page.goto('/bar/consumables');
    await page.getByRole('button', { name: '+ Расходник', exact: true }).click();
    let drawer = page.getByRole('dialog').filter({
      has: page.getByRole('heading', { name: 'Новый расходник', exact: true }),
    });
    await expect(drawer).toHaveAccessibleName('Новый расходник');
    await drawer.getByLabel('Название', { exact: true }).fill('Тестовый шампунь');
    await expect(drawer).toHaveAccessibleName('Новый расходник');
    await drawer.getByLabel('Единица', { exact: true }).selectOption('мл');
    await drawer.getByLabel('Минимальный остаток', { exact: true }).fill('1');
    await drawer.getByRole('button', { name: 'Создать', exact: true }).click();
    await expect(drawer).toBeHidden();
    await expect(page.getByText('Тестовый шампунь', { exact: true })).toBeVisible();

    const products = await jsonCall(request, headers, 'get', '/food-service/stock/products');
    const product = products.items.find(
      (item: { name: string }) => item.name === 'Тестовый шампунь',
    );
    expect(product).toBeDefined();

    await page.getByRole('button', { name: '+ Приход товара', exact: true }).click();
    drawer = page.getByRole('dialog', { name: 'Приход на склад', exact: true });
    await drawer.getByLabel('Поставщик', { exact: true }).fill('Тестовый поставщик');
    await drawer.getByLabel('Номер накладной', { exact: true }).fill('TEST-RECEIPT-1');
    await drawer.getByLabel('Расходник', { exact: true }).selectOption(product.id);
    await drawer.getByLabel('Количество, мл', { exact: true }).fill('5');
    await drawer.getByLabel('Цена за л, ₸', { exact: true }).fill('100');
    await drawer.getByRole('button', { name: 'Провести приход', exact: true }).click();
    await expect(drawer).toBeHidden();
    await expect(page.getByText('5 мл', { exact: true })).toBeVisible();

    const service = await jsonCall(request, headers, 'post', '/beauty/services', {
      name: 'Тестовый уход с расходником',
      durationMinutes: 60,
      priceMinor: '1200000',
      currency: 'KZT',
    });
    await jsonCall(request, headers, 'put', `/beauty/services/${service.id}/location`, {
      enabled: true,
    });
    const linked = await jsonCall(request, headers, 'put', `/beauty/services/${service.id}/materials`, {
      expectedRevision: 0,
      items: [{ productId: product.id, normQty: '0.5', unit: 'мл' }],
    });
    expect(linked).toMatchObject({
      revision: 1,
      items: [{ productId: product.id, normQty: '0.5', onHand: '5' }],
    });

    const employee = await jsonCall(request, headers, 'post', '/beauty/employees', {
      name: 'Тестовый мастер расходников',
    });
    await jsonCall(request, headers, 'put', `/beauty/employees/${employee.id}/services`, {
      serviceIds: [service.id],
    });
    const schedule = await jsonCall(
      request,
      headers,
      'get',
      `/beauty/schedule?employee=${employee.id}`,
    );
    await jsonCall(request, headers, 'put', `/beauty/employees/${employee.id}/working-hours`, {
      expectedRevision: schedule.weekRevision,
      intervals: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
        weekday,
        timeFrom: '09:00',
        timeTo: '18:00',
      })),
    });

    const visitDate = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const day = await jsonCall(request, headers, 'post', '/beauty/appointments', {
      employeeId: employee.id,
      serviceId: service.id,
      startsAt: `${visitDate}T10:00:00+05:00`,
      firstName: 'Тестовый клиент расходников',
    });
    const appointment = day.appointments.find(
      (item: { serviceId: string }) => item.serviceId === service.id,
    );
    expect(appointment).toBeDefined();
    await jsonCall(request, headers, 'post', `/beauty/appointments/${appointment.id}/status`, {
      status: 'CONFIRMED',
    });
    await jsonCall(request, headers, 'post', `/beauty/appointments/${appointment.id}/status`, {
      status: 'DONE',
    });

    const stock = await jsonCall(request, headers, 'get', '/food-service/stock/products');
    expect(stock.items.find((item: { id: string }) => item.id === product.id)).toMatchObject({
      onHand: '4.5',
    });
    const movements = await jsonCall(request, headers, 'get', '/food-service/stock/movements');
    expect(movements.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ productId: product.id, kind: 'RECEIPT', qty: '5' }),
      expect.objectContaining({
        productId: product.id,
        kind: 'CONSUMPTION',
        qty: '-0.5',
        reason: 'Услуга: Тестовый уход с расходником',
      }),
    ]));

    await page.goto('/services');
    await page.getByRole('button', {
      name: 'Техкарта услуги: Тестовый уход с расходником',
      exact: true,
    }).click();
    const techcard = page.getByRole('dialog', {
      name: 'Техкарта: Тестовый уход с расходником',
      exact: true,
    });
    await expect(techcard).toContainText('Тестовый шампунь');
    await expect(techcard).toContainText('4.5 мл');
    mkdirSync(evidence, { recursive: true });
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({
          path: `${evidence}/consumables-techcard-${width}-${colorScheme}.png`,
          fullPage: true,
        });
      }
    }
  }
});
