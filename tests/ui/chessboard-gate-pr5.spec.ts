import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { mkdirSync } from 'node:fs';

/**
 * Снимки стоп-гейта PR 5 «Шахматка v2» (создание брони выделением, ТЗ §31–32) — в светлой и тёмной
 * теме: выделение в процессе («3 ночи»), окошко периода, упор в закрытую ночь, окошко одной клетки,
 * заполненные формы брони и блокировки. Данные — базовые брони стенда (вымышленные, ADR-010).
 * Спек ничего не доказывает red→green (это chessboard-range.spec.ts): он снимает артефакты гейта,
 * а ожидания подтверждают, что снят нужный момент.
 */
const DIR = 'reports/chessboard-v2-pr5-2026-09-28/gate';
// порт стенда можно переопределить (FIXTURE_PORT) — параллельные сессии не делят 4311
const fixture = `http://127.0.0.1:${process.env.FIXTURE_PORT || 4311}`;
const headers = { 'x-wetop-test-client': '1' };

const add = (date: string, n: number) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const cellOf = (page: Page, unit: string, date: string) =>
  page.locator(`[data-testid="unit-row"][data-unit-code="${unit}"] td[data-date="${date}"]`);
async function press(page: Page, at: Locator) {
  const box = (await at.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
}
async function moveTo(page: Page, at: Locator) {
  const box = (await at.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 8 });
}

for (const theme of ['light', 'dark'] as const) {
  test(`гейт PR 5: ${theme}`, async ({ page, request }) => {
    test.setTimeout(180_000);
    mkdirSync(DIR, { recursive: true });
    await request.post(`${fixture}/__test/reset`);
    const stay = (await (
      await request.get(`${fixture}/reservations/20260913-TEST1`, { headers })
    ).json()) as { arrivalDate: string };
    const today = stay.arrivalDate;
    // закрытая ночь в R08 через одну (API: «по» не включается)
    await request.post(`${fixture}/units/R08/blocks`, {
      headers,
      data: {
        dateFrom: add(today, 2),
        dateTo: add(today, 3),
        type: 'MAINTENANCE',
        reason: 'кондиционер',
      },
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ colorScheme: theme });
    const open = () => page.goto(`/chessboard?from=${add(today, -1)}&to=${add(today, 5)}`);
    await open();
    await expect(page.getByTestId('unit-row')).toHaveCount(88);
    const ghost = page.getByTestId('drop-ghost');
    const menu = page.getByTestId('free-menu');

    // 1. Выделение в процессе: «3 ночи» под мышью
    await press(page, cellOf(page, 'R07', today));
    await moveTo(page, cellOf(page, 'R07', add(today, 2)));
    await expect(ghost).toHaveText('3 ночи');
    await page.screenshot({ caret: 'initial', path: `${DIR}/${theme}-range-dragging.png` });
    // 2. Отпустил: окошко периода (§31)
    await page.mouse.up();
    await expect(menu.getByRole('link', { name: 'Создать бронь', exact: true })).toBeVisible();
    await page.screenshot({ caret: 'initial', path: `${DIR}/${theme}-range-menu.png` });
    await page.keyboard.press('Escape');

    // 3. Упор в закрытую ночь: мышь ушла дальше, выделено две ночи
    await press(page, cellOf(page, 'R08', today));
    await moveTo(page, cellOf(page, 'R08', add(today, 4)));
    await expect(ghost).toHaveText('2 ночи');
    await page.screenshot({ caret: 'initial', path: `${DIR}/${theme}-range-stops.png` });
    await page.mouse.up();
    await page.keyboard.press('Escape');

    // 4. Щелчок по одной клетке (§32)
    await cellOf(page, 'R07', add(today, 3)).click();
    await expect(menu.getByTestId('free-menu-state')).toHaveText('Свободен');
    await page.screenshot({ caret: 'initial', path: `${DIR}/${theme}-cell-menu.png` });

    // 5. «Новая бронь» — форма заполнена
    await menu.getByRole('link', { name: 'Новая бронь', exact: true }).click();
    const form = page.getByTestId('new-reservation-form');
    await expect(form.locator('[name="unitCode"]')).toHaveValue('R07');
    await page.screenshot({ caret: 'initial', path: `${DIR}/${theme}-new-reservation.png` });

    // 6. «Заблокировать» после выделения — карточка ячейки с периодом
    await open();
    await press(page, cellOf(page, 'R07', add(today, 1)));
    await moveTo(page, cellOf(page, 'R07', add(today, 3)));
    await page.mouse.up();
    await menu.getByRole('link', { name: 'Заблокировать', exact: true }).click();
    await expect(page.getByTestId('block-form').locator('[name="dateTo"]')).toHaveValue(
      add(today, 4),
    );
    await page.getByTestId('block-form').scrollIntoViewIfNeeded();
    await page.screenshot({ caret: 'initial', path: `${DIR}/${theme}-block-form.png` });
  });
}
