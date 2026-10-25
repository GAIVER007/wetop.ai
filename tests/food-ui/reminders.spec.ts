import { test, expect, type Page, type APIRequestContext } from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';

/**
 * Напоминания гостям ресторана (DATA_MODEL §61, миграция 152, «да» владельца 23.10.2026). Настоящий Nest API на своей
 * PostgreSQL: «Настройки ресторана → Напоминания гостям» (предпросмотр, сохранение с версией), строка хаба, затем
 * бронь гостя без почты, воркер кладёт напоминание в «Вручную», на «Бронированиях» список «Напомнить сегодня» с
 * кнопкой WhatsApp и «Напомнил». 1440 и 390, светлая и тёмная, без прокрутки вбок. Настоящих писем нет.
 */
const api = `http://127.0.0.1:${process.env.FOOD_UI_API_PORT ?? '55824'}`;
const shots = process.env.REMINDER_SHOTS_DIR ?? 'reports/restaurant-reminders-2026-10-23';
const pointer = (b: string, l: string) => `business=${b};location=${l}`;
type Fixture = { business: string; locations: string[] };

async function post(request: APIRequestContext, headers: Record<string, string>, path: string, data: unknown) {
  const res = await request.post(`${api}${path}`, { headers, data });
  expect(res.ok(), `${path}: ${res.status()} ${await res.text()}`).toBe(true);
  return res.json();
}
async function seed(page: Page, request: APIRequestContext) {
  const res = await request.post(`${api}/__test/reset`);
  expect(res.ok()).toBe(true);
  const f: Fixture = await res.json();
  await page.context().addCookies([
    { name: 'wetop_scope', value: encodeURIComponent(pointer(f.business, f.locations[0]!)), domain: '127.0.0.1', path: '/' },
  ]);
  return { headers: { 'x-wetop-scope': pointer(f.business, f.locations[0]!) } };
}
async function noHorizontalScroll(page: Page) {
  const { scroll, inner } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
  expect(scroll, 'горизонтальная прокрутка').toBeLessThanOrEqual(inner);
}

test.describe.configure({ timeout: 300_000 });

test('напоминания гостям: настройки с предпросмотром, «Напомнить сегодня» с WhatsApp и «Напомнил»', async ({ page, request }) => {
  mkdirSync(shots, { recursive: true });
  const { headers } = await seed(page, request);

  // 1. Настройки: раздел «Напоминания гостям», предпросмотр текста, сохранение
  await page.goto('/restaurant-settings?section=reminders');
  const form = page.getByTestId('food-reminder-settings');
  await expect(form.getByRole('heading', { name: 'Напоминания гостям' })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('link', { name: 'Напоминания гостям' })).toHaveAttribute('aria-current', 'page');
  await expect(form.getByLabel('За сколько часов до брони')).toHaveValue('24, 2');
  await form.getByLabel('Текст напоминания').fill('{имя}, ждём вас {дата} в {время}, {гостей}!');
  await expect(form.getByTestId('food-reminder-preview')).toHaveText('Айгуль, ждём вас 23 октября в 19:00, 4 гостя!');
  await form.getByLabel('Текст напоминания').fill('');
  await form.getByLabel('За сколько часов до брони').fill('2');
  await expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
  await page.screenshot({ path: `${shots}/settings-light-1440.png`, fullPage: true });
  await form.getByRole('button', { name: 'Сохранить напоминания' }).click();
  await expect(form.getByText('Напоминания сохранены')).toBeVisible();

  // строка хаба ведёт сюда же
  await page.goto('/settings');
  await expect(page.getByRole('link', { name: 'Напоминания клиентам' })).toHaveAttribute('href', '/restaurant-settings?section=reminders');

  // 2. Бронь гостя без почты через 2,5 часа: напоминание «за 2 часа» созреет через полчаса, воркер стенда идёт «на час вперёд»
  const area = await post(request, headers, '/food-service/areas', { name: 'Основной зал', sortOrder: 0, active: true });
  await post(request, headers, '/food-service/tables', { areaId: area.id, name: '1', capacity: 4, sortOrder: 0, active: true });
  const startsAt = new Date(Date.now() + 150 * 60_000);
  // «Напомнить сегодня» показывает день филиала: в последние полчаса суток по Алматы напоминание уже завтрашнее
  const almatyDay = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' }).format(d);
  test.skip(almatyDay(new Date(startsAt.getTime() - 2 * 3_600_000)) !== almatyDay(new Date()), 'около полуночи по Алматы');
  // Период строится вокруг самой брони (Алматы, UTC+5): «Весь день» до 23:59 не вмещал бронь, начатую после 22:59
  // (запуск после 20:29 по Алматы), и тест краснел каждый вечер. Окно начала брони плюс 90 минут, через полночь явно.
  const local = new Date(startsAt.getTime() + 5 * 3_600_000);
  const hhmm = (d: Date) => d.toISOString().slice(11, 16);
  const localEnd = new Date(local.getTime() + 90 * 60_000);
  await post(request, headers, '/food-service/service-periods', {
    name: 'Вечер', weekday: local.getUTCDay(), timeFrom: hhmm(local), timeTo: hhmm(localEnd),
    endsNextDay: localEnd.getUTCDate() !== local.getUTCDate(), defaultDurationMinutes: 60, active: true,
  });
  const periods = await (await request.get(`${api}/food-service/service-periods`, { headers })).json();
  const res = await request.post(`${api}/food-service/reservations`, {
    headers: { ...headers, 'idempotency-key': `rem-${Date.now()}` },
    data: { servicePeriodId: periods.items[0].id, startsAt: startsAt.toISOString(), partySize: 4, customer: { firstName: 'Ерлан', phone: '+7 700 555 66 77' } },
  });
  expect(res.ok(), await res.text()).toBe(true);
  const run = await request.post(`${api}/__test/food-reminders/run`, { data: { aheadMinutes: 60 } });
  expect(run.ok(), await run.text()).toBe(true);
  expect((await run.json()).manual, 'напоминание без почты ушло в «Вручную»').toBe(1);

  // 3. «Бронирования»: «Напомнить сегодня» с WhatsApp и «Напомнил»
  for (const [scheme, width] of [['light', 1440], ['dark', 390]] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/table-reservations');
    // потоковая отрисовка оставляет в DOM скрытую копию раздела: берём видимую, в main
    const box = page.getByRole('main').getByTestId('food-reminders-today');
    await expect(box).toBeVisible({ timeout: 60_000 });
    await expect(box.getByRole('heading')).toHaveText('Напомнить сегодня (1)');
    await expect(box.getByTestId('food-reminder-row')).toContainText('Ерлан, бронь в');
    await expect(box.getByRole('link', { name: 'Написать в WhatsApp' })).toHaveAttribute('href', /^https:\/\/wa\.me\/77005556677\?text=/);
    await noHorizontalScroll(page);
    await box.screenshot({ path: `${shots}/today-${scheme}-${width}.png` });
  }
  await expect((await new AxeBuilder({ page }).include('[data-testid="food-reminders-today"]').withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
  await page.getByTestId('food-reminders-today').getByRole('button', { name: 'Напомнил' }).click();
  await expect(page.getByTestId('food-reminders-today')).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('food-reminders-today')).toHaveCount(0);
});
