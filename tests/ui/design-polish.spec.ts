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
      // плиток над доской нет (аудит 21.10.2026 п.7): итоги строкой, подписи читаются целиком
      await expect(page.locator('.bar-kpi')).toHaveCount(0);
      const totals = page.getByTestId('bar-totals');
      await expect(totals).toBeVisible();
      expect(await totals.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBeTruthy();
      await page.locator('.bar-board-head').getByRole('button', { name: 'Добавить товар', exact: true }).click();
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


test('home tasks stay separate from a past financial period', async ({page}) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByRole('heading', {name: 'Главная', exact: true})).toBeVisible();
  await expect(page.getByTestId('owner-risks')).toBeVisible();
  await page.goto('/finance?from=2026-08-15&to=2026-08-15');
  await expect(page.getByRole('heading', {name: 'Финансы', exact: true})).toBeVisible();
  await expect(page.getByTestId('period-form').getByLabel('Период: с', {exact: true})).toHaveValue('2026-08-15');
  await expect(page.getByTestId('period-form').getByLabel('Период: по', {exact: true})).toHaveValue('2026-08-15');
  await expect(page.getByTestId('owner-risks')).toHaveCount(0);
  await page.goto('/today');
  await expect(page.getByTestId('owner-risks')).toBeVisible();
});
