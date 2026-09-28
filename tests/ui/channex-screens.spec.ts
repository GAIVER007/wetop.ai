import { expect, test } from './fixtures';

/**
 * Срез 7.2 «Три экрана Channex» (plans/slice-7-2-channex-screens.md) на синтетическом API с витриной,
 * с 27.09.2026 — в модуле «Каналы продаж» (ADR-112): отчёт по источникам на «Обзоре», очередь на
 * «Синхронизации» за «Техническими деталями», журнал входящих — на «Событиях», страница приёма брони
 * без персональных данных.
 */
const fixture = 'http://127.0.0.1:4311';

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
  await request.post(`${fixture}/__test/control`, { data: { showcase: true } });
});

/** Роль читается из `/auth/me`, а без входа его нет: «Настройка подключения» видна только вошедшему владельцу */
async function signIn(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
}

/**
 * Отчёт по источникам (21.09.2026, продолжение правки «чтобы каши не было»; с 27.09 — на «Обзоре»).
 *
 * Было: ряд из четырёх плиток, где четвёртая — «Источников продаж 4» — повторяла число строк таблицы
 * под ней; следом панель «Стоимость выбранных броней» высотой ~230 px ради одного числа; у каждой
 * строки — кружок-монограмма с первой буквой канала, хотя в справочниках от аватаров отказались
 * (DESIGN.md §8) и логотипы каналов не вставляем (§7); пустой отчёт рисовался ячейкой внутри таблицы
 * с шапкой из шести колонок.
 */
test('обзор каналов: отчёт по источникам без дубля числа источников и без монограмм', async ({
  page,
  request,
}) => {
  const main = page.getByRole('main');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/channels');

  // стоимость стоит рядом с остальными числами, отдельной панели под неё нет
  await expect(main.getByTestId('channel-amount')).toContainText('1 920 000');
  await expect(main.locator('.channel-value-panel')).toHaveCount(0);
  // плитка «Источников продаж» повторяла число строк таблицы — снята
  await expect(main.getByText('Источников продаж')).toHaveCount(0);

  // строка называет канал словами: кружков с буквой нет
  await expect(main.locator('.channel-monogram')).toHaveCount(0);
  await expect(main.getByTestId('channel-report')).toContainText('Booking.com');

  // подпись периода без двоеточия
  await expect(main.getByTestId('channel-period')).not.toContainText(':');

  // пустой отчёт — общее пустое состояние, шапки из шести колонок над ним нет
  await request.post(`${fixture}/__test/control`, { data: { empty: true } });
  await page.goto('/channels');
  await expect(main.getByTestId('channel-report-empty')).toBeVisible();
  // шапки нет у отчёта; таблица «Каналы» рядом живёт по событиям, а не по броням
  const report = main.getByRole('region', { name: 'Брони по источникам' });
  await expect(report.getByRole('columnheader')).toHaveCount(0);
  await request.post(`${fixture}/__test/control`, { data: {} });
});

