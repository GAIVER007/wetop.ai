import AxeBuilder from '@axe-core/playwright';
import { FIXTURE_API, expect, test } from './fixtures';
import type { Page, APIRequestContext } from '@playwright/test';

/**
 * «Клиенты» салона по макету ТЗ (09.10.2026): визиты, последний визит и средний чек по завершённым
 * записям, производные сегменты «Новый» и «Постоянный» (Q-BS-3: порог два визита, VIP не выдумывается),
 * поиск и отбор. Деньги это снимки цен записей (Q-252), курсов и новых таблиц нет.
 */
const DAY = '2026-10-12';

async function openSalon(page: Page, request: APIRequestContext) {
  await request.post(`${FIXTURE_API}/__test/reset`);
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
  await page.goto('/branches');
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Добавить', exact: true }).click();
  const creation = page.getByRole('dialog', { name: 'Добавить бизнес или филиал' });
  await creation.getByLabel('Новый бизнес или бренд').check();
  await creation.getByRole('radio', { name: 'Салон красоты или студия' }).check();
  await creation.getByLabel('Название бизнеса', { exact: true }).fill('Студия Айна');
  await creation.getByRole('button', { name: 'Создать бизнес', exact: true }).click();
  await expect(creation.getByRole('status')).toContainText('Салон создан');
  await page.reload();
  await main.getByRole('button', { name: 'Открыть объект: Студия Айна', exact: true }).click();
  // MV8: открытый салон начинает с общего рабочего экрана дня
  await page.waitForURL('**/today');
  await page.goto('/calendar');
}

/** Услуга продаётся, мастер работает в понедельник: как readySalon журнального спека */
/** Назначает специалисту услугу через API стенда с той же сессией и областью, что у страницы */
async function assignService(page: Page, employeeId: string, name: string) {
  const cookies = await page.context().cookies();
  const scope = decodeURIComponent(cookies.find((c) => c.name === 'wetop_scope')!.value);
  const session = cookies.find((c) => c.name === 'wetop_session')!.value;
  const headers = { 'x-wetop-test-client': '1', 'x-wetop-scope': scope, 'x-wetop-session': session };
  const catalog = await page.request.get(`${FIXTURE_API}/beauty/services`, { headers });
  expect(catalog.status()).toBe(200);
  const service = ((await catalog.json()) as { items: Array<{ id: string; name: string }> }).items.find(
    (item) => item.name === name,
  )!;
  const assigned = await page.request.put(`${FIXTURE_API}/beauty/employees/${employeeId}/services`, {
    headers,
    data: { serviceIds: [service.id] },
  });
  expect(assigned.status()).toBe(200);
}

async function readySalon(page: Page, request: APIRequestContext) {
  await openSalon(page, request);
  await page.goto('/beauty/services');
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Добавить услугу', exact: true }).click();
  let panel = page.getByRole('dialog');
  await panel.getByLabel('Название').fill('Маникюр');
  await panel.getByLabel(/Длительность, минут/).fill('60');
  await panel.getByLabel(/Цена каталога/).fill('8000');
  await panel.getByRole('button', { name: 'Сохранить услугу', exact: true }).click();
  await expect(panel.getByRole('status')).toHaveText('Услуга создана. Включите её в выбранном филиале ниже.');
  await page.goto('/beauty/services');
  // услуги салона показаны карточками каталога, не строками таблицы
  await main
    .locator('[data-service-list="catalog"] .beauty-service-item')
    .filter({ has: page.getByText('Маникюр', { exact: true }) })
    .getByRole('button', { name: 'Изменить' })
    .click();
  panel = page.getByRole('dialog');
  await panel.getByLabel('Филиал оказывает эту услугу').check();
  await panel.getByRole('button', { name: 'Сохранить для филиала', exact: true }).click();
  await expect(panel.getByRole('status')).toContainText('Настройки филиала сохранены');
  await page.goto('/beauty/masters');
  await main.getByRole('button', { name: 'Добавить специалиста', exact: true }).click();
  panel = page.getByRole('dialog');
  await panel.getByLabel('Имя мастера').fill('Дина');
  await panel.getByRole('button', {name:'Создать мастера',exact:true}).click();
  // после создания открывается профиль специалиста; кабинета в подставном API нет, услуга назначается запросом
  await expect(page).toHaveURL(/\/employees\/[0-9a-f-]+\/profile$/);
  await assignService(page, page.url().split('/').at(-2)!, 'Маникюр');
  await page.goto('/beauty/schedule');
  await main.getByRole('button', { name: 'Дина', exact: true }).click();
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
  await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toHaveText('Журнал');
}

