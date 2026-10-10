import { expect, test } from './fixtures';
test('flat shared surfaces across application routes in both themes', async ({ page }) => {
  test.setTimeout(120_000);
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    for (const route of ['/finance', '/hotel-settings', '/hotel-settings/stay', '/hotel-settings/services', '/reservations', '/rooms/categories', '/channels', '/ai-seller']) {
      await page.goto(route);
      await expect(page.getByRole('main')).toBeVisible();
      const decor = await page.evaluate(() => ({
        before: getComputedStyle(document.body, '::before').content,
        after: getComputedStyle(document.body, '::after').content,
        // у плитки с тоном черта 3 px слева нарисована inset-тенью — это утверждённый DS1c (§8.2), не декор
        panels: [...document.querySelectorAll('.panel,.stat:not([class*="stat--tone"]),.table-scroll,.workspace-property')].filter(e => e.getBoundingClientRect().height > 0).map(e => ({ shadow: getComputedStyle(e).boxShadow, image: getComputedStyle(e).backgroundImage })),
      }));
      expect(decor.before, route).toBe('none');
      expect(decor.after, route).toBe('none');
      for (const panel of decor.panels) { expect(panel.shadow, route).toBe('none'); expect(panel.image, route).toBe('none'); }
    }
  }
});
