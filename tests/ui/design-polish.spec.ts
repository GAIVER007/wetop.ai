import { FIXTURE_API, expect, test } from './fixtures';

test.beforeEach(async ({ request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
});

for (const width of [1333, 390]) {
  for (const theme of ['light', 'dark']) {
    test(`bar labels and product form: ${width} ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 973 });
      await page.addInitScript((value) => localStorage.setItem('wetop.theme', value), theme);
      await page.goto('/bar');
      const cards = await page.locator('.bar-kpi').evaluateAll((elements) => elements.map((card) => {
        const body = card.querySelector('.bar-kpi-body')!.getBoundingClientRect();
        const hint = card.querySelector('.bar-kpi-hint')?.getBoundingClientRect();
        return { wide: body.width >= card.getBoundingClientRect().width - 32, separated: !hint || hint.top >= body.bottom - 1 };
      }));
      expect(cards.length).toBeGreaterThan(0);
      for (const card of cards) {
        expect(card.wide).toBeTruthy();
        expect(card.separated).toBeTruthy();
      }
      await page.getByRole('link', { name: 'Добавить товар', exact: true }).click();
      await expect(page.locator('#bar-new-name')).toBeVisible();
      await page.getByRole('button', { name: 'Отмена', exact: true }).click();
      await expect(page.locator('#bar-new-name')).toBeHidden();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    });

    test(`finance overview and navigation: ${width} ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 973 });
      await page.addInitScript((value) => localStorage.setItem('wetop.theme', value), theme);
      await page.goto('/finance');
      await expect(page.getByRole('heading', {name: 'Финансы', exact: true})).toBeVisible();
      await expect(page.getByTestId('finance-board')).toBeVisible();
      await expect(page.getByRole('tabpanel', {name: 'Обзор', exact: true}).getByTestId('charged')).toBeVisible();
      for (const name of ['Операции', 'Долги', 'Услуги', 'Касса', 'Обзор']) {
        await page.getByRole('tab', { name, exact: true }).click();
        await expect(page.getByRole('tabpanel', { name, exact: true })).toBeVisible();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    });
  }
}

for (const theme of ['light', 'dark']) {
  test(`booking tooltip supports pointer, keyboard and scroll: ${theme}`, async ({ page, request }) => {
    await request.post(`${FIXTURE_API}/__test/design-seed`);
    await page.setViewportSize({ width: 1333, height: 973 });
    await page.addInitScript((value) => localStorage.setItem('wetop.theme', value), theme);
    await page.goto('/chessboard');
    const stay = page.getByTestId('stay-cell').first();
    const tooltip = page.getByRole('tooltip');
    await stay.hover();
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('Бронь');
    const box = await tooltip.boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(1333);
    await stay.focus();
    await stay.press('Escape');
    await expect(tooltip).toBeHidden();
    await stay.blur();
    await stay.focus();
    await expect(tooltip).toBeVisible();
    await page.mouse.wheel(0, 400);
    await expect(tooltip).toBeHidden();
  });
}
