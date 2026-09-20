import { expect, test, type Page } from '@playwright/test';
import { cardTab } from '../e2e/card-tabs';

/**
 * Срез 7.3 «Четыре действия управляющего» (plans/slice-7-3-manager-actions-2026-09-16.md) на синтетическом API:
 * суммы до подтверждения (Д5) — переселение в другую категорию, продление, отмена, незаезд, выселение
 * с долгом; «Разрешить» и плашки конфликтов на шахматке (Д3–Д4). Цены синтетические: номер 8 000 ₸,
 * койка 4 000 ₸ за ночь; карточка 20260913-TESTAA — R01, три ночи, 24 000 ₸, предоплата 8 000 ₸.
 */
const fixture = 'http://127.0.0.1:4311';
const BOOKING = '20260913-TESTAA';
const today = new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
const plus = (n: number) =>
  new Date(Date.parse(`${today}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
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
  const assign = page.getByTestId('assign-form');
  await assign.locator('select[name="unitCode"]').selectOption('M03');
  await assign.getByRole('button', { name: 'Переселить' }).click();
  const dialog = page.locator('dialog[open]');
  await expect(dialog.getByRole('heading')).toHaveText('Переселить в мужской общий номер M03?');
  // сумма словами и целиком (срез 7.3, Д5): «станет столько вместо столько»
  await expect(dialog).toContainText('Цена проживания станет 12 000 ₸ вместо 24 000 ₸');
  await expect(dialog).toContainText('дешевле на 12 000 ₸');
  expect((await commands(page)).map((c) => c.path)).toEqual([]); // предпросмотр ничего не пишет
  await dialog.getByRole('button', { name: 'Переселить и пересчитать' }).click();
  await expect(page.getByTestId('assign-form')).toContainText('Переселить из M03');
  expect((await commands(page)).map((c) => c.path)).toEqual([
    `/reservations/${BOOKING}/items/ui-item/assign`,
  ]);
  await cardTab(page, 'Обзор');
  await expect(page.getByTestId('stay-row').first()).toContainText('M03');
  await expect(page.getByTestId('stay-row').first()).toContainText('12 000');
  // внутри категории — без окна
  await cardTab(page, 'Действия');
  await page.getByTestId('assign-form').locator('select[name="unitCode"]').selectOption('M04');
  await page.getByTestId('assign-form').getByRole('button', { name: 'Переселить' }).click();
  await expect(page.getByTestId('assign-form')).toContainText('Переселить из M04');
  await expect(page.locator('dialog[open]')).toHaveCount(0);
});

test('карточка: «+1 ночь» называет сумму до подтверждения; занятая ячейка — причина словом вместо окна', async ({
  page,
  request,
}) => {
  await page.goto(`/reservations/${BOOKING}`);
  await cardTab(page, 'Действия');
  await page.getByTestId('extend-ui-item').click();
  const dialog = page.locator('dialog[open]');
  await expect(dialog).toContainText('Новая ночь — 8 000 ₸. Проживание станет 32 000 ₸');
  expect((await commands(page)).map((c) => c.path)).toEqual([]); // предпросмотр ничего не пишет
  await dialog.getByRole('button', { name: 'Продлить' }).click();
  await expect(page.getByTestId('toast-stack')).toContainText('Продлено до');
  await cardTab(page, 'Обзор');
  // дата выезда словами (§14), сырая — в datetime
  await expect(page.getByTestId('stay-row').first().locator('time').nth(1)).toHaveAttribute(
    'datetime',
    plus(4),
  );
  await expect(page.getByTestId('stay-row').first()).toContainText('32 000');
  // соседняя бронь на R01 со следующей ночи — окна нет, причина словом (сервер ответил бы 409 после)
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
  await page.getByTestId('extend-ui-item').click();
  await expect(page.getByRole('main')).toContainText('R01 занята');
  await expect(page.getByRole('main')).toContainText('сначала переселите');
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  // второго продления не было: в списке команд, кроме соседней брони выше, только одно продление
  expect(
    (await commands(page)).filter((c) => c.path.endsWith('/extend')).map((c) => c.path),
  ).toEqual([`/reservations/${BOOKING}/items/ui-item/extend`]);
});

test('карточка: отмена, незаезд и выселение с долгом — окно с суммой вместо window.confirm', async ({
  page,
  request,
}) => {
  // отмена в день заезда: штраф — первая ночь; «Оставить как есть» ничего не пишет
  await page.goto(`/reservations/${BOOKING}`);
  await cardTab(page, 'Действия');
  await page.getByTestId('cancel-reservation').click();
  let dialog = page.locator('dialog[open]');
  await expect(dialog.getByRole('heading')).toHaveText(`Отменить бронь ${BOOKING}?`);
  await expect(dialog).toContainText('Начисление 24 000 ₸ сторнируется, вместо него штраф 8 000 ₸');
  await expect(dialog).toContainText('ячейки освободятся');
  await dialog.getByRole('button', { name: 'Оставить как есть' }).click();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  expect(await commands(page)).toEqual([]);
  await page.getByTestId('cancel-reservation').click();
  await page.locator('dialog[open]').getByRole('button', { name: 'Отменить бронь' }).click();
  await cardTab(page, 'Обзор');
  await expect(page.getByTestId('stay-row').first()).toContainText('отменена');

  // незаезд
  await request.post(`${fixture}/__test/reset`);
  await page.goto(`/reservations/${BOOKING}`);
  await cardTab(page, 'Действия');
  await page.getByTestId('no-show-ui-item').click();
  dialog = page.locator('dialog[open]');
  await expect(dialog.getByRole('heading')).toContainText('Отметить незаезд');
  await expect(dialog).toContainText('вместо него штраф 8 000 ₸');
  await dialog.getByRole('button', { name: 'Отметить незаезд' }).click();
  await cardTab(page, 'Обзор');
  await expect(page.getByTestId('stay-row').first()).toContainText('незаезд');

  // выселение с долгом: первое нажатие — окно с суммой долга, «Оставить как есть» держит гостя заселённым
  await request.post(`${fixture}/__test/reset`);
  await page.goto(`/reservations/${BOOKING}`);
  await cardTab(page, 'Действия');
  await page.getByTestId('check-in-ui-item').click();
  await page.getByTestId('check-out-ui-item').click();
  dialog = page.locator('dialog[open]');
  await expect(dialog.getByRole('heading')).toHaveText('Выселить с долгом?');
  await expect(dialog).toContainText('долг 16 000 ₸');
  await dialog.getByRole('button', { name: 'Оставить как есть' }).click();
  await cardTab(page, 'Обзор');
  await expect(page.getByTestId('stay-row').first()).toContainText('заселён');
  await cardTab(page, 'Действия');
  await page.getByTestId('check-out-ui-item').click();
  await page.locator('dialog[open]').getByRole('button', { name: 'Выселить с долгом' }).click();
  await cardTab(page, 'Обзор');
  await expect(page.getByTestId('stay-row').first()).toContainText('выселен');
});

test('карточка: предварительная бронь названа словом, место за ней держится', async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/control`, { data: { tentative: true } });
  await page.goto(`/reservations/${BOOKING}`);
  await expect(page.getByTestId('tentative-callout')).toContainText('Бронь не подтверждена');
  await expect(page.getByTestId('tentative-callout')).toContainText('второй раз не продаётся');
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
  await expect(page.getByTestId('stay-too-long')).toContainText('длиннее 62 ночей');
  await expect(page.getByTestId('stay-too-long')).toContainText('с шахматки');
  await expect(page.getByRole('main')).not.toContainText('Доступность части периодов не загрузилась');
});

test('шахматка: плашки «сверх мест» и «требует разбора», «Разрешить» у строки без ячейки', async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/control`, { data: { showcase: true } });
  await page.goto('/chessboard');
  await expect(page.getByTestId('overbooked-callout')).toContainText('Продано сверх мест');
  await expect(page.getByTestId('review-callout')).toContainText('Входящая бронь требует разбора');
  await expect(
    page.getByTestId('review-callout').getByRole('link', { name: 'Разобрать' }),
  ).toHaveAttribute('href', '/channels');
  await expect(page.getByTestId('unassigned-stays')).toHaveAttribute('data-count', '1');
  await page.getByTestId('unassigned-stays').getByRole('button', { name: 'Разрешить' }).click();
  const menu = page.getByRole('menu');
  await expect(menu.getByRole('menuitem')).toHaveText([
    /Назначить ячейку/,
    /Переселить в другую категорию/,
  ]);
  await menu.getByRole('menuitem', { name: /Назначить ячейку/ }).click();
  await expect(page).toHaveURL(/\/reservations\/20260913-SHOWUN#booking-actions$/);
  await cardTab(page, 'Действия');
  await expect(page.getByTestId('assign-form')).toBeVisible();
});
