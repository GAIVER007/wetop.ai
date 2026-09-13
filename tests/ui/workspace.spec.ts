import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const fixture = 'http://127.0.0.1:4311';
const booking = '20260913-TESTAA';
const screenshots = resolve('reports/hostel-frontend/screenshots');
test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

async function noPageOverflow(page: Page) {
  const widths = await page.evaluate(() => {
    // The repository's test tsconfig targets Node; this callback runs in the browser.
    const browser = globalThis as unknown as {
      document: { documentElement: { scrollWidth: number } };
      innerWidth: number;
    };
    return { content: browser.document.documentElement.scrollWidth, viewport: browser.innerWidth };
  });
  expect(widths.content, `Overflow at ${page.url()}`).toBeLessThanOrEqual(widths.viewport + 1);
}

test('все разделы, карточки и печать открываются; desktop/mobile без переполнения', async ({
  page,
}) => {
  test.setTimeout(120_000);
  mkdirSync(screenshots, { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  const routes = [
    ['/today', 'Сегодня,'],
    ['/chessboard', 'Шахматка'],
    ['/guests?q=Тест', 'Гости'],
    ['/guests/ui-guest', 'Гость'],
    [`/reservations/${booking}`, `Бронь ${booking}`],
    ['/reservations/new?unit=M03', 'Новая бронь'],
    ['/finance', 'Деньги за период'],
    ['/rates', 'Цены и ограничения'],
    ['/inventory', 'Номерной фонд'],
    ['/units/R01', 'R01'],
    ['/channels', 'Каналы продаж'],
    ['/journal', 'Журнал действий'],
    ['/incidents', 'Неисправности'],
    ['/analytics', 'Аналитика сайта'],
    ['/analytics/setup', 'Подключение счётчика'],
  ];
  for (const [route, title] of routes) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(route!);
    await expect(page.locator('h1')).toContainText(title!);
    await noPageOverflow(page);
    if (route === '/today' || route === '/chessboard') {
      await page.screenshot({
        path: `${screenshots}/${route.slice(1)}-desktop.png`,
        fullPage: false,
        caret: 'initial',
      });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await noPageOverflow(page);
    if (route === '/today')
      await page.screenshot({ path: `${screenshots}/today-mobile.png`, caret: 'initial' });
  }
  await page.goto(`/reservations/${booking}/print?lang=ru`);
  await expect(page.locator('h1')).toContainText('Регистрационная карта');
  await expect(page.locator('.workspace-sidebar')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('поиск и списки дня; мобильное меню и возврат фокуса', async ({ page }) => {
  await page.goto('/today');
  await page.getByRole('button', { name: /^Заезды/ }).click();
  await expect(page.getByTestId('group-departures')).toHaveCount(0);
  await page.getByLabel('Поиск в рабочем дне').fill('R01');
  await expect(page.getByTestId('row-arrivals')).toHaveCount(1);
  await page.getByRole('button', { name: 'Найти гостя или бронь' }).click();
  await page.getByLabel('Запрос', { exact: true }).fill('Тест');
  await page.getByRole('button', { name: 'Найти', exact: true }).click();
  await expect(page).toHaveURL(/\/guests\?q=/);
  await expect(page.locator('h1')).toHaveText('Гости');
  await page.setViewportSize({ width: 390, height: 844 });
  const openMenu = page.getByRole('button', { name: 'Открыть меню' });
  await openMenu.click();
  await expect(page.getByRole('dialog', { name: 'Навигация' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(openMenu).toBeFocused();
  await openMenu.click();
  await page
    .getByRole('dialog', { name: 'Навигация' })
    .getByRole('link', { name: 'Шахматка', exact: true })
    .click();
  await expect(page).toHaveURL(/\/chessboard/);
  await expect(page.getByRole('dialog', { name: 'Навигация' })).not.toBeVisible();
});

test('шахматка: фильтры, продолжение брони, выбранная койка в форме', async ({ page }) => {
  await page.goto('/chessboard');
  await expect(page.getByTestId('unit-row')).toHaveCount(88);
  await page.getByRole('link', { name: '30', exact: true }).click();
  await expect(page.getByTestId('date-col')).toHaveCount(30);
  await expect(page.getByTestId('unit-row')).toHaveCount(88);
  await expect(page.locator('.board-stay-caption').filter({ hasText: '←' }).first()).toBeVisible();
  await page.getByLabel('Категория на шахматке').selectOption('MALE');
  await expect(page.getByTestId('unit-row')).toHaveCount(36);
  await page.getByLabel('Поиск на шахматке').fill('M03');
  await expect(page.getByTestId('unit-row')).toHaveCount(1);
  await page.getByTestId('free-cell').first().click();
  await expect(page).toHaveURL(/unit=M03/);
  await expect(page.locator('select[name="accommodationTypeCode"]')).toHaveValue('MALE');
  await expect(page.locator('select[name="unitCode"]')).toHaveValue('M03');
});

test('ошибка создания сохраняет ввод; повтор отправляет поля существующего API', async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/control`, { data: { rejectCreate: true } });
  await page.goto('/reservations/new?unit=M03');
  const form = page.getByTestId('new-reservation-form');
  await form.locator('[name="source"]').selectOption('PHONE');
  await form.getByLabel('Имя *', { exact: true }).fill('Новый');
  await form.getByLabel('Фамилия *', { exact: true }).fill('Тест');
  await form.getByLabel('Отчество').fill('Тестович');
  await form.getByLabel('Email').fill('new@example.invalid');
  await form.getByLabel('Заметки').fill('Тест сохранения полей');
  await form.getByRole('button', { name: 'Создать бронь' }).click();
  await expect(form.getByRole('alert')).toContainText('Место уже занято');
  await expect(form.getByLabel('Email')).toHaveValue('new@example.invalid');
  await expect(form.getByLabel('Заметки')).toHaveValue('Тест сохранения полей');
  await expect(form.locator('[name="unitCode"]')).toHaveValue('M03');
  await request.post(`${fixture}/__test/control`, { data: {} });
  await form.getByRole('button', { name: 'Создать бронь' }).click();
  await expect(page).toHaveURL(new RegExp(`/reservations/${booking}$`));
  const response = await request.get(`${fixture}/__test/commands`);
  const commands = await response.json();
  expect(commands).toHaveLength(2);
  expect(commands[1].body).toMatchObject({
    guest: { email: 'new@example.invalid', middleName: 'Тестович' },
    items: [{ accommodationTypeCode: 'MALE', unitCode: 'M03', quantity: 1 }],
  });
});

test('карточка: профиль гостя и заселение проходят через server actions', async ({
  page,
  request,
}) => {
  await page.goto('/guests/ui-guest');
  await page.getByTestId('guest-form').getByLabel('Отчество').fill('Проверенный');
  await page
    .getByTestId('guest-form')
    .getByRole('button', { name: 'Сохранить', exact: true })
    .click();
  await expect
    .poll(async () => (await (await request.get(`${fixture}/guests/ui-guest`)).json()).middleName)
    .toBe('Проверенный');
  await page.goto(`/reservations/${booking}`);
  await page.getByTestId('check-in-ui-item').click();
  await expect(page.getByTestId('stay-row')).toContainText('заселён');
  const commands = await (await request.get(`${fixture}/__test/commands`)).json();
  expect(commands.map((c: { path: string }) => c.path)).toContain(
    `/reservations/${booking}/items/ui-item/check-in`,
  );
});

test('сбой API показывает ошибку, повтор восстанавливает страницу', async ({ page, request }) => {
  await request.post(`${fixture}/__test/control`, { data: { failPath: '/inventory/summary' } });
  await page.goto('/inventory');
  await expect(page.locator('h1')).toHaveText('Не удалось загрузить данные');
  await request.post(`${fixture}/__test/control`, { data: {} });
  await page.getByRole('button', { name: 'Повторить загрузку' }).click();
  await expect(page.locator('h1')).toHaveText('Номерной фонд');
});

test('неисправности из обновлённого main: принятие и закрытие работают в новом каркасе', async ({
  page,
}) => {
  await page.goto('/today');
  await page.getByRole('link', { name: 'Неисправности', exact: true }).click();
  await page.getByTestId('incident-acknowledge').click();
  await expect(page.getByTestId('incident-status')).toHaveText('принято');
  await page.getByTestId('incident-resolve').click();
  await expect(page.getByTestId('incident-row')).toHaveCount(0);
  await expect(page.getByTestId('incidents-closed')).toContainText(
    'Тестовая бронь без назначенной ячейки',
  );
});

test('сбой списка неисправностей не выдаётся за отсутствие проблем', async ({ page, request }) => {
  await request.post(`${fixture}/__test/control`, { data: { failPath: '/guard/incidents' } });
  await page.goto('/incidents');
  await expect(
    page.getByRole('alert').filter({ hasText: 'Список неисправностей не загрузился' }),
  ).toBeVisible();
  await expect(page.getByText('за сутки ничего не закрывалось', { exact: true })).toHaveCount(0);
});

test('неверная дата в ссылке оставляет доступную форму для исправления', async ({ page }) => {
  await page.goto('/reservations/new?arrival=bad-date');
  await expect(page.locator('h1')).toHaveText('Новая бронь');
  await expect(page.getByText('Даты некорректны:', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Создать бронь' })).toBeDisabled();
});

test('отсутствующая бронь, гость или ячейка показывают 404 вместо сбоя системы', async ({
  page,
}) => {
  for (const route of ['/reservations/MISSING', '/guests/MISSING', '/units/MISSING']) {
    await page.goto(route);
    await expect(page.locator('h1')).toHaveText('Страница не найдена');
  }
});

test('групповая бронь: разные категории сохраняются при конфликте', async ({ page, request }) => {
  await request.post(`${fixture}/__test/control`, { data: { rejectCreate: true } });
  await page.goto('/reservations/new');
  const form = page.getByTestId('new-reservation-form');
  await form.getByLabel('Источник *').selectOption('PHONE');
  await form.getByRole('button', { name: '+ Добавить размещение' }).click();
  const second = form.getByTestId('placement-fields').nth(1);
  await second.getByLabel('Категория *').selectOption('MALE');
  await second.getByLabel('Количество мест').fill('4');
  await form.getByLabel('Имя *', { exact: true }).fill('Тест');
  await form.getByLabel('Фамилия *', { exact: true }).fill('Группа');
  await form.getByRole('button', { name: 'Создать бронь' }).click();
  await expect(form.getByRole('alert')).toContainText('Место уже занято');
  await expect(second.getByLabel('Категория *')).toHaveValue('MALE');
  await expect(second.getByLabel('Количество мест')).toHaveValue('4');
  const commands = await (await request.get(`${fixture}/__test/commands`)).json();
  expect(commands[0].body.items).toHaveLength(2);
  expect(commands[0].body.items[1]).toMatchObject({
    accommodationTypeCode: 'MALE',
    quantity: 4,
    unitCode: null,
  });
});

test('общий платёж: ошибка не стирает распределения, успешный повтор обновляет баланс', async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/control`, { data: { group: true } });
  await page.goto(`/reservations/${booking}`);
  await page.getByText('Один платёж на несколько счетов', { exact: true }).click();
  const form = page.getByTestId('group-payment-form');
  await form.getByLabel('Общая сумма, KZT').fill('2000');
  await form.getByLabel('На счёт 1', { exact: true }).fill('1000');
  await form.getByLabel('На счёт 2', { exact: true }).fill('500');
  await form.getByRole('button', { name: 'Принять общий платёж' }).click();
  await expect(form.getByRole('alert')).toContainText('должны совпадать');
  await expect(form.getByLabel('На счёт 1', { exact: true })).toHaveValue('1000');
  await form.getByLabel('На счёт 2', { exact: true }).fill('1000');
  await form.getByRole('button', { name: 'Принять общий платёж' }).click();
  await expect(form.getByRole('status')).toContainText('Платёж принят');
  await expect(page.getByTestId('finance-total')).toContainText('30 000,00');
  const result = await (await request.get(`${fixture}/finance/reservations/${booking}`)).json();
  expect(result.balanceMinor).toBe('3000000');
});
