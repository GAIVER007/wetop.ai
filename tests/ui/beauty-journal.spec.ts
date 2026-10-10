import AxeBuilder from '@axe-core/playwright';
import { FIXTURE_API, expect, test } from './fixtures';
import type { Page, APIRequestContext } from '@playwright/test';

/**
 * Журнал записей салона (DATA_MODEL §19.1, срез B5): день столбцами по мастерам, запись из пустой клетки,
 * занятость мастера словами, перенос и состояния. На телефоне тот же день списком.
 */
const SNAPSHOTS = 'reports/beauty-b5-2026-10-03';
// понедельник: в этот день у мастера стоит график
const DAY = '2026-10-12';

async function openSalon(page: Page, request: APIRequestContext) {
  await request.post(`${FIXTURE_API}/__test/reset`);
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/finance');

  await page.goto('/branches');
  const main = page.getByRole('main');
  await main.locator('summary').filter({ hasText: 'Добавить филиал' }).click();
  await main.getByRole('radio', { name: 'Салон красоты или студия' }).check();
  await main.getByLabel('Название филиала').fill('Студия Айна');
  await main.getByRole('button', { name: 'Добавить филиал', exact: true }).click();
  await expect(main.getByRole('status')).toContainText('Салон создан');
  await page.reload();
  await main
    .locator('.branches-grid section')
    .filter({ hasText: 'Студия Айна' })
    .getByRole('button', { name: 'Открыть салон', exact: true })
    .click();
  // MV8: открытый салон начинает с общего рабочего экрана дня
  await page.waitForURL('**/today');
  await page.goto('/calendar');
}

/** Салон, в котором уже можно записывать: услуга продаётся, мастер её умеет и работает в понедельник */
async function readySalon(page: Page, request: APIRequestContext) {
  await openSalon(page, request);

  await page.goto('/beauty/services');
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Добавить услугу', exact: true }).click();
  let panel = page.getByRole('dialog');
  await panel.getByLabel('Название').fill('Маникюр');
  await panel.getByLabel(/Длительность, минут/).fill('60');
  await panel.getByLabel(/Цена каталога, тиын/).fill('800000');
  await panel.getByRole('button', { name: 'Сохранить услугу', exact: true }).click();
  await expect(panel.getByRole('status')).toContainText('Услуга добавлена');
  await page.goto('/beauty/services');
  await main
    .getByRole('row')
    .filter({ hasText: 'Маникюр' })
    .getByRole('button', { name: 'Изменить' })
    .click();
  panel = page.getByRole('dialog');
  await panel.getByLabel('Филиал оказывает эту услугу').check();
  await panel.getByRole('button', { name: 'Сохранить для филиала', exact: true }).click();
  await expect(panel.getByRole('status')).toContainText('Настройки филиала сохранены');

  await page.goto('/beauty/masters');
  await main.getByRole('button', { name: 'Добавить мастера', exact: true }).click();
  panel = page.getByRole('dialog');
  await panel.getByLabel('Имя мастера').fill('Дина');
  await panel.getByRole('checkbox', { name: 'Маникюр' }).check();
  await panel.getByRole('button', { name: 'Сохранить мастера', exact: true }).click();
  await expect(panel.getByRole('status')).toContainText('Мастер добавлен');

  await page.goto('/beauty/schedule');
  await main.getByRole('button', { name: 'Изменить график', exact: true }).click();
  panel = page.getByRole('dialog');
  await panel
    .getByRole('group')
    .filter({ hasText: 'Понедельник' })
    .getByRole('button', { name: 'Сделать рабочим', exact: true })
    .click();
  await panel.getByLabel('Понедельник: начало').fill('09:00');
  await panel.getByLabel('Понедельник: конец').fill('18:00');
  await panel.getByRole('button', { name: 'Сохранить график', exact: true }).click();
  await expect(panel.getByRole('status')).toContainText('График сохранён');
}

async function openDay(page: Page) {
  await page.goto(`/beauty?date=${DAY}`);
  await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toHaveText('Календарь');
}

async function book(page: Page, time: string, name: string) {
  await page.getByRole('button', { name: `Дина, ${time}, свободно` }).click();
  const panel = page.getByRole('dialog');
  await panel.getByLabel('Услуга').selectOption({ label: 'Маникюр, 60 мин' });
  await panel.getByLabel('Имя клиента').fill(name);
  await panel.getByRole('button', { name: 'Записать', exact: true }).click();
  return panel;
}

test('запись из пустой клетки появляется в сетке и в списке дня', async ({ page, request }) => {
  await readySalon(page, request);
  await openDay(page);
  const main = page.getByRole('main');
  await expect(main.getByTestId('beauty-day-summary')).toContainText('Записей на этот день нет');

  await book(page, '10:00', 'Айгуль');
  await openDay(page);
  await expect(main.getByTestId('beauty-day-summary')).toContainText('Записей: 1');
  const tile = main.getByRole('button').filter({ hasText: 'Айгуль' }).first();
  await expect(tile).toContainText('10:00');
  await expect(tile).toContainText('Маникюр');
  await expect(main.getByTestId('beauty-grid')).toContainText('Айгуль');
  await page.screenshot({ path: `${SNAPSHOTS}/journal-1440.png`, fullPage: true });
});

