import AxeBuilder from '@axe-core/playwright';
import { FIXTURE_API, expect, test } from './fixtures';
import type { Page, APIRequestContext } from '@playwright/test';

/**
 * Каталог салона в стойке (DATA_MODEL §19.1, срез B3, ADR-141): услуги сети с ценой филиала и мастера с
 * умениями. Проверяется то, за чем приходит человек: услуга появляется, филиал ставит свою цену, мастер
 * получает умения, а снятая галочка снимается.
 */
const SNAPSHOTS = 'reports/beauty-b3-2026-10-03';

test('M4-B1: CSV проверяется локально, колонки меняются, клиенты не создаются', async ({ page, request }) => {
  test.setTimeout(180_000);
  await openSalon(page, request);
  // Решение владельца 19.10.2026: администратор видит проверку файла без записи, сам импорт и отмена только у владельца.
  await request.post(`${FIXTURE_API}/__test/control`, { data: { role: 'STAFF' } });
  await page.goto('/customers');
  const main = page.getByRole('main');
  const before = await main.getByRole('row').count();
  await main.getByRole('button', { name: 'Импортировать клиентов', exact: true }).click();
  const panel = page.getByRole('dialog', { name: 'Импортировать клиентов' });
  const writes: string[] = [];
  page.on('request', (req) => { if (req.method() === 'POST') writes.push(req.url()); });
  const csv = 'Имя;Телефон\r\nПервый тест;87000001001\r\nПовтор тест;+7 (700) 000-10-01\r\nБез номера;\r\nОшибка тест;abc';
  await panel.getByLabel('Файл с клиентами: CSV или Excel').setInputFiles({ name: 'synthetic.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await expect(panel.getByLabel('Колонка имени')).toHaveValue('0');
  await expect(panel.getByLabel('Колонка телефона')).toHaveValue('1');
  await panel.getByRole('button', { name: 'Проверить строки', exact: true }).click();
  await expect(panel.getByRole('heading', { name: 'Готовы: 1', exact: true })).toBeVisible();
  await expect(panel.getByRole('heading', { name: 'Повторы в файле: 1', exact: true })).toBeVisible();
  await expect(panel.getByRole('heading', { name: 'С замечаниями: 1', exact: true })).toBeVisible();
  await expect(panel.getByRole('heading', { name: 'Пропустим: 1', exact: true })).toBeVisible();
  await expect(panel.getByText('Проверка завершена. Данные ещё не импортированы.', { exact: true })).toBeVisible();
  await expect(panel.getByRole('link', { name: 'Скачать шаблон CSV' })).toHaveAttribute('download', 'wetop-customers-template.csv');
  // записи у администратора нет: ни надёжного импорта, ни отмены
  await expect(panel.getByRole('button', { name: /^Импортировать \d+ строк$/ })).toHaveCount(0);
  await expect(panel.getByRole('button', { name: 'Отменить импорт', exact: true })).toHaveCount(0);
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate((dark) => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; }, width === 375);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const headingBox = await panel.getByRole('heading', { name: 'Проверка завершена. Данные ещё не импортированы.', exact: true }).boundingBox();
    const titleBox = await panel.locator('.overlay-heading').boundingBox();
    expect(headingBox!.y).toBeGreaterThanOrEqual(titleBox!.y + titleBox!.height);
    expect((await new AxeBuilder({ page }).include('dialog, [role="dialog"]').analyze()).violations).toEqual([]);
    await page.screenshot({ path: `reports/salons-m4b-2026-10-18/preview-${width}.png`, fullPage: true });
  }
  await panel.getByLabel('Колонка телефона').selectOption('0');
  await expect(panel.getByText('Проверка завершена. Данные ещё не импортированы.', { exact: true })).not.toBeVisible();
  await panel.getByRole('button', { name: 'Проверить строки', exact: true }).click();
  await expect(panel.getByRole('alert')).toContainText('дважды');
  await expect(panel.getByRole('alert')).toBeFocused();
  await panel.getByLabel('Файл с клиентами: CSV или Excel').setInputFiles({ name: 'wrong.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from('synthetic') });
  await expect(panel.getByRole('alert')).toContainText('не является Excel');
  await expect(panel.getByRole('button', { name: 'Проверить строки', exact: true })).not.toBeVisible();
  expect(writes).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(panel).not.toBeVisible();
  await expect(main.getByRole('row')).toHaveCount(before);
  await page.reload();
  await expect(main.getByRole('row').filter({ hasText: 'Первый тест' })).toHaveCount(0);
});

test('M4-A: клиент без записи, повтор номера и сохранение ввода при ошибке', async ({ page, request }) => {
  test.setTimeout(180_000);
  await openSalon(page, request);
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto('/customers');
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Добавить клиента', exact: true }).click();
  let panel = page.getByRole('dialog', { name: 'Добавить клиента' });
  await panel.getByLabel('Имя', { exact: true }).fill('Тестовый клиент M4');
  await panel.getByLabel('Фамилия', { exact: true }).fill('Синтетический');
  await panel.getByLabel('Телефон', { exact: true }).fill('8 (700) 000-50-01');
  await panel.getByRole('button', { name: 'Сохранить клиента', exact: true }).click();
  await expect(panel).not.toBeVisible();
  let row = main.getByRole('row').filter({ hasText: 'Тестовый клиент M4' });
  await expect(row).toContainText('8 (700) 000-50-01');
  await expect(row.locator('[data-label="Всего визитов"]')).toHaveText('0');
  await expect(main.getByRole('status').filter({ hasText: 'Клиент создан.' })).toBeVisible();
  await page.screenshot({ path: 'reports/salons-m4a-2026-10-18/customers-375.png', fullPage: true });

  await main.getByRole('button', { name: 'Добавить клиента', exact: true }).click();
  panel = page.getByRole('dialog', { name: 'Добавить клиента' });
  await panel.getByLabel('Имя', { exact: true }).fill('Имя дубля');
  await panel.getByLabel('Телефон', { exact: true }).fill('+77000005001');
  await panel.getByRole('button', { name: 'Сохранить клиента', exact: true }).click();
  await expect(panel).not.toBeVisible();
  await expect(main.getByRole('status').filter({ hasText: 'Клиент уже есть.' })).toBeVisible();
  await expect(main.getByRole('row').filter({ hasText: 'Тестовый клиент M4' })).toHaveCount(1);
  await expect(main.getByRole('row').filter({ hasText: 'Имя дубля' })).toHaveCount(0);

  await main.getByRole('button', { name: 'Добавить клиента', exact: true }).click();
  panel = page.getByRole('dialog', { name: 'Добавить клиента' });
  await panel.getByLabel('Имя', { exact: true }).fill('Сохранённый ввод M4');
  await panel.getByLabel('Телефон', { exact: true }).fill('invalid');
  await panel.getByRole('button', { name: 'Сохранить клиента', exact: true }).click();
  await expect(panel.getByRole('alert')).toContainText('Укажите телефон');
  await expect(panel.getByLabel('Имя', { exact: true })).toHaveValue('Сохранённый ввод M4');
  await expect(panel.getByLabel('Телефон', { exact: true })).toHaveValue('invalid');
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate((dark) => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; }, width === 375);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const result = await new AxeBuilder({ page }).include('dialog, [role="dialog"]').analyze();
    expect(result.violations).toEqual([]);
    await page.screenshot({ path: `reports/salons-m4a-2026-10-18/create-error-${width}.png`, fullPage: true });
  }
  await panel.getByLabel('Телефон', { exact: true }).fill('7000005002');
  await panel.getByRole('button', { name: 'Сохранить клиента', exact: true }).click();
  await expect(panel).not.toBeVisible();
  row = main.getByRole('row').filter({ hasText: 'Сохранённый ввод M4' });
  await expect(row).toBeVisible();
});

