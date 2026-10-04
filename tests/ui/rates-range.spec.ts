import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { FIXTURE_API } from './fixtures';

/**
 * «Тарифы и цены» RT2 (28.09.2026, слово владельца «Начинай RT2», ADR-111, план §8): цена меняется на дату
 * или отрезок, выбранный прямо в календаре. Панель «Изменить цены» называет категорию, тариф, даты и их
 * число, текущую цену и предпросмотр до сохранения; сохраняет существующий `POST /rates/bulk` одним
 * запросом (одна транзакция), новой логики цен нет. Витрина фикстуры: будни 10 000 ₸ за 2 гостей и
 * 8 000 ₸ за 1 гостя; 1 окт. 2026 — четверг.
 */
const fixture = FIXTURE_API;

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
  await request.post(`${fixture}/__test/control`, { data: { showcase: true } });
});

async function commands(request: APIRequestContext) {
  const all = (await (await request.get(`${fixture}/__test/commands`)).json()) as Array<{
    method: string;
    path: string;
    body: { changes: Array<Record<string, unknown>> };
  }>;
  return all.filter((c) => c.path === '/rates/bulk');
}

/** Выбрать день по кнопке с его числом — тот же путь, что у клавиатуры и программы чтения */
async function pick(page: Page, date: string) {
  await page
    .getByRole('main')
    .getByTestId(`rate-row-${date}`)
    .getByRole('button', { name: /^Выбрать / })
    .click();
}

test('один день: выбор, панель с фактами, предпросмотр, одна отправка, календарь обновлён и выбор сброшен', async ({
  page,
  request,
}) => {
  const main = page.getByRole('main');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/rates?month=2026-10');
  const selection = main.getByTestId('rates-selection');
  await expect(selection).toContainText('Выберите дату или отрезок в календаре');
  await pick(page, '2026-10-07');
  await expect(selection).toContainText('Выбрана 1 дата: 07.10.2026');
  await expect(main.getByTestId('rate-row-2026-10-07')).toHaveClass(/is-selected/);
  await selection.getByRole('button', { name: 'Изменить цены', exact: true }).click();

  const drawer = page.getByRole('dialog', { name: 'Изменить цены', exact: true });
  await expect(drawer).toBeVisible();
  const facts = drawer.getByTestId('range-facts');
  await expect(facts).toContainText('Двухместный номер');
  await expect(facts).toContainText('Стандартный');
  await expect(facts).toContainText('07.10.2026');
  await expect(facts).toContainText('1 дата');
  await expect(drawer.getByTestId('range-current-2')).toHaveText('10 000 ₸');
  await expect(drawer.getByTestId('range-current-1')).toHaveText('8 000 ₸');
  // без новой цены предпросмотра нет и применять нечего
  await expect(drawer.getByTestId('range-preview')).toHaveCount(0);
  await expect(drawer.getByTestId('range-apply')).toBeDisabled();

  await drawer.getByLabel('Новая цена за 2 гостей', { exact: true }).fill('12000');
  const preview = drawer.getByTestId('range-preview');
  await expect(preview).toContainText('Будет изменена 1 дата');
  await expect(preview).toContainText('07.10.2026');
  await expect(preview).toContainText('10 000 ₸ → 12 000 ₸');
  await expect(drawer.getByTestId('range-apply')).toHaveText('Применить к 1 дате');
  await drawer.getByTestId('range-apply').click();

  await expect(drawer).toHaveCount(0);
  await expect(page.locator('.toast').first()).toContainText('Цены обновлены для 1 даты');
  await expect(selection).toContainText('Выберите дату или отрезок в календаре');
  await expect(main.getByTestId('price-2026-10-07-2')).toContainText('12 000 ₸');
  // цена за 1 гостя не тронута: меньшая вместимость по умолчанию «не менять»
  await expect(main.getByTestId('price-2026-10-07-1')).toContainText('8 000 ₸');
  const sent = await commands(request);
  expect(sent).toHaveLength(1);
  expect(sent[0]!.body.changes).toEqual([
    expect.objectContaining({
      dateFrom: '2026-10-07',
      dateTo: '2026-10-07',
      occupancy: 2,
      price: '12000',
    }),
  ]);
});

