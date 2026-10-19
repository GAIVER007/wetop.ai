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
  // Локальный preview доступен администратору; durable import и его recovery проверяются отдельно у OWNER.
  await request.post(`${FIXTURE_API}/__test/control`, { data: { role: 'STAFF' } });
  await page.goto('/customers');
  const main = page.getByRole('main');
  const before = await main.getByRole('row').count();
  await main.getByRole('button', { name: 'Импортировать клиентов', exact: true }).click();
  const panel = page.getByRole('dialog', { name: 'Импортировать клиентов', exact: true });
  const localImport = panel.getByRole('region', { name: 'Надёжный импорт CSV и история', exact: true });
  const writes: string[] = [];
  page.on('request', (req) => { if (req.method() === 'POST') writes.push(req.url()); });
  const csv = 'Имя;Телефон\r\nПервый тест;87000001001\r\nПовтор тест;+7 (700) 000-10-01\r\nБез номера;\r\nОшибка тест;abc';
  await localImport.getByLabel('CSV с клиентами').setInputFiles({ name: 'synthetic.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await expect(localImport.getByLabel('Колонка имени')).toHaveValue('0');
  await expect(localImport.getByLabel('Колонка телефона')).toHaveValue('1');
  await localImport.getByRole('button', { name: 'Проверить строки', exact: true }).click();
  await expect(localImport.getByRole('heading', { name: 'Готовы: 1', exact: true })).toBeVisible();
  await expect(localImport.getByRole('heading', { name: 'Повторы в файле: 1', exact: true })).toBeVisible();
  await expect(localImport.getByRole('heading', { name: 'С замечаниями: 1', exact: true })).toBeVisible();
  await expect(localImport.getByRole('heading', { name: 'Пропустим: 1', exact: true })).toBeVisible();
  await expect(localImport.getByRole('button', { name: /^Импортировать \d+ строк$/ })).toHaveCount(0);
  await expect(localImport.getByRole('button', { name: 'Отменить импорт', exact: true })).toHaveCount(0);
  await expect(localImport.getByText('Проверка завершена. Данные ещё не импортированы.', { exact: true })).toBeVisible();
  await expect(localImport.getByRole('link', { name: 'Скачать шаблон CSV' })).toHaveAttribute('download', 'wetop-customers-template.csv');
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate((dark) => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; }, width === 375);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const headingBox = await localImport.getByRole('heading', { name: 'Проверка завершена. Данные ещё не импортированы.', exact: true }).boundingBox();
    const titleBox = await panel.locator('.overlay-heading').boundingBox();
    expect(headingBox!.y).toBeGreaterThanOrEqual(titleBox!.y + titleBox!.height);
    expect((await new AxeBuilder({ page }).include('dialog, [role="dialog"]').analyze()).violations).toEqual([]);
    await page.screenshot({ path: `reports/salons-m4b-2026-10-18/preview-${width}.png`, fullPage: true });
  }
  await localImport.getByLabel('Колонка телефона').selectOption('0');
  await expect(localImport.getByText('Проверка завершена. Данные ещё не импортированы.', { exact: true })).not.toBeVisible();
  await localImport.getByRole('button', { name: 'Проверить строки', exact: true }).click();
  await expect(localImport.getByRole('alert')).toContainText('дважды');
  await expect(localImport.getByRole('alert')).toBeFocused();
  await localImport.getByLabel('CSV с клиентами').setInputFiles({ name: 'wrong.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from('synthetic') });
  await expect(localImport.getByRole('alert')).toContainText('Выберите CSV');
  await expect(localImport.getByRole('button', { name: 'Проверить строки', exact: true })).not.toBeVisible();
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
  const item = catalog.getByRole('article').filter({ has: page.getByText('Маникюр', { exact: true }) });
  await expect(item).toHaveCount(1);
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
    .locator('[data-service-list="catalog"]').getByRole('article')
    .filter({ has: page.getByText('Маникюр', { exact: true }) })
    .getByRole('button', { name: 'Изменить' })
    .click();
  const panel = page.getByRole('dialog');
  await panel.getByLabel('Филиал оказывает эту услугу').check();
  await panel.getByLabel(/Своя цена филиала/).fill('9500');
  await panel.getByLabel(/Своя длительность/).fill('90');
  await panel.getByRole('button', { name: 'Сохранить для филиала', exact: true }).click();
  await expect(panel.getByRole('status').filter({ hasText: /^Настройки филиала сохранены$/ })).toHaveText('Настройки филиала сохранены');
  await page.goto('/beauty/services');
  const salonItem = main
    .locator('[data-service-list="salon"]').getByRole('article')
    .filter({ has: page.getByText('Маникюр', { exact: true }) });
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
    salon.getByRole('article').filter({ has: page.getByText('Услуга стрелкой', { exact: true }) }),
  ).toBeVisible();
  await expect(catalog.getByRole('button', { name: 'В филиале: Услуга стрелкой' })).toBeDisabled();

  const catalogDragItem = catalog.getByRole('article').filter({
    has: page.getByText('Услуга перетаскиванием', { exact: true }),
  });
  const salonDropHeading = salon.getByRole('heading', { name: 'Услуги филиала', exact: true });
  await catalogDragItem.scrollIntoViewIfNeeded();
  await salonDropHeading.scrollIntoViewIfNeeded();
  await expect(catalogDragItem).toBeInViewport({ ratio: 1 });
  await expect(salonDropHeading).toBeInViewport({ ratio: 1 });
  await catalogDragItem.dragTo(salonDropHeading);
  await expect(
    salon.getByRole('article').filter({ has: page.getByText('Услуга перетаскиванием', { exact: true }) }),
  ).toBeVisible();
  await expect(catalog.getByRole('button', { name: 'В филиале: Услуга перетаскиванием' })).toBeDisabled();

  const salonDragItem = salon.getByRole('article').filter({
    has: page.getByText('Услуга перетаскиванием', { exact: true }),
  });
  const catalogDropHeading = catalog.getByRole('heading', { name: 'Каталог услуг', exact: true });
  await salonDragItem.scrollIntoViewIfNeeded();
  await catalogDropHeading.scrollIntoViewIfNeeded();
  await expect(salonDragItem).toBeInViewport({ ratio: 1 });
  await expect(catalogDropHeading).toBeInViewport({ ratio: 1 });
  await salonDragItem.dragTo(catalogDropHeading);
  await expect(
    salon.getByRole('article').filter({ has: page.getByText('Услуга перетаскиванием', { exact: true }) }),
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
  await expect(page).toHaveURL(/\/employees\/[0-9a-f-]+\/profile$/);
  const employeeId = page.url().split('/').at(-2)!;
  const cookies = await page.context().cookies();
  const scopeCookie = cookies.find(cookie => cookie.name === 'wetop_scope')?.value;
  const session = cookies.find(cookie => cookie.name === 'wetop_session')?.value;
  // Assert presence without including cookie/token values in failure output.
  expect(Boolean(scopeCookie)).toBe(true);
  expect(Boolean(session)).toBe(true);
  const scope = decodeURIComponent(scopeCookie!);
  const locationId = /(?:^|;)location=([^;]+)/.exec(scope)?.[1];
  expect(Boolean(locationId)).toBe(true);
  const headers = { 'x-wetop-test-client': '1', 'x-wetop-scope': scope, 'x-wetop-session': session! };
  const servicesResponse = await page.request.get(`${FIXTURE_API}/beauty/services`, { headers });
  expect(servicesResponse.status()).toBe(200);
  const catalog = await servicesResponse.json() as { locationId: string; items: Array<{ id: string; name: string }> };
  expect(catalog.locationId).toBe(locationId);
  const manicures = catalog.items.filter(item => item.name === 'Маникюр');
  const haircuts = catalog.items.filter(item => item.name === 'Стрижка');
  expect(manicures).toHaveLength(1);
  expect(haircuts).toHaveLength(1);
  const manicure = manicures[0]!;
  const haircut = haircuts[0]!;
  const serviceIds = [manicure.id, haircut.id];
  const assigned = await page.request.put(`${FIXTURE_API}/beauty/employees/${employeeId}/services`, {
    headers, data: { serviceIds },
  });
  expect(assigned.status()).toBe(200);
  const assignedRow = await assigned.json() as { id: string; serviceIds: string[] };
  expect(assignedRow.id).toBe(employeeId);
  expect(assignedRow.serviceIds).toEqual(serviceIds);
  const assignedReadback = await page.request.get(`${FIXTURE_API}/beauty/employees/${employeeId}`, { headers });
  expect(assignedReadback.status()).toBe(200);
  const persistedAssignment = await assignedReadback.json() as { id: string; serviceIds: string[] };
  expect(persistedAssignment.id).toBe(employeeId);
  expect(persistedAssignment.serviceIds).toEqual(serviceIds);
  await page.goto('/beauty/masters');
  // карточки вместо таблицы (ТЗ салона 09.10.2026): умения и филиалы остаются на виду
  const row = main.getByRole('listitem').filter({ hasText: 'Дина' });
  await expect(row).toContainText('Маникюр, Стрижка');
  await expect(row).toContainText('Студия Айна');
  // у нового мастера нет графика на сегодня: карточка честно говорит «Выходной» и «0 записей»
  await expect(row).toContainText('Выходной');
  await expect(row).toContainText('0 записей сегодня');
  await expect(row).toContainText('Сегодня не работает');
  await page.screenshot({ path: `${SNAPSHOTS}/masters-1440.png`, fullPage: true });

  await expect(row.getByRole('link', { name: 'Открыть' })).toHaveAttribute(
    'href',
    `/employees/${employeeId}/profile`,
  );
  // UI назначения и снятия проверяет real-portal набор; здесь фиксируем отображение ответа каталога.
  const reduced = await page.request.put(`${FIXTURE_API}/beauty/employees/${employeeId}/services`, {
    headers, data: { serviceIds: [manicure.id] },
  });
  expect(reduced.status()).toBe(200);
  const reducedRow = await reduced.json() as { id: string; serviceIds: string[] };
  expect(reducedRow.id).toBe(employeeId);
  expect(reducedRow.serviceIds).toEqual([manicure.id]);
  const reducedReadback = await page.request.get(`${FIXTURE_API}/beauty/employees/${employeeId}`, { headers });
  expect(reducedReadback.status()).toBe(200);
  const persistedReduction = await reducedReadback.json() as { id: string; serviceIds: string[] };
  expect(persistedReduction.id).toBe(employeeId);
  expect(persistedReduction.serviceIds).toEqual([manicure.id]);
  await page.goto('/beauty/masters');
  await expect(main.getByRole('listitem').filter({ hasText: 'Дина' })).toContainText('Маникюр');
  await expect(main.getByRole('listitem').filter({ hasText: 'Дина' })).not.toContainText(
    'Стрижка',
  );
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
  await expect(panel.getByRole('status')).toContainText('Услуга создана');
  await page.goto('/beauty/services');
  await expect(
    page.getByRole('main').locator('[data-service-list="catalog"]').getByRole('article').filter({ has: page.getByText('Маникюр', { exact: true }) }),
  ).toContainText('5 000');
});

