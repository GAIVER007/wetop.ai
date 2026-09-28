import { test, expect } from '@playwright/test';

/**
 * Витрина шагов «Свободных мест» для визуального подтверждения владельца (ТЗ — ADR-107,
 * `plans/tz-availability-2026-09-27.md` §10): light/dark снимки экрана на подставном API.
 * AV1 — `reports/availability-av1-2026-09-27/` (подтверждён 28.09); AV2 (цены «от») — папка ниже.
 */
const DIR = 'reports/availability-av2-2026-09-28';
const URL = '/rooms/availability?arrival=2026-10-01&departure=2026-10-04&guests=2';

// Даты в полях — как на машине владельца (ru), а не en-US хрома CI
test.use({ locale: 'ru-RU' });

for (const theme of ['light', 'dark'] as const) {
  test(`витрина AV2: ${theme}`, async ({ page, request }) => {
    await request.post('http://127.0.0.1:4311/__test/reset');
    await page.addInitScript((t) => localStorage.setItem('wetop.theme', t), theme);
    // Оверлей next dev («N Issues») — шум дев-сборки, к экрану не относится
    await page.addInitScript(() => {
      const style = document.createElement('style');
      style.textContent = 'nextjs-portal { display: none !important; }';
      document.addEventListener('DOMContentLoaded', () => document.head.append(style));
    });
    await page.goto(URL);
    await expect(page.getByRole('heading', { name: /Найдено \d+ вариант/ })).toBeVisible();
    await page.screenshot({ path: `${DIR}/search-${theme}.png`, fullPage: true });
    await page.locator('.fund-availability summary').first().click();
    await page.screenshot({ path: `${DIR}/units-open-${theme}.png`, fullPage: true });
    // трое гостей: подходящих номеров нет, «Все категории» объясняет каждую строку
    await page.goto(URL.replace('guests=2', 'guests=3'));
    await page.getByRole('button', { name: 'Все категории', exact: true }).click();
    await expect(page.getByText(/Не вмещает 3 гостей/).first()).toBeVisible();
    await page.screenshot({ path: `${DIR}/guests-3-all-${theme}.png`, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(URL);
    await expect(page.getByRole('heading', { name: /Найдено \d+ вариант/ })).toBeVisible();
    await page.screenshot({ path: `${DIR}/mobile-${theme}.png`, fullPage: true });
  });
}