test('отрезок: второе касание задаёт отрезок, третье начинает заново, то же касание снимает выбор', async ({
  page,
  request,
}) => {
  const main = page.getByRole('main');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/rates?month=2026-10');
  const selection = main.getByTestId('rates-selection');
  // выбор в обратную сторону — отрезок всё равно от меньшей даты
  await pick(page, '2026-10-19');
  await pick(page, '2026-10-13');
  await expect(selection).toContainText('Выбрано 7 дат: 13.10 → 19.10.2026');
  for (const d of ['13', '16', '19'])
    await expect(main.getByTestId(`rate-row-2026-10-${d}`)).toHaveClass(/is-selected/);
  await expect(main.getByTestId('rate-row-2026-10-20')).not.toHaveClass(/is-selected/);
  // третье касание — новый выбор; касание того же дня — выбор снят
  await pick(page, '2026-10-22');
  await expect(selection).toContainText('Выбрана 1 дата: 22.10.2026');
  await pick(page, '2026-10-22');
  await expect(selection).toContainText('Выберите дату или отрезок в календаре');

  await pick(page, '2026-10-13');
  await pick(page, '2026-10-19');
  await selection.getByRole('button', { name: 'Изменить цены', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'Изменить цены', exact: true });
  await expect(drawer.getByTestId('range-facts')).toContainText('7 дат');
  await drawer.getByLabel('Новая цена за 2 гостей', { exact: true }).fill('11000');
  await drawer.getByLabel('Новая цена за 1 гостя', { exact: true }).fill('9000');
  const preview = drawer.getByTestId('range-preview');
  await expect(preview).toContainText('Будут изменены 7 дат');
  await expect(preview).toContainText('13.10 → 19.10.2026');
  await expect(preview).toContainText('10 000 ₸ → 11 000 ₸');
  await expect(preview).toContainText('8 000 ₸ → 9 000 ₸');
  await drawer.getByRole('button', { name: 'Применить к 7 датам', exact: true }).click();
  await expect(page.locator('.toast').first()).toContainText('Цены обновлены для 7 дат');
  await expect(main.getByTestId('price-2026-10-16-2')).toContainText('11 000 ₸');
  await expect(main.getByTestId('price-2026-10-16-1')).toContainText('9 000 ₸');
  await expect(main.getByTestId('price-2026-10-20-2')).toContainText('10 000 ₸');
  // обе вместимости — одной отправкой: одна транзакция, одно сообщение в каналы
  const sent = await commands(request);
  expect(sent).toHaveLength(1);
  expect(sent[0]!.body.changes).toEqual([
    expect.objectContaining({
      dateFrom: '2026-10-13',
      dateTo: '2026-10-19',
      occupancy: 2,
      price: '11000',
    }),
    expect.objectContaining({
      dateFrom: '2026-10-13',
      dateTo: '2026-10-19',
      occupancy: 1,
      price: '9000',
    }),
  ]);
});

test('разные исходные цены: «отличаются» с наименьшей и наибольшей, в предпросмотре — только новая цена', async ({
  page,
  request,
}) => {
  // выходные 3–4 окт. дороже будней
  await request.post(`${fixture}/rates/bulk`, {
    headers: { 'x-wetop-test-client': '1' },
    data: {
      changes: [
        {
          accommodationTypeCode: 'ROOM',
          ratePlanCode: 'BASE',
          dateFrom: '2026-10-03',
          dateTo: '2026-10-04',
          price: '12000',
        },
      ],
    },
  });
  const main = page.getByRole('main');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/rates?month=2026-10');
  await pick(page, '2026-10-01');
  await pick(page, '2026-10-08');
  const selection = main.getByTestId('rates-selection');
  await expect(selection).toContainText('Выбрано 8 дат: 01.10 → 08.10.2026');
  await selection.getByRole('button', { name: 'Изменить цены', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'Изменить цены', exact: true });
  await expect(drawer.getByTestId('range-current-2')).toHaveText(
    'отличаются: от 10 000 ₸ до 12 000 ₸',
  );
  await drawer.getByLabel('Новая цена за 2 гостей', { exact: true }).fill('15000');
  const preview = drawer.getByTestId('range-preview');
  await expect(preview).toContainText('Будут изменены 8 дат');
  await expect(preview).toContainText('Текущие цены отличаются');
  await expect(preview).toContainText('Новая цена: 15 000 ₸');
  await expect(preview).not.toContainText('→ 15 000');
  // ночь без цены в отрезке названа (21 окт. в витрине без цены)
  await drawer.getByRole('button', { name: 'Закрыть: Изменить цены', exact: true }).click();
  await pick(page, '2026-10-20');
  await pick(page, '2026-10-22');
  await selection.getByRole('button', { name: 'Изменить цены', exact: true }).click();
  await expect(drawer.getByTestId('range-current-2')).toContainText('у 1 даты цены нет');
  expect(await commands(request)).toHaveLength(1); // только посев выходных — из панели ничего не ушло
});

