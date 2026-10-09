import type { APIRequestContext, Page } from '@playwright/test';
import { FIXTURE_API, expect, test } from './fixtures';

/**
 * «Шахматка v2» PR 6 — ящик «Брони без размещения» (ТЗ §11–12, пятый сценарий §64): две брони без
 * места; администратор видит одну строку над сеткой, открывает ящик, система показывает допустимые
 * свободные места, он назначает. Свободные места грузятся по выбранной брони — не запросом на каждую
 * карточку (условие владельца к PR 6), это проверяется счётчиком запросов стенда. Назначение —
 * существующая команда `assign`; в другую категорию — только после вопроса с разницей стоимости.
 * Гости вымышленные (ADR-010).
 */
const fixture = FIXTURE_API;
const headers = { 'x-wetop-test-client': '1' };

const add = (date: string, n: number) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const hotelToday = () => new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);

async function unplaced(
  request: APIRequestContext,
  category: string,
  arrival: string,
  departure: string,
  lastName: string,
): Promise<string> {
  const res = await request.post(`${fixture}/reservations`, {
    headers,
    data: {
      arrivalDate: arrival,
      departureDate: departure,
      source: 'DESK',
      guest: { firstName: 'Тест', lastName },
      items: [{ accommodationTypeCode: category, quantity: 1, adults: 1, unitCode: null }],
    },
  });
  expect(res.ok()).toBe(true);
  return ((await res.json()) as { confirmationNumber: string }).confirmationNumber;
}
const availabilityHits = async (request: APIRequestContext) =>
  (
    (await (await request.get(`${fixture}/__test/hits`)).json()) as {
      byPath: Record<string, number>;
    }
  ).byPath['/availability'] ?? 0;
const drawerOf = (page: Page) => page.getByRole('dialog', { name: 'Брони без размещения' });

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

test('две брони без места: строка над сеткой, ящик, места по выбранной брони, назначение (§64)', async ({
  page,
  request,
}) => {
  const today = hotelToday();
  const first = await unplaced(request, 'ROOM', today, add(today, 2), 'Первый');
  const second = await unplaced(request, 'FEMALE', today, add(today, 1), 'Вторая');
  const before = await availabilityHits(request);

  await page.goto(`/chessboard?from=${today}&to=${add(today, 6)}`);
  const strip = page.getByRole('main').getByTestId('unassigned-stays');
  await expect(strip).toContainText('2 брони без назначенного места');
  await expect(strip).toHaveAttribute('data-tone', 'warning');
  // строка ничего не грузит сверх сетки
  expect(await availabilityHits(request)).toBe(before);

  await strip.getByRole('button', { name: 'Разместить', exact: true }).click();
  const drawer = drawerOf(page);
  await expect(drawer).toBeVisible();
  const cards = drawer.getByTestId('unassigned-card');
  await expect(cards).toHaveCount(2);
  const card1 = cards.filter({ hasText: first });
  // имя — фамилией: подставной API пишет «Фамилия Имя», настоящий — «Имя Фамилия»
  await expect(card1).toContainText('Первый');
  await expect(card1).toContainText('2 ночи');
  await expect(card1).toContainText('Двухместный номер');
  await expect(card1.getByRole('link', { name: 'Открыть бронь' })).toHaveAttribute(
    'href',
    `/reservations/${first}`,
  );
  // первая карточка выбрана сама: её свободные места и «Назначить …» — один запрос доступности
  const assign = card1.getByRole('button', { name: /^Назначить [A-Z]+\d+$/ });
  await expect(assign).toBeVisible();
  expect(await availabilityHits(request)).toBe(before + 1);
  // у второй — только по выбору, ещё одним запросом
  const card2 = cards.filter({ hasText: second });
  await expect(card2.getByRole('button', { name: /^Назначить / })).toHaveCount(0);
  await card2.getByRole('button', { name: 'Подобрать место', exact: true }).click();
  await expect(card2.getByRole('button', { name: /^Назначить F\d+$/ })).toBeVisible();
  expect(await availabilityHits(request)).toBe(before + 2);

  // выбор другого свободного места меняет кнопку
  await card1.getByRole('button', { name: 'Подобрать место', exact: true }).click();
  const options = card1.getByTestId('unassigned-free').getByRole('button');
  const unit = (await options.nth(1).textContent())!.trim();
  await options.nth(1).click();
  await expect(options.nth(1)).toHaveAttribute('aria-pressed', 'true');
  await card1.getByRole('button', { name: `Назначить ${unit}`, exact: true }).click();

  // уведомление в углу закрыто модальным ящиком — итог назван строкой в самом ящике
  await expect(drawerOf(page).getByTestId('unassigned-done')).toHaveText(
    `✓ Бронь ${first} размещена: ${unit}`,
  );
  await expect(strip).toContainText('1 бронь без назначенного места');
  await expect(cards).toHaveCount(1);
  await expect(
    page
      .locator(`[data-testid="unit-row"][data-unit-code="${unit}"] [data-number="${first}"]`)
      .first(),
  ).toBeVisible();
});

