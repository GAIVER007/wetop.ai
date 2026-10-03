import type { APIRequestContext } from '@playwright/test';
import { expect, test, FIXTURE_API } from './fixtures';
import { mkdirSync } from 'node:fs';

/**
 * Снимки стоп-гейта PR 6 «Шахматка v2» (ящик «Брони без размещения», ТЗ §11–12, §64) — в светлой и
 * тёмной теме: строка над сеткой, ящик с двумя бронями и свободными местами, «нет мест в категории» и
 * другие категории, вопрос с разницей стоимости, результат назначения, тон critical при проданном
 * сверх мест. Данные — базовые брони стенда и брони без места, заведённые здесь (вымышленные, ADR-010).
 * Спек ничего не доказывает red→green (это chessboard-unassigned.spec.ts): он снимает артефакты гейта,
 * а ожидания подтверждают, что снят нужный момент.
 */
const DIR = 'reports/chessboard-v2-pr6-2026-09-28/gate';
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
  firstName: string,
  lastName: string,
): Promise<string> {
  const res = await request.post(`${fixture}/reservations`, {
    headers,
    data: {
      arrivalDate: arrival,
      departureDate: departure,
      source: 'DESK',
      guest: { firstName, lastName },
      items: [{ accommodationTypeCode: category, quantity: 1, adults: 1, unitCode: null }],
    },
  });
  expect(res.ok()).toBe(true);
  return ((await res.json()) as { confirmationNumber: string }).confirmationNumber;
}

for (const theme of ['light', 'dark'] as const) {
  test(`гейт PR 6: ${theme}`, async ({ page, request }) => {
    test.setTimeout(180_000);
    mkdirSync(DIR, { recursive: true });
    await request.post(`${fixture}/__test/reset`);
    const today = hotelToday();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ colorScheme: theme });

    // 1–3. Две брони без места: строка, ящик, выбор другого места
    const first = await unplaced(request, 'ROOM', today, add(today, 2), 'Айгерим', 'Тестова');
    await unplaced(request, 'FEMALE', today, add(today, 1), 'Мария', 'Примерова');
    await page.goto(`/chessboard?from=${today}&to=${add(today, 6)}`);
    const strip = page.getByRole('main').getByTestId('unassigned-stays');
    await expect(strip).toContainText('2 брони без назначенного места');
    await page.screenshot({
      caret: 'initial',
      path: `${DIR}/${theme}-strip.png`,
      clip: { x: 0, y: 0, width: 1440, height: 520 },
    });
    await strip.getByRole('button', { name: 'Разместить', exact: true }).click();
    const drawer = page.getByRole('dialog', { name: 'Брони без размещения' });
    const card1 = drawer.getByTestId('unassigned-card').filter({ hasText: first });
    await expect(card1.getByRole('button', { name: /^Назначить / })).toBeVisible();
    await page.screenshot({ caret: 'initial', path: `${DIR}/${theme}-drawer.png` });

    // 4. Назначил — уведомление, в строке и ящике осталась одна бронь
    await card1.getByRole('button', { name: /^Назначить / }).click();
    await expect(drawer.getByTestId('unassigned-done')).toContainText(`Бронь ${first} размещена`);
    await expect(strip).toContainText('1 бронь без назначенного места');
    await expect(drawer.getByTestId('unassigned-card')).toHaveCount(1);
    await page.screenshot({ caret: 'initial', path: `${DIR}/${theme}-assigned.png` });
    await page.keyboard.press('Escape');

    // 5–7. Своих мест нет: другие категории и вопрос с разницей стоимости
    await request.post(`${fixture}/__test/reset`);
    const day = add(today, 20);
    const board = (await (
      await request.get(`${fixture}/chessboard?from=${day}&to=${day}`, { headers })
    ).json()) as { rows: Array<{ unit: { code: string; accommodationTypeCode: string } }> };
    for (const r of board.rows.filter((x) => x.unit.accommodationTypeCode === 'ROOM'))
      await request.post(`${fixture}/units/${r.unit.code}/blocks`, {
        headers,
        data: { dateFrom: day, dateTo: add(day, 1), type: 'MAINTENANCE', reason: 'ремонт этажа' },
      });
    const third = await unplaced(request, 'ROOM', day, add(day, 1), 'Ержан', 'Образцов');
    await page.goto(`/chessboard?from=${day}&to=${add(day, 6)}`);
    await page
      .getByRole('main')
      .getByTestId('unassigned-stays')
      .getByRole('button', { name: 'Разместить', exact: true })
      .click();
    const card = drawer.getByTestId('unassigned-card').filter({ hasText: third });
    await expect(card).toContainText('Нет доступных мест в категории');
    await page.screenshot({ caret: 'initial', path: `${DIR}/${theme}-no-units.png` });
    await card.getByRole('button', { name: 'Посмотреть другие категории', exact: true }).click();
    const other = card.getByTestId('unassigned-other').first();
    await other.getByRole('button').first().click();
    await page.screenshot({ caret: 'initial', path: `${DIR}/${theme}-other-categories.png` });
    await card.getByRole('button', { name: /^Назначить / }).click();
    const confirm = page.getByRole('dialog', { name: new RegExp(`Разместить бронь ${third}`) });
    await expect(confirm).toContainText(/Разница стоимости|Стоимость не изменится/);
    await page.screenshot({ caret: 'initial', path: `${DIR}/${theme}-confirm.png` });
    await confirm.getByRole('button', { name: 'Оставить как есть' }).click();

    // 8. Продано сверх мест: строка тоном critical
    await request.post(`${fixture}/__test/reset`);
    await request.post(`${fixture}/__test/control`, { data: { showcase: true } });
    await page.goto('/chessboard');
    await expect(page.getByRole('main').getByTestId('unassigned-stays')).toHaveAttribute(
      'data-tone',
      'critical',
    );
    await page.screenshot({
      caret: 'initial',
      path: `${DIR}/${theme}-critical.png`,
      clip: { x: 0, y: 0, width: 1440, height: 520 },
    });
    await request.post(`${fixture}/__test/reset`);
  });
}
