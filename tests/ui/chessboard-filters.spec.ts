import type { APIRequestContext, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { FIXTURE_API, expect, test } from './fixtures';

/**
 * «Шахматка v2» PR 7 (ТЗ §8–10, §37–41; решения — `plans/chessboard-v2-2026-09-27.md`, PR 7):
 * основная строка — поиск, «Категория», «Места», «Фильтры N», «Вид»; окошко «Фильтры» с черновиком,
 * «Применить» и «Сбросить»; снятые условия — чипами; поиск подсвечивает совпадения, приглушает
 * остальное, раскрывает свёрнутые категории, прокручивает к найденному и открывает бронь по Enter;
 * «Ничего не найдено»; вид строк в браузере; Ctrl+K ставит курсор в поиск шахматки.
 * Стенд UI-тестов: восемь базовых броней недели (R01–R04, M01, M02, F01, F03) и брони, заведённые
 * здесь; гости вымышленные (ADR-010).
 */
const fixture = FIXTURE_API;
const headers = { 'x-wetop-test-client': '1' };
const add = (date: string, n: number) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const hotelToday = () => new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);

async function book(
  request: APIRequestContext,
  unitCode: string | null,
  category: string,
  arrival: string,
  departure: string,
  guest: { firstName: string; lastName: string; phone?: string },
  source = 'WHATSAPP',
): Promise<string> {
  const res = await request.post(`${fixture}/reservations`, {
    headers,
    data: {
      arrivalDate: arrival,
      departureDate: departure,
      source,
      guest,
      items: [{ accommodationTypeCode: category, quantity: 1, adults: 1, unitCode }],
    },
  });
  expect(res.ok()).toBe(true);
  return ((await res.json()) as { confirmationNumber: string }).confirmationNumber;
}

