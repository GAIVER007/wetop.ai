import { mkdirSync } from 'node:fs';
import { FIXTURE_API, expect, test } from './fixtures';

test.beforeEach(async ({ request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
});

for (const width of [360, 390, 430]) {
  test(`statistics ${width}: compact widgets and complete category words`, async ({
    page,
    request,
  }) => {
    const get = (url: string) => request.get(url, { headers: { 'x-wetop-test-client': '1' } });
    await request.post(`${FIXTURE_API}/__test/design-seed`);
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/chessboard');
    const panel = page.getByRole('group', { name: 'Сегодня на объекте' });
    // шесть карточек по образцу владельца (09.10): загрузка, заезды, выезды, свободно, уборка, внимание
    await expect(panel.getByText('Дни рождения')).toHaveCount(0);
    await expect(panel.getByText('Задачи', { exact: true })).toHaveCount(0);
    const panelBox = await panel.boundingBox();
    expect(panelBox!.height).toBeLessThanOrEqual(280);
    const day = await (await get(`${FIXTURE_API}/desk/today`)).json();
    await expect(panel.getByTestId('day-arrivals')).toHaveText(String(day.counts.arrivals));
    await expect(panel.getByTestId('day-departures')).toHaveText(String(day.counts.departures));
    const board = await (
      await get(`${FIXTURE_API}/chessboard?from=${day.date}&to=${day.date}`)
    ).json();
    const free = board.rows.filter(
      (r: { cells: { state: string }[] }) => r.cells[0]?.state === 'FREE',
    ).length;
    await expect(panel.getByTestId('day-free')).toHaveText(String(free));
    const label = page.locator('.board-group-name-text').first();
    await label.scrollIntoViewIfNeeded();
    await page.evaluate(() => document.fonts.ready);
    const word = await label.evaluate((el) => {
      const text = el.firstChild!;
      const range = document.createRange();
      range.setStart(text, 0);
      range.setEnd(text, (text.textContent!.match(/^\S+/) ?? [''])[0].length);
      return { lines: range.getClientRects().length, wrap: getComputedStyle(el).overflowWrap };
    });
    expect(word.lines).toBe(1);
    expect(word.wrap).not.toBe('anywhere');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    ).toBeLessThanOrEqual(1);
    mkdirSync('reports/calendar-mobile-statistics-2026-10-05', { recursive: true });
    await page.screenshot({
      path: `reports/calendar-mobile-statistics-2026-10-05/grid-${width}.png`,
    });
  });
}

test('today statistics stay available when the calendar shows another month', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/chessboard');
  const panel = page.getByRole('group', { name: 'Сегодня на объекте' });
  const gridBox = await page.locator('.board-wrap').boundingBox();
  expect(gridBox!.y).toBeLessThanOrEqual(700);
  const occupancy = await panel.getByTestId('day-occupancy').innerText();
  const free = await panel.getByTestId('day-free').innerText();
  await page.goto('/chessboard?from=2025-01-01&to=2025-01-30');
  await expect(panel.getByTestId('day-occupancy')).toHaveText(occupancy);
  await expect(panel.getByTestId('day-free')).toHaveText(free);
  await page.screenshot({ path: 'reports/calendar-mobile-statistics-2026-10-05/top-390.png' });
});

test('empty booking base shows zero occupancy and no urgent bookings', async ({
  page,
  request,
}) => {
  await request.post(`${FIXTURE_API}/__test/control`, { data: { noBookings: true } });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/chessboard');
  const panel = page.getByRole('group', { name: 'Сегодня на объекте' });
  await expect(panel.getByTestId('day-occupancy')).toHaveText('0%');
  await expect(panel.getByTestId('day-occupied')).toHaveText('0');
  await expect(panel.getByTestId('day-arrivals')).toHaveText('0');
});

for (const theme of ['light', 'dark'] as const) {
  test(`daily widgets ${theme}: accessible labels and contrasts`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/chessboard');
    const panel = page.getByRole('group', { name: 'Сегодня на объекте' });
    const AxeBuilder = (await import('@axe-core/playwright')).default;
    const results = await new AxeBuilder({ page }).include('.board-kpis').analyze();
    expect(results.violations).toEqual([]);
    await expect(panel.getByTestId('day-occupancy')).toHaveText('8%');
    mkdirSync('reports/calendar-mobile-statistics-2026-10-05', { recursive: true });
    await page.screenshot({
      path: `reports/calendar-mobile-statistics-2026-10-05/${theme}-390.png`,
    });
  });
}

for (const theme of ['light', 'dark'] as const) {
  test(`desktop daily widgets ${theme}: accessible pointer targets`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/chessboard');
    const AxeBuilder = (await import('@axe-core/playwright')).default;
    const results = await new AxeBuilder({ page })
      .include('.board-kpis')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}
