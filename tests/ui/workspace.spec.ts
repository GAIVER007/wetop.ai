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
  test.setTimeout(180_000);
  mkdirSync(screenshots, { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  const routes: Array<[string, string]> = [
    ['/today', 'Обзор дня'],
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
    ['/rooms', 'Управление номерами'],
    ['/rooms/categories', 'Категории номеров'],
    ['/rooms/availability', 'Доступность номеров'],
    ['/rooms/promotions', 'Акции'],
    ['/hotel-settings', 'Настройка гостиницы'],
    ['/hotel-settings/check-in', 'Заезд и выезд'],
    ['/hotel-settings/penalties', 'Штрафы'],
    ['/hotel-settings/services', 'Услуги'],
    ['/hotel-settings/description', 'Описание'],
    ['/hotel-settings/photos', 'Фото'],
    ['/hotel-settings/amenities', 'Удобства'],
    ['/management', 'Управление отелем'],
    ['/management/statistics', 'Статистика'],
    ['/management/reports', 'Отчёты'],
    ['/management/analytics', 'Аналитика отеля'],
    ['/channel-manager', 'Менеджер каналов'],
    ['/connections', 'Подключения API'],
    ['/marketing', 'Маркетинг'],
  ];
  for (const [route, title] of routes) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(route!);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(title!);
    await noPageOverflow(page);
    if (
      ['/today', '/chessboard', '/rooms', '/hotel-settings', '/channel-manager'].includes(route!)
    ) {
      await page.screenshot({
        caret: 'initial',
        path: `${screenshots}/${route.slice(1)}-desktop.png`,
        fullPage: false,
      });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await noPageOverflow(page);
    if (route === '/today')
      await page.screenshot({
        caret: 'initial',
        path: `${screenshots}/today-mobile.png`,
      });
  }
  await page.goto(`/reservations/${booking}/print?lang=ru`);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Регистрационная карта');
  await expect(page.locator('.workspace-sidebar')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('вложенные разделы: раскрытие, один активный пункт, мобильный переход', async ({ page }) => {
  await page.goto('/today');
  const sidebar = page.locator('.workspace-sidebar');
  const rooms = sidebar.getByRole('button', { name: 'Подразделы: Управление номерами' });
  await expect(rooms).toHaveAttribute('aria-expanded', 'false');
  await rooms.click();
  await expect(rooms).toHaveAttribute('aria-expanded', 'true');
  await sidebar.getByRole('link', { name: 'Категории номеров', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Категории номеров');
  await expect(sidebar.locator('[aria-current="page"]')).toHaveCount(1);
  await expect(sidebar.locator('[aria-current="page"]')).toHaveText('Категории номеров');
  await rooms.click();
  await expect(
    sidebar.getByRole('link', { name: 'Категории номеров', exact: true }),
  ).not.toBeVisible();
  await page.goto('/analytics/setup');
  await expect(sidebar.locator('[aria-current="page"]')).toHaveCount(1);
  await expect(sidebar.locator('[aria-current="page"]')).toHaveText('Настройки сайта');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Открыть меню' }).click();
  const menu = page.getByRole('dialog', { name: 'Навигация' });
  await menu.getByRole('button', { name: 'Подразделы: Настройка гостиницы' }).click();
  await menu.getByRole('link', { name: 'Услуги', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Услуги');
  await expect(menu).not.toBeVisible();
  await noPageOverflow(page);
});

test('доступность переносит даты и свободное место в создание брони; неверный период виден', async ({
  page,
}) => {
  await page.goto('/rooms/availability?arrival=2026-10-01&departure=2026-10-04');
  await page.getByRole('link', { name: 'Создать бронь', exact: true }).first().click();
  await expect(page).toHaveURL(/arrival=2026-10-01&departure=2026-10-04&unit=R01/);
  await expect(
    page
      .getByRole('dialog', { name: 'Новая бронь', exact: true })
      .getByRole('heading', { level: 1 }),
  ).toHaveText('Новая бронь');
  await page.goto('/rooms/availability?arrival=2026-10-04&departure=2026-10-01');
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Выезд должен быть позже заезда',
  );
  await expect(page.getByRole('link', { name: 'Создать бронь', exact: true })).toHaveCount(0);
});

test('менеджер каналов: реальные фильтры, пустой результат, период и отказ API', async ({
  page,
  request,
}) => {
  await page.goto('/channel-manager?from=2026-09-01&to=2026-09-30');
  await expect(page.getByTestId('channel-bookings')).toHaveText('48');
  await expect(page.getByTestId('channel-report')).toContainText('Booking.com');
  await expect(page.getByTestId('channel-report')).toContainText('Trip.com');
  await page.getByLabel('Статус брони').selectOption('CANCELLED');
  await page.getByRole('button', { name: 'Показать', exact: true }).click();
  await expect(page).toHaveURL(/status=CANCELLED/);
  await expect(page.getByTestId('channel-bookings')).toHaveText('0');
  await expect(page.getByTestId('channel-report')).toContainText('Нет бронирований');
  await page.goto('/channel-manager?from=2026-09-30&to=2026-09-01');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Выберите корректные даты');
  await request.post(`${fixture}/__test/control`, { data: { failPath: '/hotel/channel-report' } });
  await page.goto('/channel-manager');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Не удалось загрузить данные');
  await expect(page.getByTestId('channel-bookings')).toHaveCount(0);
});

test('подключения показывают частичный сбой, неподключённые функции не имитируют сохранение', async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/control`, {
    data: { failPath: '/channels/channex/webhook/status' },
  });
  await page.goto('/connections');
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Не удалось проверить webhook',
  );
  await expect(page.getByText('Сайтов в системе: 1')).toBeVisible();
  await page.goto('/rooms/promotions');
  await expect(page.getByText('Ещё не подключено', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Сохранить|Создать|Загрузить/ })).toHaveCount(0);
  // Фото, описание и удобства читаются из Channex (ADR-033): только просмотр, источник подписан
  await page.goto('/hotel-settings/photos');
  await expect(page.getByTestId('content-photos').getByRole('img', { name: 'Фасад' })).toHaveCount(
    1,
  );
  await expect(page.getByTestId('content-source')).toContainText('Channex');
  await page.goto('/hotel-settings/amenities');
  await expect(page.getByTestId('content-facilities')).toContainText('WiFi');
  await expect(page.getByText('нельзя', { exact: true })).toBeVisible();
  await page.goto('/hotel-settings/description');
  await expect(page.getByTestId('content-description')).toContainText('Вымышленное описание');
  // свежесть данных в боковой панели: Exely · Channex · очередь ARI (шаг 4 плана wetop-live-data)
  await expect(page.getByTestId('data-freshness').first()).toContainText('очередь 0');
  await expect(page.getByRole('button', { name: /Сохранить|Создать|Загрузить/ })).toHaveCount(0);
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
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Гости');
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
  // The short window starts today and clips the seeded stay that arrived yesterday.
  const today = new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
  const last = new Date(Date.parse(`${today}T00:00:00Z`) + 6 * 86400_000)
    .toISOString()
    .slice(0, 10);
  await page.goto(`/chessboard?from=${today}&to=${last}`);
  await expect(page.getByTestId('date-col')).toHaveCount(7);
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
  await expect(page).toHaveURL(/\/reservations\/20260913-NEW2$/);
  await expect(page.getByTestId('stay-row')).toContainText('M03');
  await expect(page.getByRole('main')).toContainText('Тестович');
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
    .poll(
      async () =>
        (
          await (
            await request.get(`${fixture}/guests/ui-guest`, {
              headers: { 'x-wetop-test-client': '1' },
            })
          ).json()
        ).middleName,
    )
    .toBe('Проверенный');
  await page.goto(`/reservations/${booking}`);
  await page.getByRole('tab', { name: 'Действия', exact: true }).click();
  await page.getByTestId('check-in-ui-item').click();
  await page.getByRole('tab', { name: 'Обзор', exact: true }).click();
  await expect(page.getByTestId('stay-row')).toContainText('заселён');
  const commands = await (await request.get(`${fixture}/__test/commands`)).json();
  expect(commands.map((c: { path: string }) => c.path)).toContain(
    `/reservations/${booking}/items/ui-item/check-in`,
  );
});

test('экран ошибки различает отклонённый запрос (400/404) и отсутствие связи', async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/control`, {
    data: { failPath: '/desk/today', failStatus: 404 },
  });
  await page.goto('/today');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Не удалось загрузить данные');
  await expect(page.getByRole('main')).toContainText('Сервер отклонил запрос (код 404)');
  await expect(page.getByText('Проверьте подключение')).toHaveCount(0);
  await request.post(`${fixture}/__test/control`, { data: { failPath: '/desk/today' } });
  await page.goto('/today');
  await expect(page.getByRole('main')).toContainText('Проверьте подключение');
  await expect(page.getByText('Сервер отклонил запрос')).toHaveCount(0);
});

test('сбой карточки брони показывает ошибку внутри выезжающей карточки, повтор открывает бронь', async ({
  page,
  request,
}) => {
  await page.goto('/reservations');
  await request.post(`${fixture}/__test/control`, {
    data: { failPath: '/reservations/20260913-TESTAA' },
  });
  await page.getByRole('link', { name: 'Открыть бронь 20260913-TESTAA' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Не удалось загрузить данные');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Брони');
  await request.post(`${fixture}/__test/control`, { data: {} });
  await dialog.getByRole('button', { name: 'Повторить загрузку' }).click();
  await expect(dialog.getByRole('tab', { name: 'Обзор', exact: true })).toBeVisible();
});

test('каналы: сбой сводки фонда не роняет страницу; пустое сопоставление названо', async ({
  page,
  request,
}) => {
  await page.goto('/channels');
  await expect(page.getByTestId('mapping-empty')).toContainText('сопоставлений пока нет');
  await expect(page.getByTestId('events-table')).toContainText('Получено (Алматы)');
  await request.post(`${fixture}/__test/control`, { data: { failPath: '/inventory/summary' } });
  await page.goto('/channels');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Каналы продаж — Channex');
  await expect(
    page.getByRole('main').getByRole('alert').filter({ hasText: 'Сводка фонда не загрузилась' }),
  ).toBeVisible();
});

test('сегодня: гость, не заехавший вовремя, виден отдельным списком и в «Требуют внимания»', async ({
  page,
  request,
}) => {
  await page.goto('/today');
  await expect(page.getByTestId('group-overdue')).toHaveCount(0);
  await request.post(`${fixture}/__test/control`, { data: { overdue: true } });
  await page.goto('/today');
  await expect(page.getByTestId('group-overdue')).toContainText('20260913-TEST1');
  const tasks = page.getByRole('complementary', { name: 'Задачи и размещение' });
  await expect(tasks.getByRole('link', { name: /Не заехал/ })).toHaveAttribute(
    'href',
    '/reservations/20260913-TEST1#booking-actions',
  );
});

test('номера: доступность дольше 62 ночей останавливает форма, а не ошибка API', async ({
  page,
}) => {
  await page.goto('/rooms/availability?arrival=2026-10-01&departure=2027-01-01');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Доступность номеров');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('не больше чем на 62 ночи');
  await expect(page.getByLabel('Выезд')).toHaveAttribute('max', '2026-12-02');
});

test('аналитика: период дольше года и отклонённый запрос названы словами; демо бронирования предупреждает', async ({
  page,
  request,
}) => {
  await page.goto('/analytics?from=2025-01-01&to=2026-12-31');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('не больше года');
  await request.post(`${fixture}/__test/control`, {
    data: { failPath: '/analytics/sites/ui-site/report', failStatus: 400 },
  });
  await page.goto('/analytics?from=2026-09-01&to=2026-09-30');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('запрос отклонён');
  await expect(page.getByRole('main').getByRole('alert')).not.toContainText('HTTP 400');
  await request.post(`${fixture}/__test/control`, { data: {} });
  await page.goto('/analytics/setup');
  // .first(): ~300 мс после загрузки стойка держит две копии страницы (потоковый сегмент Next)
  await expect(page.getByText(/Демо бронирования делает настоящую бронь/).first()).toBeVisible();
});

test('карточка брони и новая бронь при сбое справочника тарифов: предупреждение, а не экран ошибки', async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/control`, { data: { failPath: '/rate-plans' } });
  await page.goto('/reservations/20260913-TESTAA');
  await expect(page.getByRole('tab', { name: 'Обзор', exact: true })).toBeVisible();
  // предупреждение живёт там, где нужен справочник — во вкладке действий
  await page.getByRole('tab', { name: 'Действия', exact: true }).click();
  await expect(
    page
      .getByRole('main')
      .getByRole('alert')
      .filter({ hasText: 'Справочник тарифов не загрузился' }),
  ).toBeVisible();
  await page.goto('/reservations/new?unit=M03');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Новая бронь');
  await expect(
    page
      .getByRole('main')
      .getByRole('alert')
      .filter({ hasText: 'Справочник тарифов не загрузился' }),
  ).toBeVisible();
  await expect(page.getByTestId('new-reservation-form')).toHaveCount(0);
});

test('сбой API показывает ошибку, повтор восстанавливает страницу', async ({ page, request }) => {
  await request.post(`${fixture}/__test/control`, { data: { failPath: '/inventory/summary' } });
  await page.goto('/inventory');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Не удалось загрузить данные');
  await request.post(`${fixture}/__test/control`, { data: {} });
  await page.getByRole('button', { name: 'Повторить загрузку' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Номерной фонд');
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
    page
      .getByRole('main')
      .getByRole('alert')
      .filter({ hasText: 'Список неисправностей не загрузился' }),
  ).toBeVisible();
  await expect(page.getByText('за сутки ничего не закрывалось', { exact: true })).toHaveCount(0);
});

test('неверная дата в ссылке оставляет доступную форму для исправления', async ({ page }) => {
  await page.goto('/reservations/new?arrival=bad-date');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Новая бронь');
  await expect(page.getByText('Даты некорректны:', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Создать бронь' })).toBeDisabled();
});

test('отсутствующая бронь, гость или ячейка показывают 404 вместо сбоя системы', async ({
  page,
}) => {
  for (const route of ['/reservations/MISSING', '/guests/MISSING', '/units/MISSING']) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Страница не найдена');
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
  await page.getByRole('tab', { name: 'Счета', exact: true }).click();
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
  const result = await (
    await request.get(`${fixture}/finance/reservations/${booking}`, {
      headers: { 'x-wetop-test-client': '1' },
    })
  ).json();
  expect(result.balanceMinor).toBe('3000000');
});

test('обзор: задачи ведут к счетам, фильтр не меняет сводку, узкие экраны сохраняют действия', async ({
  page,
}) => {
  await page.goto('/today');
  const tasks = page.getByRole('complementary', { name: 'Задачи и размещение' });
  await expect(tasks.getByRole('heading', { name: 'Требуют внимания' })).toBeVisible();
  await expect(tasks.locator('.attention-count')).toHaveText('1');
  await expect(tasks.getByRole('link', { name: /К оплате/ })).toHaveAttribute(
    'href',
    '/reservations/20260913-TEST4#booking-finance',
  );
  const debt = await page.getByTestId('c-debt').innerText();
  await page.getByLabel('Поиск в рабочем дне').fill('несуществующий гость');
  await expect(page.getByTestId('row-arrivals')).toHaveCount(0);
  await expect(page.getByTestId('c-debt')).toHaveText(debt);
  await expect(tasks.locator('.attention-count')).toHaveText('1');
  await page.getByLabel('Поиск в рабочем дне').fill('R01');
  await expect(
    page.getByRole('link', { name: `Открыть бронь ${booking}`, exact: true }),
  ).toHaveAttribute('href', `/reservations/${booking}#booking-actions`);
  for (const width of [320, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await noPageOverflow(page);
    await expect(page.getByRole('link', { name: 'Новая бронь', exact: true })).toBeVisible();
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await tasks.getByRole('link', { name: /К оплате/ }).click();
  await expect(page).toHaveURL(/#booking-finance$/);
  await expect(page.locator('#booking-finance')).toBeInViewport();
});

test('ошибка буфера обмена видна, код остаётся доступен', async ({ page }) => {
  await page.addInitScript(() => {
    const browser = globalThis as unknown as { navigator: object };
    Object.defineProperty(browser.navigator, 'clipboard', {
      value: { writeText: () => Promise.reject(new Error('denied')) },
      configurable: true,
    });
  });
  await page.goto('/analytics/setup');
  await page.getByRole('button', { name: 'Скопировать код' }).first().click();
  await expect(
    page.getByRole('main').getByRole('alert').filter({ hasText: 'Не удалось скопировать' }),
  ).toBeVisible();
  await expect(page.getByTestId('site-card-snippet')).toContainText('public-ui-fixture');
});

test('финансы: неверные даты можно исправить без падения страницы', async ({ page }) => {
  await page.goto('/finance?from=2026-09-30&to=2026-09-01');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Деньги за период');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Проверьте даты');
  await expect(page.getByTestId('charged')).toHaveCount(0);
  await page.locator('input[name="to"]').fill('2026-09-30');
  await page.getByRole('button', { name: 'Показать', exact: true }).click();
  await expect(page.getByTestId('charged')).toBeVisible();
});

test('ошибка загрузки тарифов не позволяет включить виджет', async ({ page, request }) => {
  await request.post(`${fixture}/__test/control`, { data: { failPath: '/rate-plans' } });
  await page.goto('/analytics/setup');
  await expect(
    page.getByRole('main').getByRole('alert').filter({ hasText: 'Не удалось загрузить тарифы' }),
  ).toBeVisible();
  await expect(page.getByTestId('booking-save')).toHaveCount(0);
});

test('номера: статус уборки, блокировка и снятие сохраняются', async ({ page, request }) => {
  await page.goto('/units/R01');
  await page.getByTestId('hk-DIRTY').click();
  await expect(page.getByText('Статус уборки: грязно')).toBeVisible();
  await page.getByTestId('hk-INSPECTED').click();
  await expect(page.getByText('Статус уборки: проверено')).toBeVisible();
  await page.getByLabel('Блокировка с').fill('2026-10-01');
  await page.getByLabel('До (не включая)').fill('2026-10-03');
  await page.getByLabel('Причина', { exact: true }).fill('Тест ремонта');
  await page.getByRole('button', { name: 'Заблокировать', exact: true }).click();
  await expect(page.getByTestId('block-row')).toContainText('Тест ремонта');
  // Снятие блокировки возвращает ячейку в продажу — стойка переспрашивает; «Отмена» ничего не шлёт
  const dialogs: string[] = [];
  page.once('dialog', (d) => {
    dialogs.push(d.message());
    void d.dismiss();
  });
  await page.getByTestId('block-row').getByRole('button', { name: 'снять', exact: true }).click();
  await expect.poll(() => dialogs.length).toBe(1);
  expect(dialogs[0]).toContain('Снять блокировку');
  await expect(page.getByTestId('block-row')).toContainText('Тест ремонта');
  page.once('dialog', (d) => void d.accept());
  await page.getByTestId('block-row').getByRole('button', { name: 'снять', exact: true }).click();
  await expect(page.getByTestId('block-row')).toHaveCount(0);
  const commands = await (await request.get(`${fixture}/__test/commands`)).json();
  expect(commands.map((c: { method: string; path: string }) => `${c.method} ${c.path}`)).toEqual([
    'POST /units/R01/housekeeping',
    'POST /units/R01/housekeeping',
    'POST /units/R01/blocks',
    'DELETE /units/R01/blocks/ui-block',
  ]);
});

test('гости: удаление документа переспрашивает; «Отмена» не шлёт команду', async ({
  page,
  request,
}) => {
  await page.goto('/guests/ui-guest');
  const form = page.getByTestId('document-form');
  await form.getByLabel('Номер документа').fill('TEST-ONLY-0042');
  await form.getByRole('button', { name: 'Добавить', exact: true }).click();
  await expect(page.getByTestId('document-row')).toContainText('0042');
  page.once('dialog', (d) => void d.dismiss());
  await page
    .getByTestId('document-row')
    .getByRole('button', { name: 'удалить', exact: true })
    .click();
  await expect(page.getByTestId('document-row')).toHaveCount(1);
  page.once('dialog', (d) => void d.accept());
  await page
    .getByTestId('document-row')
    .getByRole('button', { name: 'удалить', exact: true })
    .click();
  await expect(page.getByTestId('document-row')).toHaveCount(0);
  const commands = await (await request.get(`${fixture}/__test/commands`)).json();
  expect(commands.map((c: { method: string; path: string }) => `${c.method} ${c.path}`)).toEqual([
    'POST /guests/ui-guest/documents',
    'DELETE /guests/ui-guest/documents/ui-doc-1',
  ]);
});

test('новая бронь: число гостей ограничено вместимостью выбранной категории', async ({ page }) => {
  await page.goto('/reservations/new?unit=M03');
  const guests = page.getByTestId('placement-fields').first().getByLabel('Гостей в проживании');
  // койка в общем номере — один гость
  await expect(guests).toHaveAttribute('max', '1');
  await page.getByTestId('placement-fields').first().getByLabel('Категория *').selectOption('ROOM');
  await expect(guests).toHaveAttribute('max', '2');
});

test('тарифы: гостей в массовом изменении — по вместимости категории; несопоставленная категория не «уходит в каналы»', async ({
  page,
  request,
}) => {
  await page.goto('/rates?month=2026-10&category=MALE');
  const editor = page.getByTestId('bulk-editor');
  await expect(editor.getByLabel('Гостей (occupancy)')).toHaveAttribute('max', '1');
  await editor.locator('select[name="accommodationTypeCode"]').selectOption('ROOM');
  await expect(editor.getByLabel('Гостей (occupancy)')).toHaveAttribute('max', '2');
  await request.post(`${fixture}/__test/control`, { data: { ratesUnmapped: true } });
  await editor.getByLabel('Цена за ночь').fill('9100');
  await editor.getByRole('button', { name: '+ Добавить в список', exact: true }).click();
  await page.getByTestId('apply-changes').click();
  await expect(page.getByTestId('bulk-done')).toContainText('Сохранено изменений: 1');
  await expect(page.getByTestId('bulk-done')).toContainText('В каналы не ушло');
  await expect(page.getByTestId('bulk-done')).not.toContainText('Ушло в очередь');
});

test('неисправности: когда история обрезана, это написано', async ({ page, request }) => {
  await page.goto('/incidents');
  await expect(page.getByTestId('incidents-truncated')).toHaveCount(0);
  await request.post(`${fixture}/__test/control`, { data: { incidents: 200 } });
  await page.goto('/incidents');
  await expect(page.getByTestId('incidents-truncated')).toContainText('последние 200');
});

test('настройки: подсказка про услуги ведёт во вкладку «Счета», а не в «Финансы»', async ({
  page,
}) => {
  await page.goto('/hotel-settings/services');
  await expect(page.getByText('«Счета»')).toBeVisible();
  await expect(page.getByText('«Финансы»')).toHaveCount(0);
});

test('тарифы: добавить, удалить, сохранить и прочитать новую цену; отказ сохраняет список', async ({
  page,
  request,
}) => {
  await page.goto('/rates?month=2026-10');
  const editor = page.getByTestId('bulk-editor');
  await editor.getByLabel('Цена за ночь').fill('9100');
  await editor.getByRole('button', { name: '+ Добавить в список', exact: true }).click();
  await expect(page.getByTestId('pending-changes')).toContainText('9100');
  await editor.getByRole('button', { name: '×', exact: true }).click();
  await expect(page.getByTestId('apply-changes')).toBeDisabled();
  await editor.getByLabel('Цена за ночь').fill('9100');
  await editor.getByRole('button', { name: '+ Добавить в список', exact: true }).click();
  await request.post(`${fixture}/__test/control`, { data: { failPath: '/rates/bulk' } });
  await page.getByTestId('apply-changes').click();
  await expect(editor.getByRole('alert')).toBeVisible();
  await expect(page.getByTestId('pending-changes')).toContainText('9100');
  await request.post(`${fixture}/__test/control`, { data: {} });
  await page.getByTestId('apply-changes').click();
  await expect(page.getByTestId('bulk-done')).toContainText('Сохранено изменений: 1');
  await expect(page.getByTestId('price-2026-10-01-1')).toContainText('9 100');
});

test('сайты: проверка, домены, пауза, виджет, удаление и создание обновляют данные', async ({
  page,
}) => {
  await page.goto('/analytics/setup');
  await page.getByTestId('site-check').click();
  await expect(page.getByTestId('site-check-result')).toBeVisible();
  await page.getByTestId('hosts-input').fill('updated.example.invalid');
  await page.getByTestId('hosts-save').click();
  await expect(page.getByTestId('hosts-result')).toContainText('updated.example.invalid');
  await page.getByTestId('site-toggle').click();
  await expect(page.getByTestId('site-card-status')).toHaveText('на паузе');
  await page.getByTestId('site-toggle').click();
  await expect(page.getByTestId('site-card-status')).toHaveText('включён');
  await page.getByTestId('booking-enabled').uncheck();
  await page.getByTestId('booking-save').click();
  await expect(page.getByTestId('booking-result')).toContainText('выключено');
  await page.goto('/marketing');
  await expect(page.getByRole('main')).toContainText('updated.example.invalid');
  await page.goto('/analytics/setup');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByTestId('site-delete').click();
  await expect(page.getByTestId('site-card')).toHaveCount(0);
  await page.getByTestId('site-name').fill('Новый тестовый сайт');
  await page.getByTestId('site-hosts').fill('new.example.invalid');
  await page.getByTestId('site-create').click();
  await expect(page.getByTestId('site-card-name')).toHaveText('Новый тестовый сайт');
});

test('кнопки Channex отправляют команды один раз и показывают результат; проверка только читает', async ({
  page,
  request,
}) => {
  await page.goto('/connections');
  await page.getByRole('button', { name: 'Проверить соединение' }).click();
  await expect(page.getByText('Соединение установлено')).toBeVisible();
  expect(await (await request.get(`${fixture}/__test/commands`)).json()).toEqual([]);
  await page.goto('/channels');
  for (const id of ['channel-pull', 'channel-flush', 'channel-sync', 'channel-setup']) {
    // Streamed Suspense may briefly retain a hidden copy; require one visible action.
    const button = page.getByTestId(id).filter({ visible: true });
    await expect(button).toHaveCount(1);
    await button.click();
    await expect(page.getByTestId('channel-result').filter({ visible: true })).toBeVisible();
    await expect(button).toBeEnabled();
    await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
  }
  const commands = await (await request.get(`${fixture}/__test/commands`)).json();
  expect(commands.map((c: { path: string }) => c.path)).toEqual([
    '/channels/channex/pull',
    '/channels/channex/outbox/flush',
    '/channels/channex/sync',
    '/channels/channex/setup',
  ]);
  await expect(page.getByTestId('channel-webhook-register')).toBeDisabled();
  await expect(
    page.getByText('Для webhook укажите публичный HTTPS-адрес и секрет на сервере.'),
  ).toBeVisible();
});

test('пустые ответы дают нули; сбой API не выдаётся за пустую базу', async ({ page, request }) => {
  await request.post(`${fixture}/__test/control`, { data: { empty: true } });
  await page.goto('/channel-manager');
  await expect(page.getByTestId('channel-bookings')).toHaveText('0');
  await expect(page.getByTestId('channel-report')).toContainText('Нет бронирований');
  await page.goto('/finance');
  for (const id of ['charged', 'paid', 'refunded', 'balance'])
    await expect(page.getByTestId(id)).toHaveText('0,00 ₸');
  await page.goto('/rooms');
  for (const stat of await page.locator('.stat__value').all()) await expect(stat).toHaveText('0');
  await page.goto('/marketing');
  for (const stat of await page.locator('.stat__value').all()) await expect(stat).toHaveText('0');
  await request.post(`${fixture}/__test/control`, { data: { failPath: '*' } });
  for (const route of [
    '/today',
    '/chessboard',
    '/rooms',
    '/finance',
    '/channel-manager',
    '/marketing',
  ]) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Не удалось загрузить данные');
    await expect(page.locator('.stat__value:visible')).toHaveCount(0);
  }
  await page.goto('/connections');
  await expect(
    page.getByRole('main').getByRole('alert').filter({ hasText: 'Нет связи с рабочим API' }),
  ).toBeVisible();
  await expect(page.getByText('Соединение установлено')).toHaveCount(0);
});
