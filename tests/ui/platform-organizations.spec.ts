import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { FIXTURE_API, expect, test } from './fixtures';

/**
 * «Платформа → Организации и филиалы» (план organizations-page-2026-10-09): плитки, направления, карточки и список,
 * окно «Создать организацию» из трёх шагов без пробного периода и без черновиков. Стенд (`scripts/preview/fixture-api.ts`)
 * отвечает теми же формами, что API; цифры вымышленные (ADR-010).
 */
const SHOTS = 'reports/platform-organizations-2026-10-09';

test.beforeEach(async ({ request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
});

async function signInAsPlatformAdmin(page: Page, request: import('@playwright/test').APIRequestContext) {
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
  await request.post(`${FIXTURE_API}/__test/control`, { data: { platformAdmin: true } });
}

const axe = (page: Page) =>
  new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();

test('без отметки главного администратора раздел говорит, чей он, и ничего не показывает', async ({ page }) => {
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
  await page.goto('/platform');
  await expect(page.getByTestId('platform-forbidden')).toContainText('главного администратора');
  await expect(page.getByTestId('platform-totals')).toHaveCount(0);
  await expect(page.getByTestId('platform-organization-cards')).toHaveCount(0);
});

test('обзор: итоги, вкладки направлений, карточки с филиалами, виджеты; слова «пробный» нет нигде', async ({
  page,
  request,
}) => {
  await signInAsPlatformAdmin(page, request);
  await page.goto('/platform');
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { level: 1, name: 'Организации и филиалы' })).toBeVisible();

  const totals = page.getByTestId('platform-totals');
  await expect(totals).toContainText('Организаций');
  await expect(totals).toContainText('Филиалов');
  await expect(totals).toContainText('Бизнесов');
  await expect(totals).toContainText('Доход');
  // деньги разных валют не складываются; у ресторана дохода в системе нет, и экран говорит об этом словами
  await expect(totals).toContainText('У ресторанов дохода в системе нет');

  const tabs = main.getByRole('navigation', { name: 'Направления' });
  await expect(tabs.getByRole('link', { name: /^Все/ })).toContainText('4');
  await expect(tabs.getByRole('link', { name: /^Отели/ })).toContainText('2');
  await expect(tabs.getByRole('link', { name: /^Салоны красоты/ })).toContainText('1');
  await expect(tabs.getByRole('link', { name: /^Рестораны/ })).toContainText('1');

  const cards = page.getByTestId('platform-organization-card');
  await expect(cards).toHaveCount(4);
  const salon = cards.filter({ hasText: 'Салон «Пример»' });
  await expect(salon).toContainText('Салон красоты');
  await expect(salon).toContainText('1240 клиентов');
  const food = cards.filter({ hasText: 'Ресторан «Пример»' });
  // ресторан: гости есть, денег нет, и это сказано, а не нарисовано нулём
  await expect(food).toContainText('640');
  await expect(food).toContainText('нет данных');
  const hotel = cards.filter({ hasText: 'Хостел «Пример»' });
  await expect(hotel).toContainText('35%');

  await expect(page.getByTestId('platform-dynamics')).toBeVisible();
  await expect(page.getByTestId('platform-distribution')).toContainText('по доходу, KZT');
  await expect(page.getByTestId('platform-activity')).toContainText('Новый филиал');
  await expect(page.getByTestId('platform-activity')).toContainText('назад');

  expect(await main.innerText()).not.toMatch(/пробн|trial/i);
  await page.screenshot({ path: `${SHOTS}/list-cards.png`, fullPage: true });
  const result = await axe(page);
  expect(result.violations.map((v) => ({ id: v.id, nodes: v.nodes.slice(0, 3).map((n) => n.target) }))).toEqual([]);
});

test('направление, поиск, порядок и вид живут в адресе и переживают перезагрузку', async ({ page, request }) => {
  await signInAsPlatformAdmin(page, request);
  await page.goto('/platform');
  const main = page.getByRole('main');
  await main.getByRole('navigation', { name: 'Направления' }).getByRole('link', { name: /^Салоны красоты/ }).click();
  await expect(page).toHaveURL(/vertical=BEAUTY/);
  await expect(page.getByTestId('platform-organization-card')).toHaveCount(1);
  await page.reload();
  await expect(page.getByTestId('platform-organization-card')).toHaveCount(1);

  await main.getByRole('navigation', { name: 'Вид' }).getByRole('link', { name: 'Список' }).click();
  await expect(page).toHaveURL(/view=list/);
  await expect(page.getByTestId('platform-organizations').first()).toBeVisible();

  await page.goto('/platform');
  await main.getByRole('searchbox', { name: /Поиск по организациям/ }).fill('нет такого названия');
  await main.getByRole('button', { name: 'Найти' }).click();
  await expect(main.getByText('Ничего не найдено')).toBeVisible();
  await expect(page.getByTestId('platform-organization-card')).toHaveCount(0);

  await page.goto('/platform?sort=name');
  const names = await page.getByTestId('platform-organization-card').locator('h2').allTextContents();
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'ru')));
});

