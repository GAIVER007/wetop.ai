import { expect, test } from './fixtures';

/** Gate 1, шаг 7: страница показывает ровно реальные 88 единиц (PLAN.md неделя 2). */
test('страница «Номерной фонд» показывает 88 единиц и сводку 16 / 72 / 92', async ({ page }) => {
  await page.goto('/inventory');
  await expect(page.getByRole('heading', { name: 'Номерной фонд' })).toBeVisible();

  const summary = page.getByTestId('inventory-summary');
  await expect(summary.getByTestId('total-units')).toHaveText('88');
  await expect(summary.getByTestId('rooms')).toHaveText('16');
  await expect(summary.getByTestId('beds')).toHaveText('72');
  await expect(summary.getByTestId('max-guests')).toHaveText('92');

  await expect(page.getByTestId('category-row')).toHaveCount(5);
  await expect(page.getByTestId('unit-row')).toHaveCount(88);

  await page.screenshot({ path: 'reports/screenshots/inventory-2026-09-08.png', fullPage: true });
});

test('фильтр по категории оставляет только её единицы', async ({ page }) => {
  await page.goto('/inventory?category=exely-5074687');
  await expect(page.getByTestId('unit-row')).toHaveCount(4);
  await expect(page.getByTestId('unit-row').first()).toContainText('Двухместная комната');
});