/** Обзор — вход модуля: состояние обмена словом, очередь и ошибки числами, вкладки на месте (ADR-112) */
test('обзор каналов: полоса состояния, вкладки и технические детали раскрывашкой', async ({
  page,
}) => {
  const main = page.getByRole('main');
  await page.goto('/channels');
  await expect(main.getByRole('heading', { level: 1 })).toHaveText('Каналы продаж');
  // вкладки модуля — как у «Настроек гостиницы»
  const nav = page.getByRole('navigation', { name: 'Каналы продаж' });
  await expect(nav.getByRole('link')).toHaveText([
    'Обзор',
    'Подключения',
    'Сопоставление',
    'Синхронизация',
    'События',
  ]);
  await expect(nav.getByRole('link', { name: 'Обзор' })).toHaveAttribute('aria-current', 'page');
  // полоса состояния: очередь и ошибки числами, webhook словом
  await expect(main.getByTestId('outbox-pending')).toHaveText('2');
  await expect(main.getByTestId('channels-errors')).toHaveText('2');
  // webhook стенда не настроен (registered=false без PUBLIC_API_URL) — слово честное, не «выключен»
  await expect(main.getByTestId('webhook-status')).toHaveText('нет PUBLIC_API_URL');
  // наблюдаемые каналы (Q-205 закрыт владельцем, дополнение к ADR-112): факты из событий,
  // без зелёного health — формулировка «Booking.com — работает» запрещена
  const observedTable = main.getByTestId('channels-observed');
  await expect(observedTable.getByTestId('observed-row').first()).toContainText('Booking.com');
  await expect(observedTable).not.toContainText('работает');
  await expect(main.getByTestId('mapping-note')).toContainText('категорий 3 из 3');
  // ежедневные кнопки обмена — здесь; настройка подключения — на «Подключениях»
  await expect(main.getByTestId('channel-flush')).toBeVisible();
  await expect(main.getByTestId('channel-pull')).toBeVisible();
  await expect(main.getByTestId('channel-setup')).toHaveCount(0);
  await expect(main.getByTestId('channel-sync')).toHaveCount(0);
  // технические значения спрятаны раскрывашкой и открываются
  const tech = main.getByTestId('channels-tech');
  await expect(tech.getByTestId('outbox-last-task')).not.toBeVisible();
  await tech.locator('summary').click();
  await expect(tech.getByTestId('outbox-last-task')).toBeVisible();
  await expect(tech.getByTestId('outbox-last-task')).toHaveText('ui-task-4f2a');
});

/** «Подключения»: состояние Channex и webhook; опасные кнопки — владельцу, сотруднику — словами */
test('подключения каналов: настройка подключения только владельцу', async ({ page, request }) => {
  const main = page.getByRole('main');
  await signIn(page);
  await page.goto('/channels/connections');
  await expect(main.getByRole('heading', { level: 1 })).toHaveText('Подключения');
  await expect(main).toContainText('Тестовая');
  await expect(main.getByTestId('webhook-state')).toContainText('нет PUBLIC_API_URL');
  // владелец видит группу «Настройка подключения» с прежними командами в прежнем порядке
  for (const id of ['channel-setup', 'channel-webhook-register', 'channel-webhook-test', 'channel-sync'])
    await expect(main.getByTestId(id)).toBeVisible();
  await expect(main.getByTestId('channel-flush')).toHaveCount(0);
  // сотруднику кнопки не показываются, причина — словами
  await request.post(`${fixture}/__test/control`, { data: { showcase: true, role: 'STAFF' } });
  await page.goto('/channels/connections');
  await expect(main.getByTestId('channel-setup-owner-only')).toHaveText(
    'Настройку подключения меняет владелец организации.',
  );
  await expect(main.getByTestId('channel-setup')).toHaveCount(0);
  await expect(main.getByTestId('channel-sync')).toHaveCount(0);
});

test('цены: правка в ячейке — Enter сохраняет и уведомляет, Escape отменяет, ноль не уходит', async ({
  page,
  request,
}) => {
  await page.goto('/rates?month=2026-10');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Тарифы и цены');
  // Формат §14: дата «1 окт. чт», деньги без «,00», стоп-продажа словом
  await expect(page.getByRole('main').getByTestId('rate-row-2026-10-01')).toContainText(
    '1 окт. чт',
  );
  await expect(
    page.getByRole('main').getByTestId('rate-row-2026-10-01').locator('time'),
  ).toHaveAttribute('datetime', '2026-10-01');
  const cell = page.getByRole('main').getByTestId('price-2026-10-02-1');
  await expect(cell).toContainText('8 000 ₸');
  await expect(cell).not.toContainText(',00');
  await expect(page.locator('.rate-cal__day.is-stop').first()).toContainText('закрыто');
  // Escape — ничего не ушло
  await cell.getByTestId('price-cell-edit').click();
  const input = cell.getByRole('textbox');
  await expect(input).toBeFocused();
  await input.fill('7777');
  await input.press('Escape');
  await expect(cell.getByTestId('price-cell-edit')).toContainText('8 000 ₸');
  expect(await (await request.get(`${fixture}/__test/commands`)).json()).toEqual([]);
  // Ноль — слово у ячейки, запроса нет
  await cell.getByTestId('price-cell-edit').click();
  await cell.getByRole('textbox').fill('0');
  await cell.getByRole('textbox').press('Enter');
  await expect(cell.getByRole('alert')).toHaveText('Цена не может быть 0');
  expect(await (await request.get(`${fixture}/__test/commands`)).json()).toEqual([]);
  // Enter — одна строка на один день и одно число гостей, уведомление, новая цена в ячейке
  await cell.getByRole('textbox').fill('9100');
  await cell.getByRole('textbox').press('Enter');
  await expect(cell.getByTestId('price-cell-result')).toContainText(
    'Цена сохранена, ушло в очередь каналов: 1',
  );
  await expect(cell.getByTestId('price-cell-edit')).toContainText('9 100 ₸');
  const commands = await (await request.get(`${fixture}/__test/commands`)).json();
  expect(commands).toHaveLength(1);
  expect(commands[0].body.changes).toEqual([
    expect.objectContaining({
      dateFrom: '2026-10-02',
      dateTo: '2026-10-02',
      price: '9100',
      occupancy: 1,
    }),
  ]);
  // Соседняя колонка (2 гостя) не тронута
  await expect(page.getByRole('main').getByTestId('price-2026-10-02-2')).toContainText('10 000 ₸');
  // Ошибка сервера — там же, у ячейки
  await request.post(`${fixture}/__test/control`, {
    data: { showcase: true, failPath: '/rates/bulk' },
  });
  await cell.getByTestId('price-cell-edit').click();
  await cell.getByRole('textbox').fill('9200');
  await cell.getByRole('textbox').press('Enter');
  await expect(cell.getByRole('alert')).toContainText('Синтетический сбой API');
});

