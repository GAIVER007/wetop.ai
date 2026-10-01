import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('brand introduction does not depend on unpublished legal details', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#about')).toContainText('Создаём пространство');
  await expect(page.locator('#about')).toContainText('Hospitality');
  await expect(page.locator('#control')).toContainText('Роли');
  await expect(page.locator('#start')).toContainText('Подтвердите почту');
  await expect(page.locator('.hero')).not.toContainText(/248[\s\u00a0]?500|\+12%|Анна|Алексей/);
});

for (const width of [320, 390, 768, 1440]) {
  test(`refreshed homepage fits ${width} and opens access from the hero`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
    await page.goto('/');
    expect(
      await page.evaluate('document.documentElement.scrollWidth - innerWidth'),
    ).toBeLessThanOrEqual(1);
    await page.locator('.hero a[href="#features"]').click();
    await expect(page.locator('#features')).toBeInViewport();
    await page.locator('.hero [data-auth="register"]').click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });
}

test('new editorial sections are accessible in both themes', async ({ page }) => {
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('#about')).toBeVisible();
    const result = await new AxeBuilder({ page })
      .include('#about')
      .include('#control')
      .include('.hero')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(result.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  }
});
