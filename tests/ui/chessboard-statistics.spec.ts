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
    // Четыре основных карточки, свободные места и уборка доступны в деталях.
    await expect(panel.locator('.board-kpi')).toHaveCount(4);
    await expect(panel.getByText('Дни рождения')).toHaveCount(0);
    // exact: подпись «Требует внимания: долги и задачи» (макет владельца 09.10) содержит это слово в нижнем регистре
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
    await panel.getByText('Другие показатели', { exact: true }).click();
    await expect(panel.getByTestId('day-free')).toHaveText(String(free));
    await page.evaluate(() => document.fonts.ready);
    const brokenWords = await panel.locator('.board-kpi__label').evaluateAll((labels) => {
      const broken: string[] = [];
      for (const label of labels) {
        const walker = document.createTreeWalker(label, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const node = walker.currentNode;
          for (const match of (node.textContent ?? '').matchAll(/\S+/g)) {
            const range = document.createRange();
            range.setStart(node, match.index!);
            range.setEnd(node, match.index! + match[0].length);
            if (range.getClientRects().length > 1) broken.push(match[0]);
          }
        }
      }
      return broken;
    });
    expect(brokenWords).toEqual([]);
    await expect(panel.locator('.board-kpi-more__panel')).toContainText('Свободно мест');
    await expect(panel.locator('.board-kpi-more__panel')).toContainText('Нужна уборка');
    const label = page.locator('.board-group-name-text').first();
    await label.scrollIntoViewIfNeeded();
    await page.evaluate(() => document.fonts.ready);
    const word = await label.evaluate((el) => {
      const text = el.firstChild!;
      const range = document.createRange();
      range.setStart(text, 0);
      range.setEnd(text, (text.textContent!.match(/^\S+/) ?? [''])[0].length);
      return {
        height: range.getBoundingClientRect().height,
        lineHeight: Number.parseFloat(getComputedStyle(el).lineHeight),
        wrap: getComputedStyle(el).overflowWrap,
      };
    });
    expect(word.height).toBeLessThanOrEqual(word.lineHeight + 1);
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
  await panel.getByText('Другие показатели', { exact: true }).click();
  const free = await panel.getByTestId('day-free').innerText();
  await page.goto('/chessboard?from=2025-01-01&to=2025-01-30');
  await expect(panel.getByTestId('day-occupancy')).toHaveText(occupancy);
  await panel.getByText('Другие показатели', { exact: true }).click();
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