test('цены: месяц листается кнопками со значками, список массового изменения без « · »', async ({
  page,
}) => {
  await page.goto('/rates?month=2026-10');
  const monthSelect = page.getByRole('main').getByLabel('Месяц', { exact: true });
  await expect(monthSelect).toHaveValue('2026-10');
  await page.getByLabel('Следующий месяц', { exact: true }).click();
  await expect(page).toHaveURL(/month=2026-11/);
  await expect(monthSelect).toHaveValue('2026-11');
  await page.getByRole('main').getByTestId('rates-edit-open').click();
  const editor = page.getByRole('main').getByTestId('bulk-editor');
  await editor.getByLabel('Цена за ночь').fill('9100');
  await editor.getByLabel('Мин. ночей', { exact: true }).fill('3');
  await editor.getByRole('button', { name: '+ Добавить в список', exact: true }).click();
  const pending = page.getByRole('main').getByTestId('pending-changes');
  await expect(pending).toContainText('01.11 → 30.11.2026 — цена 9100, мин. ночей 3');
  await expect(pending).not.toContainText(' · ');
});

test('синхронизация: строки видов обмена, очередь с фильтром за «Техническими деталями»', async ({
  page,
}) => {
  const main = page.getByRole('main');
  await page.goto('/channels/sync');
  await expect(main.getByRole('heading', { level: 1 })).toHaveText('Синхронизация');
  await expect(main.getByTestId('sync-pending')).toHaveText('2');
  // строки видов обмена словами: остатки, цены и ограничения, брони из каналов
  const kinds = main.getByTestId('sync-kinds');
  await expect(kinds.getByTestId('sync-kind-AVAILABILITY')).toContainText('Остатки');
  await expect(kinds.getByTestId('sync-kind-RESTRICTIONS')).toContainText('Цены и ограничения');
  await expect(kinds.getByTestId('sync-kind-BOOKINGS')).toContainText('требуют разбора: 1');
  // очередь спрятана за раскрывашкой
  const outbox = main.getByTestId('outbox-table');
  await expect(outbox).not.toBeVisible();
  await main.getByTestId('sync-tech').locator('summary').click();
  await expect(outbox.getByTestId('outbox-row')).toHaveCount(4);
  await expect(outbox).toContainText('цены и ограничения');
  await expect(outbox).toContainText('Двухместный номер');
  await expect(outbox).toContainText('ui-task-4f2a');
  await expect(outbox).toContainText('rate plan not found');
  await main.getByTestId('outbox-filter-FAILED').click();
  await expect(page).toHaveURL(/\/channels\/sync\?queue=FAILED/);
  // фильтр в адресе — раскрывашка открыта сама, отбор отмечен
  await expect(main.getByTestId('outbox-filter-FAILED')).toHaveAttribute('aria-current', 'true');
  await expect(main.getByTestId('outbox-table').getByTestId('outbox-row')).toHaveCount(1);
  await expect(main.getByTestId('outbox-table')).toContainText('ошибка');
});

