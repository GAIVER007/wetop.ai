import type { APIRequestContext, Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * Шахматка v2, PR 5 (ТЗ §31–32): создание брони выделением и щелчок по пустой клетке.
 * Прижал мышь на свободной клетке и протянул по датам — под мышью «N ночей», выделение не заходит на
 * занятую или закрытую ночь; отпустил — окошко «Номер R07, даты, ночи» с «Создать бронь» и
 * «Заблокировать». Одиночный щелчок — «Свободен», «Новая бронь», «Блокировка». Форма брони и форма
 * блокировки открываются уже заполненными. Команд здесь нет: окошко ведёт на существующие формы.
 *
 * Данные — базовые брони стенда (вымышленные, ADR-010): «Клиент Пример» (TEST1) — R02, три ночи с
 * сегодняшнего дня; R07 и R08 свободны; закрытую ночь тест ставит сам блокировкой через API стенда.
 */
const fixture = 'http://127.0.0.1:4311';
const headers = { 'x-wetop-test-client': '1' };

const add = (date: string, n: number) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Неделя со вчерашнего дня; «сегодня» стенда — заезд TEST1 */
async function openWeek(page: Page, request: APIRequestContext): Promise<string> {
  const stay = (await (
    await request.get(`${fixture}/reservations/20260913-TEST1`, { headers })
  ).json()) as {
    arrivalDate: string;
  };
  const from = add(stay.arrivalDate, -1);
  await page.goto(`/chessboard?from=${from}&to=${add(from, 6)}`);
  return stay.arrivalDate;
}

const cell = (page: Page, unit: string, date: string) =>
  page.locator(`[data-testid="unit-row"][data-unit-code="${unit}"] td[data-date="${date}"]`);

/** Прижать мышь на одной клетке и провести до другой (обычные события указателя, не HTML5 drag) */
async function sweep(page: Page, from: Locator, to: Locator) {
  const a = (await from.boundingBox())!;
  const b = (await to.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
}

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

test('протянул по свободным ночам: «N ночей» под мышью, окошко с номером и датами, форма брони заполнена', async ({
  page,
  request,
}) => {
  const today = await openWeek(page, request);
  await sweep(page, cell(page, 'R07', today), cell(page, 'R07', add(today, 2)));
  const ghost = page.getByTestId('drop-ghost');
  await expect(ghost).toHaveAttribute('data-tone', 'range');
  await expect(ghost).toHaveText('3 ночи');
  await page.mouse.up();

  const menu = page.getByTestId('free-menu');
  await expect(menu).toBeVisible();
  await expect(menu.getByTestId('free-menu-title')).toHaveText('Номер R07');
  await expect(menu.getByTestId('free-menu-dates')).toContainText('3 ночи');
  // выделение остаётся видно, пока открыто окошко
  await expect(cell(page, 'R07', today).getByTestId('drop-ghost')).toBeVisible();
  const create = menu.getByRole('link', { name: 'Создать бронь', exact: true });
  await expect(create).toHaveAttribute(
    'href',
    `/reservations/new?arrival=${today}&departure=${add(today, 3)}&unit=R07`,
  );
  await expect(menu.getByRole('link', { name: 'Заблокировать', exact: true })).toHaveAttribute(
    'href',
    `/units/R07?blockFrom=${today}&blockTo=${add(today, 3)}#block-form`,
  );
  await create.click();
  const form = page.getByTestId('new-reservation-form');
  await expect(form.locator('[name="arrivalDate"]')).toHaveValue(today);
  await expect(form.locator('[name="departureDate"]')).toHaveValue(add(today, 3));
  await expect(form.locator('[name="unitCode"]')).toHaveValue('R07');
  await expect(form.locator('[name="accommodationTypeCode"]')).not.toHaveValue('');
});

test('выделение не заходит на занятую или закрытую ночь — ни вправо, ни влево', async ({
  page,
  request,
}) => {
  const today = await openWeek(page, request);
  // закрытая ночь через одну (API: «по» не включается)
  expect(
    (
      await request.post(`${fixture}/units/R08/blocks`, {
        headers,
        data: {
          dateFrom: add(today, 2),
          dateTo: add(today, 3),
          type: 'MAINTENANCE',
          reason: 'тест',
        },
      })
    ).ok(),
  ).toBe(true);
  await page.reload();
  await sweep(page, cell(page, 'R08', today), cell(page, 'R08', add(today, 4)));
  await expect(page.getByTestId('drop-ghost')).toHaveText('2 ночи');
  await page.mouse.up();
  await expect(page.getByTestId('free-menu').getByTestId('free-menu-dates')).toContainText(
    '2 ночи',
  );
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('free-menu')).toBeHidden();
  await expect(page.getByTestId('drop-ghost')).toHaveCount(0);

  // влево по R02: с 4-й ночи назад упирается в бронь TEST1 (последняя её ночь — третья)
  await sweep(page, cell(page, 'R02', add(today, 4)), cell(page, 'R02', add(today, -1)));
  await expect(page.getByTestId('drop-ghost')).toHaveText('2 ночи');
  await page.mouse.up();
  await expect(
    page.getByTestId('free-menu').getByRole('link', { name: 'Создать бронь', exact: true }),
  ).toHaveAttribute(
    'href',
    `/reservations/new?arrival=${add(today, 3)}&departure=${add(today, 5)}&unit=R02`,
  );
});

test('щелчок по свободной клетке: «Свободен», «Новая бронь», «Блокировка» — карточка ячейки с периодом', async ({
  page,
  request,
}) => {
  const today = await openWeek(page, request);
  const night = add(today, 1);
  await cell(page, 'R07', night).click();
  await expect(page).toHaveURL(/\/chessboard/);
  const menu = page.getByTestId('free-menu');
  await expect(menu.getByTestId('free-menu-state')).toHaveText('Свободен');
  await expect(menu.getByRole('link', { name: 'Новая бронь', exact: true })).toHaveAttribute(
    'href',
    `/reservations/new?arrival=${night}&departure=${add(night, 1)}&unit=R07`,
  );
  await menu.getByRole('link', { name: 'Блокировка', exact: true }).click();
  await expect(page).toHaveURL(
    new RegExp(`/units/R07\\?blockFrom=${night}&blockTo=${add(night, 1)}`),
  );
  const form = page.getByTestId('block-form');
  await expect(form.locator('[name="dateFrom"]')).toHaveValue(night);
  await expect(form.locator('[name="dateTo"]')).toHaveValue(add(night, 1));
});

test('«только чтение» (ADR-102): окошко говорит, что свободно, но действий не предлагает', async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/control`, { data: { orgTrialDays: 'ended' } });
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
  const today = await openWeek(page, request);
  await cell(page, 'R07', add(today, 1)).click();
  const menu = page.getByTestId('free-menu');
  await expect(menu.getByTestId('free-menu-state')).toHaveText('Свободен');
  await expect(menu.getByRole('link')).toHaveCount(0);
  await request.post(`${fixture}/__test/reset`);
});
