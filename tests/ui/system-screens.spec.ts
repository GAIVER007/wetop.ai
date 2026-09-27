import { expect, test } from './fixtures';

/**
 * D4 «Журнал и неисправности» (tasks/todo.md): выборка журнала названа словами, разделы — чипами, отказ API не
 * уносит экран (поиск и раздел остаются, вместо строк сбой с повтором), пустой результат называет условие и путь к
 * последним операциям, время в `<time>`; у «Неисправностей» отказ состояния сторожа — сбой с повтором, пустые
 * таблицы говорят, что это значит; на телефоне строки читаются без прокрутки вбок; загрузка — словом.
 */
const fixture = 'http://127.0.0.1:4311';

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});
test.afterEach(async ({ request }) => {
  await request.post(`${fixture}/__test/control`, { data: {} });
});

test('журнал: выборка словами, разделы чипами, сбой без потери формы, пустой результат с причиной', async ({
  page,
  request,
}) => {
  const main = page.getByRole('main');
  await page.goto('/journal');
  await expect(main.getByTestId('journal-meta')).toHaveText('Последние 3 операции');
  await expect(main.getByTestId('journal-meta')).not.toContainText(' · ');
  await expect(main.getByTestId('journal-row').first().locator('time')).toHaveAttribute(
    'datetime',
    /T08:30:00/,
  );
  // раздел — чипом с текущим состоянием, выборка пересчитана
  const filters = main.getByRole('navigation', { name: 'Раздел журнала' });
  await filters.getByRole('link', { name: 'сотрудники', exact: true }).click();
  await expect(page).toHaveURL(/type=user/);
  await expect(filters.getByRole('link', { name: 'сотрудники', exact: true })).toHaveAttribute(
    'aria-current',
    'true',
  );
  await expect(main.getByTestId('journal-meta')).toHaveText('1 операция, раздел «сотрудники»');
  // пусто по условиям — условие названо, путь к последним операциям
  await page.goto('/journal?q=нет-такого&type=Reservation');
  const empty = main.getByTestId('journal-empty');
  // 21.09: пустой результат — общее пустое состояние, условие названо в тексте, а не в ячейке таблицы
  await expect(empty).toContainText('По этим условиям операций нет');
  await expect(empty).toContainText('по запросу «нет-такого», раздел «брони»');
  await expect(main.getByTestId('journal-meta')).toContainText(
    '0 операций, по запросу «нет-такого», раздел «брони» (поиск по всей истории)',
  );
  await empty.getByRole('link', { name: 'Показать последние операции' }).click();
  await expect(main.getByTestId('journal-row')).toHaveCount(3);
  // отказ API: поиск и раздел на месте, повтор возвращает строки с теми же условиями
  await request.post(`${fixture}/__test/control`, { data: { failPath: '/audit' } });
  await page.goto('/journal?q=TEST&type=Reservation');
  await expect(main.getByRole('heading', { level: 1 })).toHaveText('Журнал действий');
  await expect(main.getByLabel('Поиск в журнале')).toHaveValue('TEST');
  const failure = main.getByTestId('journal-error');
  await expect(failure).toContainText('Проверьте подключение и повторите запрос');
  await expect(main.getByTestId('journal-table')).toHaveCount(0);
  await expect(main.getByTestId('journal-meta')).toHaveCount(0);
  await request.post(`${fixture}/__test/control`, { data: {} });
  await failure.getByRole('button', { name: 'Повторить загрузку' }).click();
  await expect(main.getByTestId('journal-row')).toHaveCount(1);
  await expect(page).toHaveURL(/q=TEST/);
  // телефон: строка карточкой, без прокрутки вбок
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/journal');
  const layout = await page.evaluate(() => {
    const w = globalThis as unknown as {
      innerWidth: number;
      document: { documentElement: { scrollWidth: number } };
    };
    return { viewport: w.innerWidth, content: w.document.documentElement.scrollWidth };
  });
  expect(layout.content, 'журнал шире экрана телефона').toBeLessThanOrEqual(layout.viewport + 1);
  const row = main.getByTestId('journal-row').first();
  await expect(row.locator('td').nth(0)).toHaveCSS('grid-column-start', '2');
  await page.setViewportSize({ width: 1440, height: 1000 });
  // загрузка словом
  await request.post(`${fixture}/__test/control`, { data: { delayPath: '/audit', delayMs: 2500 } });
  await page.goto('/journal', { waitUntil: 'commit' });
  await expect(main.getByTestId('journal-loading')).toContainText('Загружаем журнал действий');
  await expect(main.getByTestId('journal-row').first()).toBeVisible({ timeout: 15_000 });
});

