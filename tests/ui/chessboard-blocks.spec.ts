import { expect, test } from './fixtures';

/**
 * План дизайн-системы §10 п. 3 и 4 (18.09.2026): клетка блокировки на шахматке.
 *  — штриховка `.board-block` задана в CSS как `background-image`; инлайн-сокращение `background:` на
 *    той же клетке её сбрасывало, и блокировка выглядела как ровная заливка (вывод был по коду —
 *    здесь проверяется вычисленный стиль в браузере);
 *  — подсказка блокировки называла тип сырым кодом (`OUT_OF_ORDER`, `MANAGEMENT`) — теперь словом,
 *    тем же, что на карточке ячейки.
 * Засев крайних случаев (`POST /__test/design-seed`) ставит M06 в OUT_OF_ORDER на вчера → завтра.
 */
const fixture = 'http://127.0.0.1:4311';

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
  const seeded = await request.post(`${fixture}/__test/design-seed`);
  expect(seeded.ok()).toBe(true);
});

test('клетка блокировки заштрихована и называет тип словом', async ({ page }) => {
  await page.goto('/chessboard');
  const row = page.getByRole('main').locator('[data-testid="unit-row"][data-unit-code="M06"]');
  const blocked = row.locator('td[data-state="BLOCKED"]').first();
  await expect(blocked).toBeVisible();
  const link = blocked.locator('a.board-block');
  await expect(link).toHaveCount(1);
  // штриховка жива: background-image не сброшен инлайн-фоном
  // tsconfig тестов без lib dom: глобал getComputedStyle берём через globalThis с узким типом
  const image = await link.evaluate(
    (el) =>
      (
        globalThis as unknown as { getComputedStyle(e: typeof el): { backgroundImage: string } }
      ).getComputedStyle(el).backgroundImage,
  );
  expect(image).toContain('repeating-linear-gradient');
  // тип блокировки — словом, как на карточке ячейки; сырого кода нет
  await expect(link).toHaveAttribute('aria-label', /неисправна: нет матраса/);
  await expect(link).not.toHaveAttribute('aria-label', /OUT_OF_ORDER/);
});