const TEST_CLIENT = { 'x-wetop-test-client': '1' };

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

async function addService(page: Page, name: string, minutes: string, price: string) {
  await page.goto('/beauty/services');
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Добавить услугу', exact: true }).click();
  const panel = page.getByRole('dialog');
  // новая услуга по умолчанию сразу в филиале (аудит 21.10.2026 п.5); здесь проверяем путь «только каталог»
  await expect(panel.getByLabel('Сразу в этом филиале')).toBeChecked();
  await panel.getByLabel('Сразу в этом филиале').uncheck();
  await panel.getByLabel('Название').fill(name);
  await panel.getByLabel(/Длительность, минут/).fill(minutes);
  await panel.getByLabel(/Цена каталога/).fill(price);
  await panel.getByRole('button', { name: 'Сохранить услугу', exact: true }).click();
  await expect(panel.getByRole('status')).toHaveText('Услуга создана. Включите её в выбранном филиале ниже.');
}

test('услуга каталога добавляется и видна в списке', async ({ page, request }) => {
  await openSalon(page, request);
  await addService(page, 'Маникюр', '60', '8000');
  await page.goto('/beauty/services');
  const main = page.getByRole('main');
  const catalog = main.locator('[data-service-list="catalog"]');
  const item = catalog.locator('.beauty-service-item').filter({ has: page.getByText('Маникюр', { exact: true }) });
  await expect(item).toContainText('60 мин');
  await expect(item).toContainText('8 000');
  // Услуга уже есть в общем каталоге, но филиал добавляет её отдельно.
  await expect(item.getByRole('button', { name: 'Добавить в филиал: Маникюр' })).toBeVisible();
  await page.screenshot({ path: `${SNAPSHOTS}/services-1440.png`, fullPage: true });
});