test('события: фильтры, поиск и постраничность на своей вкладке', async ({ page }) => {
  const main = page.getByRole('main');
  await page.goto('/channels/events');
  await expect(main.getByRole('heading', { level: 1 })).toHaveText('События');
  // События: страница из 20, всего 33 (в витрине есть и проверка webhook с двоеточиями в номере)
  const events = main.getByTestId('events-table');
  await expect(events.getByTestId('event-row')).toHaveCount(20);
  await expect(main.getByTestId('events-pager')).toContainText('показано 20 из 33');
  await expect(main.getByTestId('events-callout')).toContainText('Входящая бронь требует разбора');
  await expect(events.getByRole('link', { name: '20260913-SHOWTN' }).first()).toHaveAttribute(
    'href',
    '/reservations/20260913-SHOWTN',
  );
  await page.getByRole('link', { name: 'Дальше' }).click();
  await expect(page).toHaveURL(/\/channels\/events\?.*page=2/);
  await expect(
    main.getByTestId('events-table').getByTestId('event-row'),
  ).toHaveCount(13);
  await expect(main.getByTestId('events-pager')).toContainText('показано 13 из 33');
  // Фильтр по статусу + поиск по unique_id
  await main.getByLabel('Статус события').selectOption('FAILED');
  await page.getByRole('button', { name: 'Найти', exact: true }).click();
  await expect(main.getByTestId('events-table').getByTestId('event-row')).toHaveCount(1);
  await expect(main.getByTestId('events-table')).toContainText('BDC-4821-7731');
  await main.getByLabel('Статус события').selectOption('');
  await main.getByTestId('events-search').fill('exp-90210');
  await page.getByRole('button', { name: 'Найти', exact: true }).click();
  await expect(main.getByTestId('events-table').getByTestId('event-row')).toHaveCount(1);
  await expect(main.getByTestId('events-table')).toContainText('20260913-SHOWCX');
  await expect(main.getByTestId('events-pager')).toContainText('показано 1 из 1');
  await main.getByTestId('events-search').fill('нет-такого');
  await page.getByRole('button', { name: 'Найти', exact: true }).click();
  await expect(main.getByTestId('events-table')).toContainText('ничего не найдено');
});

/** Старые адреса пульта ведут на свои вкладки: queue — на «Синхронизацию», type — на «События» */
test('старые адреса /channels с параметрами пульта открывают нужную вкладку', async ({ page }) => {
  await page.goto('/channels?queue=FAILED');
  await expect(page).toHaveURL(/\/channels\/sync\?queue=FAILED/);
  await page.goto('/channels?status=RECEIVED&type=booking_cancellation&q=abc');
  await expect(page).toHaveURL(/\/channels\/events\?/);
  await page.goto('/channel-manager?from=2026-09-01&to=2026-09-30');
  await expect(page).toHaveURL(/\/channels\?from=2026-09-01&to=2026-09-30/);
});

