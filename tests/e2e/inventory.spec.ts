import { expect, test } from './fixtures';

/** Gate 1, шаг 7: страница показывает ровно реальные 88 единиц (PLAN.md неделя 2). */
test('страница «Номерной фонд» показывает 88 единиц и сводку 16 / 72 / 92', async ({ page }) => {
  await page.goto('/inventory');
  await expect(page.getByRole('heading', { name: 'Номерной фонд' })).toBeVisible();

  const summary = page.getByRole('main').getByTestId('inventory-summary');
  await expect(summary.getByTestId('total-units')).toHaveText('88');
  await expect(summary.getByTestId('rooms')).toHaveText('16');
  await expect(summary.getByTestId('beds')).toHaveText('72');
  await expect(summary.getByTestId('max-guests')).toHaveText('92');

  await expect(page.getByRole('main').getByTestId('category-row')).toHaveCount(5);
  await expect(page.getByRole('main').getByTestId('unit-row')).toHaveCount(88);

  await page.screenshot({ path: 'reports/screenshots/inventory-2026-09-08.png', fullPage: true });
});

test('фильтр по категории оставляет только её единицы', async ({ page }) => {
  // категория берётся из сводки, а не кодом объекта: на стенде коды другие, форма та же
  const api = process.env.APP_API_URL ?? 'http://127.0.0.1:3001';
  const summary = (await (await page.request.get(`${api}/inventory/summary`)).json()) as {
    byCategory: Array<{ code: string; name: string; units: number }>;
  };
  const double = summary.byCategory.find((c) => c.units === 4 && /двухместн/i.test(c.name))!;
  expect(double).toBeDefined();
  await page.goto(`/inventory?category=${encodeURIComponent(double.code)}`);
  await expect(page.getByRole('main').getByTestId('unit-row')).toHaveCount(4);
  // с PR #66 по умолчанию список; группа с именем категории — в виде карточками
  await page.goto(`/inventory?category=${encodeURIComponent(double.code)}&view=cards`);
  await expect(
    page.getByRole('region', { name: double.name, exact: true }).getByTestId('unit-row'),
  ).toHaveCount(4);
});
