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
const dd = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

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
  page.on('pageerror', (error) => pageErrors.push(error.message));
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
  await expect(page.getByRole('main').getByTestId('stay-row').first()).toContainText('отменена');

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
  await cardTab(page, 'Обзор');
  await expect(page.getByRole('main').getByTestId('stay-row').first()).toContainText('незаезд');
  await expect(
    page.getByRole('main').getByTestId('stay-row').first().getByRole('cell').first(),
  ).toHaveText('—');

  // выселение с долгом: первое нажатие — окно с суммой долга, «Оставить» держит гостя заселённым
  await request.post(`${fixture}/__test/reset`);
  await page.goto(`/reservations/${BOOKING}`);
  await cardTab(page, 'Действия');
  await page.getByRole('main').getByTestId('check-in-ui-item').click();
  await page.getByRole('main').getByTestId('check-out-ui-item').click();
  dialog = page.getByRole('dialog', { name: 'Выселить с долгом?' });
  await expect(dialog.getByTestId('debt-amount')).toHaveText('Долг 16 000 ₸ останется на счёте');
  await dialog.getByRole('button', { name: 'Оставить' }).click();
  await cardTab(page, 'Обзор');
  await expect(page.getByRole('main').getByTestId('stay-row').first()).toContainText('заселён');
  await cardTab(page, 'Действия');
  await page.getByRole('main').getByTestId('check-out-ui-item').click();
  await page
    .getByRole('dialog', { name: 'Выселить с долгом?' })
    .getByRole('button', { name: 'Выселить с долгом' })
    .click();
  await cardTab(page, 'Обзор');
  await expect(page.getByRole('main').getByTestId('stay-row').first()).toContainText('выселен');
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
  await expect(page.getByRole('main').getByTestId('stay-too-long')).toContainText('с шахматки');
  await expect(page.getByRole('main')).not.toContainText(
    'Доступность части периодов не загрузилась',
  );
});

test('шахматка: плашки «сверх мест» и «требует разбора», «Разрешить» у строки без ячейки', async ({
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
  ).toHaveAttribute('href', '/channels');
  await expect(page.getByRole('main').getByTestId('unassigned-stays')).toHaveAttribute(
    'data-count',
    '1',
  );
  await page
    .getByRole('main')
    .getByTestId('unassigned-stays')
    .getByRole('button', { name: 'Разрешить' })
    .click();
  const menu = page.getByRole('menu');
  await expect(menu.getByRole('menuitem')).toHaveText([
    /Назначить ячейку/,
    /Переселить в другую категорию/,
  ]);
  await menu.getByRole('menuitem', { name: /Назначить ячейку/ }).click();
  await expect(page).toHaveURL(/\/reservations\/20260913-SHOWUN#booking-actions$/);
  await cardTab(page, 'Действия');
  await expect(page.getByRole('main').getByTestId('assign-form')).toBeVisible();
});
