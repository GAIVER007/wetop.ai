import { FIXTURE_API, expect, test } from './fixtures';

test('действия брони предлагают редактировать количество гостей', async ({ page, request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
  await page.goto('/reservations/20260913-TESTAA#booking-actions');
  const actions = page.getByTestId('reservation-actions');
  await expect(actions).toBeVisible();
  await expect(actions.getByRole('button', { name: 'Заселить', exact: true })).toBeVisible();
  await expect(actions.locator('[data-testid^="guests-form-"]')).toHaveCount(1);
  await expect(actions.locator('input[name="adults"], input[name="children"]')).toHaveCount(2);
});

for (const width of [390, 320]) {
  test(`форма гостей помещается на телефоне ${width}px`, async ({ page, request }) => {
    await request.post(`${FIXTURE_API}/__test/reset`);
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/reservations/20260913-TESTAA#booking-actions');
    const form = page.locator('[data-testid^="guests-form-"]').first();
    await expect(form).toBeVisible();
    const fields = form.locator('input[name="adults"], input[name="children"]');
    await expect(fields).toHaveCount(2);
    for (const field of await fields.all()) {
      await expect(field).toBeVisible();
      const bounds = await field.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
  });
}
