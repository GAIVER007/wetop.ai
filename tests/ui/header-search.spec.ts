import { mkdirSync } from 'node:fs';
import { FIXTURE_API, expect, test } from './fixtures';

/**
 * Верхняя строка шапки (владелец 24.10.2026, вариант A: «давай со временем»): у знака WETOP дата и время филиала,
 * второго поля поиска нет; поиск по системе значком лупы и Ctrl K. Текст чёткий и целиком на любой ширине.
 */
const out = 'reports/header-search-2026-10-24';

test.beforeEach(async ({ page, request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
});

for (const width of [1920, 1440, 1366, 1280, 1024, 768, 390, 360, 320]) {
  test(`дата и время у знака, поиск значком: ${width}px`, async ({ page }) => {
    mkdirSync(out, { recursive: true });
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/today');
    const clock = page.getByTestId('header-clock');
    await expect(clock).toBeVisible();
    await expect(clock.locator('time')).toHaveText(/^\d{2}:\d{2}$/);
    // дата словами: длинная на компьютере, короткая на телефоне
    if (width >= 375) {
      const shown = clock.locator(width <= 600 ? '.header-clock__short' : '.header-clock__long');
      await expect(shown).toBeVisible();
      await expect(shown).toHaveText(width <= 600 ? /^\d{1,2} [а-я]{3,4}\.?$/ : /^\d{1,2} [а-я]+$/);
    }
    // значок поиска квадратный, не растянут
    const icon = (await page.locator('.workspace-search').boundingBox())!;
    expect(Math.abs(icon.width - icon.height)).toBeLessThan(2);
    // ничего не обрезано и не переносится на вторую строку
    const cut = await clock.evaluate((el) =>
      [el, ...el.querySelectorAll('*')]
        .filter((n) => (n as HTMLElement).offsetParent !== null)
        .filter((n) => n.scrollWidth > n.clientWidth + 1 || (n as HTMLElement).offsetHeight > 30)
        .map((n) => n.className),
    );
    expect(cut, JSON.stringify(cut)).toEqual([]);
    // часы справа от знака и в той же строке
    const brand = (await page.locator('.workspace-brand').boundingBox())!;
    const box = (await clock.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(brand.x + brand.width - 1);
    expect(Math.abs(box.y + box.height / 2 - (brand.y + brand.height / 2))).toBeLessThan(10);
    // второго поля поиска нет, значок открывает поиск по системе
    await expect(page.locator('.workspace-search-full')).toHaveCount(0);
    await page.locator('.workspace-search').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `${out}/today-${width}.png`, clip: { x: 0, y: 0, width, height: 110 } });
  });
}
