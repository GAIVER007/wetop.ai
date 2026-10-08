import { FIXTURE_API, expect, test, settleStreaming } from './fixtures';

test.beforeEach(async ({ request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
});

for (const width of [1440, 390]) {
  test(`AVAIL-SUM-01: totals match visible categories at ${width}`, async ({ page, request }) => {
    await page.setViewportSize({ width, height: 844 });
    const reset = await request.post(`${FIXTURE_API}/__test/reset`);
    expect(reset.ok()).toBe(true);
    const { today } = (await reset.json()) as { today: string };
    const dateAfter = (days: number) => {
      const date = new Date(`${today}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() + days);
      return date.toISOString().slice(0, 10);
    };
    // M01 and M02 occupy [today - 2, today + 3); verify both periods exactly.
    await page.goto(
      `/rooms/availability?arrival=${today}&departure=${dateAfter(1)}&guests=1&category=MALE`,
    );
    await expect(page.locator('.fund-result-heading .fund-counts b')).toHaveText(['0', '34']);
    await expect(page.locator('.fund-availability .fund-available-count b')).toHaveText('34');
    await page.goto(
      `/rooms/availability?arrival=${dateAfter(4)}&departure=${dateAfter(6)}&guests=1&category=MALE`,
    );
    const heading = page.locator('.fund-result-heading');
    await expect(page.locator('.fund-availability > article')).toHaveCount(1);
    await expect(heading.getByRole('heading')).toHaveText('Найдено 1 вариант');
    await expect(heading.locator('.fund-counts b')).toHaveText(['0', '36']);
    await page.reload();
    await expect(heading.locator('.fund-counts b')).toHaveText(['0', '36']);
    await page.getByRole('combobox', { name: 'Тип размещения' }).selectOption('ROOM');
    await expect(heading.getByRole('heading')).toHaveText('Ничего не найдено на эти даты');
    await expect(heading.locator('.fund-counts b')).toHaveText(['0', '0']);
    await page.getByRole('combobox', { name: 'Категория', exact: true }).selectOption('');
    const counts = await page
      .locator('.fund-availability .fund-available-count b')
      .allTextContents();
    await expect(heading.locator('.fund-counts b')).toHaveText([
      String(counts.reduce((sum, count) => sum + Number(count), 0)),
      '0',
    ]);
  });

  test(`FIN-NAV-01: finance card opens charges and preserves period at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/reports?from=2026-10-01&to=2026-10-31');
    const card = page.getByTestId('report-finance');
    await expect(card).toHaveAttribute('href', '/finance?from=2026-10-01&to=2026-10-31#charges');
    await card.click();
    await settleStreaming(page);
    await expect(page.getByRole('button', { name: 'Отчёты и управление' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await expect(page.getByRole('tab', { name: 'Обзор', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.reload();
    await expect(page.getByRole('tab', { name: 'Обзор', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.goBack();
    await expect(page).toHaveURL(/\/reports\?from=2026-10-01&to=2026-10-31$/);
    await page.goForward();
    await expect(page.getByRole('tab', { name: 'Обзор', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
}
