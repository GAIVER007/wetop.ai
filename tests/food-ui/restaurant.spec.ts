import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Ресторанный модуль по ТЗ владельца (ADR-159, DATA_MODEL §33): меню и техкарты, заказы, кухня (KDS),
 * главная, план зала с заказами и уборкой, сотрудники и зарплата. Настоящие контроллеры и база (pms_test).
 */
const api = 'http://127.0.0.1:55824';
type Fixture = {
  business: string;
  otherBusiness: string;
  beauty: string;
  hotel: string;
  locations: string[];
};
const pointer = (b: string, l: string) => `business=${b};location=${l}`;
async function scope(page: Page, b: string, l: string) {
  await page.context().addCookies([
    {
      name: 'wetop_scope',
      value: encodeURIComponent(pointer(b, l)),
      domain: '127.0.0.1',
      path: '/',
    },
  ]);
}
async function reset(page: Page, request: APIRequestContext) {
  const res = await request.post(`${api}/__test/reset`);
  expect(res.ok()).toBe(true);
  const f: Fixture = await res.json();
  await scope(page, f.business, f.locations[0]!);
  return f;
}
async function post(
  request: APIRequestContext,
  headers: Record<string, string>,
  path: string,
  data: unknown,
) {
  const res = await request.post(`${api}${path}`, { headers, data });
  expect(res.ok(), `${path}: ${res.status()}`).toBe(true);
  return res.json();
}
/** Зал, стол, меню из двух блюд и официант — основание всех сценариев */
async function seed(page: Page, request: APIRequestContext) {
  const f = await reset(page, request);
  const headers = { 'x-wetop-scope': pointer(f.business, f.locations[0]!) };
  const area = await post(request, headers, '/food-service/areas', {
    name: 'Основной зал',
    sortOrder: 0,
    active: true,
  });
  const table = await post(request, headers, '/food-service/tables', {
    areaId: area.id,
    name: '7',
    capacity: 4,
    sortOrder: 0,
    active: true,
  });
  const category = await post(request, headers, '/food-service/menu/categories', {
    name: 'Паста',
  });
  const pasta = await post(request, headers, '/food-service/menu/items', {
    categoryId: category.id,
    name: 'Паста Карбонара',
    price: 39000,
    weightGrams: 320,
  });
  const steak = await post(request, headers, '/food-service/menu/items', {
    categoryId: category.id,
    name: 'Стейк рибай',
    price: 149000,
  });
  const waiter = await post(request, headers, '/food-service/employees', {
    name: 'Иванова Анна',
    phone: '+7 700 000-00-01',
  });
  return { f, headers, area, table, category, pasta, steak, waiter };
}

