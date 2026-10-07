import { FIXTURE_API, expect, test } from './fixtures';

test('действия брони не предлагают редактировать количество гостей', async ({ page, request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
  await page.goto('/reservations/20260913-TESTAA#booking-actions');
  const actions = page.getByTestId('reservation-actions');
  await expect(actions).toBeVisible();
  await expect(actions.getByRole('button', { name: 'Заселить', exact: true })).toBeVisible();
  await expect(actions.locator('[data-testid^="guests-form-"]')).toHaveCount(0);
  await expect(actions.locator('input[name="adults"], input[name="children"]')).toHaveCount(0);
});
