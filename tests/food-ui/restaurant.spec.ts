import { test, expect, type Page, type APIRequestContext } from './fixtures';
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
  // вкладка «Категории» по макету (экран 8)
  await page.getByRole('button', { name: /^Категории/ }).click();
  await expect(page.getByTestId('menu-board').locator('tbody')).toContainText('Десерты');
  await page.getByRole('button', { name: /^Позиции/ }).click();
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
  // возврат по закрытому заказу (§56): без причины подсказка, с причиной «Возвращено»
  const refund = payment.getByRole('region', { name: 'Возврат по заказу' });
  await expect(refund.getByLabel('Сумма возврата, ₸')).toHaveValue('780');
  await refund.getByLabel('Сумма возврата, ₸').fill('200');
  await refund.getByRole('button', { name: 'Оформить возврат' }).click();
  await expect(payment.getByRole('alert')).toContainText('Укажите причину возврата');
  await refund.getByLabel('Причина возврата').fill('Блюдо остыло');
  await refund.getByRole('button', { name: 'Оформить возврат' }).click();
  await expect(payment.getByTestId('order-refunded')).toContainText('200 ₸');
  expect((await new AxeBuilder({ page }).include('[data-testid="order-drawer"]').analyze()).violations).toEqual([]);
  await page.keyboard.press('Escape');
  // вкладки: закрытый заказ в «Закрыты», счётчики совпадают
  await expect(page.getByRole('button', { name: 'Закрыты' })).toContainText('1');
  await page.getByRole('button', { name: 'Закрыты' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody tr').first()).toContainText('Оплачен');
  // отмена заказа только через подтверждение (ADR-182): «Оставить как есть» ничего не меняет
  await page.getByRole('button', { name: 'Все' }).first().click();
  await page.getByRole('button', { name: '+ Новый заказ' }).click();
  const second = page.getByRole('dialog');
  await second.getByRole('button', { name: 'Добавить: Паста Карбонара, 390 ₸' }).click();
  await second.getByRole('button', { name: 'Отправить на кухню' }).click();
  await expect(second.getByTestId('order-total')).toContainText('390 ₸');
  await second.getByRole('button', { name: 'Отменить заказ' }).click();
  const confirm = page.getByTestId('confirm-dialog');
  await confirm.getByRole('button', { name: 'Оставить как есть' }).click();
  await expect(second.getByText('Новый', { exact: true })).toBeVisible();
  await second.getByRole('button', { name: 'Отменить заказ' }).click();
  await page.getByTestId('confirm-dialog').getByRole('button', { name: 'Отменить заказ' }).click();
  await expect(second.getByText('Отменён', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  const axe = await new AxeBuilder({ page }).include('main').analyze();
  expect(axe.violations).toEqual([]);
  // рейтинг официанта по оценкам гостей на экране «Сотрудники»
  await page.goto('/employees');
  await expect(
    page.locator('tbody tr', { hasText: waiter.name }).getByTestId('employee-rating'),
  ).toContainText('4 ★, 1 оценка');
  // «Финансы»: возврат гостю своей вкладкой, в «Расходах» его нет (§56, как ADR-176)
  await page.goto('/restaurant-finance');
  const board = page.getByTestId('finance-board');
  await board.getByRole('button', { name: 'Возвраты' }).click();
  await expect(board.locator('tbody')).toContainText('Возврат по заказу');
  await expect(page.getByTestId('finance-total')).toContainText('200 ₸');
  await board.getByRole('button', { name: 'Расходы' }).click();
  await expect(board).not.toContainText('Возврат по заказу');
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
  await ready.getByRole('button', { name: 'Отметить как выдано' }).click();
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
  // полоса шагов макета (экран 4): «Основное» заполнено датой, временем и периодом, «Стол» выбран кликом
  const steps = dialog.getByRole('list', { name: 'Шаги брони' });
  await expect(steps.getByRole('listitem').nth(0)).toHaveAttribute('data-done', 'true');
  await expect(steps.getByRole('listitem').nth(2)).toHaveAttribute('data-done', 'true');
  await expect(steps.getByRole('listitem').nth(1)).toHaveAttribute('aria-current', 'step');
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
  expect(r.guestsCount).toBe(4);
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

test('оценка по QR (§40): ссылка смены, страница гостя без входа, одна оценка, замена ссылки, лимит', async ({
  page,
  browser,
  request,
}) => {
  const { headers, table, pasta, waiter } = await seed(page, request);
  const order = () =>
    post(request, headers, '/food-service/orders', {
      tableId: table.id,
      waiterId: waiter.id,
      guestCount: 2,
      items: [{ menuItemId: pasta.id, qty: 1 }],
    });
  const link = (id: string) => request.post(`${api}/food-service/orders/${id}/rating-link`, { headers });
  const open = await order();
  expect((await link(open.id)).status()).toBe(409);
  const a = await order();
  await serveAndPay(request, headers, a);
  // повторная выдача заменяет ключ: прежняя ссылка мертва
  const first = await (await link(a.id)).json();
  const second = await (await link(a.id)).json();
  expect(second.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  const publicGet = (token: string, ip?: string) =>
    request.get(`${api}/public/order-rating/${token}`, ip ? { headers: { 'cf-connecting-ip': ip } } : {});
  expect((await publicGet(first.token)).status()).toBe(404);
  const preview = await (await publicGet(second.token)).json();
  expect(preview).toMatchObject({ waiterName: 'Иванова Анна', orderNumber: a.number });
  // мусорный ключ отвечает тем же текстом, что и мёртвый
  const junk = await publicGet('x'.repeat(43));
  expect([junk.status(), (await junk.json()).message]).toEqual([404, 'Ссылка недействительна']);

  // гость: чистый браузер без входа и без кук стойки
  const guest = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const phone = await guest.newPage();
  await phone.goto(`/rate/${second.token}`);
  // getByRole не видит скрытую потоковую копию страницы: у нового контекста нет обёртки goto фикстуры
  const main = phone.getByRole('main');
  await expect(main.getByRole('heading', { name: 'Как вас обслужили?' })).toBeVisible();
  await expect(main).toContainText(`заказ № ${a.number}`);
  await expect(main).toContainText('Иванова Анна');
  await main.getByRole('button', { name: 'Отправить оценку' }).click();
  await expect(main.getByRole('alert')).toContainText('Выберите от 1 до 5 звёзд');
  await main.getByRole('radio', { name: '5 из 5' }).click();
  await main.getByLabel('Комментарий, если хотите').fill('Очень внимательно');
  const axe = await new AxeBuilder({ page: phone }).analyze();
  expect(axe.violations).toEqual([]);
  await main.getByRole('button', { name: 'Отправить оценку' }).click();
  await expect(main.getByTestId('rate-done')).toContainText('Спасибо');
  await phone.reload();
  await expect(main.getByRole('heading', { name: 'Ссылка недействительна' })).toBeVisible();
  await guest.close();

  // оценка легла на заказ и на официанта; второй раз ни по ссылке, ни новой ссылкой
  const again = await request.post(`${api}/public/order-rating/${second.token}`, { data: { stars: 1 } });
  expect(again.status()).toBe(404);
  expect((await link(a.id)).status()).toBe(409);
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' }).format(new Date());
  const list = await (await request.get(`${api}/food-service/orders?date=${day}`, { headers })).json();
  const rated = list.items.find((o: { id: string }) => o.id === a.id);
  expect(rated.rating).toMatchObject({ stars: 5, comment: 'Очень внимательно' });

  // смена видит QR-код в карточке закрытого заказа
  const b = await order();
  await serveAndPay(request, headers, b);
  await page.goto('/orders');
  await page.getByRole('button', { name: `№${b.number}`, exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'QR-код для гостя' }).click();
  const qr = dialog.getByTestId('order-rating-qr');
  await expect(qr.getByRole('img', { name: 'QR-код: оценка с телефона гостя' })).toBeVisible();
  await expect(qr.getByRole('link')).toHaveAttribute('href', /\/rate\/[A-Za-z0-9_-]{43}$/);

  // лимит по адресу посетителя: 120 в час, дальше 429 (свой адрес, чтобы не задеть соседние шаги)
  const statuses: number[] = [];
  // окно лимита живёт в памяти API час: свой адрес на прогон, иначе повтор теста упрётся в счётчик прошлого
  const visitor = `198.51.100.${(Date.now() % 250) + 1}`;
  for (let i = 0; i < 121; i++) statuses.push((await publicGet('y'.repeat(43), visitor)).status());
  expect(statuses.slice(0, 120).every((s) => s === 404)).toBe(true);
  expect(statuses[120]).toBe(429);
});

test('график смен (Q-REST-11): неделя сотрудника, правка часов, проверка ввода', async ({ page, request }) => {
  const { headers, waiter } = await seed(page, request);
  const shifts = async () => (await (await request.get(`${api}/food-service/shifts`, { headers })).json()).employees;
  const empty = (await shifts()).find((e: { id: string }) => e.id === waiter.id);
  expect(empty.week).toHaveLength(7);
  expect(empty.week.every((d: { intervals: unknown[] }) => d.intervals.length === 0)).toBe(true);
  const bad = await request.put(`${api}/food-service/employees/${waiter.id}/working-hours`, {
    headers,
    data: { intervals: [{ weekday: 1, timeFrom: '18:00', timeTo: '10:00' }] },
  });
  expect(bad.status()).toBe(400);

  await page.goto('/employees');
  await page.getByRole('link', { name: 'График смен' }).click();
  await expect(page).toHaveURL(/\/employees\/shifts$/);
  const line = page.locator('tbody tr', { hasText: waiter.name });
  await expect(line).toContainText('Выходной');
  await line.getByRole('button', { name: 'Изменить график' }).click();
  const dialog = page.getByRole('dialog');
  const monday = dialog.getByRole('group', { name: 'Понедельник' });
  await monday.getByRole('button', { name: 'Сделать рабочим' }).click();
  await monday.getByLabel('Понедельник: начало').fill('10:00');
  await monday.getByLabel('Понедельник: конец').fill('18:00');
  await dialog.getByRole('button', { name: 'Сохранить график' }).click();
  await expect(dialog.getByRole('status')).toContainText('График сохранён');
  await page.keyboard.press('Escape');
  await expect(line).toContainText('10:00–18:00');
  const saved = (await shifts()).find((e: { id: string }) => e.id === waiter.id);
  expect(saved.week[0]).toEqual({ weekday: 1, intervals: [{ timeFrom: '10:00', timeTo: '18:00' }] });
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations).toEqual([]);
});

test('схема зала (Q-REST-8): расстановка зоны стрелками и мышью, форма и размер, отказы API', async ({
  page,
  request,
}) => {
  const { headers, area, table } = await seed(page, request);
  const second = await post(request, headers, '/food-service/tables', {
    areaId: area.id,
    name: '8',
    capacity: 2,
    sortOrder: 1,
    active: true,
  });
  const terrace = await post(request, headers, '/food-service/areas', { name: 'Терраса', sortOrder: 1, active: true });
  const foreign = await post(request, headers, '/food-service/tables', {
    areaId: terrace.id,
    name: '20',
    capacity: 2,
    sortOrder: 0,
    active: true,
  });
  const put = (tables: unknown[]) =>
    request.put(`${api}/food-service/areas/${area.id}/layout`, { headers, data: { tables } });
  const spot = (id: string, posX = 100) => ({ id, posX, posY: 100, shape: null, scale: 100, rotation: 0 });
  expect((await put([spot(foreign.id)])).status()).toBe(400);
  expect((await put([spot(table.id, 1001)])).status()).toBe(400);

  await page.goto('/floor-plan');
  await page.getByRole('button', { name: 'Расставить столы: Основной зал' }).click();
  const editor = page.getByTestId('floor-layout-editor');
  // клавиатура: стол 7 по порядку стоит в (100, 500), Shift+стрелка двигает на 50
  const seven = editor.getByRole('button', { name: /^7: место/ });
  await seven.focus();
  for (let i = 0; i < 5; i++) await page.keyboard.press('Shift+ArrowRight');
  await editor.getByLabel('Форма: 7').selectOption('ROUND');
  await editor.getByLabel('Размер: 7').selectOption('130');
  // мышь: стол 8 в точку 75 % по ширине, 25 % по высоте
  const canvas = await editor.locator('.rest-fp__layout').boundingBox();
  const eight = await editor.getByRole('button', { name: /^8: место/ }).boundingBox();
  await page.mouse.move(eight!.x + eight!.width / 2, eight!.y + eight!.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvas!.x + canvas!.width * 0.75, canvas!.y + canvas!.height * 0.25, { steps: 8 });
  await page.mouse.up();
  const axe = await new AxeBuilder({ page }).include('[data-testid="floor-layout-editor"]').analyze();
  expect(axe.violations).toEqual([]);
  await editor.getByRole('button', { name: 'Сохранить расстановку' }).click();
  await expect(editor).toHaveCount(0);
  await expect(page.locator('.rest-fp__layout .rest-fp__spot')).toHaveCount(2);

  const tables = (await (await request.get(`${api}/food-service/tables`, { headers })).json()).items as Array<{
    id: string;
    posX: number;
    posY: number;
    shape: string | null;
    scale: number;
  }>;
  const t7 = tables.find((t) => t.id === table.id)!;
  const t8 = tables.find((t) => t.id === second.id)!;
  expect(t7).toMatchObject({ posX: 350, posY: 500, shape: 'ROUND', scale: 130 });
  expect(Math.abs(t8.posX - 750)).toBeLessThanOrEqual(10);
  expect(Math.abs(t8.posY - 250)).toBeLessThanOrEqual(10);
  // перезагрузка: схема стоит, стол чужой зоны своей зоне не мешает
  await page.reload();
  await expect(page.locator('.rest-fp__layout .rest-fp__spot')).toHaveCount(2);
  expect(tables.find((t) => t.id === foreign.id)!.posX).toBeNull();
});

test('бар филиала (ADR-178): ресторан и салон продают в кассу своего филиала', async ({ page, request }) => {
  const { f, headers } = await seed(page, request);
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' }).format(new Date());
  const stockUp = async (h: Record<string, string>, code: string) => {
    const supplier = await post(request, h, '/bar/suppliers', { name: `Поставщик ${code}` });
    const product = await post(request, h, '/bar/products', {
      code, name: `Кола ${code}`, categoryId: null, barcode: null, unitsPerPackage: 1, markupBasis: null,
      salePriceMinor: '60000', minimumStockUnits: '0',
    });
    const receipt = await post(request, h, '/bar/receipts', {
      supplierId: supplier.id, documentNumber: `Н-${code}`, documentDate: day, receivedDate: day, currency: 'KZT',
      lines: [{ productId: product.id, quantityUnits: '10', unitCostMinor: '30000', markupBasis: '10000' }],
    });
    await post(request, h, `/bar/receipts/${receipt.id}/post`, {});
    return product;
  };
  await stockUp(headers, 'R1');
  await page.goto('/bar#bar-quick-sale');
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { name: 'Склад', level: 1 })).toBeVisible();
  // «в счёт гостя» только у гостиницы
  await expect(main.getByText('Продажа напрямую', { exact: true }).first()).toBeVisible();
  await expect(main.getByRole('tab', { name: 'В счёт гостя' })).toHaveCount(0);
  const sale = main.locator('#bar-quick-sale');
  await sale.getByLabel('Товар').selectOption({ label: 'Кола R1, остаток 10 шт.' });
  await sale.getByLabel('Количество, шт.').fill('2');
  await sale.getByRole('button', { name: 'Продать' }).click();
  await expect
    .poll(async () => {
      const cash = await (await request.get(`${api}/food-service/cash`, { headers })).json();
      return cash.balances.find((b: { method: string }) => b.method === 'CASH')?.balanceMinor;
    })
    .toBe('120000');
  const axe = await new AxeBuilder({ page }).include('main').analyze();
  expect(axe.violations).toEqual([]);

  // салон: продаёт в кассу филиала салона (§48), у кассы нет вкладки оплат заказов
  const beauty = { 'x-wetop-scope': pointer(f.beauty, f.locations[3]!) };
  await stockUp(beauty, 'B1');
  await scope(page, f.beauty, f.locations[3]!);
  // тот же адрес с якорем браузер не перезагружает: салон открывается заново через другой адрес
  await page.goto('/today');
  await page.goto('/bar#bar-quick-sale');
  await expect(main.getByRole('tab', { name: 'В счёт гостя' })).toHaveCount(0);
  const salonSale = main.locator('#bar-quick-sale');
  await salonSale.getByLabel('Товар').selectOption({ label: 'Кола B1, остаток 10 шт.' });
  await salonSale.getByLabel('Количество, шт.').fill('1');
  await salonSale.getByRole('button', { name: 'Продать' }).click();
  await expect
    .poll(async () => {
      const cash = await (await request.get(`${api}/food-service/cash`, { headers: beauty })).json();
      return cash.balances?.find((b: { method: string }) => b.method === 'CASH')?.balanceMinor;
    })
    .toBe('60000');
  await page.goto('/cashbox');
  await expect(main.getByRole('heading', { name: 'Касса', level: 1 })).toBeVisible();
  await expect(main).toContainText('Деньги салона по способам оплаты');
  await expect(main.getByRole('tab', { name: 'Оплаты заказов' })).toHaveCount(0);
  await expect(main.getByRole('tab', { name: 'Операции' })).toBeVisible();
  const salonAxe = await new AxeBuilder({ page }).include('main').analyze();
  expect(salonAxe.violations).toEqual([]);
});

test('зарплата салона (§19.2): та же доска, процент от выполненных записей, без вкладок ресторана', async ({ page, request }) => {
  const { f } = await seed(page, request);
  const beauty = { 'x-wetop-scope': pointer(f.beauty, f.locations[3]!) };
  await post(request, beauty, '/beauty/employees', { name: 'Мастер Дина' });
  await scope(page, f.beauty, f.locations[3]!);
  await page.goto('/today');
  await page.goto('/payroll');
  await expect(page.getByRole('main').getByRole('cell', { name: 'Мастер Дина' })).toBeVisible();
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { name: 'Зарплата', level: 1 })).toBeVisible();
  await expect(main).toContainText('процент от выполненных записей');
  await expect(main.getByRole('columnheader', { name: 'Услуги' })).toBeVisible();
  await expect(main.getByRole('columnheader', { name: 'Продажи' })).toHaveCount(0);
  await expect(main.getByRole('link', { name: 'График смен' })).toHaveCount(0);
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
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
  // аннулирование только через подтверждение (ADR-182)
  await page.getByTestId('confirm-dialog').getByRole('button', { name: 'Аннулировать' }).click();
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
  // внутри видимого блока: потоковая отрисовка Next на миг держит копию куска страницы в скрытом div
  const attention = page.getByRole('region', { name: 'Требуют внимания' });
  await expect(attention.getByTestId('today-attention-birthdays')).toContainText('1');
  await expect(attention.getByTestId('today-attention-vip')).toContainText('1');
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
  for (const path of ['/orders', '/kitchen', '/drinks', '/menu', '/customers', '/employees', '/payroll', '/restaurant-finance', '/restaurant-settings'])
    expect(hrefs, path).toContain(path);
});

