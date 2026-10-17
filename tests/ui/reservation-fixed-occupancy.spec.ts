import { FIXTURE_API, expect, test } from './fixtures';

for (const width of [320, 390]) {
  test(`действия брони ${width}: гости из сохранённого проживания и границы полей`, async ({ page, request }) => {
    await request.post(`${FIXTURE_API}/__test/reset`);
    const response = await request.get(`${FIXTURE_API}/reservations/20260913-TESTAA`, { headers: { 'x-wetop-test-client': '1' } });
    expect(response.ok()).toBe(true);
    const card = await response.json();
    const item = card.items[0];
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/reservations/20260913-TESTAA#booking-actions');
    const actions = page.getByTestId('reservation-actions');
    await expect(actions).toBeVisible();
    await expect(actions.getByRole('button', { name: 'Заселить', exact: true })).toBeVisible();
    const form = page.getByTestId(`guests-form-${item.id}`);
    await expect(form).toBeVisible();
    await expect(form.locator('[name="adults"]')).toHaveValue(String(item.adults));
    await expect(form.locator('[name="children"]')).toHaveValue(String(item.children));
    await expect(form.locator('[name="adults"]')).toHaveAttribute('min', '1');
    await expect(form.locator('[name="children"]')).toHaveAttribute('min', '0');
    for (const field of await form.locator('input[name="adults"], input[name="children"]').all()) {
      await expect(field).toHaveAttribute('step', '1');
      const box = (await field.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  });
}
