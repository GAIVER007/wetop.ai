import type { APIRequestContext, Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * Шахматка v2, PR 4 (ТЗ §26–29, §54): перетаскивание и продление за край.
 * Во время перетаскивания строки, куда можно бросить бронь, подсвечены, над строкой виден призрак
 * брони; занятая или заблокированная строка drop не принимает и говорит почему. Перед переселением —
 * окно по §27: гость, откуда и куда, даты, разница в деньгах. Продление показывает дату выезда, ночи
 * и сумму до того, как мышь отпущена, а поверх чужой брони или блокировки не продлевает.
 * Команды прежние: переселение — `assign`, продление — `extend`, суммы — предпросмотры API.
 *
 * Данные — базовые брони стенда (гости вымышленные, ADR-010), не design-seed: там с 1-го числа
 * следующего месяца заняты все 88 мест, и в последние дни месяца тест зависел бы от календаря.
 * «Клиент Пример» (TEST1) — R02, три ночи с сегодняшнего дня; на R03 в те же ночи TEST2; R07 и
 * койки с M03 свободны; закрытую строку тест делает сам — блокировкой через API стенда.
 */
const fixture = 'http://127.0.0.1:4311';
const headers = { 'x-wetop-test-client': '1' };
const NUMBER = '20260913-TEST1';
const ITEM = 'ui-item-1';
const GUEST = 'Клиент Пример';

const add = (date: string, n: number) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Неделя со вчерашнего дня: ночи брони в середине окна, справа запас на продление */
async function openWeek(page: Page, request: APIRequestContext): Promise<string> {
  const stay = (await (await request.get(`${fixture}/reservations/${NUMBER}`, { headers })).json()) as {
    arrivalDate: string;
  };
  const from = add(stay.arrivalDate, -1);
  await page.goto(`/chessboard?from=${from}&to=${add(from, 6)}`);
  return stay.arrivalDate;
}

const block = (request: APIRequestContext, unit: string, from: string, to: string) =>
  request.post(`${fixture}/units/${unit}/blocks`, {
    headers,
    data: { dateFrom: from, dateTo: to, type: 'MAINTENANCE', reason: 'тест' },
  });

const unitRow = (page: Page, code: string) =>
  page.locator(`[data-testid="unit-row"][data-unit-code="${code}"]`);

/** Навести на клетку, не отпуская: dragover нужен минимум двумя движениями */
async function moveTo(page: Page, target: Locator) {
  const box = (await target.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 6 });
  await page.mouse.move(box.x + box.width / 2 + 3, box.y + box.height / 2, { steps: 2 });
}
async function dragOver(page: Page, source: Locator, target: Locator) {
  await source.hover();
  await page.mouse.down();
  await moveTo(page, target);
}

const commands = async (request: APIRequestContext, tail: string) =>
  ((await (await request.get(`${fixture}/__test/commands`)).json()) as Array<{
    path: string;
    body: Record<string, unknown>;
  }>).filter((c) => c.path.endsWith(tail));

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

test('во время перетаскивания: свободная строка подсвечена и показывает призрак, занятая и закрытая — причину; drop туда ничего не делает', async ({
  page,
  request,
}) => {
  const arrival = await openWeek(page, request);
  expect((await block(request, 'R06', arrival, add(arrival, 3))).ok()).toBe(true);
  await page.reload();
  const source = unitRow(page, 'R02').locator(`[data-testid="stay-cell"][data-date="${arrival}"]`);
  await expect(source).toHaveAttribute('data-number', NUMBER);

  await dragOver(page, source, unitRow(page, 'R07').locator(`td[data-date="${arrival}"]`));
  // допустимые места подсвечены, недопустимые помечены ещё до наведения (§26)
  await expect(unitRow(page, 'R07')).toHaveAttribute('data-drop', 'ok');
  await expect(unitRow(page, 'R03')).toHaveAttribute('data-drop', 'blocked');
  await expect(unitRow(page, 'R06')).toHaveAttribute('data-drop', 'blocked');
  const ghost = page.getByTestId('drop-ghost');
  await expect(ghost).toHaveAttribute('data-tone', 'ok');
  await expect(ghost).toContainText(GUEST);
  await expect(unitRow(page, 'R07').getByTestId('drop-ghost')).toBeVisible();

  await moveTo(page, unitRow(page, 'R03').locator(`td[data-date="${arrival}"]`));
  await expect(ghost).toHaveAttribute('data-tone', 'blocked');
  await expect(ghost).toContainText(/Занято с \d+ /);

  await moveTo(page, unitRow(page, 'R06').locator(`td[data-date="${arrival}"]`));
  await expect(ghost).toContainText(/Недоступно с \d+ /);
  await page.mouse.up();

  // drop на закрытую строку не принят: ни вопроса, ни команды, подсветка снята
  await expect(page.getByTestId('confirm-dialog')).toBeHidden();
  expect(await commands(request, '/assign')).toHaveLength(0);
  await expect(unitRow(page, 'R07')).not.toHaveAttribute('data-drop', /.+/);
  await expect(page.getByTestId('drop-ghost')).toHaveCount(0);
});

