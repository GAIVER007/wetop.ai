import type { Locator, Page } from '@playwright/test';
import { FIXTURE_API, expect, test } from './fixtures';
import { mkdirSync } from 'node:fs';

/**
 * Снимки стоп-гейта PR 4 «Шахматка v2» (перетаскивание и продление, ТЗ §26–29, §49, §54) — в
 * светлой и тёмной теме: призрак над свободной, занятой и закрытой строкой; окно переселения в ту же
 * и в другую категорию; «Сохраняем…» и отказ сервера; продление с датой, ночами и суммой и конфликт.
 * Данные — базовые брони стенда (гости вымышленные, ADR-010): «Клиент Пример» на R02, три ночи с
 * сегодняшнего дня. Спек ничего не доказывает red→green (это chessboard-dnd.spec.ts): он снимает
 * артефакты гейта, а ожидания подтверждают, что снят нужный момент.
 */
const DIR = 'reports/chessboard-v2-pr4-2026-09-28/gate';
// адрес стенда общий для набора: `UI_FIXTURE_API` или `FIXTURE_PORT`, параллельные сессии не делят 4311
const fixture = FIXTURE_API;
const headers = { 'x-wetop-test-client': '1' };
const NUMBER = '20260913-TEST1';
const ITEM = 'ui-item-1';

const add = (date: string, n: number) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const unitRow = (page: Page, code: string) =>
  page.locator(`[data-testid="unit-row"][data-unit-code="${code}"]`);
async function moveTo(page: Page, target: Locator) {
  const box = (await target.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 6 });
  await page.mouse.move(box.x + box.width / 2 + 3, box.y + box.height / 2, { steps: 2 });
}

for (const theme of ['light', 'dark'] as const) {
  test(`гейт PR 4: ${theme}`, async ({ page, request }) => {
    test.setTimeout(180_000);
    mkdirSync(DIR, { recursive: true });
    await request.post(`${fixture}/__test/reset`);
    const stay = (await (
      await request.get(`${fixture}/reservations/${NUMBER}`, { headers })
    ).json()) as { arrivalDate: string };
    const arrival = stay.arrivalDate;
    // закрытые ночи: R06 на время брони, R02 — через ночь после выезда (конфликт продления)
    for (const [unit, from, to] of [
      ['R06', arrival, add(arrival, 3)],
      ['R02', add(arrival, 4), add(arrival, 5)],
    ] as const)
      await request.post(`${fixture}/units/${unit}/blocks`, {
        headers,
        data: { dateFrom: from, dateTo: to, type: 'MAINTENANCE', reason: 'кондиционер' },
      });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ colorScheme: theme });
    const open = () => page.goto(`/chessboard?from=${add(arrival, -1)}&to=${add(arrival, 5)}`);
    await open();
    await expect(page.getByTestId('unit-row')).toHaveCount(88);
    const source = unitRow(page, 'R02').locator(
      `[data-testid="stay-cell"][data-date="${arrival}"]`,
    );
    const at = (code: string, n = 0) =>
      unitRow(page, code).locator(`td[data-date="${add(arrival, n)}"]`);
    const ghost = page.getByTestId('drop-ghost');

    // 1–3. Бронь в руке: свободная строка, занятая, закрытая
    await source.hover();
    await page.mouse.down();
    await moveTo(page, at('R07'));
    await expect(ghost).toHaveAttribute('data-tone', 'ok');
    await page.screenshot({ caret: 'initial', path: `${DIR}/${theme}-drag-free.png` });
    await moveTo(page, at('R03'));
    await expect(ghost).toContainText('Занято с');
    await page.screenshot({ caret: 'initial', path: `${DIR}/${theme}-drag-occupied.png` });
    await moveTo(page, at('R06'));
    await expect(ghost).toContainText('Недоступно с');
    await page.screenshot({ caret: 'initial', path: `${DIR}/${theme}-drag-blocked.png` });
    await page.mouse.up();

    // 4. Окно переселения в ту же категорию (§27)
    const dialog = page.getByTestId('confirm-dialog');
    await source.hover();
    await page.mouse.down();
    await moveTo(page, at('R07'));
    await page.mouse.up();
    await expect(dialog.getByTestId('move-money')).toHaveText('Стоимость не изменится');
    await page.screenshot({ caret: 'initial', path: `${DIR}/${theme}-move-dialog.png` });
    await dialog.getByRole('button', { name: 'Оставить как есть', exact: true }).click();

    // 5. В другую категорию — всё проживание, разница стоимости
    await page.setViewportSize({ width: 1440, height: 1500 });
    await source.hover();
    await page.mouse.down();
    await moveTo(page, at('M03'));
    await expect(at('M03').getByTestId('drop-ghost')).toBeVisible();
    await page.screenshot({ caret: 'initial', path: `${DIR}/${theme}-drag-category.png` });
    await page.mouse.up();
    await expect(dialog.getByTestId('move-money')).toContainText('Разница стоимости');
    await page.screenshot({ caret: 'initial', path: `${DIR}/${theme}-move-dialog-category.png` });
    await dialog.getByRole('button', { name: 'Оставить как есть', exact: true }).click();
    await page.setViewportSize({ width: 1440, height: 900 });

    // 6–7. «Сохраняем…» и отказ сервера: призрак уходит, бронь на месте, причина словами
    await request.post(`${fixture}/__test/control`, {
      data: {
        failPath: `/reservations/${NUMBER}/items/${ITEM}/assign`,
        failStatus: 409,
        delayPath: `/reservations/${NUMBER}/items/${ITEM}/assign`,
        delayMs: 2500,
      },
    });
    await source.hover();
    await page.mouse.down();
    await moveTo(page, at('R07'));
    await page.mouse.up();
    await dialog.getByRole('button', { name: 'Переселить', exact: true }).click();
    await expect(at('R07').getByTestId('drop-ghost')).toContainText('Сохраняем');
    await page.screenshot({ caret: 'initial', path: `${DIR}/${theme}-saving.png` });
    await expect(page.getByTestId('drag-error')).toContainText('Не удалось переселить');
    await page.getByTestId('drag-error').scrollIntoViewIfNeeded();
    await page.screenshot({ caret: 'initial', path: `${DIR}/${theme}-move-error.png` });
    await request.post(`${fixture}/__test/control`, { data: { failPath: '', delayPath: '' } });

    // 8–9. Продление за край: дата, ночи и сумма до отпускания; поверх блокировки — конфликт
    await open();
    const handle = unitRow(page, 'R02').locator('.board-stay-resize');
    const from = (await handle.boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    const next = (await at('R02', 3).boundingBox())!;
    await page.mouse.move(next.x + next.width / 2, next.y + next.height / 2, { steps: 6 });
    await expect(page.getByRole('status').filter({ hasText: 'До ' })).toContainText('₸');
    await page.screenshot({ caret: 'initial', path: `${DIR}/${theme}-extend.png` });
    const shut = (await at('R02', 4).boundingBox())!;
    await page.mouse.move(shut.x + shut.width / 2, shut.y + shut.height / 2, { steps: 6 });
    await expect(page.getByRole('status').filter({ hasText: 'продлить нельзя' })).toBeVisible();
    await page.screenshot({ caret: 'initial', path: `${DIR}/${theme}-extend-conflict.png` });
    await page.mouse.up();
    await expect(page.getByTestId('drag-error')).toContainText('Не удалось продлить проживание');
    await page.screenshot({ caret: 'initial', path: `${DIR}/${theme}-extend-refused.png` });
  });
}
