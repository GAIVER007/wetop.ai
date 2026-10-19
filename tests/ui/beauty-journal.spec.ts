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

/** Салон, в котором уже можно записывать: услуга продаётся, мастер её умеет и работает в понедельник */
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
  await expect(panel.getByRole('status')).toHaveText(
    'Услуга создана. Включите её в выбранном филиале ниже.',
  );
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
  await panel.getByRole('button', { name: 'Создать мастера', exact: true }).click();
  await panel.getByRole('tab', { name: 'Услуги', exact: true }).click();
  await panel.getByRole('checkbox', { name: 'Маникюр' }).check();
  await panel.getByRole('button', { name: 'Сохранить услуги', exact: true }).click();
  await expect(panel.getByRole('status')).toContainText('Услуги назначены');

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

test('неделя показывает запись и открывает её карточку, телефон без прокрутки вбок', async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  await readySalon(page, request);
  await openDay(page);
  await book(page, '10:00', 'Тестовый клиент недели');
  await page.goto(`/calendar?date=${DAY}&view=week`);
  const week = page.getByTestId('beauty-week');
  await expect(week).toBeVisible();
  await expect(week.getByRole('link', { name: 'Открыть день', exact: true })).toHaveCount(7);
  await page.screenshot({
    path: 'reports/beauty-continuation-2026-10-14/week-1440.png',
    fullPage: true,
  });
  await week.getByRole('link').filter({ hasText: 'Тестовый клиент недели' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('Тестовый клиент недели');
  await page.goto(`/calendar?date=${DAY}&view=week`);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(week).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: 'reports/beauty-continuation-2026-10-14/week-390.png',
    fullPage: true,
  });
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(`/calendar?date=${DAY}&view=week`);
  await expect(week).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: 'reports/beauty-continuation-2026-10-14/week-dark-390.png',
    fullPage: true,
  });
});

