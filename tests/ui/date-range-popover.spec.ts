import { expect, test } from './fixtures';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

test('единый выбор периода: пресет, ручной диапазон и Escape', async ({ page }) => {
  await page.goto('/design-system');
  const control = page.getByTestId('kit-range-popover-light');
  await control.locator('summary').click();
  await expect(control.locator('details')).toHaveAttribute('open', '');

  await control.getByRole('button', { name: '7 дней' }).click();
  await expect(control.locator('input[name="from"]')).toHaveValue('2026-10-11');
  await expect(control.locator('input[name="to"]')).toHaveValue('2026-10-17');
  await expect(control.getByText('Выбрано: 11–17 октября 2026 (7 дн.)')).toBeVisible();

  await control.getByRole('button', { name: 'Произвольный период' }).click();
  await control.locator('input[name="from"]').fill('2026-10-20');
  await control.locator('input[name="to"]').fill('2026-10-22');
  await expect(control.getByText('Выбрано: 20–22 октября 2026 (3 дн.)')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(control.locator('details')).not.toHaveAttribute('open');
  await expect(control.locator('summary')).toBeFocused();
});

test('«Отмена» возвращает отрезок экрана и закрывает окно', async ({ page }) => {
  await page.goto('/design-system');
  const control = page.getByTestId('kit-range-popover-light');
  await control.locator('summary').click();
  await control.getByRole('button', { name: '14 дней' }).click();
  await expect(control.locator('input[name="to"]')).toHaveValue('2026-10-24');
  await control.getByRole('button', { name: '7 дней' }).click();
  await expect(control.locator('input[name="to"]')).toHaveValue('2026-10-17');
  await control.getByRole('button', { name: 'Отмена' }).click();
  await expect(control.locator('details')).not.toHaveAttribute('open');
  await expect(control.locator('summary')).toBeFocused();
  await expect(control.locator('input[name="from"]')).toHaveValue('2026-10-10');
  await expect(control.locator('input[name="to"]')).toHaveValue('2026-10-24');
});

test('popover помещается на планшете и телефоне в обеих темах', async ({ page }) => {
  await page.goto('/design-system');
  for (const width of [1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: width <= 390 ? 844 : 900 });
    for (const theme of ['light', 'dark'] as const) {
      const control = page.getByTestId(`kit-range-popover-${theme}`);
      await control.locator('summary').click();
      await expect(control.getByRole('button', { name: 'Применить' })).toBeVisible();
      const panel = await control.locator('.date-range__panel').boundingBox();
      expect(panel).not.toBeNull();
      expect(panel!.x).toBeGreaterThanOrEqual(0);
      expect(panel!.x + panel!.width).toBeLessThanOrEqual(width);
      await page.keyboard.press('Escape');
    }
  }
});

test('визуальное доказательство выбора периода в обеих темах', async ({ page }) => {
  test.skip(process.env.UI_CAPTURE !== '1', 'Снимки создаются отдельным запуском');
  const directory = resolve('reports/ui4-2-a-2026-10-12');
  mkdirSync(directory, { recursive: true });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.goto('/design-system');
    for (const theme of ['light', 'dark'] as const) {
      const control = page.getByTestId(`kit-range-popover-${theme}`);
      await control.evaluate((element) => element.scrollIntoView({ block: 'start' }));
      await page.evaluate(() => window.scrollBy(0, -90));
      await control.locator('summary').click();
      await expect(control.getByRole('button', { name: 'Применить' })).toBeVisible();
      await page.screenshot({ path: resolve(directory, `period-${width}-${theme}.png`) });
      await page.keyboard.press('Escape');
    }
  }
});