test('неисправности: сбой состояния сторожа с повтором, пустые таблицы объяснены, время в <time>, телефон', async ({
  page,
  request,
}) => {
  const main = page.getByRole('main');
  await page.goto('/incidents');
  await expect(main.getByTestId('incident-row').locator('time').first()).toHaveAttribute(
    'datetime',
    /\d{4}-\d{2}-\d{2}T/,
  );
  await expect(main.getByTestId('incidents-closed-empty')).toContainText(
    'За сутки ничего не закрывалось',
  );
  // закрыли единственную — открытых нет, и сказано, откуда возьмётся новая
  await main.getByTestId('incident-resolve').click();
  const empty = main.getByTestId('incidents-empty');
  await expect(empty).toContainText('Открытых неисправностей нет');
  await expect(empty).toContainText('Сторож проверяет систему раз в минуту');
  await expect(main.getByTestId('incidents-closed')).toContainText(
    'Тестовая бронь без назначенной ячейки',
  );
  // сбой состояния сторожа: плитки не выдуманы, списки на месте, повтор возвращает состояние
  await request.post(`${fixture}/__test/reset`);
  await request.post(`${fixture}/__test/control`, { data: { failPath: '/guard/status' } });
  await page.goto('/incidents');
  await expect(main.getByRole('heading', { level: 1 })).toHaveText('Неисправности');
  const failure = main.getByTestId('incidents-status-error');
  await expect(failure).toContainText('Проверьте подключение и повторите запрос');
  await expect(main.getByTestId('incidents-open')).toHaveText('—');
  await expect(main.getByTestId('incident-row')).toHaveCount(1);
  await request.post(`${fixture}/__test/control`, { data: {} });
  await failure.getByRole('button', { name: 'Повторить загрузку' }).click();
  await expect(main.getByTestId('incidents-status-error')).toHaveCount(0);
  await expect(main.getByTestId('incidents-open')).toHaveText('1');
  await expect(main.getByTestId('guard-running')).toContainText('работает');
  // телефон: строка карточкой, кнопки в своей строке, без прокрутки вбок
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/incidents');
  const layout = await page.evaluate(() => {
    const w = globalThis as unknown as {
      innerWidth: number;
      document: { documentElement: { scrollWidth: number } };
    };
    return { viewport: w.innerWidth, content: w.document.documentElement.scrollWidth };
  });
  expect(layout.content, 'неисправности шире экрана телефона').toBeLessThanOrEqual(
    layout.viewport + 1,
  );
  // 21.09: строка — карточка, и на телефоне кнопки уходят под текст, а не в колонку справа
  await expect(main.getByTestId('incident-row').first().locator('.incident__actions')).toHaveCSS(
    'grid-column-start',
    '1',
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  // загрузка словом
  await request.post(`${fixture}/__test/control`, {
    data: { delayPath: '/guard/status', delayMs: 2500 },
  });
  await page.goto('/incidents', { waitUntil: 'commit' });
  await expect(main.getByTestId('incidents-loading')).toContainText('Читаем состояние сторожа');
  await expect(main.getByTestId('incidents-open')).toBeVisible({ timeout: 15_000 });
});

/**
 * D4 «Статистика и аналитика сайта»: без счётчика — пустое состояние с шагом; отказ сервиса аналитики —
 * сбой с повтором при тех же датах, отклонённый запрос — по-прежнему словами у формы; период словами в `<time>`,
 * готовые отрезки чипами; «Статистика» при отказе шахматки оставляет дату и форму; оба экрана — загрузка словом.
 */
test('аналитика и статистика: пустое состояние, сбой с повтором, период словами, загрузка словом', async ({
  page,
  request,
}) => {
  const main = page.getByRole('main');
  await page.goto('/analytics');
  await expect(main.getByTestId('an-period')).toContainText(
    /Период \d{2}\.\d{2}\.\d{4} → \d{2}\.\d{2}\.\d{4}, 7 дней/,
  );
  await expect(main.getByTestId('an-period').locator('time').first()).toHaveAttribute(
    'datetime',
    /^\d{4}-\d{2}-\d{2}$/,
  );
  await expect(main.getByRole('navigation', { name: 'Готовые периоды' })).toContainText(
    'Прошлый месяц',
  );
  await expect(main.getByTestId('an-daily-table').locator('time').first()).toHaveAttribute(
    'datetime',
    /^\d{4}-\d{2}-\d{2}$/,
  );
  // сервис аналитики не ответил: форма и сайт на месте, вместо чисел сбой, повтор с теми же датами
  await request.post(`${fixture}/__test/control`, {
    data: { failPath: '/analytics/sites/ui-site/report' },
  });
  await page.goto('/analytics?from=2026-09-01&to=2026-09-30');
  await expect(main.getByRole('heading', { level: 1 })).toHaveText('Аналитика сайта');
  await expect(main.getByLabel('Аналитика: с')).toHaveValue('2026-09-01');
  const failure = main.getByTestId('an-error');
  await expect(failure).toContainText('Проверьте подключение и повторите запрос');
  await expect(main.getByTestId('an-summary')).toHaveCount(0);
  await request.post(`${fixture}/__test/control`, { data: {} });
  await failure.getByRole('button', { name: 'Повторить загрузку' }).click();
  await expect(main.getByTestId('an-summary')).toBeVisible();
  await expect(page).toHaveURL(/from=2026-09-01/);
  // без счётчика — не пустая страница, а шаг
  await request.post(`${fixture}/__test/control`, { data: { empty: true } });
  await page.goto('/analytics');
  const noSites = main.getByTestId('an-no-sites');
  await expect(noSites).toContainText('Счётчик ещё не подключён');
  await expect(noSites.getByRole('link', { name: 'Подключить счётчик' })).toHaveAttribute(
    'href',
    '/analytics/setup',
  );
  await request.post(`${fixture}/__test/control`, { data: {} });
  // статистика (с ADR-108 — «Аналитика → Загрузка»): старый адрес ведёт на вкладку с той же датой;
  // подпись даты словами; отказ шахматки оставляет форму и дату
  await page.goto('/management/statistics?date=2026-09-25');
  await expect(page).toHaveURL(/\/management\/analytics\/occupancy\?date=2026-09-25$/);
  await expect(main.getByTestId('statistics-meta')).toContainText('Загрузка на 25.09.2026');
  await expect(main.getByTestId('statistics-table').locator('tbody tr').first()).toBeVisible();
  await request.post(`${fixture}/__test/control`, { data: { failPath: '/chessboard' } });
  await page.goto('/management/analytics/occupancy?date=2026-09-25');
  await expect(main.getByRole('heading', { level: 1 })).toHaveText('Аналитика');
  await expect(main.getByLabel('Дата')).toHaveValue('2026-09-25');
  const statsFailure = main.getByTestId('statistics-error');
  await expect(statsFailure).toContainText('Проверьте подключение и повторите запрос');
  await expect(main.locator('.stat__value')).toHaveCount(0);
  await request.post(`${fixture}/__test/control`, { data: {} });
  await statsFailure.getByRole('button', { name: 'Повторить загрузку' }).click();
  await expect(main.getByTestId('statistics-table').locator('tbody tr').first()).toBeVisible();
  await expect(page).toHaveURL(/date=2026-09-25/);
  // телефон: таблица категорий карточкой, без прокрутки вбок
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/management/analytics/occupancy');
  const layout = await page.evaluate(() => {
    const w = globalThis as unknown as {
      innerWidth: number;
      document: { documentElement: { scrollWidth: number } };
    };
    return { viewport: w.innerWidth, content: w.document.documentElement.scrollWidth };
  });
  expect(layout.content, 'статистика шире экрана телефона').toBeLessThanOrEqual(
    layout.viewport + 1,
  );
  await expect(
    main.getByTestId('statistics-table').locator('tbody tr').first().locator('td').nth(5),
  ).toHaveCSS('grid-column-start', '2');
  await page.setViewportSize({ width: 1440, height: 1000 });
  // загрузка словом на обоих экранах
  await request.post(`${fixture}/__test/control`, {
    data: { delayPath: '/analytics/sites/ui-site/report', delayMs: 2500 },
  });
  await page.goto('/analytics', { waitUntil: 'commit' });
  await expect(main.getByTestId('an-loading')).toContainText('Считаем отчёт по сайту');
  await expect(main.getByTestId('an-summary')).toBeVisible({ timeout: 15_000 });
  await request.post(`${fixture}/__test/control`, {
    data: { delayPath: '/chessboard', delayMs: 2500 },
  });
  await page.goto('/management/analytics/occupancy', { waitUntil: 'commit' });
  await expect(main.getByTestId('statistics-loading')).toContainText(
    'Считаем загрузку по шахматке',
  );
  await expect(main.getByTestId('statistics-table')).toBeVisible({ timeout: 15_000 });
});

/**
 * Настройки объекта: ошибки с повтором не скрывают навигацию; пустые значения — «—»,
 * справочники объясняют источник, загрузка обозначена текстом. Контент каналов не дублируется.
 */
test('настройки гостиницы: сбой с повтором, пустые справочники с причиной, загрузка словом', async ({
  page,
  request,
}) => {
  const main = page.getByRole('main');
  await page.goto('/hotel-settings/description');
  await expect(page).toHaveURL(/\/hotel-settings$/);
  await expect(main.getByTestId('stored-property')).toBeVisible();
  await expect(main.getByText('Не указан', { exact: true })).toHaveCount(0);
  // штрафы: подпись тарифа без « · »
  await page.goto('/hotel-settings/penalties');
  await expect(main.getByTestId('rate-plans-table')).toContainText('BASE, KZT');
  await expect(main.getByTestId('rate-plans-table')).not.toContainText(' · ');
  // Ошибка чтения настроек оставляет заголовок и вкладки на месте.
  await request.post(`${fixture}/__test/control`, { data: { failPath: '/hotel/settings' } });
  await page.goto('/hotel-settings');
  await expect(main.getByRole('heading', { level: 1 })).toHaveText('Настройки гостиницы');
  await expect(main.getByRole('navigation', { name: 'Настройки гостиницы' })).toBeVisible();
  const failure = main.getByTestId('settings-error');
  await expect(failure).toContainText('Проверьте подключение и повторите запрос');
  await request.post(`${fixture}/__test/control`, { data: {} });
  await failure.getByRole('button', { name: 'Повторить загрузку' }).click();
  await expect(main.getByTestId('stored-property')).toBeVisible();
  await expect(main.getByTestId('settings-error')).toHaveCount(0);
  // отказ настроек на «Услугах»: сбой с повтором вместо общего экрана
  await request.post(`${fixture}/__test/control`, { data: { failPath: '/finance/services' } });
  await page.goto('/hotel-settings/services');
  await expect(main.getByRole('heading', { level: 1 })).toHaveText('Услуги');
  await expect(main.getByTestId('services-error')).toContainText(
    'Проверьте подключение и повторите запрос',
  );
  await expect(main.getByTestId('services-table')).toHaveCount(0);
  // пустой справочник услуг — откуда он берётся
  await request.post(`${fixture}/__test/control`, { data: { empty: true } });
  await page.goto('/hotel-settings/services');
  // без Exely: новому клиенту имя прежней системы ничего не говорит (ТЗ ux-retention п. 1.2)
  await expect(main.getByTestId('services-empty')).toHaveText('Услуг в каталоге пока нет.');
  await request.post(`${fixture}/__test/control`, { data: {} });
  // загрузка словом
  await request.post(`${fixture}/__test/control`, {
    data: { delayPath: '/finance/services', delayMs: 2500 },
  });
  await page.goto('/hotel-settings/services', { waitUntil: 'commit' });
  await expect(main.getByTestId('settings-loading')).toContainText('Читаем настройки объекта');
  await expect(main.getByTestId('services-table')).toBeVisible({ timeout: 15_000 });
});

/**
 * D4 «Вход, регистрация и профиль»: экран «Вы вошли» без « · »; отказ API на странице приглашения — сбой с
 * повтором, а не общий экран (мёртвая ссылка по-прежнему одним текстом); загрузка приглашения словом; «Доступ» в
 * настройках рабочего места говорит правду о входе. Сами формы входа, регистрации и сброса не менялись
 * (`login-access`, `invites`, `password-reset`).
 */
test('вход и профиль: «Вы вошли» без точек, приглашение при сбое с повтором, «Доступ» словами', async ({
  page,
  request,
}) => {
  const main = page.getByRole('main');
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL(/\/today/);
  await page.goto('/login');
  await expect(main).toContainText('как Дана Тестова, admin@wetop.test');
  await expect(main).not.toContainText(' · ');
  // приглашение: API не ответил — сбой с повтором, повтор открывает приглашение
  await request.post(`${fixture}/__test/control`, {
    data: { failPath: '/auth/invites/fixture-invite-token' },
  });
  await page.goto('/invite/fixture-invite-token');
  await expect(main).toContainText('Приглашение не прочиталось');
  const failure = main.getByTestId('invite-load-error');
  await expect(failure).toContainText('Проверьте подключение и повторите запрос');
  await expect(main.getByRole('button', { name: 'Принять приглашение' })).toHaveCount(0);
  await request.post(`${fixture}/__test/control`, { data: {} });
  await failure.getByRole('button', { name: 'Повторить загрузку' }).click();
  await expect(main).toContainText('Вас приглашают');
  await expect(main.getByRole('button', { name: 'Принять приглашение' })).toBeVisible();
  // загрузка словом
  await request.post(`${fixture}/__test/control`, {
    data: { delayPath: '/auth/invites/fixture-invite-token', delayMs: 2500 },
  });
  await page.goto('/invite/fixture-invite-token', { waitUntil: 'commit' });
  await expect(main.getByTestId('invite-loading')).toContainText('Проверяем приглашение');
  await expect(main).toContainText('Вас приглашают', { timeout: 15_000 });
  await request.post(`${fixture}/__test/control`, { data: {} });
  // профиль: «Доступ» говорит правду о входе, а не «появится после подключения авторизации»
  await page.goto('/profile');
  await main.getByRole('tab', { name: 'Доступ' }).click();
  // роли есть с ADR-083: на стойке все равны, у владельца — приглашения и настройки продавца
  await expect(main.getByTestId('profile-access')).toContainText(
    'владелец организации ещё приглашает сотрудников',
  );
  await expect(main).not.toContainText('появится после подключения авторизации');
  await expect(main.getByRole('link', { name: 'Экран входа' })).toHaveAttribute('href', '/login');
});