test('перенос мышью меняет время записи через существующий API', async ({ page, request }) => {
  test.setTimeout(240_000);
  await readySalon(page, request);
  await openDay(page);
  await book(page, '10:00', 'Тестовый перенос');
  await openDay(page);
  const tile = page
    .getByTestId('beauty-grid')
    .getByRole('button')
    .filter({ hasText: 'Тестовый перенос' });
  await expect(tile).toHaveAttribute('draggable', 'true');
  await tile.dragTo(page.getByRole('button', { name: 'Дина, 12:00, свободно', exact: true }));
  await expect(tile).toContainText('12:00');
  await expect(
    page.getByRole('button', { name: 'Дина, 10:00, свободно', exact: true }),
  ).toBeVisible();
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

test('M6-A: будущий визит объясняет запрет неявки на desktop, телефоне и планшете', async ({
  page,
  request,
}) => {
  test.setTimeout(180_000);
  await readySalon(page, request);
  const date = new Date();
  do date.setUTCDate(date.getUTCDate() + 1);
  while (date.getUTCDay() !== 1);
  const futureDay = date.toISOString().slice(0, 10);
  await page.goto(`/beauty?date=${futureDay}`);
  await book(page, '12:00', 'Тестовый клиент M6');
  await page.goto(`/beauty?date=${futureDay}`);
  await page
    .getByRole('main')
    .getByRole('button')
    .filter({ hasText: 'Тестовый клиент M6' })
    .first()
    .click();
  const card = page.getByRole('dialog');
  for (const width of [1440, 375, 768]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate((dark) => {
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    }, width === 375);
    await expect(
      card.getByText('Не пришёл: Можно после начала визита', { exact: true }),
    ).toBeVisible();
    await expect(card.getByRole('button', { name: 'Не пришёл', exact: true })).toHaveCount(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    const accessibility = await new AxeBuilder({ page })
      .include('dialog, [role="dialog"]')
      .analyze();
    expect(accessibility.violations).toEqual([]);
    await page.screenshot({
      path: `reports/salons-m6a-2026-10-18/card-${width}.png`,
      fullPage: true,
    });
  }
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
  await expect(ask).toContainText('Время специалиста освободится');
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

test('быстрый отчёт календаря: пустой день, календарь месяца, темы и телефон', async ({
  page,
  request,
}) => {
  test.setTimeout(360_000);
  await openSalon(page, request);
  await openDay(page);
  const trigger = page.getByRole('button', { name: 'Быстрый отчёт', exact: true });
  await expect(trigger).toBeVisible();
  await page.getByRole('button', { name: 'Открыть календарь', exact: true }).click();
  const calendar = page.getByRole('dialog', { name: 'Календарь', exact: true });
  await expect(calendar).toBeVisible();
  await calendar.getByRole('button', { name: 'Следующий месяц' }).click();
  await calendar.getByRole('button', { name: 'Предыдущий месяц' }).click();
  await page.keyboard.press('Escape');
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      await trigger.click();
      const report = page.getByRole('dialog', { name: /Статистика за/ });
      await expect(report).toContainText('Все специалисты');
      await expect(report.getByRole('status')).toContainText('записей нет');
      await expect(report).toContainText('Средний чек');
      await expect(report).toContainText('Оплата наличными');
      await expect(report).toContainText('Оплата безналом');
      await expect(report.getByRole('region', { name: 'Лояльность' })).toContainText('Нет данных');
      await expect(report.getByRole('region', { name: 'WETOP' })).toContainText('Нет данных');
      await expect(report).not.toContainText('Zapis');
      await expect(report).toContainText('Сертификат от WETOP');
      await expect(report).toContainText('Подарочная карта от WETOP');
      await expect(report).not.toContainText('0 ₸');
      const countsBox = await report.locator('.quick-report-counts').first().boundingBox();
      const headingBox = await report.locator('.overlay-heading').boundingBox();
      expect(countsBox!.y).toBeGreaterThanOrEqual(headingBox!.y + headingBox!.height);
      const box = await report.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      await page.screenshot({
        path: `reports/calendar-quick-report-2026-10-17/beauty-${width}-${colorScheme}.png`,
        fullPage: false,
      });
      await expect(report.getByRole('button', { name: /Закрыть/ })).toBeFocused();
      await page.keyboard.press('Shift+Tab');
      await expect(report.locator('.reference-info summary').last()).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(report.locator('.reference-info').last()).toContainText(
        'Источник этого показателя',
      );
      await page.keyboard.press('Enter');
      await page.keyboard.press('Tab');
      await expect(report.getByRole('button', { name: /Закрыть/ })).toBeFocused();
      const axe = await new AxeBuilder({ page }).include('.quick-report').analyze();
      expect(axe.violations).toEqual([]);
      await page.keyboard.press('Escape');
      await expect(report).not.toBeVisible();
      await expect(trigger).toBeFocused();
    }
  }
});

test('быстрый отчёт календаря: выбранный мастер сохраняется при смене дня', async ({
  page,
  request,
}) => {
  test.setTimeout(240_000);
  await openSalon(page, request);
  const scope = (await page.context().cookies()).find((c) => c.name === 'wetop_scope')!.value;
  const headers = { 'x-wetop-scope': decodeURIComponent(scope), 'x-wetop-test-client': '1' };
  const create = async (path: string, data: unknown) => {
    const response = await request.post(`${FIXTURE_API}${path}`, { headers, data });
    expect(response.ok()).toBeTruthy();
    return response.json();
  };
  const service = await create('/beauty/services', {
    name: 'Маникюр',
    durationMinutes: 60,
    priceMinor: '800000',
    currency: 'KZT',
  });
  expect(
    (
      await request.put(`${FIXTURE_API}/beauty/services/${service.id}/location`, {
        headers,
        data: { enabled: true },
      })
    ).ok(),
  ).toBeTruthy();
  for (const name of ['Дина', 'Мира']) {
    const employee = await create('/beauty/employees', { name });
    expect(
      (
        await request.put(`${FIXTURE_API}/beauty/employees/${employee.id}/services`, {
          headers,
          data: { serviceIds: [service.id] },
        })
      ).ok(),
    ).toBeTruthy();
    expect(
      (
        await request.put(`${FIXTURE_API}/beauty/employees/${employee.id}/working-hours`, {
          headers,
          data: { intervals: [{ weekday: 1, timeFrom: '09:00', timeTo: '18:00' }] },
        })
      ).ok(),
    ).toBeTruthy();
  }
  await openDay(page);
  await book(page, '10:00', 'Тестовый клиент');
  await openDay(page);
  await page
    .getByRole('main')
    .getByRole('button')
    .filter({ hasText: 'Тестовый клиент' })
    .first()
    .click();
  await page.getByRole('dialog').getByRole('button', { name: 'Подтвердить', exact: true }).click();
  await openDay(page);
  await page
    .getByRole('main')
    .getByRole('button')
    .filter({ hasText: 'Тестовый клиент' })
    .first()
    .click();
  await page.getByRole('dialog').getByRole('button', { name: 'Завершить', exact: true }).click();
  await openDay(page);
  await page.locator('.employee-filter summary').click();
  await page.getByRole('searchbox', { name: 'Поиск специалиста' }).fill('Дин');
  await page
    .locator('.employee-filter-list')
    .getByRole('button', { name: 'Дина', exact: true })
    .click();
  await expect(page).toHaveURL(/employee=/);
  await expect(page.getByTestId('beauty-grid').getByRole('heading', { name: /Мира/ })).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: 'Быстрый отчёт', exact: true }).click();
  let report = page.getByRole('dialog', { name: /Статистика за/ });
  await expect(report).toContainText('Дина');
  await expect(report).toContainText('8 000 ₸');
  await expect(report).toContainText('Оплата наличными');
  await expect(report).toContainText('Оплата безналом');
  await expect(report).not.toContainText('Стоимость всех записей');
  await expect(report).toContainText('Скидка (сумма)');
  await expect(report.locator('.quick-report-counts').first()).toContainText('Клиентов1');
  await page.screenshot({
    path: 'reports/calendar-quick-report-2026-10-17/beauty-master.png',
    fullPage: false,
  });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Следующий день', exact: true }).click();
  await expect(page.getByTestId('beauty-day-date')).toHaveValue('2026-10-13');
  await expect(page.locator('.employee-filter summary')).toContainText('Дина');
  await page.getByRole('button', { name: 'Быстрый отчёт', exact: true }).click();
  report = page.getByRole('dialog', { name: /Статистика за/ });
  await expect(report.getByRole('status')).toContainText('записей нет');
  await page.keyboard.press('Escape');
  await page.locator('.employee-filter summary').click();
  await page
    .locator('.employee-filter-list')
    .getByRole('button', { name: 'Все специалисты', exact: true })
    .click();
  await expect(page).not.toHaveURL(/employee=/);
  await expect(
    page.getByTestId('beauty-grid').getByRole('heading', { name: /Мира/ }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Неделя', exact: true }).click();
  await expect(page.getByTestId('beauty-week')).toBeVisible();
  await page.getByRole('button', { name: 'Быстрый отчёт', exact: true }).click();
  await expect(page.getByRole('dialog', { name: /Статистика за/ })).toContainText('Выбранный день');
});
