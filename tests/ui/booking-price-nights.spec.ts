import { FIXTURE_API, expect, test } from './fixtures';

/**
 * Образец Exely (поручение 03.10): в форме брони — «Детализация цены по дням», цена каждой ночи
 * из того же расчёта, что итог; шапка календаря — панель «Сегодня» не выше строки управления.
 */
const fixture = FIXTURE_API;

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

test('форма брони: детализация цены по дням, сумма ночей равна итогу', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/reservations/new?unit=M03');
  const form = page.getByTestId('new-reservation-form');
  await form.getByRole('button', { name: '3 ночи', exact: true }).click();
  const nights = form.getByTestId('price-by-night');
  await expect(nights).toBeVisible();
  // свёрнута по умолчанию: форма не вырастает, кнопка «Создать бронь» остаётся на экране
  await expect(nights.locator('table')).toBeHidden();
  await nights.getByText('Детализация цены по дням', { exact: true }).click();
  await expect(nights.locator('tbody tr')).toHaveCount(3);
  await expect(form.getByTestId('price-by-night-sum')).toContainText('Всего ночей: 3');
  await expect(form.getByTestId('price-by-night-sum')).toContainText('средняя стоимость ночи');
});

for (const width of [1280, 1366, 1440]) {
  test(`календарь ${width}px: заголовок с периодом в одну строку, шесть плиток, полоса фильтров, сетка`, async ({
    page,
  }) => {
    // Эталон владельца 13.10.2026 (UI4.2): заголовок слева и период, «Сегодня», «Новая бронь» справа одной
    // строкой; под ним шесть плиток в один ряд; затем полоса фильтров; затем сетка.
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/chessboard');
    const panel = page.getByRole('group', { name: 'Сегодня на объекте' });
    await expect(panel).toBeVisible();
    const head = (await page.locator('main > .page__head').boundingBox())!;
    const p = (await panel.boundingBox())!;
    const bar = (await page.locator('.board-toolbar').boundingBox())!;
    const grid = (await page.locator('.board-wrap').boundingBox())!;
    expect(head.height).toBeLessThanOrEqual(64);
    expect(head.y + head.height).toBeLessThanOrEqual(p.y + 1);
    expect(p.height).toBeLessThanOrEqual(120);
    expect(p.y + p.height).toBeLessThanOrEqual(bar.y + 1);
    expect(bar.height).toBeLessThanOrEqual(56);
    expect(bar.y + bar.height).toBeLessThanOrEqual(grid.y + 1);
    // 384 как в chessboard-week C1 (поручение 02.10): шапка от 1280 px в две строки, 88 px (20.10.2026)
    expect(grid.y).toBeLessThanOrEqual(384);
    const tops = await panel
      .locator('.stat')
      .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    expect(tops).toHaveLength(6);
    expect(new Set(tops).size).toBe(1);
    // период и «Новая бронь» на одной линии с заголовком; ярлык «Сегодня» снят в #506 (пресет внутри периода)
    const lineTops = await page
      .locator('main > .page__head')
      .locator('.board-period, .board-nav > .btn, .board-new')
      .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top / 8)));
    expect(lineTops).toHaveLength(2);
    expect(new Set(lineTops).size).toBe(1);
    await expect(panel.getByTestId('day-free')).toBeVisible();
    await expect(panel.getByTestId('day-units')).toHaveCount(0);
  });
}
