import { expect, test } from './fixtures';

/** Кадры компактной панели брони на шахматке (замечание владельца 25.10.2026): не входят в гейт, только для сверки */
const OUT = process.env.SHOT_DIR ?? '/tmp/booking-shots';


for (const [w, h] of [
  [1440, 900],
  [390, 844],
] as const) {
  test(`панель брони ${w}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/chessboard');
    await page.locator('td[data-status="CONFIRMED"] [data-testid="stay-cell"]').first().click();
    const preview = page.getByTestId('stay-preview');
    await expect(preview.getByTestId('preview-sums')).toContainText('₸');
    await preview.screenshot({ path: `${OUT}/preview-${w}.png` });
    await preview.getByRole('link', { name: 'Редактировать бронь' }).click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/card-${w}.png`, fullPage: false });
    const drawer = page.getByRole('dialog', { name: 'Бронирование' });
    if (await drawer.isVisible()) {
      await drawer.screenshot({ path: `${OUT}/drawer-${w}.png` });
      const box = drawer.locator('.drawer__body, [class*="body"]').first();
      if (await box.isVisible()) await box.evaluate((el) => el.scrollTo(0, 99999));
      await page.waitForTimeout(500);
      await drawer.screenshot({ path: `${OUT}/drawer-bottom-${w}.png` });
    }
  });
}