test('филиал включает услугу и ставит свою цену', async ({ page, request }) => {
  await openSalon(page, request);
  await addService(page, 'Маникюр', '60', '8000');
  await page.goto('/beauty/services');
  const main = page.getByRole('main');
  await main
    .locator('[data-service-list="catalog"] .beauty-service-item')
    .filter({ has: page.getByText('Маникюр', { exact: true }) })
    .getByRole('button', { name: 'Изменить' })
    .click();
  const panel = page.getByRole('dialog');
  await panel.getByLabel('Филиал оказывает эту услугу').check();
  await panel.getByLabel(/Своя цена филиала/).fill('9500');
  await panel.getByLabel(/Своя длительность/).fill('90');
  await panel.getByRole('button', { name: 'Сохранить для филиала', exact: true }).click();
  await expect(panel.getByRole('status').filter({ hasText: 'Настройки филиала сохранены' })).toBeVisible();
  await page.goto('/beauty/services');
  const salonItem = main
    .locator('[data-service-list="salon"] .beauty-service-item')
    .filter({ hasText: 'Маникюр' });
  await expect(salonItem).toContainText('9 500');
  await expect(salonItem).toContainText('90 мин');
  await expect(
    main.locator('[data-service-list="catalog"]').getByRole('button', { name: 'В филиале: Маникюр' }),
  ).toBeDisabled();
});