test('стартовая услуга справа требует цену и после настройки появляется слева', async ({ page, request }) => {
  await openSalon(page, request);
  await page.goto('/beauty/services');
  const main = page.getByRole('main');
  const catalog = main.locator('[data-service-list="catalog"]');
  await expect(catalog.getByText('Стрижка мужская', { exact: true })).toBeVisible();
  await expect(catalog).toContainText('Цена задаётся при добавлении');
  await catalog.getByRole('button', { name: 'Настроить и добавить в филиал: Стрижка мужская' }).click();
  const panel = page.getByRole('dialog');
  await expect(panel.getByLabel('Название')).toHaveValue('Стрижка мужская');
  await expect(panel.getByLabel(/Категория/)).toHaveValue('Волосы');
  await expect(panel.getByLabel(/Длительность, минут/)).toHaveValue('45');
  await expect(panel.getByLabel(/Цена каталога/)).toHaveValue('');
  await panel.getByLabel(/Цена каталога/).fill('35.50');
  await panel.getByRole('button', { name: 'Сохранить услугу', exact: true }).click();
  await expect(panel.getByRole('status')).toContainText('Услуга создана');
  await expect(panel.getByLabel('Филиал оказывает эту услугу')).toBeChecked();
  await panel.getByRole('button', { name: 'Сохранить для филиала', exact: true }).click();
  await expect(panel.getByRole('status').filter({ hasText: /^Настройки филиала сохранены$/ })).toHaveText('Настройки филиала сохранены');
  await page.goto('/beauty/services');
  await expect(
    main.locator('[data-service-list="salon"]').getByRole('article').filter({ has: page.getByText('Стрижка мужская', { exact: true }) }),
  ).toContainText('35,50');
});