async function book(page: Page, time: string, name: string, existing = false) {
  await page.getByRole('button', { name: `Дина, ${time}, свободно` }).click();
  const panel = page.getByRole('dialog');
  await panel.getByLabel('Услуга').selectOption({ label: 'Маникюр, 60 мин' });
  if (existing) await panel.getByLabel('Клиент', { exact: true }).selectOption({ label: name });
  else await panel.getByLabel('Имя клиента').fill(name);
  await panel.getByRole('button', { name: 'Записать', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

async function complete(page: Page, name: string, time: string) {
  await openDay(page);
  await page.getByRole('main').getByRole('button').filter({ hasText: name }).filter({ hasText: time }).first().click();
  const card = page.getByRole('dialog');
  await card.getByRole('button', { name: 'Завершить', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

/** Два завершённых визита Айгуль, одна только запись Сауле: сегменты, визиты, чек и последний визит */
async function seededCustomers(page: Page, request: APIRequestContext) {
  await readySalon(page, request);
  await openDay(page);
  await book(page, '10:00', 'Айгуль');
  await complete(page, 'Айгуль', '10:00');
  await openDay(page);
  await book(page, '12:00', 'Айгуль', true);
  await complete(page, 'Айгуль', '12:00');
  await openDay(page);
  await book(page, '14:00', 'Сауле');
}

test('клиенты по макету: визиты, средний чек, последний визит и сегменты по DONE', async ({
  page,
  request,
}) => {
  await seededCustomers(page, request);
  await page.goto('/customers');
  const main = page.getByRole('main');
  const aigul = main.getByRole('row').filter({ hasText: 'Айгуль' });
  await expect(aigul).toContainText('Постоянный');
  await expect(aigul).toContainText('2');
  await expect(aigul).toContainText('8 000');
  await expect(aigul.locator('time')).toHaveAttribute('datetime', DAY);
  const saule = main.getByRole('row').filter({ hasText: 'Сауле' });
  await expect(saule).toContainText('Новый');
  await expect(saule).toContainText('Визитов не было');
  await expect(saule).toContainText('Нет данных');
});

test('поиск и сегмент отбирают строки, итог говорит сколько показано', async ({
  page,
  request,
}) => {
  await seededCustomers(page, request);
  await page.goto('/customers');
  const main = page.getByRole('main');
  await main.getByLabel('Поиск по имени или телефону').fill('Сау');
  await expect(main.getByRole('row').filter({ hasText: 'Айгуль' })).toHaveCount(0);
  await expect(main.getByRole('row').filter({ hasText: 'Сауле' })).toHaveCount(1);
  await expect(main.getByRole('status')).toContainText('Показано 1 из 2');
  await main.getByLabel('Поиск по имени или телефону').fill('');
  await main.getByLabel('Сегмент').selectOption({ label: 'Постоянные' });
  await expect(main.getByRole('row').filter({ hasText: 'Сауле' })).toHaveCount(0);
  await expect(main.getByRole('row').filter({ hasText: 'Айгуль' })).toHaveCount(1);
  await main.getByLabel('Сегмент').selectOption({ label: 'Новые' });
  await expect(main.getByRole('row').filter({ hasText: 'Айгуль' })).toHaveCount(0);
  await expect(main.getByRole('row').filter({ hasText: 'Сауле' })).toHaveCount(1);
  // пустой отбор говорит словами, а не пустой таблицей
  await main.getByLabel('Поиск по имени или телефону').fill('Нет такого');
  await expect(main.getByText('Никого не нашли')).toBeVisible();
});

test('клиенты на телефоне: без прокрутки вбок', async ({ page, request }) => {
  await seededCustomers(page, request);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/customers');
  await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const theme of ['light', 'dark'] as const) {
  test(`клиенты доступны в ${theme === 'light' ? 'светлой' : 'тёмной'} теме`, async ({
    page,
    request,
  }) => {
    await seededCustomers(page, request);
    await page.emulateMedia({ colorScheme: theme });
    await page.goto('/customers');
    await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible();
    const audit = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(audit.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });
}