test('бар, финансы и настройки ресторана по макету (экраны 7, 12, 13)', async ({ page, request }) => {
  const { headers, table, pasta } = await seed(page, request);
  // бар: категория «Напитки» и напиток; плитка открывает заказ с этим напитком
  const drinks = await post(request, headers, '/food-service/menu/categories', { name: 'Напитки' });
  const mojito = await post(request, headers, '/food-service/menu/items', {
    categoryId: drinks.id,
    name: 'Мохито',
    price: 55000,
  });
  const order = await post(request, headers, '/food-service/orders', {
    tableId: table.id,
    guestCount: 2,
    items: [
      { menuItemId: pasta.id, qty: 1 },
      { menuItemId: mojito.id, qty: 2 },
    ],
  });
  await page.goto('/drinks');
  const current = page.getByRole('region', { name: /Текущие заказы/ });
  await expect(current).toContainText(`№${order.number}`);
  await expect(current).toContainText('Мохито×2');
  await expect(current).not.toContainText('Паста');
  await page.getByRole('button', { name: 'Новый заказ: Мохито, 550 ₸' }).click();
  await expect(page.getByRole('dialog').getByTestId('order-draft-total')).toContainText('550 ₸');
  await page.keyboard.press('Escape');
  // финансы: оплата заказа это выручка, расход кассы со знаком минус
  await serveAndPay(request, headers, order);
  await post(request, headers, '/food-service/cash/operations', {
    kind: 'EXPENSE',
    method: 'CASH',
    amount: 12_500,
    note: 'Закупка продуктов',
  });
  await page.goto('/restaurant-finance');
  const board = page.getByTestId('finance-board');
  await expect(board.locator('tbody')).toContainText(`Оплата заказа №${order.number}`);
  await expect(page.getByTestId('finance-total')).toContainText('1 490 ₸');
  await board.getByRole('button', { name: 'Расходы' }).click();
  await expect(board.locator('tbody')).toContainText('Закупка продуктов');
  await expect(board.locator('tbody td[data-negative]')).toContainText('−125 ₸');
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
  // Периоды приёма броней отделены от физического расписания зала; проверяем прежний ServicePeriod workflow.
  await page.goto('/restaurant-settings?section=bookings');
  await expect(page.getByRole('heading', { name: 'Периоды приёма броней', exact: true })).toBeVisible();
  await page.getByRole('switch', { name: 'Понедельник: работаем' }).click();
  // создание периода идёт через серверное действие и обновление страницы: под нагрузкой дольше 5 с
  await expect(page.getByRole('switch', { name: 'Понедельник: работаем' })).toBeChecked({
    timeout: 20_000,
  });
  const start = page.getByLabel('Понедельник, начало');
  await expect(start).toBeEnabled();
  await start.fill('11:00');
  await start.blur();
  await expect
    .poll(async () => {
      const r = await request.get(`${api}/food-service/service-periods?limit=100`, { headers });
      return (await r.json()).items.find((p: { weekday: number }) => p.weekday === 1)?.timeFrom;
    })
    .toBe('11:00');
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
});
