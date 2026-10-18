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
  await page.goto('/customers');
  const main = page.getByRole('main');
  const before = await main.getByRole('row').count();
  await main.getByRole('button', { name: 'Проверить CSV', exact: true }).click();
  const panel = page.getByRole('dialog', { name: 'Проверка CSV клиентов' });
  const writes: string[] = [];
  page.on('request', (req) => { if (req.method() === 'POST') writes.push(req.url()); });
  const csv = 'Имя;Телефон\r\nПервый тест;87000001001\r\nПовтор тест;+7 (700) 000-10-01\r\nБез номера;\r\nОшибка тест;abc';
  await panel.getByLabel('CSV с клиентами').setInputFiles({ name: 'synthetic.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await expect(panel.getByLabel('Колонка имени')).toHaveValue('0');
  await expect(panel.getByLabel('Колонка телефона')).toHaveValue('1');
  await panel.getByRole('button', { name: 'Проверить строки', exact: true }).click();
  await expect(panel.getByRole('heading', { name: 'Готовы: 1', exact: true })).toBeVisible();
  await expect(panel.getByRole('heading', { name: 'Повторы в файле: 1', exact: true })).toBeVisible();
  await expect(panel.getByRole('heading', { name: 'С замечаниями: 1', exact: true })).toBeVisible();
  await expect(panel.getByRole('heading', { name: 'Пропустим: 1', exact: true })).toBeVisible();
  await expect(panel.getByText('Проверка завершена. Данные ещё не импортированы.', { exact: true })).toBeVisible();
  await expect(panel.getByRole('link', { name: 'Скачать шаблон CSV' })).toHaveAttribute('download', 'wetop-customers-template.csv');
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
  await panel.getByLabel('CSV с клиентами').setInputFiles({ name: 'wrong.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from('synthetic') });
  await expect(panel.getByRole('alert')).toContainText('Выберите CSV');
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
  const row = main.getByRole('row').filter({ hasText: 'Маникюр' });
  await expect(row).toContainText('60 мин');
  await expect(row).toContainText('8 000');
  // филиал услугу ещё не включил: продавать её нельзя, и экран говорит это словами
  await expect(row).toContainText('Филиал не оказывает');
  await page.screenshot({ path: `${SNAPSHOTS}/services-1440.png`, fullPage: true });
});

test('филиал включает услугу и ставит свою цену', async ({ page, request }) => {
  await openSalon(page, request);
  await addService(page, 'Маникюр', '60', '8000');
  await page.goto('/beauty/services');
  const main = page.getByRole('main');
  await main
    .getByRole('row')
    .filter({ hasText: 'Маникюр' })
    .getByRole('button', { name: 'Изменить' })
    .click();
  const panel = page.getByRole('dialog');
  await panel.getByLabel('Филиал оказывает эту услугу').check();
  await panel.getByLabel(/Своя цена филиала/).fill('9500');
  await panel.getByLabel(/Своя длительность/).fill('90');
  await panel.getByRole('button', { name: 'Сохранить для филиала', exact: true }).click();
  await expect(panel.getByRole('status')).toContainText('Настройки филиала сохранены');
  await page.goto('/beauty/services');
  const row = main.getByRole('row').filter({ hasText: 'Маникюр' });
  await expect(row).toContainText('9 500');
  await expect(row).toContainText('90 мин');
  await expect(row).toContainText('своя цена филиала');
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

test('мастер добавляется, умения ставятся и снимаются', async ({ page, request }) => {
  await openSalon(page, request);
  await addService(page, 'Маникюр', '60', '8000');
  await addService(page, 'Стрижка', '45', '5000');
  await page.goto('/beauty/masters');
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Добавить мастера', exact: true }).click();
  const panel = page.getByRole('dialog');
  await panel.getByLabel('Имя мастера').fill('Дина');
  await panel.getByRole('button', {name:'Создать мастера',exact:true}).click();
  await panel.getByRole('tab', {name:'Услуги',exact:true}).click();
  await panel.getByRole('checkbox', { name: 'Маникюр' }).check();
  await panel.getByRole('checkbox', { name: 'Стрижка' }).check();
  await panel.getByRole('button', { name: 'Сохранить услуги', exact: true }).click();
  await expect(panel.getByRole('status')).toContainText('Услуги назначены');
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

  // снятая галочка должна сниматься, а не копиться
  await row.getByRole('button', { name: 'Открыть' }).click();
  const edit = page.getByRole('dialog');
  await edit.getByRole('tab', { name: 'Услуги', exact: true }).click();
  await edit.getByRole('checkbox', { name: 'Стрижка' }).uncheck();
  await edit.getByRole('button', { name: 'Сохранить услуги', exact: true }).click();
  await expect(edit.getByRole('status')).toContainText('Услуги назначены');
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
  await expect(panel.getByLabel(/Группа/)).toHaveValue('Ногти');
  await expect(panel.getByLabel(/Длительность, минут/)).toHaveValue('60');
  const currencies = await panel.getByLabel('Валюта цены каталога').locator('option').allTextContents();
  expect(currencies).toEqual(['Тенге (KZT)', 'Доллар США (USD)', 'Дирхам ОАЭ (AED)', 'Катарский риал (QAR)']);
  // на приёмке ввели 5000 в поле «тиын» и получили 50 тенге: теперь 5000 это 5 000 тенге
  await panel.getByLabel(/Цена каталога/).fill('5000');
  await panel.getByRole('button', { name: 'Сохранить услугу', exact: true }).click();
  await expect(panel.getByRole('status')).toContainText('Услуга создана');
  await page.goto('/beauty/services');
  await expect(page.getByRole('main').getByRole('row').filter({ hasText: 'Маникюр' })).toContainText('5 000');
});
