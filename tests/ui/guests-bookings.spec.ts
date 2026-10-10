import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { FIXTURE_API } from './fixtures';

/**
 * «Гости и бронирования» (09.10.2026, поручение владельца по макету; план plans/guests-bookings-2026-10-09.md).
 *
 * Один экран вместо вкладок «Брони» и «Гости»: плитки показателей, поиск с отборами «Статус», «Источник», «Период»,
 * чипы со счётчиками, таблица «гость и его основное проживание», нижняя полоса действий со страницами и панель
 * выбранного гостя справа. Здесь проверяется поведение экрана на данных подставного API; сама выборка и подсчёт
 * доказаны интеграционным набором на настоящей базе (`tests/integration/guest-directory.test.ts`).
 *
 * Данные: 9 гостей по умолчанию (4 живут, 4 ожидаются, 1 выехал сегодня); `/__test/guest-cases` добавляет четырёх
 * (Возвращающийся живёт и бронирует снова, Задолжавший живёт, Давний выехал давно, Отменившийся без проживаний).
 */
const fixture = FIXTURE_API;

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});
test.afterEach(async ({ request }) => {
  await request.post(`${fixture}/__test/control`, { data: {} });
});

test('гости и бронирования: плитки, виды со счётчиками, одна строка на гостя, панель первого гостя', async ({
  page,
}) => {
  const main = page.getByRole('main');
  await page.goto('/guests');
  await expect(main.getByRole('heading', { level: 1, name: 'Гости и бронирования' })).toBeVisible();

  // плитки: число и подпись видны до любого нажатия, каждая плитка ведёт в свой вид
  const kpis = main.getByTestId('guests-kpis');
  for (const [id, label, value] of [
    ['kpi-inhouse', 'Проживают', '4'],
    ['kpi-arrivals', 'Заезды сегодня', '3'],
    ['kpi-departures', 'Выезды сегодня', '2'],
    ['kpi-expected', 'Ожидают заезд', '4'],
    ['kpi-attention', 'Требуют внимания', '3'],
    ['kpi-none', 'Без активного проживания', '0'],
  ] as const) {
    await expect(kpis.getByRole('link', { name: new RegExp(label) })).toBeVisible();
    await expect(kpis.getByTestId(id)).toHaveText(value);
  }

  // чипы с числами: до нажатия видно, сколько гостей в каждом виде
  const views = main.getByRole('navigation', { name: 'Быстрые виды' });
  for (const [label, count] of [
    ['Все', '9'],
    ['Сегодня', '5'],
    ['Проживают', '4'],
    ['Ожидают', '4'],
    ['Выезды', '2'],
    ['Проблемные', '3'],
  ] as const) {
    await expect(views.getByRole('link', { name: `${label} ${count}` })).toBeVisible();
  }
  await expect(views.getByRole('link', { name: /^Все/ })).toHaveAttribute('aria-current', 'page');

  // одна строка это один гость, а не одна бронь
  const table = main.getByTestId('guests-table');
  await expect(table.getByTestId('guest-row')).toHaveCount(9);
  await expect(main.getByTestId('guests-meta')).toContainText('9 гостей');
  for (const name of ['Гость', 'Бронь', 'Проживание / статус', 'Даты', 'Оплата'])
    await expect(table.getByRole('columnheader', { name, exact: true })).toHaveCount(1);
  // «Источник» и «Гостей» уходят из таблицы, пока списку не хватает ширины (справа открыта панель), и возвращаются на широком экране
  await expect(table.getByRole('columnheader', { name: 'Источник', exact: true })).toBeHidden();
  await page.setViewportSize({ width: 1920, height: 1000 });
  await expect(table.getByRole('columnheader', { name: 'Источник', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  // ячейка отметки без правого отступа (без `!important`, слои каскада решают сами)
  await expect(table.locator('td.gb-check').first()).toHaveCSS('padding-right', '0px');
  // слово о госте, а не статус брони
  await expect(table).toContainText('Проживает');
  await expect(table).toContainText('Ожидается');
  await expect(table).toContainText('Завершено');
  await expect(table.getByTestId('guest-row').filter({ hasText: 'Ожидается' }).first()).toContainText(
    'Заезд сегодня',
  );

  // панель справа открыта на первом госте списка, он же отмечен в таблице и в нижней полосе
  const panel = main.getByTestId('guest-panel');
  await expect(panel).toBeVisible();
  await expect(table.getByTestId('guest-row').first()).toHaveClass(/is-active/);
  await expect(main.getByTestId('guests-selected')).toHaveText('Выбрано 1 из 9');
  await expect(panel.getByRole('heading', { level: 2 })).toContainText('Гость');
});

test('гости и бронирования: панель гостя: вкладки, бронь, оплата, история, закрытие и выбор строкой', async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/guest-cases`);
  const main = page.getByRole('main');
  const table = main.getByTestId('guests-table');
  const panel = main.getByTestId('guest-panel');
  await page.goto('/guests?size=25');

  // щелчок по строке (не по ссылке) выбирает гостя: адрес запоминает выбор, панель переключается
  await table.getByTestId('guest-row').filter({ hasText: 'Задолжавший' }).locator('td').nth(5).click();
  await expect(page).toHaveURL(/guest=ui-guest-GCDEBT0/);
  await expect(panel.getByRole('heading', { level: 2 })).toContainText('Задолжавший');
  await expect(panel.getByRole('heading', { level: 2 })).toContainText('Проживает');

  // «Информация»: контакты, бронь, оплата с долгом словом и суммой, действия по статусу проживания
  const stay = panel.getByTestId('guest-panel-stay');
  await expect(stay).toContainText('R11');
  await expect(stay).toContainText('20260916-GCDEBT0');
  await expect(panel.getByTestId('guest-panel-payment')).toContainText('4 000 ₸');
  const actions = panel.getByTestId('guest-panel-actions');
  await expect(actions.getByRole('link', { name: 'Открыть бронь', exact: true })).toHaveAttribute(
    'href',
    /\/reservations\/20260916-GCDEBT0/,
  );
  await expect(actions.getByRole('link', { name: 'Выселить', exact: true })).toBeVisible();
  await expect(actions.getByRole('link', { name: 'Заселить', exact: true })).toHaveCount(0);
  // документов и ИИН в панели нет: их показ пишется в журнал и живёт на карточке гостя
  await expect(panel.getByText(/ИИН|Документ/)).toHaveCount(0);

  // вкладки: услуги, история, заметки; выбранная вкладка помнит выбор в адресе
  await panel.getByRole('tab', { name: 'Услуги', exact: true }).click();
  await expect(panel.getByRole('tab', { name: 'Услуги', exact: true })).toHaveAttribute('aria-selected', 'true');
  await panel.getByRole('tab', { name: 'История', exact: true }).click();
  await expect(panel.getByRole('link', { name: 'Открыть гостя', exact: true })).toHaveAttribute(
    'href',
    '/guests/ui-guest-GCDEBT0',
  );
  await panel.getByRole('tab', { name: 'Заметки', exact: true }).click();
  await expect(panel.getByTestId('guest-panel-notes')).toBeVisible();

  // постоянный гость: три визита в истории, ближайшая бронь называется в таблице
  await table.getByRole('link', { name: /Возвращающийся/ }).first().click();
  await expect(panel.getByRole('heading', { level: 2 })).toContainText('Возвращающийся');
  await expect(panel).toContainText('3 визита');
  await expect(panel.getByTestId('guest-panel-visits').getByRole('listitem')).toHaveCount(3);

  // только отменённая бронь: проживания нет, а не ложное «живёт», и подпись про отмену словами
  await table.getByRole('link', { name: /Отменившийся/ }).first().click();
  await expect(panel.getByTestId('guest-panel-nostay')).toContainText('отменена');
  await expect(panel.getByTestId('guest-panel-payment')).toHaveCount(0);
  await expect(panel.getByRole('link', { name: 'Новая бронь', exact: true })).toHaveAttribute(
    'href',
    '/reservations/new?guest=ui-guest-GCCAN0',
  );

  const audit = await new AxeBuilder({ page })
    .include('main')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(audit.violations).toEqual([]);

  // крестик закрывает панель, список остаётся на месте с тем же отбором
  await panel.getByRole('link', { name: 'Закрыть панель гостя' }).click();
  await expect(page).toHaveURL(/guest=none/);
  await expect(main.getByTestId('guest-panel')).toHaveCount(0);
  await expect(table.getByTestId('guest-row')).toHaveCount(13);
});

test('гости и бронирования: отметки строк и нижняя полоса действий', async ({ page, request }) => {
  await request.post(`${fixture}/__test/guest-cases`);
  const main = page.getByRole('main');
  const table = main.getByTestId('guests-table');
  const bar = main.getByRole('toolbar', { name: 'Действия с отмеченными' });
  await page.goto('/guests?q=Задолжавший');

  // отмечен единственный гость выдачи: кнопки ведут в его бронь на нужное действие
  await expect(main.getByTestId('guests-selected')).toHaveText('Выбрано 1 из 1');
  await expect(bar.getByRole('link', { name: 'Выселить', exact: true })).toHaveAttribute(
    'href',
    /\/reservations\/20260916-GCDEBT0/,
  );
  await expect(bar.getByRole('link', { name: 'Продлить', exact: true })).toBeVisible();
  // заселять живущего нельзя: кнопка есть, но неактивна, а причина в подсказке
  await expect(bar.getByRole('button', { name: 'Заселить', exact: true })).toHaveAttribute('aria-disabled', 'true');

  // две отметки: групповых действий нет, обе кнопки гаснут с подсказкой
  await page.goto('/guests?size=25');
  await table.getByRole('checkbox', { name: 'Отметить: Давний Гость' }).check();
  await table.getByRole('checkbox', { name: 'Отметить: Задолжавший Гость' }).check();
  await expect(main.getByTestId('guests-selected')).toContainText('Выбрано 3 из 13');
  await expect(bar.getByRole('button', { name: 'Выселить', exact: true })).toHaveAttribute(
    'title',
    /Групповых действий нет/,
  );
  // общая отметка шапки снимает и ставит всю страницу
  const all = table.getByRole('checkbox', { name: 'Отметить всех на странице' });
  await all.check();
  await expect(main.getByTestId('guests-selected')).toHaveText('Выбрано 13 из 13');
  await all.uncheck();
  await expect(main.getByTestId('guests-selected')).toHaveText('Выбрано 0 из 13');
  await expect(bar.getByRole('button', { name: 'Заселить', exact: true })).toHaveAttribute(
    'title',
    'Отметьте одну бронь',
  );
});

test('гости и бронирования: поиск, статус, источник, переключатели и период живут в адресе', async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/guest-cases`);
  const main = page.getByRole('main');
  const table = main.getByTestId('guests-table');
  const rows = table.getByTestId('guest-row');
  await page.goto('/guests?size=25');
  await expect(rows).toHaveCount(13);

  // автопоиск без кнопки «Найти»: через задержку адрес получает запрос, итог читается живой областью
  const search = main.getByRole('searchbox', { name: 'Поиск гостей' });
  expect((await search.boundingBox())!.width).toBeGreaterThanOrEqual(280);
  await expect(main.getByRole('button', { name: 'Найти', exact: true })).toHaveCount(0);
  await search.fill('Демо');
  await expect(page).toHaveURL(/q=%D0%94%D0%B5%D0%BC%D0%BE|q=Демо/);
  await expect(main.getByTestId('guests-meta')).toContainText('по запросу «Демо»');
  await expect(rows).toHaveCount(2);
  await expect(main.getByTestId('guests-meta')).toHaveAttribute('role', 'status');

  // «Статус» меняет адрес без кнопки «Показать»; «Назад» возвращает прежний вид
  await page.goto('/guests?size=25');
  await main.getByLabel('Статус', { exact: true }).selectOption('NONE');
  await expect(page).toHaveURL(/state=none/);
  await expect(rows).toHaveCount(2);
  await expect(table).toContainText('Отменившийся');
  await expect(table).toContainText('Давний');
  // у гостя без проживания бейджа нет, а подпись под именем говорит об этом словами
  await expect(rows.filter({ hasText: 'Отменившийся' })).toContainText('Без активного проживания');
  await page.goBack();
  await expect(rows).toHaveCount(13);

  // «Источник»: по каналу продаж; у основного проживания источник OTA у четверых
  await main.getByLabel('Источник', { exact: true }).selectOption('OTA');
  await expect(page).toHaveURL(/source=OTA/);
  await expect(rows).toHaveCount(4);

  // быстрый вид + переключатель: «Проблемные» с долгом, сброс одним нажатием
  await page.goto('/guests?view=attention&size=25');
  await expect(rows).toHaveCount(6);
  await main.getByRole('navigation', { name: 'Дополнительные отборы' }).getByRole('link', { name: 'Только с долгом' }).click();
  await expect(page).toHaveURL(/debt=1/);
  await expect(rows.filter({ hasText: 'Задолжавший' })).toHaveCount(1);
  await main.getByRole('link', { name: 'Сбросить фильтры' }).first().click();
  await expect(page).toHaveURL(/\/guests$/);
  // по умолчанию на странице десять гостей из тринадцати
  await expect(rows).toHaveCount(10);

  // период: «Свои даты» открывает поля с–по, даты уезжают в адрес
  await main.getByLabel('Период', { exact: true }).selectOption('range');
  await expect(page).toHaveURL(/period=range/);
  await expect(main.getByTestId('guests-range')).toBeVisible();
  await main.getByTestId('guests-range').getByLabel('Период: с').fill('2020-01-01');
  await main.getByTestId('guests-range').getByLabel('Период: по').fill('2020-01-31');
  await main.getByTestId('guests-range').getByRole('button', { name: 'Показать' }).click();
  await expect(page).toHaveURL(/from=2020-01-01&to=2020-01-31/);
  await expect(main.getByTestId('guests-empty')).toContainText('Ничего не найдено');

  // опечатка в адресе: слово об ошибке и полный список, а не молча другой отбор
  await page.goto('/guests?period=week');
  await expect(main.getByRole('alert')).toContainText('Неизвестный');
  await main.getByRole('link', { name: 'Сбросить фильтры' }).first().click();
  await expect(page).toHaveURL(/\/guests$/);
});

test('гости и бронирования: страницы и размер страницы', async ({ page, request }) => {
  await request.post(`${fixture}/__test/guest-cases`);
  const main = page.getByRole('main');
  const rows = main.getByTestId('guests-table').getByTestId('guest-row');
  await page.goto('/guests?size=10');
  await expect(rows).toHaveCount(10);
  await expect(main.getByTestId('guests-selected')).toHaveText('Выбрано 1 из 13');
  const pages = main.getByRole('navigation', { name: 'Страницы гостей' });
  await expect(pages.getByRole('link', { name: 'Страница 1' })).toHaveAttribute('aria-current', 'page');
  await pages.getByRole('link', { name: 'Следующая страница' }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(rows).toHaveCount(3);
  // страница за пределом: слово и путь назад, а не пустая таблица
  await page.goto('/guests?size=10&page=9');
  await expect(main.getByTestId('guests-empty')).toContainText('страниц меньше');
  await main.getByTestId('guests-empty').getByRole('link', { name: 'К первой странице' }).click();
  await expect(rows).toHaveCount(10);
});

test('гости и бронирования: пустые состояния, пустая база, сбой API', async ({ page, request }) => {
  const main = page.getByRole('main');

  // ничего не нашлось: что пусто и что сделать, шапки таблицы над пустотой нет
  await page.goto('/guests?q=Нетакого');
  await expect(main.getByTestId('guests-empty')).toContainText('Ничего не найдено');
  await expect(main.getByTestId('guests-table')).toHaveCount(0);
  await expect(main.getByRole('columnheader')).toHaveCount(0);
  await expect(main.getByTestId('guest-panel')).toHaveCount(0);

  // пустая база: гостей нет вовсе, плиток и таблицы нет, путь к первой брони есть
  await request.post(`${fixture}/__test/control`, { data: { noBookings: true } });
  await page.goto('/guests');
  await expect(main.getByTestId('guests-none')).toContainText('Гостей пока нет');
  await expect(main.getByTestId('guests-none').getByRole('link', { name: 'Новая бронь' })).toBeVisible();
  await expect(main.getByTestId('guests-kpis')).toHaveCount(0);
  const audit = await new AxeBuilder({ page })
    .include('main')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(audit.violations).toEqual([]);

  // сбой API: что не загрузилось и «Повторить», поиск и заголовок остаются, пустой базой это не выглядит
  await request.post(`${fixture}/__test/control`, { data: { failPath: '/guests/directory' } });
  await page.goto('/guests');
  const error = main.getByTestId('guests-error');
  await expect(error).toContainText('Не удалось загрузить гостей');
  await expect(error.getByRole('button', { name: 'Повторить загрузку' })).toBeVisible();
  await expect(main.getByRole('searchbox', { name: 'Поиск гостей' })).toBeVisible();
  await expect(main.getByTestId('guests-none')).toHaveCount(0);
});

test('гости и бронирования: одна вкладка меню, ссылка в классический список и новая бронь', async ({ page }) => {
  await page.goto('/guests');
  const menu = page.getByRole('navigation', { name: 'Разделы' }).first();
  const tab = menu.getByRole('link', { name: 'Гости и бронирования', exact: true });
  await expect(tab).toHaveAttribute('aria-current', 'page');
  await expect(menu.getByRole('link', { name: 'Гости', exact: true })).toHaveCount(0);
  await expect(menu.getByRole('link', { name: 'Брони', exact: true })).toHaveCount(0);

  // классический список броней живёт по прежнему адресу, и меню там подсвечивает ту же вкладку
  await page.getByRole('main').getByRole('link', { name: 'Список броней', exact: true }).click();
  await expect(page).toHaveURL(/\/reservations$/);
  await expect(tab).toHaveAttribute('aria-current', 'page');
  await page.goto('/guests');
  await page.getByRole('main').getByRole('link', { name: 'Новая бронь', exact: true }).first().click();
  await expect(page).toHaveURL(/\/reservations\/new/);
});

for (const scheme of ['light', 'dark'] as const) {
  test(`гости и бронирования: доступность и ширина экрана, ${scheme === 'light' ? 'светлая' : 'тёмная'} тема`, async ({
    page,
    request,
  }) => {
    await request.post(`${fixture}/__test/guest-cases`);
    await page.emulateMedia({ colorScheme: scheme });
    for (const [width, height] of [
      [1440, 1000],
      [1024, 800],
      [390, 844],
    ] as const) {
      await page.setViewportSize({ width, height });
      await page.goto('/guests');
      await expect(page.getByRole('main').getByTestId('guests-table')).toBeVisible();
      // страница не уезжает вбок: на телефоне лишние колонки скрыты, строка остаётся читаемой
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `ширина ${width}`).toBeLessThanOrEqual(1);
      const audit = await new AxeBuilder({ page })
        .include('main')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(audit.violations, `ширина ${width}`).toEqual([]);
    }
  });
}

// Ноутбук 1366×768 (сверка с макетом 09.10.2026): режим «страница в один экран» включался с высоты 740 px, отборы
// переносились в две строки, и под таблицу оставалось около 60 px, то есть одна обрезанная строка. На любой ширине
// и высоте компьютера таблица должна показывать хотя бы три строки гостей целиком.
for (const [width, height] of [
  [1366, 768],
  [1280, 800],
  [1280, 900],
  [1440, 900],
  [1440, 1000],
] as const) {
  test(`гости и бронирования: на ${width}×${height} таблица показывает несколько строк, а не одну`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/guests');
    const rows = page.getByRole('main').locator('.gb-table tbody tr');
    await expect(rows.first()).toBeVisible();
    const visible = await page.evaluate(() => {
      const box = document.querySelector('.gb-list .table-scroll')!.getBoundingClientRect();
      const top = Math.max(box.top, 0);
      const bottom = Math.min(box.bottom, window.innerHeight);
      const rowsInBox = [...document.querySelectorAll('.gb-table tbody tr')].filter((tr) => {
        const r = tr.getBoundingClientRect();
        return r.top >= box.top - 1 && r.bottom <= box.bottom + 1;
      }).length;
      const pageScrolls = document.documentElement.scrollHeight > window.innerHeight + 1;
      return { rowsInBox, pageScrolls, onScreen: bottom - top };
    });
    expect(visible.rowsInBox, JSON.stringify(visible)).toBeGreaterThanOrEqual(3);
  });
}