test('щелчок по цене — прежняя правка ячейки, выбор дат он не трогает; смена месяца выбор сбрасывает', async ({
  page,
}) => {
  const main = page.getByRole('main');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/rates?month=2026-10');
  const selection = main.getByTestId('rates-selection');
  await main.getByTestId('price-2026-10-09-2').getByTestId('price-cell-edit').click();
  await expect(page.getByTestId('price-cell-input')).toBeVisible();
  await expect(main.getByTestId('rate-row-2026-10-09')).not.toHaveClass(/is-selected/);
  await expect(selection).toContainText('Выберите дату или отрезок в календаре');
  await page.keyboard.press('Escape');
  await pick(page, '2026-10-09');
  await expect(selection).toContainText('Выбрана 1 дата');
  await main.getByLabel('Следующий месяц', { exact: true }).click();
  await expect(page).toHaveURL(/month=2026-11/);
  await expect(selection).toContainText('Выберите дату или отрезок в календаре');
});

test('отказ API: причина в панели, панель, введённая цена и выбор остаются', async ({
  page,
  request,
}) => {
  const main = page.getByRole('main');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/rates?month=2026-10');
  await pick(page, '2026-10-05');
  await pick(page, '2026-10-06');
  await main
    .getByTestId('rates-selection')
    .getByRole('button', { name: 'Изменить цены', exact: true })
    .click();
  const drawer = page.getByRole('dialog', { name: 'Изменить цены', exact: true });
  await drawer.getByLabel('Новая цена за 2 гостей', { exact: true }).fill('11000');
  await request.post(`${fixture}/__test/control`, {
    data: { showcase: true, failPath: '/rates/bulk' },
  });
  await drawer.getByTestId('range-apply').click();
  await expect(drawer.getByRole('alert')).toContainText('Синтетический сбой API');
  await expect(drawer).toBeVisible();
  await expect(drawer.getByLabel('Новая цена за 2 гостей', { exact: true })).toHaveValue('11000');
  await expect(main.getByTestId('rates-selection')).toContainText('Выбрано 2 даты');
  await expect(main.getByTestId('price-2026-10-05-2')).toContainText('10 000 ₸');
});

test('«только чтение»: выбор и предпросмотр доступны, сохранить нельзя — общая фраза, запроса нет', async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/control`, {
    data: { showcase: true, orgTrialDays: 'ended' },
  });
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/rates?month=2026-10');
  await pick(page, '2026-10-13');
  await pick(page, '2026-10-15');
  await page
    .getByRole('main')
    .getByTestId('rates-selection')
    .getByRole('button', { name: 'Изменить цены', exact: true })
    .click();
  const drawer = page.getByRole('dialog', { name: 'Изменить цены', exact: true });
  await expect(drawer.getByTestId('range-read-only')).toContainText('Пробный период закончился');
  await drawer.getByLabel('Новая цена за 2 гостей', { exact: true }).fill('11000');
  await expect(drawer.getByTestId('range-preview')).toContainText('Будут изменены 3 даты');
  await expect(drawer.getByTestId('range-apply')).toBeDisabled();
  expect(await commands(request)).toHaveLength(0);
});
