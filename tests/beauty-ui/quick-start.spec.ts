import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

/**
 * Быстрый запуск салона (владелец 27.10.2026, вариант Г): анкета в одном окне, одна кнопка «Создать салон».
 * Настоящие API и база стенда beauty-ui: после кнопки в салоне есть часы, услуги, мастер с услугами, графиком и
 * оплатой, товар бара; первичная настройка засчитана. Ошибки ловятся до создания и исправляются кнопкой.
 */
const api = `http://127.0.0.1:${process.env.BEAUTY_UI_API_PORT ?? '3772'}`;
const SHOTS = process.env.QUICK_SHOTS_DIR ?? 'reports/quick-start-2026-10-27';
type Fixture = { business: string; locations: string[] };
const pointer = (business: string, location: string) => `business=${business};location=${location}`;

async function reset(page: Page, request: APIRequestContext): Promise<Fixture> {
  const response = await request.post(`${api}/__test/reset`);
  expect(response.ok()).toBe(true);
  const f: Fixture = await response.json();
  await page.context().addCookies([
    { name: 'wetop_scope', value: encodeURIComponent(pointer(f.business, f.locations[0]!)), domain: '127.0.0.1', path: '/' },
    // вымышленный сеанс: приглашение уходит только с ним, стенд запоминает адрес вместо письма
    { name: 'wetop_session', value: 'synthetic-quick-start-session', domain: '127.0.0.1', path: '/' },
  ]);
  return f;
}

test('быстрый запуск: анкета, исправление в один клик, «Создать салон» создаёт всё', async ({ page, request }) => {
  test.setTimeout(240_000);
  const f = await reset(page, request);
  mkdirSync(SHOTS, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/register/setup');
  await page.getByTestId('quick-start-link').click();
  await expect(page).toHaveURL(/\/register\/setup\/quick$/);
  const board = page.getByTestId('quick-start');
  const go = board.getByRole('button', { name: 'Создать салон', exact: true });
  await expect(go).toBeDisabled();

  // 1. Салон
  await board.getByLabel('Название', { exact: true }).fill('Lashes Studio');
  await board.getByLabel('Адрес', { exact: true }).fill('Doha, Garafa, B05');
  await board.getByLabel('Телефон', { exact: true }).fill('+974 5000 0000');
  await board.getByLabel('С', { exact: true }).fill('10:00');
  await board.getByLabel('До', { exact: true }).fill('22:00');

  // 2. Услуги: вставка двух строк сразу
  await board.getByRole('tab', { name: /Услуги/ }).click();
  const firstService = board.getByLabel('Категория', { exact: true }).first();
  await firstService.focus();
  await page.evaluate(() => {
    const data = new DataTransfer();
    data.setData('text', 'Lashes\tClassic lashes\t90\t380\nNails\tGel manicure\t60\t250');
    document.activeElement!.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
  });
  await expect(board.getByLabel('Услуга', { exact: true })).toHaveCount(2);
  await expect(board.getByLabel('Услуга', { exact: true }).nth(1)).toHaveValue('Gel manicure');

  // 3. Мастер: опечатка в почте и часы дольше салона, обе правятся кнопкой
  await board.getByRole('tab', { name: /Мастера/ }).click();
  await board.getByLabel('Имя', { exact: true }).fill('Samira Test');
  await board.getByLabel('Почта', { exact: true }).fill('samira.quick@gmail.ru');
  await board.getByRole('button', { name: 'Gel manicure', exact: true }).click();
  await board.getByLabel('До', { exact: true }).fill('23:00');
  await board.getByLabel('Процент', { exact: true }).fill('40');
  const issues = board.getByTestId('quick-issues');
  await expect(issues).toContainText('Похоже на опечатку в почте');
  await expect(issues).toContainText('Мастер работает дольше салона');
  await expect(go).toBeDisabled();
  // таблица мастеров помещается в 1280: страница не уезжает вбок
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);
  await page.screenshot({ path: `${SHOTS}/quick-masters-issues-1280.png` });
  await issues.getByRole('button', { name: '→ gmail.com', exact: true }).click();
  await expect(board.getByLabel('Почта', { exact: true })).toHaveValue('samira.quick@gmail.com');
  await issues.getByRole('button', { name: 'Мастер до 22:00', exact: true }).click();
  await expect(issues).toHaveCount(0);

  // 4. Бар: платный товар заводится, бесплатная вода нет
  await board.getByRole('tab', { name: /Бар/ }).click();
  await board.getByRole('button', { name: '+ Добавить строку', exact: true }).click();
  await board.getByRole('button', { name: '+ Добавить строку', exact: true }).click();
  await board.getByLabel('Категория', { exact: true }).nth(0).fill('Drinks');
  await board.getByLabel('Товар', { exact: true }).nth(0).fill('Fresh juice');
  await board.getByLabel('Цена, 0 бесплатно', { exact: true }).nth(0).fill('15');
  await board.getByLabel('Товар', { exact: true }).nth(1).fill('Water');
  await board.getByLabel('Цена, 0 бесплатно', { exact: true }).nth(1).fill('0');

  await expect(go).toBeEnabled();
  await page.screenshot({ path: `${SHOTS}/quick-ready-1280.png` });
  await go.click();
  const done = page.getByTestId('quick-done');
  await expect(done).toBeVisible({ timeout: 120_000 });
  await expect(done).toContainText('Салон готов');
  await page.screenshot({ path: `${SHOTS}/quick-done-1280.png` });

  // проверка по API: всё создано в выбранном филиале
  const headers = { 'x-wetop-scope': pointer(f.business, f.locations[0]!) };
  const services = await (await request.get(`${api}/beauty/services`, { headers })).json();
  const names = services.items.filter((s: { location: { enabled: boolean } | null }) => s.location?.enabled).map((s: { name: string }) => s.name);
  expect(names).toEqual(expect.arrayContaining(['Classic lashes', 'Gel manicure']));
  const gel = services.items.find((s: { name: string }) => s.name === 'Gel manicure');
  expect(gel.priceMinor).toBe('25000');
  const employees = await (await request.get(`${api}/beauty/employees`, { headers })).json();
  const samira = employees.items.find((e: { name: string }) => e.name === 'Samira Test');
  expect(samira.email).toBe('samira.quick@gmail.com');
  expect(samira.serviceIds).toEqual([gel.id]);
  const hours = await (await request.get(`${api}/beauty/location-hours`, { headers })).json();
  expect(hours.configured).toBe(true);
  expect(hours.intervals).toHaveLength(7);
  const products = await (await request.get(`${api}/bar/products`, { headers })).json();
  expect(products.map((p: { name: string }) => p.name)).toEqual(['Fresh juice']);
  const invited = await (await request.get(`${api}/__test/invites`, { headers })).json();
  expect(invited).toEqual(expect.arrayContaining([{ email: 'samira.quick@gmail.com', role: 'EMPLOYEE' }]));
  const onboarding = await (await request.get(`${api}/onboarding`, { headers })).json();
  expect(onboarding.readiness.ready).toBe(true);
  expect(onboarding.completedFlowVersion).toBe(2);

  // повтор не плодит дублей: та же анкета второй раз
  await page.goto('/register/setup?entry=reopen');
  await expect(page.getByTestId('quick-start-link')).toHaveCount(0);
});
