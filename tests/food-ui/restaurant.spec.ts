import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Ресторанный модуль по ТЗ владельца (ADR-159, DATA_MODEL §33): меню и техкарты, заказы, кухня (KDS),
 * главная, план зала с заказами и уборкой, сотрудники и зарплата. Настоящие контроллеры и база (pms_test).
 */
const api = `http://127.0.0.1:${process.env.FOOD_UI_API_PORT ?? '55824'}`;
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
/** Довести заказ до «Подан» и оплатить целиком: полная оплата закрывает его (§35.1) */
async function serveAndPay(
  request: APIRequestContext,
  headers: Record<string, string>,
  order: { id: string; status: string; updatedAt: string; totalMinor: string },
) {
  let current = order;
  for (const status of ['COOKING', 'READY', 'SERVED'])
    current = await post(request, headers, `/food-service/orders/${order.id}/status`, {
      expectedStatus: current.status,
      expectedUpdatedAt: current.updatedAt,
      status,
    });
  return post(request, headers, `/food-service/orders/${order.id}/payments`, {
    method: 'CASH',
    amount: Number(order.totalMinor),
    idempotencyKey: `pay-${order.id}`,
  });
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
  // таблица меню (экран 8): food cost своей колонкой
  await expect(pastaRow.getByRole('cell').nth(3)).toHaveText('28 %');
  const axe = await new AxeBuilder({ page }).include('main').analyze();
  expect(axe.violations).toEqual([]);
});

test('фото блюда: загрузка в карточке блюда, превью в меню, замена и удаление', async ({
  page,
  request,
}) => {
  await seed(page, request);
  // картинка 64×48 PNG собирается в браузере: свой файл, без стоков (§19.9)
  await page.goto('/menu');
  const png = await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 48;
    const g = c.getContext('2d')!;
    g.fillStyle = '#c0392b';
    g.fillRect(0, 0, 64, 48);
    const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), 'image/png'));
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  const file = { name: 'pasta.png', mimeType: 'image/png', buffer: Buffer.from(png) };
  const row = page.getByTestId('menu-list').locator('.rest-menu-row', { hasText: 'Паста Карбонара' });
  await expect(row.locator('.rest-menu-thumb img')).toHaveCount(0);
  await row.getByRole('button', { name: 'Изменить', exact: true }).click();
  const photo = page.getByTestId('dish-photo');
  await photo.getByLabel('Файл фото блюда').setInputFiles(file);
  await photo.getByRole('button', { name: 'Загрузить фото' }).click();
  await expect(photo.locator('img')).toHaveAttribute('src', /menu-photos\/.+\.webp\?X-Expires=/);
  await page.keyboard.press('Escape');
  await expect(row.locator('.rest-menu-thumb img')).toHaveAttribute('src', /menu-photos\//);
  // не картинка отклоняется словами, фото остаётся
  await row.getByRole('button', { name: 'Изменить', exact: true }).click();
  await photo.getByLabel('Файл фото блюда').setInputFiles({ name: 'x.png', mimeType: 'image/png', buffer: Buffer.from('not an image') });
  await photo.getByRole('button', { name: 'Заменить фото' }).click();
  await expect(photo.getByRole('alert')).toBeVisible();
  await expect(photo.locator('img')).toHaveCount(1);
  await photo.getByRole('button', { name: 'Убрать фото' }).click();
  await expect(photo.locator('img')).toHaveCount(0);
  const axe = await new AxeBuilder({ page }).include('[data-testid="dish-drawer"]').analyze();
  expect(axe.violations).toEqual([]);
});

