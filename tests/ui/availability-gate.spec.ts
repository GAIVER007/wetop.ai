import { test, expect } from '@playwright/test';

/**
 * Витрина AV1 для визуального стопа владельца (ТЗ «Свободные места» — ADR-107,
 * `plans/tz-availability-2026-09-27.md` §10): light/dark снимки экрана на подставном API.
 * Снимки — `reports/availability-av1-2026-09-27/`; AV2 стартует только после подтверждения.
 */
const DIR = 'reports/availability-av1-2026-09-27';
const URL = '/rooms/availability?arrival=2026-10-01&departure=2026-10-04&guests=2';

// Даты в полях — как на машине владельца (ru), а не en-US хрома CI
test.use({ locale: 'ru-RU' });

for (const theme of ['light', 'dark'] as const) {
  test(`витрина AV1: ${theme}`, async ({ page, request }) => {
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