test('нет мест в категории: другие категории и вопрос с разницей стоимости перед переездом', async ({
  page,
  request,
}) => {
  const day = add(hotelToday(), 20);
  // все номера категории ROOM закрыты на эту ночь — своих мест нет
  const board = (await (
    await request.get(`${fixture}/chessboard?from=${day}&to=${day}`, { headers })
  ).json()) as { rows: Array<{ unit: { code: string; accommodationTypeCode: string } }> };
  for (const r of board.rows.filter((x) => x.unit.accommodationTypeCode === 'ROOM'))
    await request.post(`${fixture}/units/${r.unit.code}/blocks`, {
      headers,
      data: { dateFrom: day, dateTo: add(day, 1), type: 'MAINTENANCE', reason: 'тест' },
    });
  const number = await unplaced(request, 'ROOM', day, add(day, 1), 'Третий');

  await page.goto(`/chessboard?from=${day}&to=${add(day, 6)}`);
  await page
    .getByRole('main')
    .getByTestId('unassigned-stays')
    .getByRole('button', { name: 'Разместить', exact: true })
    .click();
  const card = drawerOf(page).getByTestId('unassigned-card').filter({ hasText: number });
  await expect(card).toContainText('Нет доступных мест в категории');
  await expect(card.getByRole('button', { name: /^Назначить / })).toHaveCount(0);
  await card.getByRole('button', { name: 'Посмотреть другие категории', exact: true }).click();
  const other = card.getByTestId('unassigned-other').first();
  await expect(other).toContainText('Мужской общий номер');
  const unit = (await other.getByRole('button').first().textContent())!.trim();
  await other.getByRole('button').first().click();
  await card.getByRole('button', { name: `Назначить ${unit}`, exact: true }).click();

  const confirm = page.getByRole('dialog', { name: `Разместить бронь ${number} в ${unit}?` });
  await expect(confirm).toBeVisible();
  await expect(confirm).toContainText('Двухместный номер → Мужской общий номер');
  await expect(confirm).toContainText(/Разница стоимости: [+−]|Стоимость не изменится/);
  await confirm.getByRole('button', { name: 'Разместить', exact: true }).click();
  await expect(page.getByText(`Бронь ${number} размещена: ${unit}`)).toBeVisible();
  await expect(page.getByRole('main').getByTestId('unassigned-stays')).toHaveCount(0);
});

test('«Разрешить» у «Продано сверх мест» и ссылка с Главной открывают ящик; тон critical', async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/control`, { data: { showcase: true } });
  await page.goto('/chessboard');
  const strip = page.getByRole('main').getByTestId('unassigned-stays');
  await expect(strip).toHaveAttribute('data-tone', 'critical');
  await page.getByTestId('overbooked-callout').getByRole('link', { name: 'Разрешить' }).click();
  await expect(drawerOf(page)).toBeVisible();
  await expect(drawerOf(page).getByTestId('unassigned-card')).toContainText('20260913-SHOWUN');
  await page.keyboard.press('Escape');
  await expect(drawerOf(page)).toBeHidden();
  // ссылка «Назначить» с Главной ведёт на календарь дня с якорем — ящик открыт сразу
  await page.goto('/chessboard#unassigned-stays');
  await expect(drawerOf(page)).toBeVisible();
});

test('«только чтение» (ADR-102): места видны, назначить нельзя, бронь открывается', async ({
  page,
  request,
}) => {
  const today = hotelToday();
  const number = await unplaced(request, 'ROOM', today, add(today, 1), 'Чтение');
  await request.post(`${fixture}/__test/control`, { data: { orgTrialDays: 'ended' } });
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/finance');
  await page.goto(`/chessboard?from=${today}&to=${add(today, 6)}`);
  await page
    .getByRole('main')
    .getByTestId('unassigned-stays')
    .getByRole('button', { name: 'Разместить', exact: true })
    .click();
  const card = drawerOf(page).getByTestId('unassigned-card').filter({ hasText: number });
  await expect(card.getByTestId('unassigned-free')).toBeVisible();
  await expect(card).toContainText('Только чтение: назначить место нельзя');
  await expect(card.getByRole('button', { name: /^Назначить / })).toHaveCount(0);
  await expect(card.getByRole('link', { name: 'Открыть бронь' })).toBeVisible();
  await request.post(`${fixture}/__test/reset`);
});