test('приём брони из канала: цепочка ревизия → бронь → ячейка, без персональных данных; ошибка и 404', async ({
  page,
}) => {
  await page.goto('/channels/events');
  await page.getByRole('link', { name: 'ui-rev-new-2' }).click();
  await expect(page).toHaveURL(/\/channels\/events\/ui-rev-new-2$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Приём брони из канала');
  const chain = page.getByRole('main').getByTestId('revision-chain');
  await expect(chain).toContainText('новая бронь');
  await expect(chain).toContainText('Booking.com');
  await expect(chain).toContainText('BDC-5510-2201');
  await expect(chain).toContainText('Двухместный номер');
  await expect(page.getByRole('main').getByTestId('revision-amount')).toContainText(
    'предоплата канала 16 000 ₸',
  );
  await expect(page.getByRole('main').getByTestId('revision-reservation')).toHaveAttribute(
    'href',
    '/reservations/20260913-SHOWTN',
  );
  // «Оплачено» из разности стоимости и остатка не считается: показываем предоплату канала как есть
  await expect(chain).toContainText('Предоплата канала');
  await expect(chain).not.toContainText('Оплачено');
  await expect(page.getByRole('main').getByTestId('revision-unit')).toContainText(
    'R06, Двухместный номер',
  );
  await expect(page.getByRole('link', { name: 'Открыть шахматку на эти даты' })).toHaveAttribute(
    'href',
    /\/chessboard\?from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}/,
  );
  // Персональные данные ревизии на странице не появляются: ни телефона, ни почты, ни фамилии из payload
  const text = await chain.innerText();
  expect(text).not.toMatch(/\+7\d{10}|@example\.test/);
  // Ошибка ADR-024: бронь не создана, есть «Обработать заново»
  await page.goto('/channels/events/ui-rev-failed');
  await expect(page.getByRole('main').getByTestId('revision-status')).toHaveText('ошибка');
  await expect(page.getByRole('main').getByTestId('revision-no-reservation')).toContainText(
    'Бронь не создана',
  );
  await expect(page.getByRole('main').getByTestId('retry-event-ui-rev-failed')).toBeVisible();
  // Неизвестная ревизия — «Страница не найдена», а не пустая цепочка (как у карточки брони)
  await page.goto('/channels/events/no-such-revision');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Страница не найдена');
});

/**
 * Идентификатор ревизии Channex содержит двоеточия (`test:<время>:<хеш>`). Next отдаёт сегмент адреса
 * закодированным, и до 17.09.2026 клиент API кодировал его второй раз: сервер отвечал 404 на живую
 * ревизию, экран говорил «Страница не найдена». Найдено обходом стойки на живых данных.
 */
test('приём брони: ревизия с двоеточиями в номере открывается', async ({ page }) => {
  await page.goto(
    `/channels/events/${encodeURIComponent('test:2026-09-16T18:35:20.672058Z:74234e98afe7')}`,
  );
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Приём брони из канала');
  await expect(page.getByRole('main').getByTestId('revision-chain')).toContainText(
    'test:2026-09-16T18:35:20',
  );
});

/**
 * Сбой сервера — не «не найдено». До 17.09.2026 страница прятала любую ошибку под словом «не найдено»,
 * и на живой стойке было не понять, что ревизия на месте, а отвечает сервер. Найдено обходом стойки.
 */
