import { test, expect, type Page, type APIRequestContext } from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';

/**
 * Официант с телефона → бар и кухня (решение владельца 22.10.2026, DATA_MODEL §33.6). Настоящий Nest API на настоящей
 * базе: официант с ролью «Личный кабинет» на 390 px принимает заказ (чай и блюдо), бар видит только чай, кухня только
 * блюдо, после «Готово» у официанта позиция «Готово к выдаче», «Подано» убирает её с экрана бара.
 */
const api = `http://127.0.0.1:${process.env.FOOD_UI_API_PORT ?? '55824'}`;
const shots = process.env.WAITER_SHOTS_DIR ?? 'reports/waiter-2026-10-22';
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
  for (const [name, sortOrder] of [['1', 0], ['2', 1], ['3', 2], ['4', 3]] as const)
    await post(request, headers, '/food-service/tables', { areaId: area.id, name, capacity: 4, sortOrder, active: true });
  const bar = await post(request, headers, '/food-service/menu/categories', { name: 'Чай и кофе', station: 'BAR' });
  const hot = await post(request, headers, '/food-service/menu/categories', { name: 'Горячее' });
  const tea = await post(request, headers, '/food-service/menu/items', { categoryId: bar.id, name: 'Чай чёрный', price: 80000 });
  await post(request, headers, '/food-service/menu/items', { categoryId: bar.id, name: 'Капучино', price: 120000 });
  const lagman = await post(request, headers, '/food-service/menu/items', { categoryId: hot.id, name: 'Лагман', price: 250000 });
  await post(request, headers, '/food-service/menu/items', { categoryId: hot.id, name: 'Плов', price: 220000 });
  const waiter = await post(request, headers, '/food-service/employees', { name: 'Официант Асель', phone: '+7 700 000-00-02' });
  return { f, headers, tea, lagman, waiter };
}
async function noHorizontalScroll(page: Page) {
  const { scroll, inner } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    inner: window.innerWidth,
  }));
  expect(scroll, 'горизонтальная прокрутка').toBeLessThanOrEqual(inner);
}

test.describe.configure({ timeout: 240_000 });

test('официант с телефона принимает заказ, бар видит чай, кухня блюдо, официант видит «Готово к выдаче»', async ({
  page,
  request,
}) => {
  mkdirSync(shots, { recursive: true });
  const { waiter } = await seed(page, request);
  await control(request, { role: 'EMPLOYEE', employeeId: waiter.id });

  // 1. официант на телефоне: столы, стол 2, чай и лагман, «Отправить»
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/waiter');
  await expect(page.getByRole('heading', { level: 1, name: 'Принять заказ' })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('waiter-table')).toHaveCount(4);
  await noHorizontalScroll(page);
  await page.screenshot({ path: `${shots}/waiter-1-tables-390.png`, fullPage: true });
  await page.getByRole('button', { name: 'Стол 2, свободен' }).click();
  const take = page.getByRole('region', { name: 'Заказ: Стол 2' });
  await take.getByRole('button', { name: 'Чай и кофе' }).click();
  await take.getByRole('button', { name: /^Добавить: Чай чёрный/ }).click();
  await take.getByRole('button', { name: 'Горячее' }).click();
  await take.getByRole('button', { name: /^Добавить: Лагман/ }).click();
  await take.getByRole('button', { name: 'Больше' }).last().click();
  await expect(page.getByTestId('order-draft-total')).toContainText('5 800');
  await noHorizontalScroll(page);
  // кнопки телефона не меньше 44 px (--touch-target)
  for (const button of [page.getByTestId('waiter-send'), take.getByRole('button', { name: 'Больше' }).last(), take.getByRole('button', { name: '← Столы' })]) {
    const box = await button.boundingBox();
    expect(box!.height, await button.innerText()).toBeGreaterThanOrEqual(44);
  }
  await page.screenshot({ path: `${shots}/waiter-2-menu-390.png`, fullPage: true });
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
  await page.getByTestId('waiter-send').click();
  const mine = page.getByTestId('waiter-orders');
  await expect(page.getByRole('alert').filter({ hasText: 'заказ отправлен' })).toBeVisible();
  await expect(mine.getByTestId('waiter-order')).toHaveCount(1);
  await expect(mine.getByTestId('waiter-item')).toHaveCount(2);
  await expect(mine).toContainText('Отправлено');

  // 2. бармен (стойка, 1440): только чай; «Принять», «Готово»
  await control(request, { role: 'OWNER' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/drinks');
  const bar = page.getByRole('region', { name: 'Заказы бара' });
  await expect(bar.getByTestId('kds-line')).toHaveCount(1, { timeout: 30_000 });
  await expect(bar).toContainText('Чай чёрный×1');
  await expect(bar).not.toContainText('Лагман');
  await page.screenshot({ path: `${shots}/waiter-bar-1440.png`, fullPage: true });
  await bar.getByRole('button', { name: 'Принять: Чай чёрный' }).click();
  await bar.getByRole('region', { name: 'Готовятся' }).getByRole('button', { name: 'Готово: Чай чёрный' }).click();
  await expect(bar.getByRole('region', { name: 'Готово' })).toContainText('Чай чёрный');

  // 3. кухня (1440): только лагман
  await page.goto('/kitchen');
  const kitchen = page.getByTestId('kitchen-board');
  await expect(kitchen.getByTestId('kds-line')).toHaveCount(1, { timeout: 30_000 });
  await expect(kitchen).toContainText('Лагман×2');
  await expect(kitchen).not.toContainText('Чай');
  await page.screenshot({ path: `${shots}/waiter-kitchen-1440.png`, fullPage: true });
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);

  // 4. официант: чай «Готово к выдаче», лагман готовится; «Подано»
  await control(request, { role: 'EMPLOYEE', employeeId: waiter.id });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/waiter');
  await page.getByRole('button', { name: /Мои заказы/ }).click();
  const orders = page.getByTestId('waiter-orders');
  const teaLine = orders.getByTestId('waiter-item').filter({ hasText: 'Чай чёрный' });
  await expect(teaLine).toHaveAttribute('data-status', 'READY');
  await expect(teaLine).toContainText('Готово к выдаче');
  await expect(orders.getByTestId('waiter-item').filter({ hasText: 'Лагман' })).toContainText('Отправлено');
  await noHorizontalScroll(page);
  await page.screenshot({ path: `${shots}/waiter-3-ready-390.png`, fullPage: true });
  await teaLine.getByRole('button', { name: 'Подано: Чай чёрный' }).click();
  await expect(teaLine).toHaveAttribute('data-status', 'SERVED');
  await expect(teaLine).toContainText('Подано');

  // 5. меню «Личного кабинета» ресторана: из рабочих разделов только «Принять заказ»; касса закрыта
  const hrefs = await page.locator('.sidenav a').evaluateAll((items) => items.map((i) => i.getAttribute('href')));
  expect(hrefs).toContain('/waiter');
  for (const closed of ['/orders', '/kitchen', '/cashbox', '/payroll', '/restaurant-finance']) expect(hrefs).not.toContain(closed);
  await control(request, { role: 'OWNER' });
});
