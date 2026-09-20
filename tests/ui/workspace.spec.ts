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
    ['/today', 'Главная'],
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
    ['/hotel-settings', 'Настройка гостиницы'],
    ['/hotel-settings/check-in', 'Заезд и выезд'],
    ['/hotel-settings/penalties', 'Штрафы'],
    ['/hotel-settings/services', 'Услуги'],
    ['/hotel-settings/description', 'Описание'],
    ['/hotel-settings/photos', 'Фото'],
    ['/hotel-settings/amenities', 'Удобства'],
    ['/management/statistics', 'Статистика'],
    ['/channel-manager', 'Менеджер каналов'],
    ['/connections', 'Подключения API'],
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
  // D4 (20.09): отказ отчёта не уносит экран — форма и заголовок на месте, вместо чисел сбой словами
  await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toHaveText(
    'Менеджер каналов',
  );
  await expect(page.getByRole('main').getByTestId('channel-report-error')).toBeVisible();
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
  // Фото, описание и удобства читаются из Channex (ADR-033): только просмотр, источник подписан
  await page.goto('/hotel-settings/photos');
  await expect(page.getByTestId('content-photos').getByRole('img', { name: 'Фасад' })).toHaveCount(
    1,
  );
  await expect(page.getByRole('main').getByTestId('content-source')).toContainText('Channex');
  await page.goto('/hotel-settings/amenities');
  await expect(page.getByTestId('content-facilities')).toContainText('WiFi');
  // значение — у своего факта и внутри main: при переходе Next держит уходящую страницу в DOM,
  // и тот же факт находился дважды (TESTING.md §3)
  await expect(
    page.getByRole('main').locator('.fact__label:text-is("Животные") + .fact__value'),
  ).toHaveText('нельзя');
  await page.goto('/hotel-settings/description');
  await expect(page.getByRole('main').getByTestId('content-description')).toContainText(
    'Вымышленное описание',
  );
  // свежесть данных в боковой панели: Exely · Channex · очередь ARI (шаг 4 плана wetop-live-data)
  await expect(page.getByTestId('data-freshness').first()).toContainText('очередь 0');
  await expect(page.getByRole('button', { name: /Сохранить|Создать|Загрузить/ })).toHaveCount(0);
});