test('drop на свободную строку: окно по §27, переселение с даты клетки только после подтверждения', async ({
  page,
  request,
}) => {
  const arrival = await openWeek(page, request);
  const source = unitRow(page, 'R02').locator(`[data-testid="stay-cell"][data-date="${arrival}"]`);
  await dragOver(page, source, unitRow(page, 'R07').locator(`td[data-date="${arrival}"]`));
  await page.mouse.up();

  const dialog = page.getByTestId('confirm-dialog');
  await expect(dialog).toContainText(`Переселить бронь ${NUMBER}?`);
  await expect(dialog.getByTestId('move-guest')).toHaveText(GUEST);
  await expect(dialog.getByTestId('move-route')).toHaveText('R02 → R07');
  await expect(dialog.getByTestId('move-dates')).toContainText('3 ночи');
  await expect(dialog.getByTestId('move-money')).toHaveText('Стоимость не изменится');
  expect(await commands(request, '/assign')).toHaveLength(0);

  await dialog.getByRole('button', { name: 'Переселить', exact: true }).click();
  await expect.poll(() => commands(request, '/assign')).toHaveLength(1);
  expect((await commands(request, '/assign'))[0]!.body).toMatchObject({
    unitCode: 'R07',
    fromDate: arrival,
  });
  await expect(unitRow(page, 'R07').locator(`[data-number="${NUMBER}"]`).first()).toBeVisible();
  await expect(unitRow(page, 'R02').locator(`td[data-date="${arrival}"]`)).toHaveAttribute(
    'data-state',
    'FREE',
  );
});

test('другая категория: переезжает всё проживание с первой ночи, разница стоимости со знаком', async ({
  page,
  request,
}) => {
  // выше окна: строка R02 и койка M03 видны сетке одновременно, без прокрутки во время drag
  await page.setViewportSize({ width: 1440, height: 1400 });
  const arrival = await openWeek(page, request);
  const target = unitRow(page, 'M03');
  for (const n of [0, 1, 2])
    await expect(target.locator(`td[data-date="${add(arrival, n)}"]`)).toHaveAttribute(
      'data-state',
      'FREE',
    );
  // тянут за вторую ночь, но в другую категорию переезжает всё проживание — призрак с первой ночи
  const second = unitRow(page, 'R02').locator(
    `[data-testid="stay-cell"][data-date="${add(arrival, 1)}"]`,
  );
  await dragOver(page, second, target.locator(`td[data-date="${add(arrival, 1)}"]`));
  await expect(target.locator(`td[data-date="${arrival}"]`).getByTestId('drop-ghost')).toBeVisible();
  await page.mouse.up();

  const dialog = page.getByTestId('confirm-dialog');
  await expect(dialog.getByTestId('move-route')).toHaveText('R02 → M03');
  await expect(dialog.getByTestId('move-dates')).toContainText('3 ночи');
  await expect(dialog.getByTestId('move-money')).toHaveText(/^Разница стоимости: [+−]\d/);
  await dialog.getByRole('button', { name: 'Оставить как есть', exact: true }).click();
  await expect(dialog).toBeHidden();
  expect(await commands(request, '/assign')).toHaveLength(0);
});

test('отказ сервера: призрак снят, бронь на месте, ошибка словами (§49, §54)', async ({
  page,
  request,
}) => {
  const arrival = await openWeek(page, request);
  await request.post(`${fixture}/__test/control`, {
    data: {
      failPath: `/reservations/${NUMBER}/items/${ITEM}/assign`,
      failStatus: 409,
      delayPath: `/reservations/${NUMBER}/items/${ITEM}/assign`,
      delayMs: 1500,
    },
  });
  const source = unitRow(page, 'R02').locator(`[data-testid="stay-cell"][data-date="${arrival}"]`);
  await dragOver(page, source, unitRow(page, 'R07').locator(`td[data-date="${arrival}"]`));
  await page.mouse.up();
  await page
    .getByTestId('confirm-dialog')
    .getByRole('button', { name: 'Переселить', exact: true })
    .click();
  // пока сервер думает, призрак стоит на новом месте — администратор видит, что происходит
  await expect(unitRow(page, 'R07').getByTestId('drop-ghost')).toContainText('Сохраняем');
  await expect(page.getByTestId('drag-error')).toContainText('Не удалось переселить');
  await expect(page.getByTestId('drop-ghost')).toHaveCount(0);
  await expect(source).toHaveAttribute('data-number', NUMBER);
});

test('продление за край: «до даты, +ночи, +сумма» до отпускания; поверх блокировки — конфликт, команды нет', async ({
  page,
  request,
}) => {
  const arrival = await openWeek(page, request);
  // последняя ночь — третья; ночь через одну после неё закрыта: +1 ночь можно, +2 — нет
  expect((await block(request, 'R02', add(arrival, 4), add(arrival, 4))).ok()).toBe(true);
  await page.reload();
  const row = unitRow(page, 'R02');
  const handle = row.locator('.board-stay-resize');
  await handle.scrollIntoViewIfNeeded();
  const from = (await handle.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();

  const next = (await row.locator(`td[data-date="${add(arrival, 3)}"]`).boundingBox())!;
  await page.mouse.move(next.x + next.width / 2, next.y + next.height / 2, { steps: 6 });
  const label = page.getByRole('status').filter({ hasText: 'До ' });
  await expect(label).toContainText('+1 ночь');
  // сумму называет предпросмотр продления API (номер — 8 000 ₸ за ночь на стенде)
  await expect(label).toContainText('+8 000 ₸');

  const shut = (await row.locator(`td[data-date="${add(arrival, 4)}"]`).boundingBox())!;
  await page.mouse.move(shut.x + shut.width / 2, shut.y + shut.height / 2, { steps: 6 });
  await expect(page.getByRole('status').filter({ hasText: 'продлить нельзя' })).toContainText(
    'Недоступно с',
  );
  await expect(row.locator('.board-resize-range')).toHaveAttribute('data-conflict', 'true');
  await page.mouse.up();

  await expect(page.getByTestId('confirm-dialog')).toBeHidden();
  await expect(page.getByTestId('drag-error')).toContainText('Не удалось продлить проживание');
  expect(await commands(request, '/extend')).toHaveLength(0);
});
