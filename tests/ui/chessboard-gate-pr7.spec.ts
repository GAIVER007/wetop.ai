import type { APIRequestContext } from '@playwright/test';
import { FIXTURE_API, expect, test } from './fixtures';
import { mkdirSync } from 'node:fs';

/**
 * Снимки стоп-гейта PR 7 «Шахматка v2» (фильтры, поиск, вид, клавиатура; ТЗ §8–10, §37–41) — в светлой
 * и тёмной теме: строка над сеткой, окошко «Фильтры» с черновиком, применённые условия чипами и
 * приглушённые плашки, поиск с подсветкой, «Ничего не найдено», компактный и подробный вид, телефон.
 * Данные — базовые брони стенда и брони, заведённые здесь (вымышленные, ADR-010). Спек ничего не
 * доказывает red→green (это chessboard-filters.spec.ts): он снимает артефакты гейта, а ожидания
 * подтверждают, что снят нужный момент.
 */
const DIR = 'reports/chessboard-v2-pr7-2026-09-29/gate';
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
  arrival: string,
  departure: string,
  firstName: string,
  lastName: string,
  phone: string | null = null,
): Promise<string> {
  const res = await request.post(`${fixture}/reservations`, {
    headers,
    data: {
      arrivalDate: arrival,
      departureDate: departure,
      source: 'WHATSAPP',
      guest: { firstName, lastName, phone },
      items: [{ accommodationTypeCode: 'ROOM', quantity: 1, adults: 1, unitCode }],
    },
  });
  expect(res.ok()).toBe(true);
  return ((await res.json()) as { confirmationNumber: string }).confirmationNumber;
}

for (const theme of ['light', 'dark'] as const) {
  test(`гейт PR 7: ${theme}`, async ({ page, request }) => {
    test.setTimeout(180_000);
    mkdirSync(DIR, { recursive: true });
    await request.post(`${fixture}/__test/reset`);
    const today = hotelToday();
    await book(
      request,
      'R02',
      add(today, 3),
      add(today, 5),
      'Динара',
      'Поискова',
      '+7 705 123 45 67',
    );
    await book(request, 'R06', add(today, 1), add(today, 4), 'Асель', 'Примерова');
    await book(request, null, today, add(today, 1), 'Ержан', 'Безместов');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ colorScheme: theme });
    const main = page.getByRole('main');
    const shot = (name: string, clip = true) =>
      page.screenshot({
        caret: 'initial',
        path: `${DIR}/${theme}-${name}.png`,
        ...(clip ? { clip: { x: 0, y: 0, width: 1440, height: 560 } } : {}),
      });

    // 1. Строка над сеткой: поиск, категория, места, «Фильтры», вид
    await page.goto(`/chessboard?from=${add(today, -1)}&to=${add(today, 5)}`);
    await expect(main.getByTestId('unit-row')).toHaveCount(88);
    await shot('toolbar');

    // 2. Окошко «Фильтры» с черновиком
    await main.getByRole('button', { name: 'Фильтры', exact: true }).click();
    const pop = page.getByRole('dialog', { name: 'Фильтры календаря' });
    await pop.getByRole('button', { name: 'Номера', exact: true }).click();
    await pop.getByRole('button', { name: 'С долгом', exact: true }).click();
    await expect(pop.getByTestId('filters-preview')).toContainText('Подходит');
    await shot('popover', false);

    // 3. Применено: «Фильтры 2», чипы, неподходящие плашки приглушены
    await pop.getByRole('button', { name: 'Применить', exact: true }).click();
    await expect(main.getByRole('button', { name: 'Фильтры 2', exact: true })).toBeVisible();
    await shot('applied');
    await main.getByRole('button', { name: 'Сбросить', exact: true }).click();

    // 4. Поиск: совпадение обведено, остальное приглушено
    await main.getByLabel('Поиск в календаре').fill('Посетитель');
    await expect(main.locator('[data-match="hit"]').first()).toBeVisible();
    await shot('search');
    await main.getByLabel('Поиск в календаре').fill('Поискова');
    await expect(main.locator('[data-match="hit"]').first()).toBeVisible();
    await shot('search-one');

    // 5. Ничего не найдено
    await main.getByLabel('Поиск в календаре').fill('Несуществующий гость');
    await expect(main.getByTestId('board-empty')).toBeVisible();
    await shot('empty');
    await main.getByTestId('board-empty').getByRole('button', { name: 'Сбросить фильтры' }).click();

    // 6. Вид: компактный и подробный; мышь уводим с сетки, чтобы на снимке не было наведения
    await page.mouse.move(0, 0);
    await main
      .getByRole('group', { name: 'Вид строк календаря' })
      .getByRole('button', { name: 'Компактный', exact: true })
      .click();
    await shot('view-compact', false);
    await main
      .getByRole('group', { name: 'Вид строк календаря' })
      .getByRole('button', { name: 'Подробный', exact: true })
      .click();
    await shot('view-detailed', false);
    await main
      .getByRole('group', { name: 'Вид строк календаря' })
      .getByRole('button', { name: 'Обычный', exact: true })
      .click();

    // 7. Телефон: строка и окошко с категорией и местами
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/chessboard?from=${add(today, -1)}&to=${add(today, 5)}`);
    await expect(main.getByTestId('unit-row')).toHaveCount(88);
    await page.screenshot({ caret: 'initial', path: `${DIR}/${theme}-phone.png` });
    await main.getByRole('button', { name: 'Фильтры', exact: true }).click();
    await expect(pop).toBeVisible();
    await page.screenshot({ caret: 'initial', path: `${DIR}/${theme}-phone-popover.png` });
    await request.post(`${fixture}/__test/reset`);
  });
}
