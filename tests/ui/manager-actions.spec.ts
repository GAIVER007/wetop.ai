import { FIXTURE_API, expect, test, type Page, devNoise } from './fixtures';
import { cardTab } from '../e2e/card-tabs';

/**
 * Срез 7.3 «Четыре действия управляющего» (plans/slice-7-3-manager-actions-2026-09-16.md) на синтетическом API:
 * суммы до подтверждения (Д5) — переселение в другую категорию, продление, отмена, незаезд, выселение
 * с долгом; «Разрешить» и плашки конфликтов в календаре (Д3–Д4). Цены синтетические: номер 8 000 ₸,
 * койка 4 000 ₸ за ночь; карточка 20260913-TESTAA — R01, три ночи, 24 000 ₸, предоплата 8 000 ₸.
 */
const fixture = FIXTURE_API;
const BOOKING = '20260913-TESTAA';
/**
 * «Сегодня» объекта — дата стенда: он считает её при каждом сбросе (Asia/Almaty). Своя дата, посчитанная при загрузке
 * файла, отставала на день, когда долгий прогон переходил полночь Алматы — 19:00 UTC (TESTING.md §4).
 */
let today = new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
const plus = (n: number) =>
  new Date(Date.parse(`${today}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const dd = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

test.beforeEach(async ({ request }) => {
  const reset = await request.post(`${fixture}/__test/reset`);
  today = ((await reset.json()) as { today: string }).today;
});

const commands = async (page: Page) =>
  (await (await page.request.get(`${fixture}/__test/commands`)).json()) as Array<{
    path: string;
    body: Record<string, unknown>;
  }>;

test('карточка: переселение в другую категорию — окно с новой суммой; внутри категории — сразу', async ({
  page,
}) => {
  await page.goto(`/reservations/${BOOKING}`);
  await cardTab(page, 'Действия');
  const assign = page.getByRole('main').getByTestId('assign-form');
  await assign.locator('select[name="unitCode"]').selectOption('M03');
  await assign.getByRole('button', { name: 'Переселить' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading')).toHaveText('Переселить в мужской общий номер M03?');
  await expect(dialog.getByTestId('move-amount')).toHaveText(
    'Новая сумма за 3 ночи 12 000 ₸ (было 24 000 ₸)',
  );
  expect((await commands(page)).map((c) => c.path)).toEqual([]); // предпросмотр ничего не пишет
  await dialog.getByRole('button', { name: 'Переселить и пересчитать' }).click();
  await expect(page.getByRole('main').getByTestId('assign-form')).toContainText(
    'Переселить из M03',
  );
  expect((await commands(page)).map((c) => c.path)).toEqual([
    `/reservations/${BOOKING}/items/ui-item/assign`,
  ]);
  await cardTab(page, 'Обзор');
  await expect(page.getByRole('main').getByTestId('stay-row').first()).toContainText('M03');
  await expect(page.getByRole('main').getByTestId('stay-row').first()).toContainText('12 000');
  // внутри категории — без окна
  await cardTab(page, 'Действия');
  await page
    .getByRole('main')
    .getByTestId('assign-form')
    .locator('select[name="unitCode"]')
    .selectOption('M04');
  await page
    .getByRole('main')
    .getByTestId('assign-form')
    .getByRole('button', { name: 'Переселить' })
    .click();
  await expect(page.getByRole('main').getByTestId('assign-form')).toContainText(
    'Переселить из M04',
  );
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('карточка: «Продлить на ночь» знает сумму заранее; занятая ячейка отключает кнопку с причиной', async ({
  page,
  request,
}) => {
  // Падает только в CI (19–20.09, три прогона подряд), локально 5/5, трасса из артефакта недоступна:
  // при отказе печатаем в лог ошибки страницы и состояние всех <dialog>
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => {
    if (!devNoise.test(error.message)) pageErrors.push(error.message);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') pageErrors.push(`console: ${message.text()}`);
  });
  await page.goto(`/reservations/${BOOKING}`);
  await cardTab(page, 'Действия');
  const hint = page.getByRole('main').getByTestId('hint-extend-ui-item');
  await expect(hint).toHaveText(`до ${dd(plus(4))}, +8 000 ₸ на счёт`);
  await page.getByRole('main').getByTestId('extend-ui-item').click();
  const confirm = page.getByRole('dialog', { name: 'Продлить на ночь — Двухместный номер?' });
  try {
    await expect(confirm).toBeVisible();
  } catch (error) {
    const dialogs = await page.evaluate(() =>
      [...document.querySelectorAll('dialog')].map((d) => ({
        open: d.hasAttribute('open'),
        title: d.getAttribute('aria-labelledby')
          ? document.getElementById(d.getAttribute('aria-labelledby')!)?.textContent
          : null,
        text: d.textContent?.slice(0, 120),
      })),
    );
    console.log('extend dialog missing; page errors:', JSON.stringify(pageErrors));
    console.log('dialogs on page:', JSON.stringify(dialogs));
    throw error;
  }
  expect(await commands(page)).toEqual([]);
  await confirm.getByRole('button', { name: 'Продлить', exact: true }).click();
  await expect(page.getByRole('main').getByTestId('done-extend-ui-item')).toHaveText(
    `Проживание продлено до ${dd(plus(4))}, +8 000 ₸ на счёт`,
  );
  await cardTab(page, 'Обзор');
  await expect(
    page.getByRole('main').getByTestId('stay-row').first().locator('time').nth(1),
  ).toHaveAttribute('datetime', plus(4));
  await expect(page.getByRole('main').getByTestId('stay-row').first()).toContainText('32 000');
  // соседняя бронь на R01 со следующей ночи — кнопка отключена, причина словом
  await request.post(`${fixture}/reservations`, {
    headers: { 'x-wetop-test-client': '1' },
    data: {
      source: 'PHONE',
      arrivalDate: plus(4),
      departureDate: plus(5),
      guest: { firstName: 'Сосед', lastName: 'Учебный' },
      items: [{ accommodationTypeCode: 'ROOM', ratePlanCode: 'BASE', adults: 1, unitCode: 'R01' }],
    },
  });
  await page.reload();
  await cardTab(page, 'Действия');
  await expect(page.getByRole('main').getByTestId('extend-ui-item')).toBeDisabled();
  await expect(page.getByRole('main').getByTestId('hint-extend-ui-item')).toHaveText(
    `R01 занята ${dd(plus(4))} — сначала переселите`,
  );
});

test('карточка: отмена, незаезд и выселение с долгом — окно с суммой вместо window.confirm', async ({
  page,
  request,
}) => {
  // отмена в день заезда: штраф — первая ночь; «Оставить» ничего не пишет
  await page.goto(`/reservations/${BOOKING}`);
  await cardTab(page, 'Действия');
  await page.getByRole('main').getByTestId('cancel-reservation').click();
  let dialog = page.getByRole('dialog', { name: `Отменить бронь ${BOOKING}?` });
  await expect(dialog.getByTestId('cancel-penalty')).toHaveText('Штраф 8 000 ₸ останется на счёте');
  await expect(dialog).toContainText('Место вернётся в продажу');
  await dialog.getByRole('button', { name: 'Оставить' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await commands(page)).toEqual([]);
  await page.getByRole('main').getByTestId('cancel-reservation').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Отменить бронь' }).click();
  await cardTab(page, 'Обзор');
  await expect(page.getByRole('main').getByTestId('stay-row').first()).toContainText('Отменена');

  // незаезд
  await request.post(`${fixture}/__test/reset`);
  await page.goto(`/reservations/${BOOKING}`);
  await cardTab(page, 'Действия');
  await page.getByRole('main').getByTestId('no-show-ui-item').click();
  dialog = page.getByRole('dialog', { name: 'Отметить незаезд по R01?' });
  await expect(dialog.getByTestId('no-show-penalty')).toHaveText(
    'Штраф 8 000 ₸ останется на счёте',
  );
  await dialog.getByRole('button', { name: 'Отметить незаезд' }).click();
  // Вкладку меняем после ответа действия: клик по «Обзору» в ту же сотню миллисекунд, когда ответ приходит,
  // перебивается адресом, с которым действие стартовало, и карточка возвращается на «Действия» — ячейки
  // «Обзора» скрыты (полный UI-набор 28.09.2026, лог 2026-09-28T18-08-55Z-e2e-4673.log). Кнопка незаезда
  // исчезает, когда ответ применён.
  await expect(page.getByRole('main').getByTestId('no-show-ui-item')).toHaveCount(0);
  await cardTab(page, 'Обзор');
  await expect(page.getByRole('main').getByTestId('stay-row').first()).toContainText('Незаезд');
  await expect(
    page.getByRole('main').getByTestId('stay-row').first().getByRole('cell').first(),
  ).toHaveText('—');

  // выселение с долгом: первое нажатие — окно с суммой долга, «Оставить» держит гостя заселённым
  await request.post(`${fixture}/__test/reset`);
  await page.goto(`/reservations/${BOOKING}`);
  await cardTab(page, 'Действия');
  await page.getByRole('main').getByTestId('check-in-ui-item').click();
  // Q-156 (ADR-068): R01 требует уборки — стойка предупреждает и заселяет после подтверждения
  await page
    .getByRole('dialog', { name: 'Ячейка R01 ещё не проверена. Заселить?' })
    .getByRole('button', { name: 'Заселить всё равно' })
    .click();
  await page.getByRole('main').getByTestId('check-out-ui-item').click();
  dialog = page.getByRole('dialog', { name: 'Выселить с долгом?' });
  await expect(dialog.getByTestId('debt-amount')).toHaveText('Долг 16 000 ₸ останется на счёте');
  await dialog.getByRole('button', { name: 'Оставить' }).click();
  await cardTab(page, 'Обзор');
  await expect(page.getByRole('main').getByTestId('stay-row').first()).toContainText('Проживает');
  await cardTab(page, 'Действия');
  await page.getByRole('main').getByTestId('check-out-ui-item').click();
  await page
    .getByRole('dialog', { name: 'Выселить с долгом?' })
    .getByRole('button', { name: 'Выселить с долгом' })
    .click();
  await cardTab(page, 'Обзор');
  await expect(page.getByRole('main').getByTestId('stay-row').first()).toContainText('Выехал');
});

test('карточка: предварительная бронь названа словом, место за ней держится', async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/control`, { data: { tentative: true } });
  await page.goto(`/reservations/${BOOKING}`);
  await expect(page.getByRole('main').getByTestId('tentative-callout')).toContainText(
    'Бронь не подтверждена',
  );
  await expect(page.getByRole('main').getByTestId('tentative-callout')).toContainText(
    'второй раз не продаётся',
  );
});

