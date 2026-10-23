import { test, expect, type Page, type APIRequestContext } from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';

/**
 * Добавки к блюдам и деление счёта (решение владельца 22.10.2026, DATA_MODEL §33.7). Настоящий Nest API на настоящей
 * базе: группы «Размер» (С/М/Л, обязательная) и «Добавки» создаются на вкладке «Добавки», привязываются к блюду, стойка
 * принимает заказ с выбором и комментарием, бар видит выбор под позицией, официант на телефоне выбирает размер, счёт
 * делится по позициям и поровну, заказ закрыт. 390 и 1440 без горизонтальной прокрутки.
 */
const api = `http://127.0.0.1:${process.env.FOOD_UI_API_PORT ?? '55824'}`;
const shots = process.env.MOD_SHOTS_DIR ?? '/tmp/personnel/audit/D-me';
const pointer = (b: string, l: string) => `business=${b};location=${l}`;
type Fixture = { business: string; locations: string[] };

async function post(request: APIRequestContext, headers: Record<string, string>, path: string, data: unknown) {
  const res = await request.post(`${api}${path}`, { headers, data });
  expect(res.ok(), `${path}: ${res.status()} ${await res.text()}`).toBe(true);
  return res.json();
}
async function control(request: APIRequestContext, data: Record<string, unknown>) {
  expect((await request.post(`${api}/__test/control`, { data })).ok()).toBe(true);
}
async function seed(page: Page, request: APIRequestContext) {
  const res = await request.post(`${api}/__test/reset`);
  expect(res.ok()).toBe(true);
  const f: Fixture = await res.json();
  await page.context().addCookies([
    { name: 'wetop_scope', value: encodeURIComponent(pointer(f.business, f.locations[0]!)), domain: '127.0.0.1', path: '/' },
  ]);
  const headers = { 'x-wetop-scope': pointer(f.business, f.locations[0]!) };
  const area = await post(request, headers, '/food-service/areas', { name: 'Основной зал', sortOrder: 0, active: true });
  for (const [name, sortOrder] of [['1', 0], ['2', 1]] as const)
    await post(request, headers, '/food-service/tables', { areaId: area.id, name, capacity: 4, sortOrder, active: true });
  const bar = await post(request, headers, '/food-service/menu/categories', { name: 'Кофе', station: 'BAR' });
  const sweets = await post(request, headers, '/food-service/menu/categories', { name: 'Десерты' });
  await post(request, headers, '/food-service/menu/items', { categoryId: bar.id, name: 'Капучино', price: 100000 });
  await post(request, headers, '/food-service/menu/items', { categoryId: sweets.id, name: 'Чизкейк', price: 200000 });
  const waiter = await post(request, headers, '/food-service/employees', { name: 'Официант Дана', phone: '+7 700 000-00-03' });
  return { waiter };
}
async function noHorizontalScroll(page: Page) {
  const { scroll, inner } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
  expect(scroll, 'горизонтальная прокрутка').toBeLessThanOrEqual(inner);
}

test.describe.configure({ timeout: 300_000 });