test('приём брони: сбой сервера назван ошибкой, а не «страница не найдена»', async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/control`, {
    data: { showcase: true, failPath: '/channels/channex/events/ui-rev-new-2' },
  });
  await page.goto('/channels/events/ui-rev-new-2');
  await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('Страница не найдена');
  await expect(page.getByRole('alert').first()).toContainText(
    /Проверьте подключение|Сервер отклонил/,
  );
});

/**
 * D4 «Тарифы и ограничения» (план владельца 19.09): отказ API не уносит экран — заголовок, форма и
 * массовое изменение остаются, вместо таблицы сбой с «Повторить загрузку»; пустой справочник назван
 * пустым состоянием с причиной; пока календарь идёт, виден скелетон словом; месяц листается только
 * кнопками-значками (текстовые дубли сняты); заголовки цен и ограничения — словами.
 */
test('цены: сбой календаря оставляет форму и массовое изменение, пустой справочник назван, загрузка словом', async ({
  page,
  request,
}) => {
  const main = page.getByRole('main');
  // ограничения словами в ячейке дня, одна пара кнопок месяца
  await page.goto('/rates?month=2026-10');
  await expect(main.getByTestId('rates-calendar')).toBeVisible();
  await expect(main.getByTestId('rate-row-2026-10-16')).toContainText('мин. 2 ночи');
  await expect(main.getByTestId('rate-row-2026-10-19')).toContainText('до 4 ночей');
  await expect(main.getByRole('link', { name: 'Следующий месяц', exact: true })).toHaveCount(1);
  await expect(main.getByRole('link', { name: 'Предыдущий месяц', exact: true })).toHaveCount(1);
  // сбой календаря: фильтры и правка на месте, сетки нет, повтор возвращает её
  await request.post(`${fixture}/__test/control`, { data: { showcase: true, failPath: '/rates' } });
  await page.goto('/rates?month=2026-10');
  await expect(main.getByRole('heading', { level: 1 })).toHaveText('Тарифы и цены');
  await expect(main.getByRole('navigation', { name: 'Категория' })).toBeVisible();
  await main.getByTestId('rates-edit-open').click();
  await expect(main.getByTestId('bulk-editor')).toBeVisible();
  await page.keyboard.press('Escape');
  const failure = main.getByTestId('rates-error');
  await expect(failure).toContainText('Проверьте подключение и повторите запрос');
  await expect(main.getByTestId('rates-calendar')).toHaveCount(0);
  await expect(main.getByTestId('rates-empty')).toHaveCount(0);
  await request.post(`${fixture}/__test/control`, { data: { showcase: true } });
  await failure.getByRole('button', { name: 'Повторить загрузку' }).click();
  await expect(main.getByTestId('rates-calendar')).toBeVisible();
  await expect(main.getByTestId('rates-error')).toHaveCount(0);
  await expect(page).toHaveURL(/month=2026-10/);
  // сбой справочника: заголовок и повтор, без правки (заполнять нечего)
  await request.post(`${fixture}/__test/control`, {
    data: { showcase: true, failPath: '/rates/options' },
  });
  await page.goto('/rates?month=2026-10');
  await expect(main.getByRole('heading', { level: 1 })).toHaveText('Тарифы и цены');
  await expect(main.getByTestId('rates-error')).toBeVisible();
  await expect(main.getByTestId('rates-edit-open')).toHaveCount(0);
  await expect(main.getByTestId('bulk-editor')).toHaveCount(0);
  // пустой справочник — не сбой и не нули: причина и куда идти
  await request.post(`${fixture}/__test/control`, { data: { empty: true } });
  await page.goto('/rates');
  const empty = main.getByTestId('rates-empty');
  await expect(empty).toContainText('Календарь цен пуст');
  await expect(empty).toContainText('Категорий ещё нет');
  // куда идти — создать категорию, а не «тарифы объекта» (там правила отмены; ТЗ ux-retention п. 1.5)
  await expect(empty.getByRole('link', { name: 'Создать категорию' })).toHaveAttribute(
    'href',
    '/rooms/categories',
  );
  await expect(main.getByTestId('rates-error')).toHaveCount(0);
  // загрузка: скелетон с подписью словом, пока справочник идёт
  await request.post(`${fixture}/__test/control`, {
    data: { showcase: true, delayPath: '/rates/options', delayMs: 2500 },
  });
  await page.goto('/rates?month=2026-10', { waitUntil: 'commit' });
  const loading = main.getByTestId('rates-loading');
  await expect(loading).toBeVisible();
  await expect(loading).toContainText('Загружаем категории, тарифы и календарь цен');
  await expect(main.getByTestId('rates-calendar')).toBeVisible({ timeout: 15_000 });
  await expect(main.getByTestId('rates-loading')).toHaveCount(0);
});

/**
 * D4 «Каналы и состояние соединений»: отказ сводки очереди или сопоставлений не уносит экран — webhook,
 * кнопки, строки очереди и события читаются на своих вкладках отдельно, на месте пропавшего — сбой с
 * «Повторить загрузку»; пустая очередь и пустые события называют причину и следующий шаг; загрузка —
 * словом; на телефоне строки очереди и событий читаются без прокрутки вбок.
 */
test('каналы: сбой сводки очереди и сопоставлений не уносит экран, пустые таблицы названы, загрузка словом', async ({
  page,
  request,
}) => {
  const main = page.getByRole('main');
  // сбой сводки очереди на «Обзоре»: числа не выдуманы, webhook на месте
  await request.post(`${fixture}/__test/control`, {
    data: { showcase: true, failPath: '/channels/channex/outbox' },
  });
  await page.goto('/channels');
  await expect(main.getByRole('heading', { level: 1 })).toHaveText('Каналы продаж');
  const failure = main.getByTestId('outbox-error');
  await expect(failure).toContainText('Проверьте подключение и повторите запрос');
  await expect(main.getByTestId('outbox-pending')).toHaveCount(0);
  await expect(main.getByTestId('webhook-status')).toBeVisible();
  await expect(main.getByTestId('outbox-last-task')).toHaveText('не загрузилось');
  await request.post(`${fixture}/__test/control`, { data: { showcase: true } });
  await failure.getByRole('button', { name: 'Повторить загрузку' }).click();
  await expect(main.getByTestId('outbox-pending')).toHaveText('2');
  await expect(main.getByTestId('outbox-error')).toHaveCount(0);
  // сбой сопоставлений: таблицы маппинга нет, сбой назван
  await request.post(`${fixture}/__test/control`, {
    data: { showcase: true, failPath: '/channels/channex/mapping' },
  });
  await page.goto('/channels/mapping');
  await expect(main.getByTestId('mapping-error')).toBeVisible();
  await expect(main.getByTestId('mapping-empty')).toHaveCount(0);
  // пустая очередь и фильтр без строк — причина и шаг, а не «таких строк нет»
  // (`control` витрину не снимает — строки очереди живут до `reset`)
  await request.post(`${fixture}/__test/reset`);
  await page.goto('/channels/sync?queue=FAILED');
  const emptyQueue = main.getByTestId('outbox-empty');
  await expect(emptyQueue).toContainText('Строк со статусом «ошибка» нет');
  await emptyQueue.getByRole('link', { name: 'Показать все строки' }).click();
  await expect(page).toHaveURL(/\/channels\/sync$/);
  await main.getByTestId('sync-tech').locator('summary').click();
  await expect(main.getByTestId('outbox-empty')).toContainText('Очередь пуста');
  // события: по условиям ничего — сброс фильтров возвращает ленту
  await request.post(`${fixture}/__test/control`, { data: { showcase: true } });
  await page.goto('/channels/events?status=RECEIVED&type=booking_cancellation&q=нет-такого');
  const emptyEvents = main.getByTestId('events-empty');
  await expect(emptyEvents).toContainText('ничего не найдено');
  await emptyEvents.getByRole('link', { name: 'Сбросить фильтры событий' }).click();
  await expect(main.getByTestId('events-table').getByTestId('event-row').first()).toBeVisible();
  // телефон: обзор и очередь без прокрутки вбок, статус строки очереди в той же строке
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/channels');
  const layoutRoot = await page.evaluate(() => {
    const w = globalThis as unknown as {
      innerWidth: number;
      document: { documentElement: { scrollWidth: number } };
    };
    return { viewport: w.innerWidth, content: w.document.documentElement.scrollWidth };
  });
  expect(layoutRoot.content, 'обзор каналов шире экрана телефона').toBeLessThanOrEqual(
    layoutRoot.viewport + 1,
  );
  await page.goto('/channels/sync');
  await main.getByTestId('sync-tech').locator('summary').click();
  const layout = await page.evaluate(() => {
    const w = globalThis as unknown as {
      innerWidth: number;
      document: { documentElement: { scrollWidth: number } };
    };
    return { viewport: w.innerWidth, content: w.document.documentElement.scrollWidth };
  });
  expect(layout.content, 'синхронизация шире экрана телефона').toBeLessThanOrEqual(
    layout.viewport + 1,
  );
  const row = main.getByTestId('outbox-table').getByTestId('outbox-row').first();
  const box = await row.boundingBox();
  const status = await row.locator('td').nth(3).boundingBox();
  expect(box && status && status.x + status.width <= box.x + box.width + 1).toBe(true);
  await expect(row.locator('td').nth(4)).toHaveCSS('grid-column-start', '2');
  await page.setViewportSize({ width: 1440, height: 1000 });
  // загрузка словом, пока сводка идёт
  await request.post(`${fixture}/__test/control`, {
    data: { showcase: true, delayPath: '/channels/channex/outbox', delayMs: 2500 },
  });
  await page.goto('/channels/sync', { waitUntil: 'commit' });
  const loading = main.getByTestId('channels-loading');
  await expect(loading).toBeVisible();
  await expect(loading).toContainText('Загружаем состояние обмена с каналами');
  await expect(main.getByTestId('sync-pending')).toBeVisible({ timeout: 15_000 });
});

/**
 * D4 «Каналы и состояние соединений», часть 2: отчёт по источникам называет период словами, отказ отчёта
 * оставляет форму (сбой вместо чисел, повтор с теми же условиями), пустой отчёт называет условие и путь к
 * «все статусы», строка источника без « · », на телефоне строки читаются без прокрутки вбок; «Интеграции»
 * называют сопоставления словами и пустое время «—».
 */
test('отчёт по источникам и интеграции: период словами, сбой без потери формы, пустой отчёт с причиной, телефон', async ({
  page,
  request,
}) => {
  const main = page.getByRole('main');
  await page.goto('/channels?from=2026-09-01&to=2026-09-30');
  // 21.09: подпись периода без двоеточия — «Брони с заездом …» (§14)
  await expect(main.getByTestId('channel-period')).toHaveText(
    'Брони с заездом 1 сент. → 30 сент., 30 дней, все статусы',
  );
  await expect(main.getByTestId('channel-report')).not.toContainText(' · ');
  await expect(main.getByTestId('channel-report')).toContainText('Канал продаж, KZT');
  // пустой отчёт по статусу — условие и ссылка на все статусы
  await page.goto('/channels?from=2026-09-01&to=2026-09-30&status=NO_SHOW');
  const empty = main.getByTestId('channel-report-empty');
  await expect(empty).toContainText(
    'Нет бронирований с заездом 1 сент. → 30 сент. со статусом «Незаезды»',
  );
  await empty.getByRole('link', { name: 'Показать все статусы' }).click();
  await expect(page).toHaveURL(/status=ALL/);
  await expect(main.getByTestId('channel-bookings')).toHaveText('48');
  // отказ отчёта: заголовок, подпись и форма на месте, повтор возвращает числа с теми же условиями
  await request.post(`${fixture}/__test/control`, { data: { failPath: '/hotel/channel-report' } });
  await page.goto('/channels?from=2026-09-01&to=2026-09-30&status=CONFIRMED');
  await expect(main.getByRole('heading', { level: 1 })).toHaveText('Каналы продаж');
  await expect(main.getByLabel('Статус брони')).toHaveValue('CONFIRMED');
  const failure = main.getByTestId('channel-report-error');
  await expect(failure).toContainText('Проверьте подключение и повторите запрос');
  await expect(main.getByTestId('channel-bookings')).toHaveCount(0);
  await request.post(`${fixture}/__test/control`, { data: {} });
  await failure.getByRole('button', { name: 'Повторить загрузку' }).click();
  await expect(main.getByTestId('channel-report-error')).toHaveCount(0);
  await expect(main.getByTestId('channel-bookings')).toBeVisible();
  await expect(page).toHaveURL(/status=CONFIRMED/);
  // телефон: строки отчёта карточкой, без прокрутки вбок
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/channels?from=2026-09-01&to=2026-09-30');
  const layout = await page.evaluate(() => {
    const w = globalThis as unknown as {
      innerWidth: number;
      document: { documentElement: { scrollWidth: number } };
    };
    return { viewport: w.innerWidth, content: w.document.documentElement.scrollWidth };
  });
  expect(layout.content, 'отчёт шире экрана телефона').toBeLessThanOrEqual(layout.viewport + 1);
  const row = main.getByTestId('channel-report').locator('tbody tr').first();
  await expect(row.locator('td').nth(1)).toHaveCSS('grid-column-start', '2');
  await page.setViewportSize({ width: 1440, height: 1000 });
  // интеграции: сопоставления словами, пустое время — «—», без « · »
  await page.goto('/connections');
  await expect(main).toContainText('3 категории, 3 тарифа');
  await expect(main).not.toContainText(' · ');
  await expect(main.getByText('Последний webhook, по Алматы')).toBeVisible();
  await expect(main).not.toContainText('Нет событий');
  // загрузка словом, пока отчёт идёт
  await request.post(`${fixture}/__test/control`, {
    data: { delayPath: '/hotel/channel-report', delayMs: 2500 },
  });
  await page.goto('/channels', { waitUntil: 'commit' });
  const loading = main.getByTestId('channels-loading');
  await expect(loading).toBeVisible();
  await expect(loading).toContainText('Загружаем состояние обмена с каналами');
  await expect(main.getByTestId('channel-bookings')).toBeVisible({ timeout: 15_000 });
});
