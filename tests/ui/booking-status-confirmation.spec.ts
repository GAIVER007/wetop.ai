import { FIXTURE_API, expect, test } from './fixtures';
const number = '20260913-TESTAA';
const headers = { 'x-wetop-test-client': '1' };
test.beforeEach(async ({ request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
});
for (const surface of ['calendar', 'card'] as const) {
  test(`${surface}: заселение требует подтверждения, отказ сохраняет статус`, async ({
    page,
    request,
  }) => {
    const card = await (
      await request.get(`${FIXTURE_API}/reservations/${number}`, { headers })
    ).json();
    for (const status of ['CLEAN', 'INSPECTED']) {
      const r = await request.post(`${FIXTURE_API}/units/${card.items[0].unitCode}/housekeeping`, {
        headers,
        data: { status },
      });
      expect(r.ok()).toBeTruthy();
    }
    if (surface === 'calendar') {
      await page.goto(`/chessboard?from=${card.arrivalDate}&to=${card.departureDate}`);
      await page.locator(`[data-testid="stay-cell"][data-number="${number}"]`).first().click();
      await page
        .getByTestId('stay-preview')
        .getByRole('button', { name: 'Заселить', exact: true })
        .click();
    } else {
      await page.goto(`/reservations/${number}#booking-actions`);
      await page.getByTestId('check-in-ui-item').click();
    }
    const dialog = page.locator('dialog[open]');
    await expect(dialog).toBeVisible();
    const untouched = await (
      await request.get(`${FIXTURE_API}/reservations/${number}`, { headers })
    ).json();
    expect(untouched.items[0].status).toBe('CONFIRMED');
    await dialog.getByRole('button', { name: 'Оставить как есть', exact: true }).click();
    expect(
      (await (await request.get(`${FIXTURE_API}/reservations/${number}`, { headers })).json())
        .items[0].status,
    ).toBe('CONFIRMED');
  });
}