test('добавки: группы, привязка к блюду, заказ с выбором и комментарием, бар видит выбор, счёт делится и закрывается', async ({
  page,
  request,
}) => {
  mkdirSync(shots, { recursive: true });
  const { waiter } = await seed(page, request);

  // 1. «Меню» → «Добавки»: группа «Размер» (обязательно, одно) и «Добавки» (до 2)
  await page.goto('/menu');
  await expect(page.getByRole('heading', { name: 'Меню', exact: true })).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: '+ Группа добавок' }).click();
  let dialog = page.getByTestId('modifier-group-drawer');
  await dialog.getByLabel('Название группы').fill('Размер');
  await dialog.getByLabel('Обязательно выбрать (например, размер)').check();
  await dialog.getByRole('button', { name: '+ Добавка' }).click();
  await dialog.getByRole('button', { name: '+ Добавка' }).click();
  for (const [index, name, price] of [[1, 'С', '0'], [2, 'М', '200'], [3, 'Л', '400']] as const) {
    await dialog.getByLabel(`Добавка ${index}`, { exact: true }).fill(name);
    await dialog.getByLabel(`Прибавка к цене ${index}, ₸`).fill(price);
  }
  await page.screenshot({ path: `${shots}/mod-1-group-form-1440.png` });
  await dialog.getByRole('button', { name: 'Сохранить' }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: '+ Группа добавок' }).click();
  dialog = page.getByTestId('modifier-group-drawer');
  await dialog.getByLabel('Название группы').fill('Добавки');
  await dialog.getByLabel('Сколько можно выбрать').fill('2');
  await dialog.getByRole('button', { name: '+ Добавка' }).click();
  await dialog.getByLabel('Добавка 1', { exact: true }).fill('Сироп');
  await dialog.getByLabel('Прибавка к цене 1, ₸').fill('150');
  await dialog.getByLabel('Добавка 2', { exact: true }).fill('Корица');
  await dialog.getByLabel('Прибавка к цене 2, ₸').fill('50');
  await dialog.getByRole('button', { name: 'Сохранить' }).click();
  await expect(dialog).toHaveCount(0);
  const rows = page.getByTestId('modifier-group-row');
  await expect(rows).toHaveCount(2);
  await expect(rows.filter({ hasText: 'Размер' })).toContainText('Обязательно, одно');
  await expect(rows.filter({ hasText: 'Размер' })).toContainText('Л +400 ₸');
  await noHorizontalScroll(page);
  await page.screenshot({ path: `${shots}/mod-2-groups-1440.png`, fullPage: true });
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);

  // 2. окно блюда: «Добавки и размеры» → обе группы у капучино
  await page.getByRole('button', { name: /^Позиции/ }).click();
  await page.locator('.rest-menu-row', { hasText: 'Капучино' }).getByRole('button', { name: 'Изменить', exact: true }).click();
  const dish = page.getByTestId('dish-drawer');
  const groups = dish.getByTestId('dish-modifier-groups');
  await groups.getByRole('checkbox', { name: /^Размер/ }).check();
  await groups.getByRole('checkbox', { name: /^Добавки/ }).check();
  await page.screenshot({ path: `${shots}/mod-3-dish-groups-1440.png` });
  await dish.getByRole('button', { name: 'Сохранить' }).click();
  await expect(dish).toHaveCount(0);
  await page.getByRole('button', { name: /^Добавки/ }).first().click();
  await expect(page.getByTestId('modifier-group-row').filter({ hasText: 'Размер' }).getByRole('cell').nth(3)).toHaveText('1');

  // 3. стойка: новый заказ, капучино открывает выбор (без размера кнопка закрыта), Л + сироп + комментарий
  await page.goto('/orders');
  await page.getByRole('button', { name: '+ Новый заказ' }).click();
  const order = page.getByTestId('order-drawer');
  await order.getByRole('button', { name: /^Добавить: Капучино/ }).click();
  const picker = page.getByTestId('modifier-picker');
  await expect(picker.getByTestId('modifier-submit')).toBeDisabled();
  await expect(picker).toContainText('Выберите: Размер');
  await picker.getByRole('radio', { name: /^Л/ }).check();
  await picker.getByRole('checkbox', { name: /^Сироп/ }).check();
  await picker.getByLabel('Комментарий').fill('без сахара');
  await expect(picker.getByTestId('modifier-price')).toContainText('1 550 ₸');
  await page.screenshot({ path: `${shots}/mod-4-picker-1440.png` });
  await picker.getByTestId('modifier-submit').click();
  await order.getByRole('button', { name: /^Добавить: Чизкейк/ }).click();
  await order.getByRole('button', { name: /^Добавить: Чизкейк/ }).click();
  await expect(order.getByTestId('order-draft-total')).toContainText('5 550');
  await expect(order.getByTestId('line-modifiers').first()).toHaveText('Л, Сироп. без сахара');
  await order.getByRole('button', { name: 'Отправить на кухню' }).click();
  await expect(order.getByTestId('order-total')).toContainText('5 550 ₸');
  await expect(order.getByTestId('line-modifiers').first()).toHaveText('Л, Сироп. без сахара');
  await page.keyboard.press('Escape');

  // 4. бар видит выбор и комментарий под позицией, кухня видит только чизкейк
  await page.goto('/drinks');
  const bar = page.getByRole('region', { name: 'Заказы бара' });
  await expect(bar.getByTestId('kds-line')).toHaveCount(1, { timeout: 30_000 });
  await expect(bar.getByTestId('line-modifiers')).toHaveText('Л, Сироп. без сахара');
  await page.screenshot({ path: `${shots}/mod-5-bar-1440.png`, fullPage: true });
  await page.goto('/kitchen');
  const kitchen = page.getByTestId('kitchen-board');
  await expect(kitchen.getByTestId('kds-line')).toHaveCount(1, { timeout: 30_000 });
  await expect(kitchen).toContainText('Чизкейк×2');

  // 5. карточка заказа: подать, «Разделить счёт» по позициям (капучино), остаток поровну на двоих
  await page.goto('/orders');
  await page.getByRole('button', { name: '№1', exact: true }).click();
  for (const action of ['Принять в работу', 'Готово', 'Подать']) await order.getByRole('button', { name: action }).click();
  await order.getByTestId('split-bill-open').click();
  const split = page.getByTestId('split-bill');
  await split.getByRole('button', { name: 'По позициям' }).click();
  await split.getByRole('checkbox', { name: 'Оплатить: Капучино' }).check();
  await expect(split.getByTestId('split-items-pay')).toContainText('1 550 ₸');
  await page.screenshot({ path: `${shots}/mod-6-split-items-1440.png` });
  await split.getByTestId('split-items-pay').click();
  await expect(split.getByTestId('split-remaining')).toContainText('4 000 ₸');
  // оплаченная позиция больше не предлагается
  await expect(split.getByRole('checkbox', { name: 'Оплатить: Капучино' })).toHaveCount(0);
  await split.getByRole('button', { name: 'Поровну' }).click();
  await split.getByLabel('Гостей').fill('2');
  await expect(split.getByTestId('split-even').locator('li')).toHaveCount(2);
  await page.screenshot({ path: `${shots}/mod-7-split-even-1440.png` });
  await split.getByRole('button', { name: 'Принять 2 000 ₸' }).click();
  await expect(split.getByTestId('split-remaining')).toContainText('2 000 ₸');
  await split.getByRole('button', { name: 'Принять 2 000 ₸' }).click();
  await expect(split).toContainText('Счёт оплачен полностью, заказ закрыт.');
  expect((await new AxeBuilder({ page }).include('[data-testid="split-bill"]').analyze()).violations).toEqual([]);
  await split.getByRole('button', { name: 'Готово' }).click();
  await expect(order.getByText('Оплачен', { exact: true })).toBeVisible();
  await expect(order.getByTestId('order-paid')).toContainText('5 550 ₸');
  await page.screenshot({ path: `${shots}/mod-8-closed-1440.png` });
  await page.keyboard.press('Escape');

  // 6. официант на телефоне: капучино открывает выбор размера, окно по ширине экрана
  await control(request, { role: 'EMPLOYEE', employeeId: waiter.id });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/waiter');
  await expect(page.getByRole('heading', { level: 1, name: 'Принять заказ' })).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: 'Стол 2, свободен' }).click();
  const take = page.getByRole('region', { name: 'Заказ: Стол 2' });
  await take.getByRole('button', { name: /^Добавить: Капучино/ }).click();
  await picker.getByRole('radio', { name: /^М/ }).check();
  await picker.getByLabel('Комментарий').fill('с собой');
  await expect(picker.getByTestId('modifier-price')).toContainText('1 200 ₸');
  await noHorizontalScroll(page);
  const submit = await picker.getByTestId('modifier-submit').boundingBox();
  expect(submit!.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: `${shots}/mod-9-waiter-picker-390.png` });
  await picker.getByTestId('modifier-submit').click();
  await expect(page.getByTestId('waiter-cart').getByTestId('line-modifiers')).toHaveText('М. с собой');
  await expect(page.getByTestId('order-draft-total')).toContainText('1 200');
  await noHorizontalScroll(page);
  await page.getByTestId('waiter-send').click();
  const mine = page.getByTestId('waiter-orders');
  await expect(mine.getByTestId('waiter-item')).toHaveCount(1);
  await expect(mine.getByTestId('line-modifiers')).toHaveText('М. с собой');
  await noHorizontalScroll(page);
  await page.screenshot({ path: `${shots}/mod-10-waiter-orders-390.png`, fullPage: true });
  await control(request, { role: 'OWNER' });
});
