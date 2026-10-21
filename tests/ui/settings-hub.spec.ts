import { test, expect, FIXTURE_API } from './fixtures';
import type { APIRequestContext, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';

/**
 * Хаб «Настройки» (поручение владельца 21.10.2026, образец «Настройки» записи клиентов): одна страница карточками со
 * ссылками для всех направлений. Гостиница и салон: карточки, свои экраны за ссылками, переход по ссылке, без
 * прокрутки вбок, axe без нарушений на ноутбуке и телефоне в обеих темах.
 */
const api = FIXTURE_API;
const shots = process.env.SETTINGS_HUB_EVIDENCE || 'test-results/settings-hub';
test.use({ extraHTTPHeaders: { 'x-wetop-test-client': '1' } });
const location = '46464646-4646-4646-8646-464646464646';
const business = '57575757-5757-4757-8757-575757575757';

async function signIn(page: Page, request: APIRequestContext) {
  expect((await request.post(`${api}/__test/reset`)).ok()).toBeTruthy();
  await request.post(`${api}/__test/control`, { data: { role: 'OWNER' } });
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
}

async function checkShots(page: Page, name: string) {
  mkdirSync(shots, { recursive: true });
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name} ${width}`).toBe(true);
      expect((await new AxeBuilder({ page }).include('main').analyze()).violations, `${name} ${width} ${colorScheme}`).toEqual([]);
      await page.screenshot({ path: `${shots}/${name}-${width}-${colorScheme}.png`, fullPage: true });
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
}

test('гостиница: «Настройки» карточками, ссылки ведут на свои экраны', async ({ page, request }) => {
  await signIn(page, request);
  await page.goto('/settings');
  const hub = page.getByTestId('settings-hub');
  await expect(page.getByRole('heading', { level: 1, name: 'Настройки гостиницы' })).toBeVisible();
  await expect(hub.getByRole('heading', { level: 2 })).toHaveText(['Основные', 'Журнал', 'Клиенты и продажи', 'Система']);
  const card = (title: string) => hub.getByRole('region', { name: title, exact: true });
  await expect(card('Основные').getByRole('link')).toHaveText(['Карточка объекта', 'Филиалы и реквизиты', 'Режим работы', 'Сотрудники и доступ', 'Права ролей', 'Мой профиль']);
  await expect(card('Система').getByRole('link', { name: 'Подключения', exact: true })).toHaveAttribute('href', '/connections');
  // на ноутбуке четыре карточки в один ряд
  const boxes = await hub.locator('.settings-hub__card').evaluateAll((cards) =>
    cards.map((c) => { const r = c.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.width), Math.round(r.height)]; }),
  );
  expect(new Set(boxes.map(([top]) => top)).size).toBe(1);
  // карточки одного размера: ширина и высота у всех одинаковые, не «прыгают» (замечание владельца 21.10.2026)
  expect(new Set(boxes.map(([, w]) => w)).size).toBe(1);
  expect(new Set(boxes.map(([, , h]) => h)).size).toBe(1);
  // на планшете два ряда по две, высота рядов тоже одна
  await page.setViewportSize({ width: 1024, height: 900 });
  const tablet = await hub.locator('.settings-hub__card').evaluateAll((cards) => cards.map((c) => Math.round(c.getBoundingClientRect().height)));
  expect(new Set(tablet).size).toBe(1);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await checkShots(page, 'hotel');
  await card('Основные').getByRole('link', { name: 'Режим работы', exact: true }).click();
  await expect(page).toHaveURL(/\/hotel-settings\/stay$/);
});

test('салон: те же карточки, свои экраны салона, режим работы и бонусы на одной компактной странице', async ({ page, request }) => {
  await signIn(page, request);
  expect(
    (
      await request.post(`${api}/branches`, {
        data: { id: location, name: 'Салон Хаб', newBusinessId: business, businessName: 'Салон Хаб', vertical: 'BEAUTY' },
      })
    ).ok(),
  ).toBeTruthy();
  await page.context().addCookies([
    { name: 'wetop_scope', value: encodeURIComponent(`business=${business};location=${location}`), domain: '127.0.0.1', path: '/' },
  ]);
  await page.goto('/settings');
  const hub = page.getByTestId('settings-hub');
  await expect(page.getByRole('heading', { level: 1, name: 'Настройки салона' })).toBeVisible({ timeout: 60_000 });
  await expect(hub.getByRole('heading', { level: 2 })).toHaveText(['Основные', 'Журнал', 'Клиенты и продажи', 'Система']);
  const card = (title: string) => hub.getByRole('region', { name: title, exact: true });
  await expect(card('Журнал').getByRole('link')).toHaveText(['Специалисты', 'График работы', 'Каталог услуг']);
  await expect(card('Клиенты и продажи').getByRole('link', { name: 'Бонусы', exact: true })).toHaveAttribute('href', '/beauty-settings#bonuses');
  // гостиничных экранов у салона нет
  await expect(hub.getByRole('link', { name: 'Каналы продаж', exact: true })).toHaveCount(0);
  await checkShots(page, 'salon');
  await card('Основные').getByRole('link', { name: 'Режим работы', exact: true }).click();
  await expect(page).toHaveURL(/\/beauty-settings#hours$/);
  await expect(page.getByRole('main').getByRole('link', { name: '← Все настройки', exact: true })).toHaveAttribute('href', '/settings');
  await expect(page.getByRole('heading', { name: 'Режим работы салона' })).toBeVisible();
  await expect(page.getByTestId('bonus-settings')).toBeVisible();
  await checkShots(page, 'salon-settings');
});

test('ресторан: те же карточки, режим работы и правила бронирования ведут в настройки ресторана', async ({ page, request }) => {
  await signIn(page, request);
  const food = { location: '48484848-4848-4848-8848-484848484848', business: '59595959-5959-4959-8959-595959595959' };
  expect(
    (
      await request.post(`${api}/branches`, {
        data: { id: food.location, name: 'Ресторан Хаб', newBusinessId: food.business, businessName: 'Ресторан Хаб', vertical: 'FOOD_SERVICE' },
      })
    ).ok(),
  ).toBeTruthy();
  await page.context().addCookies([
    { name: 'wetop_scope', value: encodeURIComponent(`business=${food.business};location=${food.location}`), domain: '127.0.0.1', path: '/' },
  ]);
  await page.goto('/settings');
  const hub = page.getByTestId('settings-hub');
  await expect(page.getByRole('heading', { level: 1, name: 'Настройки ресторана' })).toBeVisible({ timeout: 60_000 });
  await expect(hub.getByRole('heading', { level: 2 })).toHaveText(['Основные', 'Журнал', 'Клиенты и продажи', 'Система']);
  const card = (title: string) => hub.getByRole('region', { name: title, exact: true });
  await expect(card('Журнал').getByRole('link')).toHaveText(['Специалисты', 'График работы', 'Залы и столы', 'Правила бронирования', 'Каталог услуг']);
  await expect(hub.getByRole('link', { name: 'Номера', exact: true })).toHaveCount(0);
  await checkShots(page, 'restaurant');
  await card('Основные').getByRole('link', { name: 'Режим работы', exact: true }).click();
  await expect(page).toHaveURL(/\/restaurant-settings\?section=hours$/);
});