test('каталог переносит услуги кнопками и drag-and-drop на 1440 и складывается на 390', async ({
  page,
  request,
}) => {
  await openSalon(page, request);
  await addService(page, 'Услуга стрелкой', '45', '5000');
  await addService(page, 'Услуга перетаскиванием', '60', '7000');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/beauty/services');

  const main = page.getByRole('main');
  const salon = main.locator('[data-service-list="salon"]');
  const catalog = main.locator('[data-service-list="catalog"]');
  const desktopSalonBox = await salon.boundingBox();
  const desktopCatalogBox = await catalog.boundingBox();
  expect(desktopSalonBox).not.toBeNull();
  expect(desktopCatalogBox).not.toBeNull();
  expect(desktopSalonBox!.x).toBeLessThan(desktopCatalogBox!.x);

  await catalog.getByRole('button', { name: 'Добавить в филиал: Услуга стрелкой' }).click();
  await expect(
    salon.locator('.beauty-service-item').filter({ hasText: 'Услуга стрелкой' }),
  ).toBeVisible();
  await expect(catalog.getByRole('button', { name: 'В филиале: Услуга стрелкой' })).toBeDisabled();

  await catalog
    .locator('.beauty-service-item')
    .filter({ hasText: 'Услуга перетаскиванием' })
    // бросаем на всегда видимый заголовок списка: центр высокой секции ниже экрана, Playwright прокручивает
    // страницу между нажатием и первым движением, и Chromium начинает перенос с другой карточки под курсором
    .dragTo(salon.locator('header'));
  await expect(
    salon.locator('.beauty-service-item').filter({ hasText: 'Услуга перетаскиванием' }),
  ).toBeVisible();
  await expect(catalog.getByRole('button', { name: 'В филиале: Услуга перетаскиванием' })).toBeDisabled();

  await salon
    .locator('.beauty-service-item')
    .filter({ hasText: 'Услуга перетаскиванием' })
    .dragTo(catalog.locator('header'));
  await expect(
    salon.locator('.beauty-service-item').filter({ hasText: 'Услуга перетаскиванием' }),
  ).toHaveCount(0);
  await expect(catalog.getByRole('button', { name: 'Добавить в филиал: Услуга перетаскиванием' })).toBeVisible();
  await page.screenshot({ path: `${SNAPSHOTS}/services-transfer-1440.png`, fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileSalonBox = await salon.boundingBox();
  const mobileCatalogBox = await catalog.boundingBox();
  expect(mobileSalonBox).not.toBeNull();
  expect(mobileCatalogBox).not.toBeNull();
  expect(mobileSalonBox!.y).toBeLessThan(mobileCatalogBox!.y);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(catalog.getByRole('button', { name: 'Добавить в филиал: Услуга перетаскиванием' })).toBeVisible();
  await page.screenshot({ path: `${SNAPSHOTS}/services-transfer-390.png`, fullPage: true });
});

test('ошибки услуги словами, введённое не стирается', async ({ page, request }) => {
  await openSalon(page, request);
  await page.goto('/beauty/services');
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Добавить услугу', exact: true }).click();
  const panel = page.getByRole('dialog');
  await panel.getByLabel('Название').fill('Стрижка');
  await panel.getByLabel(/Длительность, минут/).fill('0');
  await panel.getByLabel(/Цена каталога/).fill('5000');
  await panel.getByRole('button', { name: 'Сохранить услугу', exact: true }).click();
  await expect(panel.getByRole('alert')).toContainText('минут больше нуля');
  await expect(panel.getByLabel('Название')).toHaveValue('Стрижка');
  await expect(panel.getByLabel(/Цена каталога/)).toHaveValue('5000');
});

test('мастер добавляется, а карточка показывает назначенные услуги и статус дня', async ({ page, request }) => {
  await openSalon(page, request);
  await addService(page, 'Маникюр', '60', '8000');
  await addService(page, 'Стрижка', '45', '5000');
  await page.goto('/beauty/masters');
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Добавить специалиста', exact: true }).click();
  const panel = page.getByRole('dialog');
  await panel.getByLabel('Имя мастера').fill('Дина');
  await panel.getByRole('button', {name:'Создать мастера',exact:true}).click();
  // Карточка мастера остаётся страницей /employees/<id>/profile (решение владельца 20.10).
  await expect(page).toHaveURL(/\/employees\/[0-9a-f-]+\/profile$/);
  const employeeId = page.url().split('/').at(-2)!;
  const servicesResponse = await request.get(`${FIXTURE_API}/beauty/services`, { headers: TEST_CLIENT });
  expect(servicesResponse.ok()).toBe(true);
  const services = (await servicesResponse.json()).items as Array<{ id: string; name: string }>;
  const manicure = services.find((item) => item.name === 'Маникюр')!;
  const haircut = services.find((item) => item.name === 'Стрижка')!;
  const assigned = await request.put(`${FIXTURE_API}/beauty/employees/${employeeId}/services`, {
    headers: TEST_CLIENT,
    data: { serviceIds: [manicure.id, haircut.id] },
  });
  expect(assigned.ok()).toBe(true);
  await page.goto('/beauty/masters');
  // единый экран персонала (вариант A, решение владельца 20.10.2026): строка таблицы, умения и филиалы на виду
  const row = main.getByRole('tabpanel').getByTestId('staff-row').filter({ hasText: 'Дина' });
  await expect(row).toContainText('Маникюр, Стрижка');
  await expect(row).toContainText('Студия Айна');
  // у нового мастера нет графика на сегодня: строка честно говорит «Выходной», записей нет
  await expect(row).toContainText('Выходной');
  await expect(row).toContainText('Не на смене');
  await page.screenshot({ path: `${SNAPSHOTS}/masters-1440.png`, fullPage: true });

  await expect(row.getByRole('link', { name: 'Открыть' })).toHaveAttribute(
    'href',
    `/employees/${employeeId}/profile`,
  );
  // UI назначения и снятия проверяет real-portal набор; здесь фиксируем отображение ответа каталога.
  const reduced = await request.put(`${FIXTURE_API}/beauty/employees/${employeeId}/services`, {
    headers: TEST_CLIENT,
    data: { serviceIds: [manicure.id] },
  });
  expect(reduced.ok()).toBe(true);
  await page.goto('/beauty/masters');
  const reducedRow = main.getByRole('tabpanel').getByTestId('staff-row').filter({ hasText: 'Дина' });
  await expect(reducedRow).toContainText('Маникюр');
  await expect(reducedRow).not.toContainText('Стрижка');
});

test('каталог салона на телефоне: без прокрутки вбок', async ({ page, request }) => {
  await openSalon(page, request);
  await addService(page, 'Маникюр', '60', '8000');
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ['/beauty/services', '/beauty/masters']) {
    await page.goto(path);
    await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      path,
    ).toBe(true);
    await page.screenshot({
      path: `${SNAPSHOTS}/${path.split('/').pop()}-390.png`,
      fullPage: true,
    });
  }
});