const rows = (page: Page) => page.getByRole('main').getByTestId('unit-row');
const codes = async (page: Page) =>
  (await rows(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-unit-code')))).sort();
/** Неделя со вчерашнего дня: в окне и заезды сегодня, и последняя ночь выезжающих сегодня */
const week = (today: string) => `/chessboard?from=${add(today, -1)}&to=${add(today, 5)}`;

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

test('§8–9: основная строка и окошко «Фильтры» — черновик, «Применить», чипы, «Сбросить»', async ({
  page,
  request,
}) => {
  const today = hotelToday();
  const extra = await book(request, 'R02', 'ROOM', add(today, 3), add(today, 5), {
    firstName: 'Динара',
    lastName: 'Поискова',
  });
  await page.goto(week(today));
  const main = page.getByRole('main');
  await expect(rows(page)).toHaveCount(88);
  // в строке — поиск, категория, места на первую дату, «Фильтры», вид; тип места ушёл в окошко
  await expect(main.getByLabel('Поиск в календаре')).toBeVisible();
  await expect(main.getByLabel('Категория в календаре')).toBeVisible();
  await expect(main.getByLabel('Места в календаре')).toBeVisible();
  await expect(main.getByLabel('Вид строк календаря')).toBeVisible();
  await expect(main.getByRole('button', { name: 'Номера', exact: true })).toHaveCount(0);
  await expect(main.getByRole('button', { name: 'Свободные', exact: true })).toHaveCount(0);

  // «Фильтры» или «Фильтры N» — имя кнопки меняется с числом условий
  const open = main.getByRole('button', { name: /^Фильтры( \d+)?$/ });
  await open.click();
  const pop = page.getByRole('dialog', { name: 'Фильтры календаря' });
  await expect(pop).toBeVisible();
  // источники и статусы — только те, что есть на сетке
  const sources = pop.getByRole('group', { name: 'Источник' });
  await expect(sources.getByRole('button')).toHaveText(['Booking.com', 'Телефон', 'WhatsApp']);
  await expect(pop.getByRole('group', { name: 'Статус брони' }).getByRole('button')).toHaveText([
    'Не подтверждена',
    'Подтверждена',
    'Заселён',
  ]);
  await expect(pop.getByText(/Брони без назначенного места/)).toHaveCount(0);
  // Escape — без применения
  await pop.getByRole('button', { name: 'Номера', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(pop).toBeHidden();
  await expect(open).toBeFocused();
  await expect(rows(page)).toHaveCount(88);

  await open.click();
  await expect(pop.getByRole('button', { name: 'Номера', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await pop.getByRole('button', { name: 'Номера', exact: true }).click();
  await pop.getByRole('button', { name: 'Заезд сегодня', exact: true }).click();
  await expect(pop.getByTestId('filters-preview')).toHaveText('Подходит 3 из 88 мест');
  await pop.getByRole('button', { name: 'Применить', exact: true }).click();
  await expect(pop).toBeHidden();
  expect(await codes(page)).toEqual(['R01', 'R02', 'R03']);
  await expect(main.getByRole('button', { name: 'Фильтры 2', exact: true })).toBeVisible();
  // заезд — только первая ночь сегодня: плашка Поисковой (заезд позже) на R02 приглушена
  await expect(
    main.locator(`[data-testid="stay-cell"][data-number="${extra}"]`).first(),
  ).toHaveAttribute('data-match', 'dim');
  await expect(
    main.locator('[data-testid="stay-cell"][data-number="20260913-TEST1"]').first(),
  ).not.toHaveAttribute('data-match', 'dim');

  // снятое условие — чипом с крестиком
  await main.getByRole('button', { name: 'Убрать условие: Заезд сегодня', exact: true }).click();
  await expect(rows(page)).toHaveCount(16);
  await expect(main.getByRole('button', { name: 'Фильтры 1', exact: true })).toBeVisible();
  await main.getByRole('button', { name: 'Сбросить', exact: true }).click();
  await expect(rows(page)).toHaveCount(88);
  await expect(main.getByRole('button', { name: 'Фильтры', exact: true })).toBeVisible();

  // источник и статус: «или» внутри группы, «и» между группами
  await open.click();
  await sources.getByRole('button', { name: 'Booking.com', exact: true }).click();
  await pop
    .getByRole('group', { name: 'Статус брони' })
    .getByRole('button', { name: 'Заселён', exact: true })
    .click();
  await pop.getByRole('button', { name: 'Применить', exact: true }).click();
  expect(await codes(page)).toEqual(['F01', 'M01', 'R04']);
  // «Сбросить» в окошке чистит черновик, применяет «Применить»
  await open.click();
  await pop.getByRole('button', { name: 'Сбросить', exact: true }).click();
  await expect(pop.getByTestId('filters-preview')).toHaveText('Подходит 88 из 88 мест');
  await pop.getByRole('button', { name: 'Применить', exact: true }).click();
  await expect(rows(page)).toHaveCount(88);
});

test('§9: «Выезд сегодня», «С долгом» и ссылка на брони без места', async ({ page, request }) => {
  const today = hotelToday();
  const unplaced = await book(request, null, 'ROOM', today, add(today, 1), {
    firstName: 'Ержан',
    lastName: 'Безместов',
  });
  await page.goto(week(today));
  const main = page.getByRole('main');
  // «Фильтры» или «Фильтры N» — имя кнопки меняется с числом условий
  const open = main.getByRole('button', { name: /^Фильтры( \d+)?$/ });
  const pop = page.getByRole('dialog', { name: 'Фильтры календаря' });
  await open.click();
  await pop.getByRole('button', { name: 'Выезд сегодня', exact: true }).click();
  await pop.getByRole('button', { name: 'Применить', exact: true }).click();
  // TEST3 на R04: заселён, последняя ночь вчера
  expect(await codes(page)).toEqual(['R04']);
  await main.getByRole('button', { name: 'Сбросить', exact: true }).click();

  await open.click();
  await pop.getByRole('button', { name: 'С долгом', exact: true }).click();
  await pop.getByRole('button', { name: 'Применить', exact: true }).click();
  expect(await codes(page)).toEqual(['F03', 'M02', 'R01', 'R03']);

  await open.click();
  const link = pop.getByRole('link', { name: 'Брони без назначенного места: 1' });
  await link.click();
  await expect(pop).toBeHidden();
  const drawer = page.getByRole('dialog', { name: 'Брони без размещения' });
  await expect(drawer.getByTestId('unassigned-card')).toContainText(unplaced);
});

test('§10, §41: поиск подсвечивает, приглушает, раскрывает категорию, прокручивает, Enter открывает бронь', async ({
  page,
  request,
}) => {
  const today = hotelToday();
  const near = await book(request, 'R02', 'ROOM', add(today, 3), add(today, 5), {
    firstName: 'Динара',
    lastName: 'Поискова',
    phone: '+7 705 123 45 67',
  });
  const far = await book(request, 'R06', 'ROOM', add(today, 22), add(today, 24), {
    firstName: 'Асель',
    lastName: 'Далекова',
  });
  await page.goto(week(today));
  const main = page.getByRole('main');
  const search = main.getByLabel('Поиск в календаре');

  // по имени: строка R02, своя плашка подсвечена, соседняя (TEST1) приглушена
  await search.fill('поискова');
  expect(await codes(page)).toEqual(['R02']);
  await expect(
    main.locator(`[data-testid="stay-cell"][data-number="${near}"]`).first(),
  ).toHaveAttribute('data-match', 'hit');
  await expect(
    main.locator('[data-testid="stay-cell"][data-number="20260913-TEST1"]').first(),
  ).toHaveAttribute('data-match', 'dim');
  // по телефону — цифрами, как ни записан
  await search.fill('705-123');
  expect(await codes(page)).toEqual(['R02']);
  // по коду места — строка найдена, плашки не приглушены
  await search.fill('m02');
  expect(await codes(page)).toEqual(['M02']);
  await expect(main.locator('[data-testid="stay-cell"]').first()).not.toHaveAttribute(
    'data-match',
    'dim',
  );

  // свёрнутая категория с совпадением раскрывается
  await search.fill('');
  await main.getByTestId('category-row').filter({ hasText: 'Мужской' }).getByRole('button').click();
  await expect(main.locator('[data-testid="unit-row"][data-unit-code="M01"]')).toHaveCount(0);
  await search.fill('Посетитель');
  await expect(main.locator('[data-testid="unit-row"][data-unit-code="M02"]')).toBeVisible();

  // Enter — первая найденная бронь
  await search.fill('Поискова');
  await search.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/reservations/${near}`));
  await expect(
    page
      .getByRole('dialog', { name: 'Бронирование', exact: true })
      .getByRole('heading', { level: 1 }),
  ).toContainText(near);
  await page.keyboard.press('Escape');

  // 30 дней: найденная далеко справа бронь прокручена в видимую часть сетки
  await page.goto(`/chessboard?from=${add(today, -1)}&to=${add(today, 28)}`);
  const far1 = main.locator(`[data-testid="stay-cell"][data-number="${far}"]`).first();
  await expect(far1).not.toBeInViewport();
  await main.getByLabel('Поиск в календаре').fill('Далекова');
  await expect(far1).toHaveAttribute('data-match', 'hit');
  await expect(far1).toBeInViewport();
});

test('§37: ничего не найдено — «Сбросить фильтры»', async ({ page }) => {
  await page.goto(week(hotelToday()));
  const main = page.getByRole('main');
  await main.getByLabel('Поиск в календаре').fill('Несуществующее место');
  await expect(rows(page)).toHaveCount(0);
  const empty = main.getByTestId('board-empty');
  await expect(empty).toContainText('Ничего не найдено');
  await expect(empty).toContainText('Попробуйте изменить фильтры');
  await empty.getByRole('button', { name: 'Сбросить фильтры', exact: true }).click();
  await expect(rows(page)).toHaveCount(88);
  await expect(main.getByLabel('Поиск в календаре')).toHaveValue('');
});

test('§38: вид «Компактный / Обычный / Подробный» меняет высоту строк и помнится', async ({
  page,
}) => {
  await page.goto(week(hotelToday()));
  const main = page.getByRole('main');
  const view = main.getByLabel('Вид строк календаря');
  // без сохранённого выбора «Компактный» (решение владельца 07.10.2026, baseline B)
  await expect(view).toHaveValue('compact');
  const height = async () =>
    (await main.locator('[data-testid="unit-row"][data-unit-code="R01"]').boundingBox())!.height;
  const compact = await height();
  await view.selectOption('normal');
  const normal = await height();
  await view.selectOption('detailed');
  const detailed = await height();
  expect(compact).toBeLessThan(normal);
  expect(detailed).toBeGreaterThan(normal);
  await view.selectOption('normal');
  await page.reload();
  await expect(main.getByLabel('Вид строк календаря')).toHaveValue('normal');
  expect(await height()).toBe(normal);
});

test('§40: Ctrl+K — поиск шахматки, второй раз — общий; Enter на плашке — предпросмотр', async ({
  page,
}) => {
  await page.goto(week(hotelToday()));
  const main = page.getByRole('main');
  await expect(rows(page)).toHaveCount(88);
  await page.keyboard.press('Control+k');
  await expect(main.getByLabel('Поиск в календаре')).toBeFocused();
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog', { name: 'Быстрый поиск' })).toBeVisible();
  await page.keyboard.press('Escape');

  const plate = main.locator('[data-testid="stay-cell"][data-number="20260913-TESTAA"]').first();
  await plate.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Бронь: Гость Тестовый' })).toBeVisible();
});

test('телефон: категория и места — в окошке, окошко в экране, цели 44 px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(week(hotelToday()));
  const main = page.getByRole('main');
  await expect(rows(page)).toHaveCount(88);
  await expect(main.getByLabel('Категория в календаре')).toBeHidden();
  await main.getByRole('button', { name: 'Фильтры', exact: true }).click();
  const pop = page.getByRole('dialog', { name: 'Фильтры календаря' });
  const box = (await pop.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await pop.getByRole('combobox', { name: 'Категория', exact: true }).selectOption('ROOM');
  for (const control of [
    pop.getByRole('combobox', { name: 'Категория', exact: true }),
    pop.getByRole('button', { name: 'Койки', exact: true }),
    pop.getByRole('button', { name: 'Применить', exact: true }),
  ]) {
    const b = (await control.boundingBox())!;
    expect(b.height).toBeGreaterThanOrEqual(44);
  }
  await pop.getByRole('button', { name: 'Применить', exact: true }).click();
  await expect(rows(page)).toHaveCount(16);
  await expect(
    main.getByRole('button', { name: 'Убрать условие: Двухместный номер' }),
  ).toBeVisible();
});

test('доступность: окошко «Фильтры» открыто', async ({ page }) => {
  await page.goto(week(hotelToday()));
  await page.getByRole('main').getByRole('button', { name: 'Фильтры', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Фильтры календаря' })).toBeVisible();
  const result = await new AxeBuilder({ page }).include('.board-filters-pop').analyze();
  expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});