test('«Экспорт» отдаёт CSV с филиалами и без почт владельцев', async ({ page, request }) => {
  await signInAsPlatformAdmin(page, request);
  await page.goto('/platform');
  const href = await page.getByTestId('platform-export').getAttribute('href');
  expect(href).toBe('/platform/export');
  const res = await page.request.get('/platform/export');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('text/csv');
  const body = await res.text();
  expect(body).toContain('Ресторан «Пример»');
  expect(body).not.toContain('owner@example.com');
});

test('создать организацию: три шага, ошибки у полей, сохранение сразу, организация видна на странице', async ({
  page,
  request,
}) => {
  await signInAsPlatformAdmin(page, request);
  await page.goto('/platform');
  await page.getByTestId('create-organization-open').click();
  const dialog = page.getByRole('dialog', { name: 'Создать организацию' });
  await expect(dialog).toBeVisible();
  // слов про пробный период и черновик в окне нет
  expect(await dialog.innerText()).not.toMatch(/пробн|trial|черновик/i);

  // первый шаг: пустая форма не пускает дальше и называет поля
  await dialog.getByRole('button', { name: /Продолжить/ }).click();
  await expect(dialog.getByText('Название организации: от 1 до 200 знаков')).toBeVisible();
  await expect(dialog.getByText(/Почта владельца: на неё откроется доступ/)).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/create-errors.png` });

  await dialog.getByLabel('Название организации').fill('Луна Групп');
  await dialog.getByLabel('Бренд / публичное название').fill('Луна');
  await dialog.getByText('Салон красоты', { exact: true }).click();
  await dialog.getByLabel('Владелец, имя').fill('Вера Образцова');
  await dialog.getByLabel('Номер телефона').fill('700 123 45 67');
  await dialog.getByLabel('Почта владельца').fill('Vera@Example.invalid');
  await dialog.getByLabel('Город').selectOption('Астана');
  await expect(dialog.getByLabel('Валюта')).toHaveValue('KZT');
  await page.screenshot({ path: `${SHOTS}/create-step-1.png` });
  await dialog.getByRole('button', { name: /Продолжить/ }).click();

  // второй шаг: филиал, по умолчанию названный брендом
  await expect(dialog.getByLabel('Название филиала')).toHaveAttribute('placeholder', 'Луна');
  await dialog.getByLabel('Название филиала').fill('Луна Центр');
  await dialog.getByLabel('Адрес').fill('Астана, пр. Образцовый, 7');
  await page.screenshot({ path: `${SHOTS}/create-step-2.png` });
  await dialog.getByRole('button', { name: /Продолжить/ }).click();

  // третий шаг: проверка и создание
  await expect(dialog).toContainText('vera@example.invalid');
  await expect(dialog).toContainText('Луна Центр');
  await page.screenshot({ path: `${SHOTS}/create-step-3.png` });
  await dialog.getByTestId('create-organization-submit').click();
  await expect(page.getByTestId('create-organization-done')).toContainText('Организация создана');
  await expect(page.getByTestId('create-organization-done')).toContainText('vera@example.invalid');
  await page.screenshot({ path: `${SHOTS}/create-done.png` });
  await page.getByRole('button', { name: 'Готово' }).click();

  // сохранено на сервере: после перезагрузки организация и её филиал на месте
  await page.reload();
  const card = page.getByTestId('platform-organization-card').filter({ hasText: 'Луна Групп' });
  await expect(card).toContainText('Салон красоты');
  await expect(card).toContainText('Луна Центр');
  await expect(card).toContainText('работает');
  await expect(page.getByTestId('platform-activity')).toContainText('Новая организация');
});

test('создать организацию: слова API при занятом названии, введённое остаётся на месте', async ({ page, request }) => {
  await signInAsPlatformAdmin(page, request);
  await page.goto('/platform');
  await page.getByTestId('create-organization-open').click();
  const dialog = page.getByRole('dialog', { name: 'Создать организацию' });
  await dialog.getByLabel('Название организации').fill('Хостел «Пример»');
  await dialog.getByLabel('Бренд / публичное название').fill('Хостел');
  await dialog.getByLabel('Владелец, имя').fill('Иван Образцов');
  await dialog.getByLabel('Номер телефона').fill('700 111 22 33');
  await dialog.getByLabel('Почта владельца').fill('ivan@example.invalid');
  await dialog.getByRole('button', { name: /Продолжить/ }).click();
  await dialog.getByRole('button', { name: /Продолжить/ }).click();
  await dialog.getByTestId('create-organization-submit').click();
  await expect(dialog.getByRole('alert')).toContainText('Организация с таким названием уже есть');
  await dialog.getByRole('button', { name: 'Назад' }).click();
  await dialog.getByRole('button', { name: 'Назад' }).click();
  await expect(dialog.getByLabel('Название организации')).toHaveValue('Хостел «Пример»');
});

test('телефон 390 px: страница и окно без горизонтальной прокрутки', async ({ page, request }) => {
  await signInAsPlatformAdmin(page, request);
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/platform');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `${SHOTS}/mobile.png`, fullPage: true });
  await page.getByTestId('create-organization-open').click();
  const dialog = page.getByRole('dialog', { name: 'Создать организацию' });
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `${SHOTS}/mobile-create.png` });
});