test('занятое время мастера не предлагается и отказ приходит словами', async ({
  page,
  request,
}) => {
  await readySalon(page, request);
  await openDay(page);
  await book(page, '10:00', 'Айгуль');
  await openDay(page);
  // 10:30 внутри часа занятого маникюром: свободной клетки там уже нет
  await expect(page.getByRole('button', { name: 'Дина, 10:30, свободно' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Дина, 11:00, свободно' })).toHaveCount(1);
});

test('вне графика мастера клетки нерабочие', async ({ page, request }) => {
  await readySalon(page, request);
  await openDay(page);
  await expect(page.getByRole('button', { name: 'Дина, 08:00, свободно' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Дина, 09:00, свободно' })).toHaveCount(1);
});

test('состояния записи идут по жизни, из выполненной дороги нет', async ({ page, request }) => {
  await readySalon(page, request);
  await openDay(page);
  await book(page, '12:00', 'Сауле');
  await openDay(page);
  await page.getByRole('main').getByRole('button').filter({ hasText: 'Сауле' }).first().click();
  let card = page.getByRole('dialog');
  await expect(card.getByTestId('beauty-card-status')).toHaveText('Записан');
  await card.getByRole('button', { name: 'Подтвердить', exact: true }).click();

  await openDay(page);
  await page.getByRole('main').getByRole('button').filter({ hasText: 'Сауле' }).first().click();
  card = page.getByRole('dialog');
  await expect(card.getByTestId('beauty-card-status')).toHaveText('Подтверждена');
  await card.getByRole('button', { name: 'Завершить', exact: true }).click();

  await openDay(page);
  await page.getByRole('main').getByRole('button').filter({ hasText: 'Сауле' }).first().click();
  card = page.getByRole('dialog');
  await expect(card.getByTestId('beauty-card-status')).toHaveText('Завершена');
  await expect(card.getByRole('button', { name: 'Отменить запись', exact: true })).toHaveCount(0);
  await page.screenshot({ path: `${SNAPSHOTS}/card-1440.png`, fullPage: true });
});

test('отмена спрашивает и освобождает время мастера', async ({ page, request }) => {
  await readySalon(page, request);
  await openDay(page);
  await book(page, '13:00', 'Жанна');
  await openDay(page);
  await page.getByRole('main').getByRole('button').filter({ hasText: 'Жанна' }).first().click();
  const card = page.getByRole('dialog');
  await card.getByRole('button', { name: 'Отменить запись', exact: true }).click();
  // окно вопроса живёт внутри панели, поэтому берём его по своему признаку, а не по роли dialog
  const ask = page.getByTestId('confirm-dialog');
  await expect(ask).toContainText('Отменить запись: Жанна');
  await expect(ask).toContainText('Время мастера освободится');
  await ask.getByRole('button', { name: 'Отменить запись', exact: true }).click();

  await openDay(page);
  await expect(page.getByRole('main').getByTestId('beauty-day-summary')).toContainText(
    'Записей на этот день нет',
  );
  // время снова свободно
  await expect(page.getByRole('button', { name: 'Дина, 13:00, свободно' })).toHaveCount(1);
});

test('перенос меняет время записи', async ({ page, request }) => {
  await readySalon(page, request);
  await openDay(page);
  await book(page, '10:00', 'Айгуль');
  await openDay(page);
  await page.getByRole('main').getByRole('button').filter({ hasText: 'Айгуль' }).first().click();
  const card = page.getByRole('dialog');
  await card.getByTestId('beauty-move-start').fill(`${DAY}T15:00`);
  await card.getByRole('button', { name: 'Перенести', exact: true }).click();

  await openDay(page);
  await expect(
    page.getByRole('main').getByRole('button').filter({ hasText: 'Айгуль' }).first(),
  ).toContainText('15:00');
});

test('журнал на телефоне: день списком, без прокрутки вбок', async ({ page, request }) => {
  await readySalon(page, request);
  await openDay(page);
  await book(page, '10:00', 'Айгуль');
  await page.setViewportSize({ width: 390, height: 844 });
  await openDay(page);
  // именно видно, а не «есть в разметке»: скрытый список тоже содержал бы текст
  await expect(page.getByTestId('beauty-mobile-calendar')).toBeVisible();
  await expect(page.getByTestId('beauty-mobile-calendar')).toContainText('Айгуль');
  await expect(page.getByTestId('beauty-grid')).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `${SNAPSHOTS}/journal-390.png`, fullPage: true });
});

for (const theme of ['light', 'dark'] as const) {
  test(`журнал доступен в ${theme === 'light' ? 'светлой' : 'тёмной'} теме`, async ({
    page,
    request,
  }) => {
    await readySalon(page, request);
    await openDay(page);
    await book(page, '10:00', 'Айгуль');
    await page.emulateMedia({ colorScheme: theme });
    await openDay(page);
    const audit = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(audit.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    await page.screenshot({ path: `${SNAPSHOTS}/journal-${theme}.png`, fullPage: true });
  });
}
