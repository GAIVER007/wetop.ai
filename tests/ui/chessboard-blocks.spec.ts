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

/**
 * Период блокировки — как у настоящего API: «по» не включается (`dateTo > dateFrom`, ночь `dateTo`
 * не блокируется; форма так и подписана — «До (не включая)»). До 28.09.2026 стенд считал `dateTo`
 * включительно, и блокировка «29.09 — 30.09» закрывала на стенде две ночи, а в работе — одну.
 */
test('блокировка «с X до X+1» закрывает одну ночь X, как API; пустой период стенд отклоняет', async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/reset`);
  const headers = { 'x-wetop-test-client': '1' };
  const stay = (await (
    await request.get(`${fixture}/reservations/20260913-TEST1`, { headers })
  ).json()) as { arrivalDate: string };
  const add = (n: number) => {
    const d = new Date(`${stay.arrivalDate}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const post = (dateFrom: string, dateTo: string) =>
    request.post(`${fixture}/units/R07/blocks`, {
      headers,
      data: { dateFrom, dateTo, type: 'MAINTENANCE', reason: 'тест' },
    });
  expect((await post(add(1), add(2))).ok()).toBe(true);
  await page.goto(`/chessboard?from=${add(-1)}&to=${add(5)}`);
  const row = page.locator('[data-testid="unit-row"][data-unit-code="R07"]');
  await expect(row.locator(`td[data-date="${add(1)}"]`)).toHaveAttribute('data-state', 'BLOCKED');
  await expect(row.locator(`td[data-date="${add(2)}"]`)).toHaveAttribute('data-state', 'FREE');
  // пустой период («по» = «с») API отклоняет 400 — стенд тоже
  expect((await post(add(3), add(3))).status()).toBe(400);
});