/**
 * Проживание длиннее 62 ночей — рабочий случай: на объекте живут по три месяца. Доступность на весь
 * срок не считается, и до 17.09.2026 карточка писала «не загрузилась, обновите карточку» — совет,
 * который ничего не менял. Найдено обходом стойки на живых данных.
 */
test('карточка: долгое проживание объясняет, почему свободных ячеек нет, а не зовёт обновить', async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/control`, { data: { longStay: true } });
  await page.goto(`/reservations/${BOOKING}`);
  await cardTab(page, 'Действия');
  await expect(page.getByRole('main').getByTestId('stay-too-long')).toContainText(
    'длиннее 62 ночей',
  );
  await expect(page.getByRole('main').getByTestId('stay-too-long')).toContainText('из календаря');
  await expect(page.getByRole('main')).not.toContainText(
    'Доступность части периодов не загрузилась',
  );
});

test('шахматка: плашки «сверх мест» и «требует разбора», «Разрешить» открывает ящик броней без места', async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/control`, { data: { showcase: true } });
  await page.goto('/chessboard');
  await expect(page.getByRole('main').getByTestId('overbooked-callout')).toContainText(
    'Продано сверх мест',
  );
  await expect(page.getByRole('main').getByTestId('review-callout')).toContainText(
    'Входящая бронь требует разбора',
  );
  await expect(
    page.getByRole('main').getByTestId('review-callout').getByRole('link', { name: 'Разобрать' }),
  ).toHaveAttribute('href', '/channels/events?status=FAILED');
  await expect(page.getByRole('main').getByTestId('unassigned-stays')).toHaveAttribute(
    'data-count',
    '1',
  );
  // При проданном сверх мест строка броней без места — тоном critical (ТЗ v2 §11); «Разрешить» у плашки
  // овербукинга открывает ящик «Брони без размещения» (§12), из карточки ящика — полная бронь
  await expect(page.getByRole('main').getByTestId('unassigned-stays')).toHaveAttribute(
    'data-tone',
    'critical',
  );
  await page
    .getByRole('main')
    .getByTestId('overbooked-callout')
    .getByRole('link', { name: 'Разрешить' })
    .click();
  const drawer = page.getByRole('dialog', { name: 'Брони без размещения' });
  const card = drawer.getByTestId('unassigned-card').filter({ hasText: '20260913-SHOWUN' });
  await card.getByRole('link', { name: 'Открыть бронь' }).click();
  await expect(page).toHaveURL(/\/reservations\/20260913-SHOWUN$/);
  await cardTab(page, 'Действия');
  await expect(page.getByRole('main').getByTestId('assign-form')).toBeVisible();
});

