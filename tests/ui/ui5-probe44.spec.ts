import { FIXTURE_API, expect, test } from './fixtures';
test.skip(!process.env['UI5_AUDIT'], 'probe');
test('probe 44', async ({ page, request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/reservations/new?unit=M03');
  const btn = page.getByRole('button', { name: 'Сегодня', exact: true });
  await expect(btn).toBeVisible();
  console.log(await btn.evaluate((el) => {
    const cs = getComputedStyle(el);
    return JSON.stringify({ h: el.getBoundingClientRect().height, min: cs.minHeight, classes: el.className });
  }));
});