test('главная: период готовыми отрезками и своими датами; мобильное меню и возврат фокуса', async ({
  page,
}) => {
  await page.goto('/today');
  // по умолчанию — сегодня: один день, загрузка по категориям вместо столбиков по дням
  await expect(page.getByRole('link', { name: 'Сегодня', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByTestId('chart-categories')).toBeVisible();
  await expect(page.getByTestId('kpi-occupancy')).toContainText('%');
  await expect(page.getByTestId('kpi-revenue')).toContainText('₸');
  await page.getByRole('link', { name: 'Этот месяц', exact: true }).click();
  await expect(page).toHaveURL(/period=month/);
  await expect(page.getByRole('link', { name: 'Этот месяц', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByTestId('chart-daily')).toBeVisible();
  await expect(page.getByTestId('kpi-compare')).toContainText('Сравнение с предыдущим периодом');
  await expect(page.getByTestId('sources')).toContainText('Booking.com');
  // свой отрезок — три дня
  await page.getByLabel('Период: с').fill('2026-09-01');
  await page.getByLabel('Период: по').fill('2026-09-03');
  await page.getByTestId('period-form').getByRole('button', { name: 'Показать' }).click();
  await expect(page).toHaveURL(/period=custom&from=2026-09-01&to=2026-09-03/);
  await expect(page.getByTestId('period-caption')).toContainText('3 дня');
  // неверный отрезок — ошибка на экране, показан сегодняшний день
  await page.goto('/today?period=custom&from=2026-09-10&to=2026-09-01');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('раньше начала');
  await expect(page.getByRole('main').getByTestId('chart-categories')).toBeVisible();
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

/**
 * Подсказка над шахматкой выводится поверх планки, поэтому открытой она накрывает строку фильтров:
 * до 17.09.2026 по кнопке «Сбросить» под ней нельзя было попасть мышью (найдено обходом стойки).
 */
test('шахматка: подсказка закрывается щелчком вне и не держит кнопки под собой', async ({
  page,
}) => {
  await page.goto('/chessboard');
  const help = page.locator('details.board-help');
  await help.locator('summary').click();
  await expect(help).toHaveAttribute('open', '');
  // щелчок вне подсказки — по заголовку экрана: с 19.09 (C1) строка фильтров стоит прямо под раскрытым
  // текстом, и щелчок по ней попадает в саму подсказку, а не «вне»
  await page.getByRole('heading', { level: 1 }).click();
  await expect(help).not.toHaveAttribute('open', '');
  // кнопки, которые она накрывала, снова под мышью
  await page.getByRole('button', { name: 'Номера', exact: true }).click({ timeout: 5000 });
  const reset = page.getByRole('button', { name: 'Сбросить', exact: true });
  await expect(reset).toBeVisible();
  await reset.click({ timeout: 5000 });
  await expect(page.getByTestId('unit-row')).toHaveCount(88);
  // Escape закрывает её так же, как щелчок вне
  await help.locator('summary').click();
  await expect(help).toHaveAttribute('open', '');
  await page.keyboard.press('Escape');
  await expect(help).not.toHaveAttribute('open', '');
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
  // Пока вкладка догружается, в DOM на миг есть скрытая копия панели действий — жмём видимую кнопку
  await page.getByTestId('check-in-ui-item').filter({ visible: true }).click();
  // §8 «сделал — и что?»: карточка перерисовывается молча, итог называет уведомление (срез 7.4)
  await expect(page.getByRole('status').filter({ hasText: 'Гость заселён' })).toBeVisible();
  await page.getByRole('tab', { name: 'Обзор', exact: true }).click();
  await expect(page.getByTestId('stay-row')).toContainText('заселён');
  const commands = await (await request.get(`${fixture}/__test/commands`)).json();
  expect(commands.map((c: { path: string }) => c.path)).toContain(
    `/reservations/${booking}/items/ui-item/check-in`,
  );
});

// «Главная» с 16.09 отказ стойки называет словами и не падает (dashboard-resilience.spec.ts), поэтому экран
// ошибки целиком проверяется на «Номерном фонде»: его запросы идут в границу ошибок без перехвата
test('экран ошибки различает отклонённый запрос (400/404) и отсутствие связи', async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/control`, {
    data: { failPath: '/inventory/summary', failStatus: 404 },
  });
  await page.goto('/inventory');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Не удалось загрузить данные');
  await expect(page.getByRole('main')).toContainText('Сервер отклонил запрос (код 404)');
  await expect(page.getByText('Проверьте подключение')).toHaveCount(0);
  await request.post(`${fixture}/__test/control`, { data: { failPath: '/inventory/summary' } });
  await page.goto('/inventory');
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
  await expect(page.getByTestId('finance-total')).toContainText('30 000 ₸');
  const result = await (
    await request.get(`${fixture}/finance/reservations/${booking}`, {
      headers: { 'x-wetop-test-client': '1' },
    })
  ).json();
  expect(result.balanceMinor).toBe('3000000');
});

test('обзор: задачи ведут к счетам, период не меняет полосу стойки, узкие экраны сохраняют действия', async ({
  page,
}) => {
  await page.goto('/today');
  const tasks = page.getByRole('complementary', { name: 'Задачи и размещение' });
  await expect(tasks.getByRole('heading', { name: 'Требуют внимания' })).toBeVisible();
  // долг уезжающего плюс «не заехал вовремя»: подтверждён, заезд был раньше, ни в одном списке дня его нет
  await expect(tasks.locator('.attention-count')).toHaveText('2');
  await expect(tasks.getByRole('link', { name: /К оплате/ })).toHaveAttribute(
    'href',
    '/reservations/20260913-TEST4#booking-finance',
  );
  const overdue = tasks.getByTestId('overdue-arrival');
  await expect(overdue).toHaveCount(1);
  await expect(overdue).toContainText('Не заехал');
  await expect(overdue).toHaveAttribute('href', '/reservations/20260913-TEST8#booking-actions');
  const debt = await page.getByTestId('c-debt').innerText();
  const arrivals = await page.getByTestId('c-arrivals').innerText();
  // полоса стойки — всегда про сегодня, какой бы период ни был выбран сверху
  await page.getByRole('link', { name: 'Прошлый месяц', exact: true }).click();
  await expect(page).toHaveURL(/period=last-month/);
  await expect(page.getByTestId('c-debt')).toHaveText(debt);
  await expect(page.getByTestId('c-arrivals')).toHaveText(arrivals);
  await expect(page.getByRole('region', { name: 'Сегодня на стойке' })).toContainText('сейчас');
  await expect(tasks.locator('.attention-count')).toHaveText('2');
  await expect(
    page
      .getByRole('region', { name: 'Сегодня на стойке' })
      .getByRole('link', { name: 'Все брони дня' }),
  ).toHaveAttribute('href', /\/reservations\?date=\d{4}-\d{2}-\d{2}/);
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
  // Во время перехода Next держит в DOM уходящую страницу: смотрим ту, что видит человек
  await expect(page.getByRole('main').getByTestId('charged')).toBeVisible();
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
  // Снятие блокировки возвращает ячейку в продажу — стойка переспрашивает окном (DESIGN.md §8);
  // отказ в окне проверяет тест «снятие блокировки спрашивают» ниже
  await page.getByTestId('block-row').getByRole('button', { name: 'снять', exact: true }).click();
  await page
    .getByTestId('confirm-dialog')
    .getByRole('button', { name: 'Снять блокировку' })
    .click();
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
  // у гостя фикстуры уже есть паспорт: ищем именно добавленную строку
  const added = page.getByTestId('document-row').filter({ hasText: '0042' });
  await expect(added).toHaveCount(1);
  await expect(page.getByTestId('document-row')).toHaveCount(2);
  const dialog = page.getByTestId('confirm-dialog');
  await added.getByRole('button', { name: 'удалить', exact: true }).click();
  await expect(dialog).toContainText('Удалить документ');
  await dialog.getByRole('button', { name: 'Оставить как есть' }).click();
  await expect(page.getByTestId('document-row')).toHaveCount(2);
  await added.getByRole('button', { name: 'удалить', exact: true }).click();
  await dialog.getByRole('button', { name: 'Удалить документ' }).click();
  await expect(page.getByTestId('document-row')).toHaveCount(1);
  const commands = await (await request.get(`${fixture}/__test/commands`)).json();
  expect(commands.map((c: { method: string; path: string }) => `${c.method} ${c.path}`)).toEqual([
    'POST /guests/ui-guest/documents',
    'DELETE /guests/ui-guest/documents/ui-doc-2',
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
  // описание: сведения PMS и описание из Channex — две разные панели с двумя разными адресами
  await page.goto('/hotel-settings/description');
  await expect(page.getByText('Сведения об объекте в PMS', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Здесь — то, что знает PMS/).first()).toBeVisible();
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
  await editor.getByRole('button', { name: 'Убрать строку 1', exact: true }).click();
  await expect(page.getByTestId('apply-changes')).toBeDisabled();
  await editor.getByLabel('Цена за ночь').fill('9100');
  await editor.getByRole('button', { name: '+ Добавить в список', exact: true }).click();
  await request.post(`${fixture}/__test/control`, { data: { failPath: '/rates/bulk' } });
  await page.getByTestId('apply-changes').click();
  await expect(editor.getByRole('alert')).toBeVisible();
  await expect(page.getByTestId('pending-changes')).toContainText('9100');
  await request.post(`${fixture}/__test/control`, { data: {} });
  await page.getByTestId('apply-changes').click();
  // Отправку в каналы экран обещает по ответу API, а не «всегда» (§7.3)
  await expect(page.getByTestId('bulk-done')).toContainText('Сохранено изменений: 1');
  await expect(page.getByTestId('bulk-done')).toContainText('В очередь каналов ушло 1');
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
  await page.goto('/analytics/setup');
  const main = page.getByRole('main');
  await main.getByTestId('site-delete').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Удалить сайт' }).click();
  await expect(main.getByTestId('site-card')).toHaveCount(0);
  await main.getByTestId('site-name').fill('Новый тестовый сайт');
  await main.getByTestId('site-hosts').fill('new.example.invalid');
  await main.getByTestId('site-create').click();
  await expect(main.getByTestId('site-card-name')).toHaveText('Новый тестовый сайт');
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
    await expect(page.getByRole('main').getByTestId(id)).toHaveText('0 ₸');
  await page.goto('/rooms');
  for (const stat of await page.locator('.stat__value').all()) await expect(stat).toHaveText('0');
  await request.post(`${fixture}/__test/control`, { data: { failPath: '*' } });
  for (const route of ['/chessboard', '/rooms']) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Не удалось загрузить данные');
    await expect(page.locator('.stat__value:visible')).toHaveCount(0);
  }
  // «Менеджер каналов» с D4 (20.09) остаётся на экране: заголовок и форма на месте, вместо чисел — сбой
  await page.goto('/channel-manager');
  await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toHaveText(
    'Менеджер каналов',
  );
  await expect(page.getByRole('main').getByTestId('channel-report-error')).toBeVisible();
  await expect(page.locator('.stat__value:visible')).toHaveCount(0);
  // «Деньги за период» с D2 (20.09) остаются на экране: заголовок и период на месте, вместо чисел — сбой
  await page.goto('/finance');
  await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toHaveText(
    'Деньги за период',
  );
  await expect(page.getByRole('main').getByTestId('finance-error')).toBeVisible();
  await expect(page.locator('.stat__value:visible')).toHaveCount(0);
  /*
   * «Главная» с 16.09.2026 ведёт себя иначе намеренно (замечание владельца «выбираю период и нифига
   * не открывает»): экран открывается, а каждый неудавшийся блок называет причину сам. Правило этой
   * проверки остаётся тем же — нули вместо неизвестных чисел не показываются.
   */
  await page.goto('/today');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Главная');
  await expect(page.getByTestId('dashboard-error')).toBeVisible();
  await expect(page.getByTestId('desk-error')).toBeVisible();
  await expect(page.locator('.stat__value:visible')).toHaveCount(0);
  await expect(page.locator('.desk-stat__value:visible')).toHaveCount(0);
  await expect(page.getByTestId('kpi-occupancy')).toHaveCount(0);
  await page.goto('/connections');
  await expect(
    page.getByRole('main').getByRole('alert').filter({ hasText: 'Нет связи с рабочим API' }),
  ).toBeVisible();
  await expect(page.getByText('Соединение установлено')).toHaveCount(0);
});

/**
 * Необратимое спрашивают окном подтверждения (DESIGN.md §8, §15; срез 7.3 плана дизайн-системы).
 *
 * До правки снятие блокировки и удаление документа гостя шли с одного клика: промах по строке — и
 * койка вернулась в продажу или паспорт стёрт без следа на экране. Системное `window.confirm` тоже
 * не годится: оно не скажет, что именно исчезнет.
 */
test('снятие блокировки спрашивают: «оставить как есть» ничего не меняет, подтверждение снимает', async ({
  page,
  request,
}) => {
  await page.goto('/units/R01');
  await page.getByLabel('Блокировка с').fill('2026-10-01');
  await page.getByLabel('До (не включая)').fill('2026-10-03');
  await page.getByLabel('Причина', { exact: true }).fill('Тест ремонта');
  await page.getByRole('button', { name: 'Заблокировать', exact: true }).click();
  await expect(page.getByTestId('block-row')).toContainText('Тест ремонта');

  await page.getByTestId('block-row').getByRole('button', { name: 'снять', exact: true }).click();
  const dialog = page.getByTestId('confirm-dialog');
  await expect(dialog).toContainText('Снять блокировку');
  await dialog.getByRole('button', { name: 'Оставить как есть' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId('block-row')).toContainText('Тест ремонта');

  await page.getByTestId('block-row').getByRole('button', { name: 'снять', exact: true }).click();
  await dialog.getByRole('button', { name: 'Снять блокировку' }).click();
  await expect(page.getByTestId('block-row')).toHaveCount(0);
  const commands = await (await request.get(`${fixture}/__test/commands`)).json();
  expect(
    commands
      .filter((c: { method: string }) => c.method === 'DELETE')
      .map((c: { path: string }) => c.path),
  ).toEqual(['/units/R01/blocks/ui-block']);
});

test('удаление документа гостя спрашивают: отказ оставляет документ на карточке', async ({
  page,
  request,
}) => {
  await page.goto('/guests/ui-guest');
  await expect(page.getByTestId('document-row')).toHaveCount(1);
  await page.getByTestId('document-row').getByRole('button', { name: 'удалить' }).click();
  const dialog = page.getByTestId('confirm-dialog');
  await expect(dialog).toContainText('Удалить документ');
  await dialog.getByRole('button', { name: 'Оставить как есть' }).click();
  await expect(page.getByTestId('document-row')).toHaveCount(1);
  expect(await (await request.get(`${fixture}/__test/commands`)).json()).toEqual([]);

  await page.getByTestId('document-row').getByRole('button', { name: 'удалить' }).click();
  await dialog.getByRole('button', { name: 'Удалить документ' }).click();
  await expect(page.getByTestId('document-row')).toHaveCount(0);
});

/**
 * «Гости» показывают всех, кто живёт сегодня (§7.3 плана wetop-domain).
 *
 * До правки экран читал первую страницу списка броней — 25 строк, — и остальных примерно 55 гостей
 * смена не видела вовсе: подписи «показаны первые 25» на месте не было, а поиск требует знать имя.
 */
test('гости на сегодня: в списке все, а не первые двадцать пять', async ({ page, request }) => {
  const seeded = await (await request.post(`${fixture}/__test/crowd-seed?n=40`)).json();
  expect(seeded.stays).toBe(40);
  await page.goto('/guests');
  const rows = page.locator('.dir-table tbody tr');
  // 40 засеянных плюс брони обычной фикстуры на сегодня; страница в 25 строк дала бы ровно 25
  const shown = await rows.count();
  expect(shown).toBeGreaterThan(40);
  await expect(page.getByTestId('guests-today-count')).toContainText(`сегодня: ${shown} гост`);
  await expect(page.getByText('показаны гости из первых')).toHaveCount(0);
});

/**
 * Подписи ведут туда, куда написано (§7.3 плана wetop-domain).
 *
 * «Как начислить услугу» звала вкладку карточки «Финансы», хотя она называется «Счета», и вела
 * искать проживающего гостя на «Сегодня» — а срез 14 (ADR-047) убрал оттуда списки дня: гости
 * живут на «Гостях». Администратор шёл по подписи и не находил ни вкладки, ни списка.
 */
test('настройки услуг: путь к начислению назван вкладкой, которая есть, и ведёт к списку гостей', async ({
  page,
}) => {
  await page.goto('/hotel-settings/services');
  const panel = page.getByTestId('service-hint');
  await expect(panel).toContainText('«Счета»');
  await expect(panel).not.toContainText('«Финансы»');
  await panel.getByRole('link', { name: 'Найти проживающего гостя' }).click();
  await expect(page).toHaveURL(/\/guests$/);
  await expect(page.getByTestId('guests-today-count')).toBeVisible();
});

test('описание объекта: два адреса подписаны источником — PMS и Channex', async ({ page }) => {
  await page.goto('/hotel-settings/description');
  // Адресов на экране два: в PMS его меняет стойка, в Channex — кабинет канала. Без подписи
  // при расхождении непонятно, какой из них правит администратор.
  await expect(page.getByTestId('stored-property')).toContainText('Адрес в PMS');
  await expect(page.getByText('Адрес в Channex')).toBeVisible();
  await expect(page.getByText('Адрес', { exact: true })).toHaveCount(0);
});

test('кнопки называют своё действие: гость заводится бронью, оплата — на счёте брони', async ({
  page,
}) => {
  // «Добавить гостя» вела в форму брони, «Принять оплату» на «Деньгах» — в список броней:
  // ни гостя отдельно, ни оплаты по этим кнопкам не заводится (§7.3).
  await page.goto('/guests');
  const newBooking = page.getByRole('main').getByRole('link', { name: 'Новая бронь с гостем' });
  await expect(newBooking).toBeVisible();
  await newBooking.click();
  await expect(page).toHaveURL(/\/reservations\/new$/);

  await page.goto('/finance');
  await expect(page.getByRole('main').getByRole('link', { name: 'Принять оплату' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Найти бронь для оплаты' }).click();
  await expect(page).toHaveURL(/\/reservations$/);
});

/**
 * Период доступности длиннее 62 ночей — ошибка формы, а не «нет связи» (§7.3 плана wetop-domain).
 *
 * API считает доступность той же шахматкой, а у неё потолок 62 дня за запрос: на 90 ночей он
 * отвечал 400, экран падал в общую ошибку «Проверьте подключение и повторите запрос», и
 * администратор чинил связь вместо того, чтобы укоротить период.
 */
test('доступность: период длиннее 62 ночей объясняется формой, а не ошибкой связи', async ({
  page,
}) => {
  await page.goto('/rooms/availability?arrival=2026-10-01&departure=2027-01-01');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('62');
  await expect(page.getByText('Проверьте подключение')).toHaveCount(0);
  // форма на месте и даёт исправить период, а не только «повторить загрузку»
  await expect(page.getByLabel('Заезд')).toHaveValue('2026-10-01');
  // тот же предел стоит и в самом поле даты: браузер не даст выбрать выезд дальше горизонта
  await expect(page.getByLabel('Выезд')).toHaveAttribute('max', '2026-12-02');
  await page.getByRole('link', { name: 'Неделя' }).click();
  await expect(page.getByText('не больше 62 ночей')).toHaveCount(0);
  await expect(page.getByText('Доступно на весь срок')).toBeVisible();
});

/**
 * Сбой шахматки на «Номерах» виден как сбой, а не как «нет данных» (§7.3 плана wetop-domain).
 *
 * Занятость карточек и категорий считается шахматкой, и её ответ ловился `.catch(() => null)`:
 * при любой ошибке каждая карточка писала «Нет данных», а каждая категория — «нет данных».
 * Смена читала это как «в системе пусто» и шла заводить брони заново.
 */
test('номера: сбой шахматки назван сбоем, а не пустотой', async ({ page, request }) => {
  await request.post(`${fixture}/__test/control`, { data: { failPath: '/chessboard' } });
  await page.goto('/rooms');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Занятость');
  await expect(page.getByText('Нет данных')).toHaveCount(0);

  await page.goto('/rooms/categories');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Занятость');
  await expect(page.getByText('нет данных')).toHaveCount(0);

  // как только шахматка отвечает, занятость на месте и предупреждения нет
  await request.post(`${fixture}/__test/control`, { data: {} });
  await page.goto('/rooms/categories');
  await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
  await expect(page.getByText('занято').first()).toBeVisible();
});

/**
 * «Демо бронирования» предупреждает, что бронь настоящая (§7.3 плана wetop-domain).
 *
 * Демо-страница виджета работает на живом API: `POST /w/book` создаёт обычную бронь, занимает
 * место и открывает счёт. Ссылка звалась «демо», ничего об этом не говорила — и проверка
 * виджета молча съедала койку.
 */
test('настройка сайта: у демо бронирования сказано, что бронь настоящая', async ({ page }) => {
  await page.goto('/analytics/setup');
  await expect(page.getByTestId('booking-demo-warning')).toContainText('настоящая');
  // DESIGN.md §14: стрелок в конце текста ссылок нет
  await expect(page.getByTestId('site-card')).not.toContainText('↗');
});

/**
 * Время входящих событий Channex — по часам объекта (§7.3 плана wetop-domain, DESIGN.md §14).
 *
 * Лента печатала сырой ISO из базы: `2026-09-17T05:12` — это UTC, а стойка читает его как своё
 * время и считает, что бронь пришла пять часов назад. Часового пояса рядом не было.
 */
test('подключения каналов: время события — по Алматы, а не сырой UTC', async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/design-seed`); // лента событий живёт в засеянных данных
  await page.goto('/channels');
  const rows = page.getByTestId('event-row');
  await expect(rows.first()).toContainText('10:12'); // 05:12 UTC = 10:12 в Алматы
  await expect(rows.first()).not.toContainText('05:12');
});

/**
 * «Каналы» переживают сбой сводки фонда и не показывают пустую таблицу молча (§7.3).
 *
 * Страница читала сводку фонда без `catch`: её отказ уносил весь экран — вместе с очередью ARI
 * и статусом webhook, то есть ровно тем, ради чего на него и заходят, когда что-то сломалось.
 * А пустой маппинг выглядел как таблица из одной шапки: непонятно, то ли не настроено, то ли
 * не загрузилось.
 */
test('каналы: сбой сводки фонда не уносит очередь и webhook; пустой маппинг назван словами', async ({
  page,
  request,
}) => {
  await page.goto('/channels');
  await expect(page.getByTestId('mapping-empty')).toContainText(/сопоставлений пока нет/i);

  await request.post(`${fixture}/__test/control`, { data: { failPath: '/inventory/summary' } });
  await page.goto('/channels');
  await expect(page.getByRole('heading', { name: 'Каналы продаж — Channex' })).toBeVisible();
  await expect(page.getByTestId('inventory-failed')).toBeVisible();
  await expect(page.getByText('Проверьте подключение')).toHaveCount(0);
});

test('журнал: время операции — тем же способом, что и везде (по Алматы)', async ({ page }) => {
  // Было: ручная арифметика «+5 часов» и обрезанный ISO. Пояс объекта задаётся одним местом,
  // иначе при переносе сервера в РК два экрана покажут разное время одного события.
  await page.goto('/journal');
  await expect(page.getByTestId('journal-row').first()).toContainText('13:30');
});

/**
 * Форма оплаты подтверждает приём словами (§7.3 плана wetop-domain).
 *
 * После «Принять оплату» форма очищалась, и всё: администратор видел пустые поля и должен был
 * сам искать в таблице, прошла ли оплата. Для денег молчание — худший ответ.
 */
test('счета: приём оплаты подтверждается суммой на экране', async ({ page }) => {
  await page.goto('/reservations/20260913-TESTAA');
  await page.getByRole('tab', { name: 'Счета', exact: true }).click();
  const payment = page.getByTestId('payment-form').filter({ visible: true }).first();
  await payment.getByLabel('Сумма', { exact: true }).fill('1200');
  await payment.getByRole('button', { name: 'Принять оплату', exact: true }).click();
  await expect(page.getByTestId('finance-done')).toContainText('Оплата принята');
  await expect(page.getByTestId('finance-done')).toContainText('1 200');
});

/**
 * «Деньги за период» объясняют слишком длинный период формой, а не экраном «нет связи» (§7.4).
 *
 * Отчёт собирает начисления, оплаты и возвраты за период: без предела с экрана можно было
 * попросить десять лет и уложить базу. Предел — 366 дней, и о нём должна сказать страница,
 * сохранив даты, а не общий экран ошибки без формы.
 */
test('деньги за период: период длиннее года объясняется на странице', async ({ page }) => {
  await page.goto('/finance?from=2020-01-01&to=2030-12-31');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('не больше года');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('366');
  await expect(page.getByText('Проверьте подключение')).toHaveCount(0);
  await expect(page.locator('input[name="from"]')).toHaveValue('2020-01-01');
  // отчёт не запрашивался: чисел за период на экране нет
  await expect(page.getByTestId('charged')).toHaveCount(0);
});

/**
 * Срез 7.1: на клетке видно то, ради чего сейчас открывают карточку (документ ментора 14.09,
 * `DESIGN.md` §9 и план `plans/slice-7-1-chessboard-2026-09-17.md`).
 *
 * Бронь из канала не подтверждена — словом, а не только жёлтым (Q-135); канал — бейджем, потому что
 * цвет уже занят статусом; неоплаченный остаток — плашкой суммы; убрана ли ячейка — бейджем в строке.
 * Фильтр «Уборка» до этого искал тип блокировки `CLEANING`, которого в модели нет, и не срабатывал
 * никогда.
 */
test('шахматка: статус словом, канал бейджем, долг плашкой, уборка в строке', async ({ page }) => {
  await page.goto('/chessboard');
  const plate = page.getByTestId('stay-cell').first();
  await expect(plate).toBeVisible();

  // статус «не подтверждена» читается словом в подсказке клетки
  const tentative = page.locator('td[data-status="TENTATIVE"]').first();
  await expect(tentative).toHaveAttribute('title', /не подтверждена/);

  // канал и остаток к оплате — на плашке брони
  await expect(page.getByTestId('cell-channel').first()).toBeVisible();
  await expect(page.getByTestId('cell-due').first()).toContainText('₸');

  // уборка — бейджем в строке ячейки
  await expect(page.getByTestId('unit-housekeeping').first()).toBeVisible();
});

test('шахматка: фильтр «Уборка» показывает грязные ячейки, а не пустоту', async ({ page }) => {
  await page.goto('/chessboard');
  const all = await page.getByTestId('unit-row').count();
  await page.getByRole('button', { name: 'Уборка', exact: true }).click();
  const dirty = await page.getByTestId('unit-row').count();
  expect(dirty).toBeGreaterThan(0);
  expect(dirty).toBeLessThan(all);
  // легенда называет статусы глифом и словом, а не одним цветом (принцип 4)
  await expect(page.getByTestId('board-legend')).toContainText('не подтверждена');
});

/**
 * Срез 7.2 — три сцены показа Channex на сертификации. Очередь строками, ссылка входящей ревизии на
 * карточку брони и цепочка «ревизия → бронь → ячейка» проверяются в `channex-screens.spec.ts` на витрине
 * фикстуры; плашка «входящая бронь требует разбора» на шахматке (Q-135) — в `manager-actions.spec.ts`
 * (`review-callout`). Здесь осталась третья сцена — правка цены в ячейке календаря. После слияния 19.09
 * их дубли из второй ветки ждали другие testid и другие слова — сведено к одному тесту на утверждение.
 */
test('цены: правка в ячейке календаря уходит тем же путём, что массовая, и говорит про очередь', async ({
  page,
}) => {
  await page.goto('/rates');
  const cell = page.getByTestId('rates-table').getByTestId('price-cell-edit').first();
  await cell.click();
  const input = page.getByTestId('price-cell-input');
  await input.fill('15000');
  await page.getByRole('button', { name: 'Сохранить цену' }).click();
  const said = page.getByTestId('price-cell-result');
  await expect(said).toContainText('Цена сохранена');
  await expect(said).toContainText('в очередь каналов');
});

/**
 * Срез 7.3 (Д5): сумму администратор объявляет гостю ДО действия, а система до сих пор считала её
 * молча после нажатия. Окно подтверждения обязано назвать число — одно и то же с тем, что появится
 * на счёте (его даёт предпросмотр `GET …/preview`, считающий теми же функциями, что само действие).
 */
test('«+1 ночь» спрашивает и называет цену новой ночи; отказ ничего не меняет', async ({
  page,
  request,
}) => {
  await page.goto('/reservations/20260913-TEST1');
  await page.getByRole('tab', { name: 'Действия', exact: true }).click();
  await page
    .getByTestId(/^extend-/)
    .first()
    .click();
  const dialog = page.locator('dialog[open][data-testid="confirm-dialog"]');
  await expect(dialog).toContainText('Новая ночь');
  await expect(dialog).toContainText('₸');
  await dialog.getByRole('button', { name: 'Оставить как есть' }).click();
  const commands = await (await request.get(`${fixture}/__test/commands`)).json();
  expect(commands.filter((c: { path: string }) => c.path.includes('/extend'))).toEqual([]);

  await page
    .getByTestId(/^extend-/)
    .first()
    .click();
  await dialog.getByRole('button', { name: 'Продлить' }).click();
  await expect
    .poll(
      async () =>
        (await (await request.get(`${fixture}/__test/commands`)).json()).filter(
          (c: { path: string }) => c.path.includes('/extend'),
        ).length,
    )
    .toBe(1);
});

/**
 * B2 «Форма брони» (tasks/todo.md, 20.09.2026): резюме выбора собирается по ходу заполнения из самих
 * полей (даты и ночи, размещение, источник, гость) без цен — цену и доступность считает сервер при
 * создании; кнопка «Создать бронь» вместе с резюме держится у нижнего края окна, пока форма
 * прокручена, а на телефоне стоит над нижней навигацией, не под ней.
 */
test('новая бронь: резюме выбора обновляется по ходу, кнопка создания видна при прокрутке и на телефоне', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 700 });
  await page.goto('/reservations/new');
  const form = page.getByRole('main').getByTestId('new-reservation-form');
  const summary = form.getByTestId('booking-summary');
  await expect(summary).toContainText('1 ночь');
  await expect(summary).not.toContainText('₸');
  // категория и ячейка — те, что выбраны в самой форме (какие свободны, решает стенд, не тест)
  const first = form.getByTestId('placement-fields').first();
  const category = first.getByLabel('Категория *');
  await category.selectOption('MALE');
  const categoryName = (await category.locator('option:checked').textContent())!.replace(
    /\s*\(свободно \d+\)\s*$/,
    '',
  );
  const unitSelect = first.getByLabel('Ячейка');
  const unitCode = (await unitSelect.locator('option').nth(1).getAttribute('value'))!;
  await unitSelect.selectOption(unitCode);
  await expect(summary).toContainText(categoryName);
  await expect(summary).toContainText(`ячейка ${unitCode}`);
  await form.getByLabel('Источник *').selectOption('PHONE');
  await expect(summary).toContainText('телефон');
  await form.getByLabel('Имя *', { exact: true }).fill('Айгуль');
  await form.getByLabel('Фамилия *', { exact: true }).fill('Тестовая');
  // §14: «Фамилия Имя»
  await expect(summary).toContainText('Тестовая Айгуль');
  await category.selectOption('ROOM');
  const roomName = (await category.locator('option:checked').textContent())!.replace(
    /\s*\(свободно \d+\)\s*$/,
    '',
  );
  await expect(summary).toContainText(roomName);
  await expect(summary).not.toContainText(`ячейка ${unitCode}`);
  // окно 700 px: форма длиннее экрана, но кнопка создания видна, пока прокручено к её началу
  await form.getByLabel('Источник *').scrollIntoViewIfNeeded();
  await expect(form.getByRole('button', { name: 'Создать бронь' })).toBeInViewport();

  // телефон: кнопка над нижней навигацией, страница без прокрутки вбок
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/reservations/new?unit=M03');
  const button = form.getByRole('button', { name: 'Создать бронь' });
  await form.getByLabel('Источник *').scrollIntoViewIfNeeded();
  await expect(button).toBeInViewport();
  const [box, nav] = await Promise.all([
    button.boundingBox(),
    page.locator('.bottom-navigation').boundingBox(),
  ]);
  expect(box!.y + box!.height).toBeLessThanOrEqual(nav!.y + 1);
  const layout = await page.evaluate(() => ({
    viewport: window.innerWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(layout.content).toBeLessThanOrEqual(layout.viewport + 1);
});

/**
 * D1 «Гости» (tasks/todo.md): поиск назван словами и пустой результат говорит, что сделать; статус
 * пребывания на карточке — одной фразой; длинное имя переносится, а не режется и не уводит экран
 * вбок; история и переход к брони доступны на телефоне.
 */
test('гости D1: выборка и пустота словами, статус пребывания, длинное имя и история на телефоне', async ({
  page,
  request,
}) => {
  await page.goto('/guests?q=Тест');
  const main = page.getByRole('main');
  await expect(main.getByTestId('guests-meta')).toContainText('по запросу «Тест»');
  const row = main.getByTestId('guests-table').locator('tbody tr').first();
  await expect(row).toContainText('Гость Тестовый');
  await expect(row.locator('time').first()).toHaveAttribute('datetime', /\d{4}-\d{2}-\d{2}/);
  await expect(main.getByRole('link', { name: 'Убрать поиск' })).toBeVisible();

  await page.goto('/guests?q=Нетакого');
  const empty = main.getByTestId('guests-empty');
  await expect(empty).toContainText('Гостей по запросу «Нетакого» не найдено');
  await expect(empty.getByRole('link', { name: 'Новая бронь с гостем' })).toBeVisible();
  await empty.getByRole('link', { name: 'Убрать поиск' }).click();
  await expect(page).toHaveURL(/\/guests$/);
  await expect(main.getByTestId('guests-today-count')).toBeVisible();

  // длинное имя (вымышленное, ADR-010) — через ту же правку профиля, что делает стойка
  await request.patch(`${fixture}/guests/ui-guest`, {
    data: {
      lastName: 'Абдрахманова-Сулейменова',
      firstName: 'Айгерим-Гульназ',
      middleName: 'Бауыржановна',
    },
    headers: { 'x-wetop-test-client': '1' },
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/guests?q=Абдрахманова');
  await expect(main.getByTestId('guests-table')).toContainText('Абдрахманова-Сулейменова');
  let overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  // карточка: статус пребывания фразой над вкладками, история — с датами и ссылкой на бронь
  await page.goto('/guests/ui-guest');
  await expect(main.getByRole('heading', { level: 1 })).toContainText('Абдрахманова-Сулейменова');
  await expect(main.getByTestId('guest-stay-now')).toContainText(/ожидается сегодня, R01|живёт/);
  await expect(main.getByTestId('guest-head')).toContainText('KAZ');
  overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await main.getByRole('tab', { name: 'Проживания', exact: true }).click();
  const stay = main.getByTestId('guest-stay-row').first();
  await expect(stay).toContainText('R01');
  await expect(stay.locator('time').first()).toHaveAttribute('datetime', /\d{4}-\d{2}-\d{2}/);
  await expect(stay.getByRole('link', { name: 'Открыть бронь 20260913-TESTAA' })).toBeVisible();
  const tableOverflow = await main
    .getByTestId('guest-stay-row')
    .first()
    .locator('xpath=ancestor::div[contains(@class,"table-scroll")]')
    .evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(tableOverflow).toBeLessThanOrEqual(1);
  await main.getByRole('tab', { name: 'Счета и услуги', exact: true }).click();
  await expect(main.locator('.guest-account-links a').first()).toContainText('20260913-TESTAA');
});

/**
 * D2 «Финансовый отчёт» (tasks/todo.md): период назван словами и переключается готовыми отрезками;
 * начисления, деньги на руках и остаток — тремя блоками с пояснением к каждому числу; отказ API не
 * выдаётся за нули; «Найти бронь для оплаты» ведёт в список броней.
 */
test('деньги D2: период словами, три блока с пояснениями, отказ не выглядит нулями', async ({
  page,
  request,
}) => {
  await page.goto('/finance?from=2026-09-01&to=2026-09-30');
  const main = page.getByRole('main');
  await expect(main.getByTestId('finance-period')).toContainText('1 сент. → 30 сент., 30 дней');
  await expect(main.getByTestId('finance-charges')).toContainText('Начислено гостям');
  await expect(main.getByTestId('finance-charges').getByTestId('charged')).toHaveText('24 000 ₸');
  await expect(main.getByTestId('finance-money').getByTestId('paid')).toHaveText('8 000 ₸');
  await expect(main.getByTestId('finance-money')).toContainText('возвратов не было');
  await expect(main.getByTestId('finance-due').getByTestId('balance')).toHaveText('16 000 ₸');
  await expect(main.getByTestId('finance-due')).toContainText(
    'Взыскать можно только на счёте брони',
  );
  // готовые отрезки: ссылка ведёт на период в адресе, активный отмечен
  await main.getByRole('link', { name: 'Сегодня', exact: true }).click();
  await expect(page).toHaveURL(/\/finance\?from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}/);
  await expect(main.getByRole('link', { name: 'Сегодня', exact: true })).toHaveClass(/is-active/);
  await expect(main.getByTestId('finance-period')).toContainText(', 1 день');
  // отказ API: заголовок, форма и период остаются, чисел нет, повтор возвращает их
  await request.post(`${fixture}/__test/control`, { data: { failPath: '/finance/report' } });
  await page.goto('/finance?from=2026-09-01&to=2026-09-30');
  await expect(main.getByTestId('finance-period')).toBeVisible();
  await expect(main.getByTestId('finance-error')).toContainText('Проверьте подключение');
  await expect(main.getByTestId('charged')).toHaveCount(0);
  await expect(main.locator('input[name="from"]')).toHaveValue('2026-09-01');
  await request.post(`${fixture}/__test/control`, { data: {} });
  await main
    .getByTestId('finance-error')
    .getByRole('button', { name: 'Повторить загрузку' })
    .click();
  await expect(main.getByTestId('charged')).toHaveText('24 000 ₸');
  await expect(main.getByTestId('finance-error')).toHaveCount(0);
});

/**
 * D4 «Номера и категории» (tasks/todo.md): пустой результат фильтров — общим `EmptyState` со сбросом;
 * карточки без « · » и стрелок; таблицы категорий и доступности на телефоне без прокрутки вбок;
 * пока фонд идёт — скелетон с подписью словом.
 */
test('номера D4: пустота фильтров словами со сбросом, телефон без прокрутки вбок, скелетон', async ({
  page,
  request,
}) => {
  await page.goto('/rooms');
  const main = page.getByRole('main');
  await expect(main.getByTestId('rooms-shown')).toContainText('Показано 16 из 88');
  await main.getByLabel('Поиск номеров').fill('нет такого');
  const empty = main.getByTestId('rooms-empty');
  await expect(empty).toContainText('Нет подходящих номеров');
  await expect(empty).toContainText('«нет такого»');
  await empty.getByRole('button', { name: 'Сбросить фильтры' }).click();
  await expect(main.getByTestId('rooms-shown')).toContainText('из 88');
  await expect(main.locator('.room-card').first()).toBeVisible();
  await expect(main.locator('.room-card-footer').first()).not.toContainText('·');

  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of [
    '/rooms/categories',
    '/rooms/availability?arrival=2026-10-01&departure=2026-10-04',
  ]) {
    await page.goto(route);
    await expect(main.locator('.dir-table tbody tr').first()).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, route).toBeLessThanOrEqual(1);
  }
  await expect(
    main.getByRole('link', { name: 'Создать бронь', exact: true }).first(),
  ).toBeVisible();

  await request.post(`${fixture}/__test/control`, {
    data: { delayPath: '/inventory/units', delayMs: 2500 },
  });
  await page.goto('/rooms', { waitUntil: 'commit' });
  const loading = page.getByTestId('rooms-loading');
  await expect(loading).toBeVisible();
  await expect(loading.getByRole('status')).toHaveText('Загружаем номера и занятость…');
  await expect(page.getByRole('main').locator('.room-card').first()).toBeVisible();
  await request.post(`${fixture}/__test/control`, { data: {} });
});
