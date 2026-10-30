import { mkdirSync } from 'node:fs';
import { test, expect } from '../ui/fixtures';
import { seed } from './tz11-helpers';

/**
 * Услуги салона двумя колонками (владелец 30.10.2026, макет): слева «В филиале», справа «Можно добавить», стрелки
 * ← и → переносят отмеченные. Снимки 1440 и 390, светлая и тёмная тема.
 */
const out = 'reports/beauty-services-columns-2026-10-30';

test('услуги: две колонки, стрелки переносят отмеченные, телефон без прокрутки вбок', async ({ page, request }) => {
  test.setTimeout(240_000);
  mkdirSync(out, { recursive: true });
  const f = await seed(page, request);
  const add = async (name: string, category: string, priceMinor: string, minutes: number, enabled: boolean) => {
    const s = await f.call('/beauty/services', { name, category, durationMinutes: minutes, priceMinor, currency: 'KZT' });
    if (enabled) await f.call(`/beauty/services/${s.id}/location`, { enabled: true }, 'put');
    return s as { id: string };
  };
  await add('Окрашивание волос', 'Волосы', '2500000', 120, true);
  await add('Стрижка женская', 'Волосы', '800000', 60, true);
  await add('Маникюр', 'Ногти', '900000', 60, true);
  await add('Педикюр', 'Ногти', '1100000', 90, false);
  await add('Стрижка мужская', 'Мужской зал', '600000', 45, true);
  await add('Коррекция бровей', 'Лицо', '400000', 30, false);

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/services');
  const list = page.locator('[data-service-list="price"]');
  const row = (name: string) => list.locator('.beauty-service-item').filter({ has: page.getByText(name, { exact: true }) });
  const left = (name: string) => page.locator('[data-service-column="location"] .beauty-service-item').filter({ has: page.getByText(name, { exact: true }) });
  const right = (name: string) => page.locator('[data-service-column="catalog"] .beauty-service-item').filter({ has: page.getByText(name, { exact: true }) });
  await expect(left('Окрашивание волос')).toContainText('25 000 ₸');
  await expect(left('Окрашивание волос')).toContainText('120 мин');
  await expect(right('Педикюр')).toHaveCount(1);

  // стрелка ←: Педикюр справа уходит в филиал
  await row('Педикюр').getByLabel('Выбрать: Педикюр').check();
  await page.getByRole('button', { name: 'Добавить в филиал отмеченные' }).click();
  await expect(page.getByRole('status').filter({ hasText: /в филиал/i })).toBeVisible({ timeout: 30_000 });
  await expect(left('Педикюр')).toHaveCount(1, { timeout: 30_000 });

  // стрелка →: две услуги филиала уходят вправо
  await row('Маникюр').getByLabel('Выбрать: Маникюр').check();
  await row('Педикюр').getByLabel('Выбрать: Педикюр').check();
  await page.getByRole('button', { name: 'Убрать из филиала отмеченные' }).click();
  await expect(page.getByRole('status').filter({ hasText: /из филиала/i })).toBeVisible({ timeout: 30_000 });
  await expect(right('Маникюр')).toHaveCount(1, { timeout: 30_000 });
  await expect(left('Маникюр')).toHaveCount(0);

  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    for (const width of [1440, 390] as const) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await page.goto('/services');
      await expect(list).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await page.mouse.move(0, 0);
      await page.screenshot({ path: `${out}/services-${width}-${theme}.png`, fullPage: width === 1440 });
    }
  }
});