test('заказы: создание с экрана, оплата частями закрывает заказ, вкладки считают', async ({
  page,
  request,
}) => {
  const { waiter } = await seed(page, request);
  await page.goto('/orders');
  await page.getByRole('button', { name: '+ Новый заказ' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Стол').selectOption({ index: 1 });
  await dialog.getByLabel('Официант').selectOption({ label: waiter.name });
  // POS по макету (экран 5): плитка блюда добавляет порцию, вторая порция кнопкой «Больше»
  await dialog.getByRole('button', { name: 'Добавить: Паста Карбонара, 390 ₸' }).click();
  await dialog.getByRole('button', { name: 'Больше' }).click();
  await expect(dialog.getByTestId('order-draft-total')).toContainText('780 ₸');
  await dialog.getByRole('button', { name: 'Отправить на кухню' }).click();
  // заказ в панели: статусная цепочка
  await expect(dialog.getByTestId('order-total')).toContainText('780 ₸');
  for (const action of ['Принять в работу', 'Готово', 'Подать']) {
    await dialog.getByRole('button', { name: action, exact: false }).click();
  }
  // без полной оплаты закрыть нельзя: кнопки «Закрыть заказ» нет
  await expect(dialog.getByRole('button', { name: 'Закрыть заказ' })).toHaveCount(0);
  const payment = dialog.getByTestId('order-payment');
  await expect(payment.getByTestId('order-remaining')).toContainText('780 ₸');
  // часть наличными, остаток Kaspi: вторая оплата закрывает заказ
  await payment.getByLabel('Сумма, ₸').fill('500');
  await payment.getByRole('button', { name: 'Принять оплату' }).click();
  await expect(payment.getByTestId('order-remaining')).toContainText('280 ₸');
  await payment.getByLabel('Способ').selectOption('KASPI');
  await expect(payment.getByLabel('Сумма, ₸')).toHaveValue('280');
  await payment.getByRole('button', { name: 'Принять оплату' }).click();
  await expect(dialog.getByText('Оплачен', { exact: true })).toBeVisible();
  await expect(payment.getByTestId('order-paid')).toContainText('780 ₸');
  await expect(payment.getByRole('button', { name: 'Принять оплату' })).toHaveCount(0);
  // оценка гостя после оплаты (§39): 4 звезды и комментарий, повторно оценить нельзя
  const rating = dialog.getByTestId('order-rating');
  await rating.getByRole('radio', { name: '4 из 5' }).click();
  await rating.getByLabel('Комментарий гостя').fill('Вкусно, но долго');
  await rating.getByRole('button', { name: 'Отправить оценку' }).click();
  await expect(rating.getByLabel('Оценка 4 из 5')).toBeVisible();
  await expect(rating).toContainText('Вкусно, но долго');
  expect((await new AxeBuilder({ page }).include('[data-testid="order-drawer"]').analyze()).violations).toEqual([]);
  await page.keyboard.press('Escape');
  // вкладки: закрытый заказ в «Закрыты», счётчики совпадают
  await expect(page.getByRole('button', { name: 'Закрыты' })).toContainText('1');
  await page.getByRole('button', { name: 'Закрыты' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody tr').first()).toContainText('Оплачен');
  const axe = await new AxeBuilder({ page }).include('main').analyze();
  expect(axe.violations).toEqual([]);
  // рейтинг официанта по оценкам гостей на экране «Сотрудники»
  await page.goto('/employees');
  await expect(
    page.locator('tbody tr', { hasText: waiter.name }).getByTestId('employee-rating'),
  ).toContainText('4 ★, 1 оценка');
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
  // карточка по макету (экран 6): номер и время в шапке, стол, позиция и количество справа
  await expect(newCol.getByRole('listitem')).toHaveText('Паста Карбонара×1');
  await expect(newCol).toContainText('Стол 7');
  await newCol.getByRole('button', { name: 'Принять' }).click();
  const cooking = page.getByRole('region', { name: 'Готовятся' });
  await expect(cooking.getByRole('listitem')).toHaveText('Паста Карбонара×1');
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
  expect((await serveAndPay(request, headers, order)).status).toBe('CLOSED');
  await page.goto('/today');
  // «Главная» по макету ресторана (экран 1): приветствие по времени дня вместо слова «Главная»
  await expect(page.getByRole('heading', { level: 1, name: /^(Доброе|Добрый|Доброй)/ })).toBeVisible();
  await expect(page.getByTestId('today-orders')).toContainText('1');
  await expect(page.getByTestId('today-revenue')).toContainText('780 ₸');
  // заказ оплачен и закрыт: стол снова свободен, плитка показывает свободные столы
  await expect(page.getByTestId('today-tables')).toHaveText('1');
  await expect(page.getByTestId('today-latest-orders')).toContainText('Стол 7');
  await expect(page.getByTestId('today-revenue-chart')).toBeVisible();
  const axe = await new AxeBuilder({ page }).include('main').analyze();
  expect(axe.violations).toEqual([]);
});

test('бронирования: шкала по столам, бронь полосой, щелчок по пустому времени открывает новую бронь на стол', async ({
  page,
  request,
}) => {
  const { headers, table } = await seed(page, request);
  const localDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' }).format(new Date());
  const period = await post(request, headers, '/food-service/service-periods', {
    name: 'Вечер',
    weekday: new Date(`${localDay}T12:00:00Z`).getUTCDay(),
    timeFrom: '12:00',
    timeTo: '23:00',
    endsNextDay: false,
    defaultDurationMinutes: 120,
    active: true,
  });
  const res = await request.post(`${api}/food-service/reservations`, {
    headers: { ...headers, 'idempotency-key': 'rest-timeline-1' },
    data: {
      servicePeriodId: period.id,
      startsAt: `${localDay}T19:00:00+05:00`,
      partySize: 3,
      customer: { firstName: 'Ольга', lastName: 'Волкова', phone: '+7 700 222-33-44' },
      tableId: table.id,
    },
  });
  expect(res.ok()).toBe(true);
  await page.goto(`/table-reservations?date=${localDay}`);
  const timeline = page.getByTestId('reservations-timeline');
  await expect(timeline.getByText('Стол 7')).toBeVisible();
  await expect(timeline.getByText('12:00')).toBeVisible();
  const bar = timeline.getByRole('button', { name: /^Ольга Волкова, 19:00–21:00, 3 гостя/ });
  await expect(bar).toBeVisible();
  // полоса брони стоит на своём часе: левый край у метки 19:00
  const at19 = await timeline.getByText('19:00', { exact: true }).boundingBox();
  const barBox = await bar.boundingBox();
  expect(Math.abs(barBox!.x - at19!.x)).toBeLessThan(6);
  const axe = await new AxeBuilder({ page }).include('main').analyze();
  expect(axe.violations).toEqual([]);
  await bar.click();
  await expect(page.getByRole('dialog')).toContainText('Ольга Волкова');
  await page.keyboard.press('Escape');
  // с клавиатуры клетка стола открывает новую бронь на этот стол во время экрана
  await timeline.getByRole('button', { name: 'Новая бронь: Стол 7' }).focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Новая бронь' })).toBeVisible();
  await expect(dialog.locator('select[name="tableId"]')).toHaveValue(table.id);
  // подбор столов по макету (экран 4): на 19:00 стол 7 занят бронью Ольги, свободных нет
  await dialog.getByLabel('Время', { exact: true }).fill('19:00');
  await expect(dialog.getByRole('heading', { name: 'Доступные столы (0)' })).toBeVisible();
  // на 12:00 стол свободен и выбирается карточкой
  await dialog.getByLabel('Время', { exact: true }).fill('12:00');
  await expect(dialog.getByRole('heading', { name: 'Доступные столы (1)' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Выбрать: Стол 7' })).toHaveAttribute('aria-pressed', 'true');
  // список остаётся вторым видом
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Список', exact: true }).click();
  await expect(page.getByRole('main').locator('tbody')).toContainText('Ольга Волкова');
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
  // план по макету (экран 2): стол залит цветом статуса, номер на столе, заказ подписью под ним
  const card = page.locator('.rest-fp-table');
  await expect(card).toHaveAttribute('data-kind', 'OCCUPIED');
  await expect(card).toContainText('Заказ №');
  // второй стол: уборка из карточки стола
  await post(request, headers, '/food-service/tables', {
    areaId: (await (await request.get(`${api}/food-service/areas?limit=100`, { headers })).json())
      .items[0].id,
    name: '8',
    capacity: 2,
    sortOrder: 1,
    active: true,
  });
  await page.reload();
  await page.locator('.rest-fp-table[data-kind="FREE"]').getByRole('button').click();
  const panel = page.getByTestId('table-panel');
  await panel.getByRole('button', { name: 'Отметить уборку' }).click();
  await expect(page.locator('.rest-fp-table[data-kind="CLEANING"]')).toBeVisible();
  await expect(page.getByLabel('Состояние столов')).toContainText('Уборка 1');
  // Escape закрывает карточку и возвращает фокус на стол
  await page.locator('.rest-fp-table[data-kind="CLEANING"]').getByRole('button').click();
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await expect(page.locator('.rest-fp-table[data-kind="CLEANING"]').getByRole('button')).toBeFocused();
  const axe = await new AxeBuilder({ page }).include('main').analyze();
  expect(axe.violations).toEqual([]);
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
  expect((await serveAndPay(request, headers, order)).status).toBe('CLOSED');
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
  // выплата из кассы (§35.3): в кассе 3 900 за заказ + приход 50 000; сверх остатка нельзя
  await post(request, headers, '/food-service/cash/operations', {
    kind: 'INCOME',
    method: 'CASH',
    amount: 5_000_000,
    note: 'Размен',
  });
  await page.reload();
  const over = await request.post(`${api}/food-service/employees/${waiter.id}/payouts`, {
    headers,
    data: { period: new Date().toISOString().slice(0, 7), method: 'CASH', amount: 4_319_501 },
  });
  expect(over.status()).toBe(409);
  await page.getByRole('tab', { name: 'Сотрудники' }).click();
  await row.getByRole('button', { name: 'Выплатить' }).click();
  await expect(dialog.getByLabel('Сумма, ₸')).toHaveValue('43195');
  await dialog.getByRole('button', { name: 'Выплатить' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByTestId('payroll-paid')).toContainText('43 195 ₸');
  await expect(row.getByTestId('payroll-remaining')).toContainText('0 ₸');
  await expect(row.getByRole('button', { name: 'Выплатить' })).toHaveCount(0);
  const axe = await new AxeBuilder({ page }).include('main').analyze();
  expect(axe.violations).toEqual([]);
});

test('отчёт за период: выручка, средний чек, оплаты по способам, блюда и официанты', async ({
  page,
  request,
}) => {
  const { headers, table, pasta, steak, waiter } = await seed(page, request);
  const order = (items: Array<{ menuItemId: string; qty: number }>) =>
    post(request, headers, '/food-service/orders', { tableId: table.id, waiterId: waiter.id, guestCount: 2, items });
  // 2 × паста = 780 ₸ наличными; паста + стейк = 1 880 ₸ частями: 880 Kaspi и 1 000 наличными
  const a = await order([{ menuItemId: pasta.id, qty: 2 }]);
  expect((await serveAndPay(request, headers, a)).status).toBe('CLOSED');
  let b = await order([{ menuItemId: pasta.id, qty: 1 }, { menuItemId: steak.id, qty: 1 }]);
  for (const status of ['COOKING', 'READY', 'SERVED'])
    b = await post(request, headers, `/food-service/orders/${b.id}/status`, {
      expectedStatus: b.status,
      expectedUpdatedAt: b.updatedAt,
      status,
    });
  await post(request, headers, `/food-service/orders/${b.id}/payments`, { method: 'KASPI', amount: 88_000, idempotencyKey: 'r1' });
  await post(request, headers, `/food-service/orders/${b.id}/payments`, { method: 'CASH', amount: 100_000, idempotencyKey: 'r2' });
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' }).format(new Date());
  const res = await request.get(`${api}/food-service/period-report?from=${day}&to=${day}`, { headers });
  expect(res.ok()).toBe(true);
  const r = await res.json();
  expect(r.ordersCount).toBe(2);
  expect(r.revenueMinor).toBe('266000');
  expect(r.averageCheckMinor).toBe('133000');
  expect(r.payments).toEqual([
    { method: 'CASH', amountMinor: '178000', count: 2 },
    { method: 'KASPI', amountMinor: '88000', count: 1 },
  ]);
  expect(r.topDishes[0]).toEqual({ name: 'Паста Карбонара', qty: 3, revenueMinor: '117000' });
  expect(r.waiters).toEqual([{ name: 'Иванова Анна', orders: 2, revenueMinor: '266000' }]);
  // техкарты не связаны со складом: себестоимость ноль, прибыль равна выручке (§38)
  expect([r.costMinor, r.grossProfitMinor, r.foodCostPct, r.shortages]).toEqual(['0', '266000', 0, []]);
  // выручка по дням и по категориям меню (макет «Аналитика», экран 10)
  expect(r.revenueByDay).toEqual([{ date: day, revenueMinor: '266000', orders: 2 }]);
  expect(r.categories).toEqual([{ name: 'Паста', revenueMinor: '266000' }]);
  const prev = new Date(`${day}T12:00:00Z`);
  prev.setUTCDate(prev.getUTCDate() - 1);
  const yesterday = prev.toISOString().slice(0, 10);
  const two = await (
    await request.get(`${api}/food-service/period-report?from=${yesterday}&to=${day}`, { headers })
  ).json();
  expect(two.revenueByDay).toEqual([
    { date: yesterday, revenueMinor: '0', orders: 0 },
    { date: day, revenueMinor: '266000', orders: 2 },
  ]);
  await page.goto('/management/analytics');
  await expect(page.getByTestId('food-period-days')).toBeVisible();
  await expect(page.getByTestId('food-period-categories')).toContainText('Паста');
  const bad = await request.get(`${api}/food-service/period-report?from=${day}&to=2000-01-01`, { headers });
  expect(bad.status()).toBe(400);
  // оценка гостя (§39): только после оплаты и только одна
  const rate = (id: string, stars: number) =>
    request.post(`${api}/food-service/orders/${id}/rating`, { headers, data: { stars } });
  expect((await rate(a.id, 5)).ok()).toBe(true);
  expect((await rate(a.id, 1)).status()).toBe(409);
  const fresh = await order([{ menuItemId: pasta.id, qty: 1 }]);
  expect((await rate(fresh.id, 5)).status()).toBe(409);
  expect((await rate(a.id, 6)).status()).toBe(400);
});

test('касса: остатки по способам, расход не уводит в минус, перевод, сверка и аннулирование', async ({
  page,
  request,
}) => {
  const { headers, table, pasta } = await seed(page, request);
  const order = await post(request, headers, '/food-service/orders', {
    tableId: table.id,
    guestCount: 2,
    items: [{ menuItemId: pasta.id, qty: 2 }],
  });
  // правила оплаты на API: переплата, повтор ключа, отмена оплаченного
  const over = await request.post(`${api}/food-service/orders/${order.id}/payments`, {
    headers,
    data: { method: 'CASH', amount: 78_001, idempotencyKey: 'over' },
  });
  expect(over.status()).toBe(409);
  const part = { method: 'KASPI', amount: 30_000, idempotencyKey: 'part-1' };
  await post(request, headers, `/food-service/orders/${order.id}/payments`, part);
  const again = await post(request, headers, `/food-service/orders/${order.id}/payments`, part);
  expect(again.paidMinor).toBe('30000');
  const cancel = await request.post(`${api}/food-service/orders/${order.id}/status`, {
    headers,
    data: { expectedStatus: again.status, expectedUpdatedAt: again.updatedAt, status: 'CANCELLED' },
  });
  expect(cancel.status()).toBe(409);
  await page.goto('/cashbox');
  await expect(page.getByRole('heading', { name: 'Касса' })).toBeVisible();
  await expect(page.getByTestId('cash-KASPI')).toContainText('300 ₸');
  await expect(page.getByTestId('cash-CASH')).toContainText('0 ₸');
  const ops = page.getByRole('region', { name: 'Операция кассы' });
  // расход наличных при нуле в кассе отклоняется
  await ops.getByRole('button', { name: 'Расход' }).click();
  await ops.getByLabel('Сумма, ₸').fill('100');
  await ops.getByRole('button', { name: 'Провести' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('меньше этой суммы');
  // перевод Kaspi → наличные
  await ops.getByRole('button', { name: 'Перевод' }).click();
  // поле оборачивает список подписью, и «Куда» входит в «Откуда»: берём списки по порядку
  await ops.locator('select').nth(0).selectOption('KASPI');
  await ops.locator('select').nth(1).selectOption('CASH');
  await ops.getByLabel('Сумма, ₸').fill('100');
  await ops.getByRole('button', { name: 'Провести' }).click();
  await expect(page.getByTestId('cash-KASPI')).toContainText('200 ₸');
  await expect(page.getByTestId('cash-CASH')).toContainText('100 ₸');
  // сверка: пересчитали 90 при 100 по системе, разница −10
  const check = page.getByRole('region', { name: 'Сверка кассы' });
  await check.getByLabel('Пересчитано, ₸').fill('90');
  await check.getByRole('button', { name: 'Сверить' }).click();
  await page.getByRole('tab', { name: 'Сверки' }).click();
  await expect(page.getByRole('tabpanel')).toContainText('−10 ₸');
  // аннулирование перевода возвращает остатки
  await page.getByRole('tab', { name: 'Операции' }).click();
  await page.getByRole('tabpanel').getByRole('button', { name: 'Аннулировать' }).click();
  await expect(page.getByTestId('cash-KASPI')).toContainText('300 ₸');
  await expect(page.getByTestId('cash-CASH')).toContainText('0 ₸');
  const axe = await new AxeBuilder({ page }).include('main').analyze();
  expect(axe.violations).toEqual([]);
});

test('клиенты: вкладки, «Постоянный гость» от двух визитов, VIP и день рождения', async ({ page, request }) => {
  const { headers, table } = await seed(page, request);
  // День и время по поясу ресторана (Asia/Almaty), а не по UTC: ночью по UTC в Алматы уже следующие
  // сутки, и посадка «сейчас» не попадала в период (гейт 10.10 19:04 UTC). Полдень местного дня
  const localDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' }).format(new Date());
  const startsAt = `${localDay}T12:00:00+05:00`;
  // период обслуживания и две завершённые посадки одного клиента
  const period = await post(request, headers, '/food-service/service-periods', {
    name: 'Весь день',
    weekday: new Date(`${localDay}T12:00:00Z`).getUTCDay(),
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
      startsAt,
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
      startsAt,
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
  // VIP и день рождения (§36): дата в будущем отклоняется, метка и «сегодня» видны во вкладках
  const future = await request.patch(`${api}/food-service/customers/${r1.customerId}`, {
    headers,
    data: { birthDate: '2999-01-01' },
  });
  expect(future.status()).toBe(400);
  await page.getByRole('tab', { name: /Все/ }).click();
  await row.getByRole('button', { name: 'Изменить' }).click();
  const marks = page.getByTestId('customer-marks');
  await marks.getByRole('switch', { name: /VIP-гость/ }).check();
  await marks.getByLabel('Дата рождения').fill(`1990-${localDay.slice(5)}`);
  await marks.getByRole('button', { name: 'Сохранить' }).click();
  await expect(marks).toHaveCount(0);
  await expect(row).toContainText('VIP');
  await expect(row.getByTestId('customer-birthday')).toContainText('сегодня');
  await page.getByRole('tab', { name: /VIP/ }).click();
  await expect(page.getByRole('tabpanel')).toContainText('Сергей Иванов');
  await page.getByRole('tab', { name: /Дни рождения/ }).click();
  await expect(page.getByRole('tabpanel')).toContainText('Сергей Иванов');
  const axe = await new AxeBuilder({ page }).include('main').analyze();
  expect(axe.violations).toEqual([]);
  // метки видит смена: в бронях дня и строкой на «Главной» (вторая бронь клиента сегодня активна)
  await page.goto(`/table-reservations?date=${localDay}&view=list`);
  await expect(page.getByTestId('guest-marks').first()).toContainText('VIP');
  await expect(page.getByTestId('guest-marks').first()).toContainText('День рождения');
  await page.goto('/today');
  await expect(page.getByTestId('today-attention-birthdays')).toContainText('1');
  await expect(page.getByTestId('today-attention-vip')).toContainText('1');
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
