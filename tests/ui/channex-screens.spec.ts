import { expect, test } from '@playwright/test';

/**
 * Срез 7.2 «Три экрана Channex» (plans/slice-7-2-channex-screens.md) на синтетическом API с витриной:
 * правка цены в ячейке (Enter / Escape / ноль), таблица очереди с фильтром, входящие события с фильтрами,
 * поиском и постраничностью, страница приёма брони без персональных данных.
 */
const fixture = 'http://127.0.0.1:4311';

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
  await request.post(`${fixture}/__test/control`, { data: { showcase: true } });
});

test('цены: правка в ячейке — Enter сохраняет и уведомляет, Escape отменяет, ноль не уходит', async ({
  page,
  request,
}) => {
  await page.goto('/rates?month=2026-10');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Цены и ограничения');
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
  await expect(page.locator('.tbl tr.is-stop').first()).toContainText('закрыто');
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
  await expect(page.locator('.page__subtitle')).toContainText('октябрь 2026');
  await page.getByLabel('Следующий месяц', { exact: true }).click();
  await expect(page).toHaveURL(/month=2026-11/);
  await expect(page.locator('.page__subtitle')).toContainText('ноябрь 2026');
  const editor = page.getByRole('main').getByTestId('bulk-editor');
  await editor.getByLabel('Цена за ночь').fill('9100');
  await editor.getByLabel('Мин. ночей', { exact: true }).fill('3');
  await editor.getByRole('button', { name: '+ Добавить в список', exact: true }).click();
  const pending = page.getByRole('main').getByTestId('pending-changes');
  await expect(pending).toContainText('01.11 → 30.11.2026 — цена 9100, мин. ночей 3');
  await expect(pending).not.toContainText(' · ');
});

test('каналы: очередь с фильтром по статусу, события с фильтрами, поиском и постраничностью', async ({
  page,
}) => {
  await page.goto('/channels');
  const outbox = page.getByRole('main').getByTestId('outbox-table');
  await expect(outbox.getByTestId('outbox-row')).toHaveCount(4);
  await expect(outbox).toContainText('цены и ограничения');
  await expect(outbox).toContainText('Двухместный номер');
  await expect(outbox).toContainText('ui-task-4f2a');
  await expect(outbox).toContainText('rate plan not found');
  await page.getByRole('main').getByTestId('outbox-filter-FAILED').click();
  await expect(page).toHaveURL(/queue=FAILED/);
  await expect(page.getByRole('main').getByTestId('outbox-filter-FAILED')).toHaveAttribute(
    'aria-current',
    'true',
  );
  await expect(
    page.getByRole('main').getByTestId('outbox-table').getByTestId('outbox-row'),
  ).toHaveCount(1);
  await expect(page.getByRole('main').getByTestId('outbox-table')).toContainText('ошибка');
  // События: страница из 20, всего 33 (в витрине есть и проверка webhook с двоеточиями в номере)
  const events = page.getByRole('main').getByTestId('events-table');
  await expect(events.getByTestId('event-row')).toHaveCount(20);
  await expect(page.getByRole('main').getByTestId('events-pager')).toContainText(
    'показано 20 из 33',
  );
  await expect(page.getByRole('main').getByTestId('events-callout')).toContainText(
    'Входящая бронь требует разбора',
  );
  await expect(events.getByRole('link', { name: '20260913-SHOWTN' }).first()).toHaveAttribute(
    'href',
    '/reservations/20260913-SHOWTN',
  );
  await page.getByRole('link', { name: 'Дальше' }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page).toHaveURL(/queue=FAILED/); // фильтр очереди не сброшен
  await expect(
    page.getByRole('main').getByTestId('events-table').getByTestId('event-row'),
  ).toHaveCount(13);
  await expect(page.getByRole('main').getByTestId('events-pager')).toContainText(
    'показано 13 из 33',
  );
  // Фильтр по статусу + поиск по unique_id
  await page.getByRole('main').getByLabel('Статус события').selectOption('FAILED');
  await page.getByRole('button', { name: 'Найти', exact: true }).click();
  await expect(
    page.getByRole('main').getByTestId('events-table').getByTestId('event-row'),
  ).toHaveCount(1);
  await expect(page.getByRole('main').getByTestId('events-table')).toContainText('BDC-4821-7731');
  await page.getByRole('main').getByLabel('Статус события').selectOption('');
  await page.getByRole('main').getByTestId('events-search').fill('exp-90210');
  await page.getByRole('button', { name: 'Найти', exact: true }).click();
  await expect(
    page.getByRole('main').getByTestId('events-table').getByTestId('event-row'),
  ).toHaveCount(1);
  await expect(page.getByRole('main').getByTestId('events-table')).toContainText('20260913-SHOWCX');
  await expect(page.getByRole('main').getByTestId('events-pager')).toContainText('показано 1 из 1');
  await page.getByRole('main').getByTestId('events-search').fill('нет-такого');
  await page.getByRole('button', { name: 'Найти', exact: true }).click();
  await expect(page.getByRole('main').getByTestId('events-table')).toContainText(
    'ничего не найдено',
  );
});

test('приём брони из канала: цепочка ревизия → бронь → ячейка, без персональных данных; ошибка и 404', async ({
  page,
}) => {
  await page.goto('/channels');
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