for (const theme of ['light', 'dark'] as const) {
  test(`каталог салона доступен в ${theme === 'light' ? 'светлой' : 'тёмной'} теме`, async ({
    page,
    request,
  }) => {
    await openSalon(page, request);
    await addService(page, 'Маникюр', '60', '8000');
    await page.emulateMedia({ colorScheme: theme });
    for (const path of ['/beauty/services', '/beauty/masters']) {
      await page.goto(path);
      await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible();
      const audit = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(audit.violations.map((v) => `${path} ${v.id}: ${v.nodes.length}`)).toEqual([]);
    }
    await page.screenshot({ path: `${SNAPSHOTS}/masters-${theme}.png`, fullPage: true });
  });
}

test('типовая услуга подставляет поля, цена вводится в тенге, валют четыре (приёмка 17.10)', async ({
  page,
  request,
}) => {
  await openSalon(page, request);
  await page.goto('/beauty/services');
  await page.getByRole('main').getByRole('button', { name: 'Добавить услугу', exact: true }).click();
  const panel = page.getByRole('dialog');
  await panel.getByLabel('Типовая услуга').selectOption({ label: 'Маникюр, 60 мин' });
  await expect(panel.getByLabel('Название')).toHaveValue('Маникюр');
  await expect(panel.getByLabel(/Категория/)).toHaveValue('Ногти');
  await expect(panel.getByLabel(/Длительность, минут/)).toHaveValue('60');
  const currencies = await panel.getByLabel('Валюта цены каталога').locator('option').allTextContents();
  expect(currencies).toEqual(['Тенге (KZT)', 'Доллар США (USD)', 'Дирхам ОАЭ (AED)', 'Катарский риал (QAR)']);
  // на приёмке ввели 5000 в поле «тиын» и получили 50 тенге: теперь 5000 это 5 000 тенге
  await panel.getByLabel(/Цена каталога/).fill('5000');
  await panel.getByRole('button', { name: 'Сохранить услугу', exact: true }).click();
  await expect(panel.getByRole('status')).toContainText('Услуга добавлена в филиал');
  await page.goto('/beauty/services');
  await expect(
    page.getByRole('main').locator('[data-service-list="catalog"] .beauty-service-item').filter({ has: page.getByText('Маникюр', { exact: true }) }),
  ).toContainText('5 000');
});

test('стартовая услуга справа требует цену и после настройки появляется слева', async ({ page, request }) => {
  await openSalon(page, request);
  await page.goto('/beauty/services');
  const main = page.getByRole('main');
  const catalog = main.locator('[data-service-list="catalog"]');
  await expect(catalog.getByText('Стрижка мужская', { exact: true })).toBeVisible();
  // типовая услуга одной строкой: название, минуты и категория (аудит 21.10.2026 п.39)
  await expect(catalog.locator('.beauty-service-item').filter({ hasText: 'Стрижка мужская' })).toContainText('45 мин, Волосы');
  await catalog.getByRole('button', { name: 'Настроить и добавить в филиал: Стрижка мужская' }).click();
  const panel = page.getByRole('dialog');
  await expect(panel.getByLabel('Типовая услуга')).toHaveCount(0);
  await expect(panel.getByLabel('Название')).toHaveValue('Стрижка мужская');
  await expect(panel.getByLabel(/Категория/)).toHaveValue('Волосы');
  await expect(panel.getByLabel(/Длительность, минут/)).toHaveValue('45');
  await expect(panel.getByLabel(/Цена каталога/)).toHaveValue('');
  await panel.getByLabel(/Цена каталога/).fill('35.50');
  await panel.getByRole('button', { name: 'Сохранить услугу', exact: true }).click();
  // типовая услуга сразу попадает в филиал, второй кнопки не нужно (онбординг на живом сайте, 21.10.2026)
  await expect(panel.getByRole('status')).toContainText('Услуга добавлена в филиал');
  await expect(panel.getByLabel('Филиал оказывает эту услугу')).toBeChecked();
  await page.goto('/beauty/services');
  await expect(
    main.locator('[data-service-list="salon"] .beauty-service-item').filter({ has: page.getByText('Стрижка мужская', { exact: true }) }),
  ).toContainText('35,50');
});