test('меню: категория и блюдо с экрана, переключатель «в меню», техкарта считает деньги', async ({
  page,
  request,
}) => {
  await seed(page, request);
  await page.goto('/menu');
  await expect(page.getByRole('heading', { name: 'Меню', exact: true })).toBeVisible();
  // категория и блюдо через экран
  await page.getByRole('button', { name: '+ Категория' }).click();
  await page.getByLabel('Название категории').fill('Десерты');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Десерты' })).toBeVisible();
  await page.getByRole('button', { name: '+ Добавить блюдо' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Название').fill('Тирамису');
  await dialog.getByLabel('Категория').selectOption({ label: 'Десерты' });
  await dialog.getByLabel('Цена, ₸').fill('2500');
  await dialog.getByRole('button', { name: 'Сохранить' }).click();
  await expect(dialog).not.toBeVisible();
  const row = page.locator('.rest-menu-row', { hasText: 'Тирамису' });
  await expect(row).toContainText('2 500 ₸');
  // переключатель «в меню»
  await row.getByRole('switch').click();
  await expect(row.getByText('Скрыто из меню')).toBeVisible();
  // техкарта: числа макета 390 / 110 → food cost 28 %, наценка 255 %
  const pastaRow = page.locator('.rest-menu-row', { hasText: 'Паста Карбонара' });
  await pastaRow.getByRole('button', { name: 'Техкарта' }).click();
  await dialog.getByRole('button', { name: '+ Ингредиент' }).click();
  await dialog.getByLabel('Ингредиент 1').fill('Спагетти');
  await dialog.getByLabel('Норма').fill('100');
  await dialog.getByLabel('Цена за единицу').fill('1000');
  await dialog.getByRole('button', { name: '+ Ингредиент' }).click();
  await dialog.getByLabel('Ингредиент 2').fill('Яйцо');
  await dialog.getByLabel('Норма').nth(1).fill('1');
  await dialog.getByLabel('Единица').nth(1).selectOption('шт');
  await dialog.getByLabel('Цена за единицу').nth(1).fill('10');
  const totals = dialog.getByTestId('tech-totals');
  await expect(totals).toContainText('Food cost');
  await expect(totals).toContainText('28 %');
  await expect(totals).toContainText('255 %');
  await dialog.getByLabel('Технология приготовления').fill('Варить 9 минут, смешать.');
  await dialog.getByRole('button', { name: 'Сохранить техкарту' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(pastaRow).toContainText('food cost 28 %');
  const axe = await new AxeBuilder({ page }).include('main').analyze();
  expect(axe.violations).toEqual([]);
});

test('заказы: создание с экрана, статусы до «Оплачен», вкладки считают', async ({
  page,
  request,
}) => {
  const { waiter } = await seed(page, request);
  await page.goto('/orders');
  await page.getByRole('button', { name: '+ Новый заказ' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Стол').selectOption({ index: 1 });
  await dialog.getByLabel('Официант').selectOption({ label: waiter.name });
  await dialog.getByLabel('Блюдо').selectOption({ label: 'Паста Карбонара, 390 ₸' });
  await dialog.getByRole('button', { name: 'Добавить в заказ' }).click();
  await dialog.getByRole('button', { name: 'Больше' }).click();
  await expect(dialog.getByTestId('order-draft-total')).toContainText('780 ₸');
  await dialog.getByRole('button', { name: 'Создать заказ' }).click();
  // заказ в панели: статусная цепочка
  await expect(dialog.getByTestId('order-total')).toContainText('780 ₸');
  for (const action of ['Принять в работу', 'Готово', 'Подать', 'Оплачен, закрыть']) {
    await dialog.getByRole('button', { name: action, exact: false }).click();
  }
  await expect(dialog.getByText('Оплачен', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  // вкладки: закрытый заказ в «Закрыты», счётчики совпадают
  await expect(page.getByRole('button', { name: 'Закрыты' })).toContainText('1');
  await page.getByRole('button', { name: 'Закрыты' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody tr').first()).toContainText('Оплачен');
  const axe = await new AxeBuilder({ page }).include('main').analyze();
  expect(axe.violations).toEqual([]);
});

test('кухня: колонки KDS и переходы кнопками', async ({ page, request }) => {
  const { headers, table, pasta } = await seed(page, request);
  await post(request, headers, '/food-service/orders', {
    tableId: table.id,
    guestCount: 2,
    items: [{ menuItemId: pasta.id, qty: 1 }],
  });
  await page.goto('/kitchen');
  const newCol = page.getByRole('region', { name: 'Новые' });
  await expect(newCol.getByText('Паста Карбонара ×1')).toBeVisible();
  await newCol.getByRole('button', { name: 'Принять' }).click();
  const cooking = page.getByRole('region', { name: 'В работе' });
  await expect(cooking.getByText('Паста Карбонара ×1')).toBeVisible();
  await cooking.getByRole('button', { name: 'Готово' }).click();
  const ready = page.getByRole('region', { name: 'Готово' });
  await ready.getByRole('button', { name: 'Подать' }).click();
  await expect(newCol.getByText('Пусто')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Задерживаются' })).toContainText('Кухня успевает');
  const axe = await new AxeBuilder({ page }).include('main').analyze();
  expect(axe.violations).toEqual([]);
});

test('главная: плитки, последние заказы и выручка после закрытия', async ({ page, request }) => {
  const { headers, table, pasta } = await seed(page, request);
  const order = await post(request, headers, '/food-service/orders', {
    tableId: table.id,
    guestCount: 2,
    items: [{ menuItemId: pasta.id, qty: 2 }],
  });
  let current = order;
  for (const status of ['COOKING', 'READY', 'SERVED', 'CLOSED']) {
    current = await post(request, headers, `/food-service/orders/${order.id}/status`, {
      expectedStatus: current.status,
      expectedUpdatedAt: current.updatedAt,
      status,
    });
  }
  await page.goto('/today');
  await expect(page.getByRole('heading', { name: 'Главная' })).toBeVisible();
  await expect(page.getByTestId('today-orders')).toContainText('1');
  await expect(page.getByTestId('today-revenue')).toContainText('780 ₸');
  await expect(page.getByTestId('today-tables')).toContainText('0 / 1');
  await expect(page.getByTestId('today-latest-orders')).toContainText('Стол 7');
  await expect(page.getByTestId('today-revenue-chart')).toBeVisible();
  const axe = await new AxeBuilder({ page }).include('main').analyze();
  expect(axe.violations).toEqual([]);
});

test('план зала: заказ занимает стол, уборка включается и видна легенда', async ({
  page,
  request,
}) => {
  const { headers, table, pasta } = await seed(page, request);
  await post(request, headers, '/food-service/orders', {
    tableId: table.id,
    guestCount: 2,
    items: [{ menuItemId: pasta.id, qty: 1 }],
  });
  await page.goto('/floor-plan');
  const card = page.locator('.food-table-card');
  await expect(card).toHaveAttribute('data-kind', 'OCCUPIED');
  await expect(card).toContainText('Заказ №');
  // второй стол: уборка
  await post(request, headers, '/food-service/tables', {
    areaId: (await (await request.get(`${api}/food-service/areas?limit=100`, { headers })).json())
      .items[0].id,
    name: '8',
    capacity: 2,
    sortOrder: 1,
    active: true,
  });
  await page.reload();
  const free = page.locator('.food-table-card[data-kind="FREE"]');
  await free.getByRole('button', { name: 'Уборка' }).click();
  await expect(page.locator('.food-table-card[data-kind="CLEANING"]')).toBeVisible();
  await expect(page.locator('.food-summary')).toContainText('Уборка');
});

test('сотрудники: список с продажами, добавление и правка', async ({ page, request }) => {
  const { headers, table, pasta, waiter } = await seed(page, request);
  await post(request, headers, '/food-service/orders', {
    tableId: table.id,
    waiterId: waiter.id,
    guestCount: 2,
    items: [{ menuItemId: pasta.id, qty: 1 }],
  });
  await page.goto('/employees');
  const row = page.locator('tbody tr', { hasText: 'Иванова Анна' });
  await expect(row).toContainText('390 ₸');
  await expect(row).toContainText('Не на смене');
  await page.getByRole('button', { name: '+ Добавить сотрудника' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Имя и фамилия').fill('Петров Максим');
  await dialog.getByRole('button', { name: 'Сохранить' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('tbody tr', { hasText: 'Петров Максим' })).toBeVisible();
  const axe = await new AxeBuilder({ page }).include('main').analyze();
  expect(axe.violations).toEqual([]);
});

test('зарплата: оклад + процент, премия и штраф, плитки месяца', async ({ page, request }) => {
  const { headers, table, pasta, waiter } = await seed(page, request);
  const order = await post(request, headers, '/food-service/orders', {
    tableId: table.id,
    waiterId: waiter.id,
    guestCount: 2,
    items: [{ menuItemId: pasta.id, qty: 10 }],
  });
  let current = order;
  for (const status of ['COOKING', 'READY', 'SERVED', 'CLOSED']) {
    current = await post(request, headers, `/food-service/orders/${order.id}/status`, {
      expectedStatus: current.status,
      expectedUpdatedAt: current.updatedAt,
      status,
    });
  }
  await page.goto('/payroll');
  const row = page.locator('tbody tr', { hasText: 'Иванова Анна' });
  await row.getByRole('button', { name: 'Оплата' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Модель оплаты').selectOption('FIXED_PLUS_PERCENT');
  await dialog.getByLabel('Оклад за месяц, ₸').fill('40000');
  await dialog.getByRole('spinbutton', { name: 'Процент от заказов' }).fill('5');
  await dialog.getByRole('button', { name: 'Сохранить' }).click();
  await expect(dialog).not.toBeVisible();
  // продажи 3 900, 5 % = 195; оклад 40 000 → к выплате 40 195
  await expect(row).toContainText('40 195 ₸');
  await row.getByRole('button', { name: 'Начислить' }).click();
  await dialog.getByLabel('Сумма, ₸').fill('5000');
  await dialog.getByLabel('Причина').fill('Отличная смена');
  await dialog.getByRole('button', { name: 'Начислить' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByTestId('payroll-bonus')).toContainText('5 000 ₸');
  await expect(page.getByTestId('payroll-total')).toContainText('45 195 ₸');
  // штраф
  await row.getByRole('button', { name: 'Начислить' }).click();
  await dialog.getByRole('button', { name: 'Штраф' }).click();
  await dialog.getByLabel('Сумма, ₸').fill('2000');
  await dialog.getByLabel('Причина').fill('Опоздание');
  await dialog.getByRole('button', { name: 'Начислить' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByTestId('payroll-penalty')).toContainText('2 000 ₸');
  await expect(page.getByTestId('payroll-total')).toContainText('43 195 ₸');
  // вкладка «Начисления» показывает журнал
  await page.getByRole('tab', { name: 'Начисления' }).click();
  await expect(page.getByRole('tabpanel')).toContainText('Отличная смена');
  await expect(page.getByRole('tabpanel')).toContainText('Опоздание');
  const axe = await new AxeBuilder({ page }).include('main').analyze();
  expect(axe.violations).toEqual([]);
});

test('клиенты: вкладки и «Постоянный гость» от двух визитов', async ({ page, request }) => {
  const { headers, table } = await seed(page, request);
  // период обслуживания и две завершённые посадки одного клиента
  const period = await post(request, headers, '/food-service/service-periods', {
    name: 'Весь день',
    weekday: new Date().getUTCDay(),
    timeFrom: '00:00',
    timeTo: '23:59',
    endsNextDay: false,
    defaultDurationMinutes: 60,
    active: true,
  });
  const first = await request.post(`${api}/food-service/reservations`, {
    headers: { ...headers, 'idempotency-key': 'rest-cust-1' },
    data: {
      servicePeriodId: period.id,
      startsAt: new Date().toISOString().slice(0, 19) + 'Z',
      partySize: 2,
      customer: { firstName: 'Сергей', lastName: 'Иванов', phone: '+7 700 123-45-67' },
      tableId: table.id,
      source: 'WALK_IN',
    },
  });
  expect(first.ok()).toBe(true);
  const r1 = await first.json();
  await post(request, headers, `/food-service/reservations/${r1.id}/status`, {
    expectedStatus: r1.status,
    expectedUpdatedAt: r1.updatedAt,
    status: 'COMPLETED',
  });
  const second = await request.post(`${api}/food-service/reservations`, {
    headers: { ...headers, 'idempotency-key': 'rest-cust-2' },
    data: {
      servicePeriodId: period.id,
      startsAt: new Date().toISOString().slice(0, 19) + 'Z',
      partySize: 3,
      customerId: r1.customerId,
      tableId: table.id,
      source: 'WALK_IN',
    },
  });
  expect(second.ok()).toBe(true);
  await page.goto('/customers');
  await expect(page.getByRole('tab', { name: /Все/ })).toBeVisible();
  // скрытые панели вкладок остаются в DOM: ищем строку только в видимой панели
  const row = page.getByRole('tabpanel').locator('tbody tr', { hasText: 'Сергей Иванов' });
  await expect(row).toContainText('Постоянный гость');
  await page.getByRole('tab', { name: /Бронирования/ }).click();
  await expect(page.getByRole('tabpanel')).toContainText('Сергей Иванов');
  await page.getByRole('tab', { name: /Постоянные гости/ }).click();
  await expect(page.getByRole('tabpanel')).toContainText('Сергей Иванов');
});

test('навигация ресторана: пункты макета на месте и ведут на экраны', async ({
  page,
  request,
}) => {
  await seed(page, request);
  await page.goto('/today');
  // левая навигация (ADR-161): пункты закрытой панели лежат в разметке скрытыми
  const hrefs = await page
    .locator('.sidenav a')
    .evaluateAll((items) => items.map((item) => item.getAttribute('href')));
  for (const path of ['/orders', '/kitchen', '/menu', '/customers', '/employees', '/payroll'])
    expect(hrefs, path).toContain(path);
});
