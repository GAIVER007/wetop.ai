import { expect, test } from '@playwright/test';

test('scroll motion works and respects reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await expect(page.locator('#product')).toHaveAttribute('data-site-enter', '');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('[data-site-enter]')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.locator('#audience').scrollIntoViewIfNeeded();
  await expect(page.locator('#audience h3 a')).toHaveCount(3);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.getByRole('link', { name: 'Гостиницы', exact: true }).click();
  await expect(page).toHaveURL(/\/for\/hotels\/$/);
  await expect(page.locator('.hotel-hero')).toHaveAttribute('data-site-enter', '');
});
