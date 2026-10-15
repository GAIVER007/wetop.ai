import { test, expect } from './fixtures';

test('главная: компактные блоки и единая очередь проблем', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/today');
  const home = page.locator('.hospitality-home');
  await expect(home).toBeVisible();
  await expect(home.locator('.biz-today__debts')).toHaveCount(0);
  const items = home.locator('.biz-attention__list a');
  await expect(items.first()).toBeVisible();
  expect(await items.first().evaluate(el => getComputedStyle(el).textDecorationLine)).toBe('none');
  const a = await items.nth(0).boundingBox();
  const b = await items.nth(1).boundingBox();
  expect(Math.abs(a!.y - b!.y)).toBeLessThan(2);
  for (const width of [1024, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
