import { mkdirSync } from 'node:fs';
import { test, expect } from '../ui/fixtures';
import { seed } from './tz11-helpers';

/**
 * Прайс-лист услуг салона (вариант B, выбор владельца 25.10.2026): категории с ценой и длительностью в одной таблице,
 * «В филиале» выключателем, пачка галочками, телефон карточками. Снимки 1440 и 390, светлая и тёмная тема.
 */
const out = 'reports/beauty-services-pricelist-2026-10-25';

test('прайс-лист: цена в строке, выключатель «В филиале», пачка и телефон', async ({ page, request }) => {
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
  await expect(row('Окрашивание волос')).toContainText('25 000 ₸');
  await expect(row('Окрашивание волос')).toContainText('120 мин');
  await expect(page.getByRole('group', { name: 'Услуги салона' })).toContainText('В филиале');

  // выключатель: Педикюр включается в филиал одним нажатием
  const sw = row('Педикюр').getByRole('switch', { name: 'В филиале: Педикюр' });
  await expect(sw).not.toBeChecked();
  await sw.click({ force: true });
  // сохранение идёт сервером: ждём итог, на загруженном стенде дольше 5 с
  await expect(page.getByRole('status').filter({ hasText: 'Настройки филиала сохранены' })).toBeVisible({ timeout: 30_000 });
  await expect(row('Педикюр').getByRole('switch')).toBeChecked({ timeout: 30_000 });

  // пачка: две услуги филиала убираются галочками
  await row('Маникюр').getByLabel('Выбрать: Маникюр').check();
  await row('Педикюр').getByLabel('Выбрать: Педикюр').check();
  await page.getByRole('button', { name: /^Убрать из филиала \(2\)/ }).click();
  await expect(page.getByRole('status').filter({ hasText: /из филиала/i })).toBeVisible({ timeout: 30_000 });
  await expect(row('Маникюр').getByRole('switch')).not.toBeChecked({ timeout: 30_000 });

  // охват «В филиале»: только включённые
  await page.getByRole('group', { name: 'Какие услуги показать' }).getByRole('button', { name: /^В филиале/ }).click();
  await expect(row('Маникюр')).toHaveCount(0);
  await expect(row('Стрижка женская')).toBeVisible();
  await page.getByRole('group', { name: 'Какие услуги показать' }).getByRole('button', { name: 'Все', exact: true }).click();

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