/**
 * B3 «Карточка брони» (tasks/todo.md): сверху — гость, даты, место, гостей, стоимость и остаток одной
 * полосой над вкладками; следующее действие смены первым в «Обзоре»; проживания в панели 480 px без
 * прокрутки вбок; опасное действие названо до окна; Escape закрывает панель и возвращает фокус туда,
 * откуда её открыли (DESIGN.md §12) — контекст списка сохранён.
 */
test('карточка B3: полоса фактов над вкладками, следующее действие, отмена названа, Escape возвращает фокус', async ({
  page,
}) => {
  await page.goto('/reservations');
  const opener = page.getByRole('link', { name: `Открыть бронь ${BOOKING}` });
  await opener.click();
  const drawer = page.getByRole('dialog', { name: 'Бронирование', exact: true });
  await expect(drawer).toBeVisible();
  const head = drawer.getByTestId('booking-head');
  await expect(head.getByTestId('guest-link')).toHaveText('Гость Тестовый');
  await expect(head).toContainText('гражданство KAZ');
  await expect(head).toContainText(`${dd(today)} → ${dd(plus(3))}`);
  await expect(head).toContainText('3 ночи');
  await expect(head.getByTestId('booking-place')).toHaveText('R01');
  // плашка суммы: слово и число — два span без пробела в DOM (AmountChip)
  await expect(head.getByTestId('booking-due')).toHaveText(/к оплате\s*16 000 ₸/);
  // полоса видна и из вкладки «Счета» — она над вкладками
  await drawer.getByRole('tab', { name: 'Счета', exact: true }).click();
  await expect(head).toBeVisible();
  await drawer.getByRole('tab', { name: 'Обзор', exact: true }).click();
  // проживания: семь колонок сложены в карточку, панель не прокручивается вбок
  const stays = drawer.getByTestId('stays-table');
  await expect(stays.getByTestId('stay-row')).toHaveCount(1);
  await expect(stays.getByTestId('stay-row')).toContainText('Двухместный номер');
  const overflow = await stays
    .locator('xpath=..')
    .evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  const drawerOverflow = await drawer.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(drawerOverflow).toBeLessThanOrEqual(1);
  // печатные формы — ссылки словами, без « · », внизу обзора
  await expect(drawer.getByRole('link', { name: 'Договор KZ' })).toBeVisible();
  // следующее действие ведёт во вкладку, не в историю: одно нажатие Escape закроет панель
  await drawer.getByRole('link', { name: 'Продлить или переселить' }).click();
  await expect(drawer.getByRole('tab', { name: 'Действия', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  // опасное действие названо до окна
  const cancelPanel = drawer.getByTestId('cancel-panel');
  await expect(cancelPanel).toContainText('Отмена брони');
  await expect(cancelPanel).toContainText('место вернётся в продажу');
  const cancelButton = cancelPanel.getByTestId('cancel-reservation');
  await cancelButton.click();
  const confirm = page.getByRole('dialog', { name: `Отменить бронь ${BOOKING}?` });
  await expect(confirm.getByTestId('cancel-penalty')).toHaveText(
    'Штраф 8 000 ₸ останется на счёте',
  );
  await page.keyboard.press('Escape');
  await expect(confirm).toBeHidden();
  await expect(cancelButton).toBeFocused();
  await expect(drawer).toBeVisible();
  // Escape закрывает панель, список под ней остаётся, фокус — на ссылке, откуда открыли
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await expect(page).toHaveURL(/\/reservations(\?|$)/);
  await expect(page.getByRole('main').getByTestId('reservations-table')).toBeVisible();
  await expect(opener).toBeFocused();
});

test('карточка B3 на телефоне: полоса и проживания без прокрутки вбок', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/reservations/${BOOKING}`);
  const main = page.getByRole('main');
  await expect(main.getByTestId('booking-head')).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  const stays = main.getByTestId('stays-table');
  await expect(stays.getByTestId('stay-row')).toContainText('R01');
  const tableOverflow = await stays
    .locator('xpath=..')
    .evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(tableOverflow).toBeLessThanOrEqual(1);
});

/**
 * C2 «Действия без перетаскивания» (tasks/todo.md): на плашке шахматки — меню «⋯» с теми же действиями,
 * что у карточки и перетаскивания: продлить (сумма до подтверждения), переселить (форма карточки),
 * отменить (штраф до подтверждения), открыть карточку. Всё с клавиатуры; Escape возвращает фокус на
 * кнопку; меню — брат ссылки-плашки, клик по плашке по-прежнему открывает карточку.
 */
test('шахматка C2: меню на плашке — продлить с суммой, отменить со штрафом, с клавиатуры и без drag', async ({
  page,
}) => {
  // окно с сегодняшнего дня: неделя по умолчанию идёт с понедельника, и в воскресенье бронь «с сегодня на три
  // ночи» видна одной клеткой, а меню у плашки появляется с двух (CI 03.10.2026, воскресенье по Алматы)
  await page.goto(`/chessboard?from=${today}&to=${plus(6)}`);
  const main = page.getByRole('main');
  const plate = main.locator(`[data-testid="stay-cell"][data-number="${BOOKING}"]`).first();
  await expect(plate).toBeVisible();
  const cell = plate.locator('xpath=..');
  const button = cell.getByRole('button', { name: 'Действия: Гость Тестовый' });
  await expect(button).toBeVisible();
  // кнопка не внутри ссылки: клик по плашке открывает карточку, клик по кнопке — меню
  expect(await button.evaluate((el) => !!el.closest('a'))).toBe(false);

  // с клавиатуры: стрелка вниз открывает меню, первый пункт в фокусе, Escape возвращает фокус
  await button.focus();
  await page.keyboard.press('ArrowDown');
  const menu = page.getByRole('menu', { name: 'Действия: Гость Тестовый' });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Открыть карточку' })).toBeFocused();
  await expect(menu.getByRole('menuitem', { name: 'Переселить' })).toHaveAttribute(
    'href',
    `/reservations/${BOOKING}#booking-actions`,
  );
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(button).toBeFocused();

  // продление: сумма до подтверждения, команда та же, что у карточки
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect(menu.getByRole('menuitem', { name: 'Продлить на ночь' })).toBeFocused();
  await page.keyboard.press('Enter');
  const extend = page.getByRole('dialog', { name: `Продлить на ночь — Гость Тестовый, R01?` });
  await expect(extend).toContainText(/Новая ночь — \d[\d\s]* ₸\. Проживание станет/);
  await extend.getByRole('button', { name: 'Продлить' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'продлена на ночь, R01' })).toBeVisible();
  const sent = await commands(page);
  expect(sent.some((c) => c.path.endsWith('/extend'))).toBe(true);
  // сетку после продления перерисовывает router.refresh(); на синтетической доске соседние ночи R01
  // заняты другими бронями фикстуры, поэтому новую клетку здесь не ищем — это доказывает живой desk-tasks

  // отмена: штраф назван до подтверждения, «Оставить» ничего не меняет
  await button.click();
  await menu.getByRole('menuitem', { name: 'Отменить бронь' }).click();
  const cancel = page.getByRole('dialog', { name: `Отменить бронь ${BOOKING}?` });
  await expect(cancel).toContainText('Место R01 вернётся в продажу');
  await expect(cancel).toContainText('Штраф 8 000 ₸ останется на счёте');
  await cancel.getByRole('button', { name: 'Оставить как есть' }).click();
  await expect(cancel).toBeHidden();
  await expect(plate).toBeVisible();
  expect((await commands(page)).some((c) => c.path.endsWith('/cancel'))).toBe(false);
});
