import { test, expect } from '@playwright/test';
import { FIXTURE_API } from './fixtures';

/**
 * Витрина шагов «Свободных мест» для визуального подтверждения владельца (ТЗ — ADR-110,
 * `plans/tz-availability-2026-09-27.md` §10): light/dark снимки экрана на подставном API.
 * AV1–AV3 — `reports/availability-av{1,2,3}-…/` (подтверждены владельцем, AV2–AV3 влиты в `main` 28.09);
 * AV4 (категории без мест с ближайшей доступностью) — папка ниже.
 */
const DIR = 'reports/availability-av4-2026-09-29';
const URL = '/rooms/availability?arrival=2026-10-01&departure=2026-10-04&guests=2';
const FIXTURE = FIXTURE_API;

// Даты в полях — как на машине владельца (ru), а не en-US хрома CI
test.use({ locale: 'ru-RU' });

for (const theme of ['light', 'dark'] as const) {
  test(`витрина AV4: ${theme}`, async ({ page, request }) => {
    await request.post(`${FIXTURE}/__test/reset`);
    // все двухместные закрыты на 1–4 октября — категория вмещает двоих, но мест нет
    for (let i = 1; i <= 16; i += 1)
      await request.post(`${FIXTURE}/units/R${String(i).padStart(2, '0')}/blocks`, {
        headers: { 'x-wetop-test-client': '1' },
        data: { dateFrom: '2026-10-01', dateTo: '2026-10-04', type: 'MAINTENANCE', reason: 'AV4' },
      });
    await page.addInitScript((t) => localStorage.setItem('wetop.theme', t), theme);
    // Оверлей next dev («N Issues») — шум дев-сборки, к экрану не относится
    await page.addInitScript(() => {
      const style = document.createElement('style');
      style.textContent = 'nextjs-portal { display: none !important; }';
      document.addEventListener('DOMContentLoaded', () => document.head.append(style));
    });
    await page.goto(URL);
    await expect(page.getByRole('region', { name: 'Нет мест на эти даты' })).toBeVisible();
    await page.screenshot({ path: `${DIR}/nearest-${theme}.png`, fullPage: true });
    // сорок гостей: коек не хватит ни в какой день из четырнадцати
    await page.goto(URL.replace('guests=2', 'guests=40'));
    await expect(page.getByText('Нет мест в ближайшие 14 дней').first()).toBeVisible();
    await page.screenshot({ path: `${DIR}/none-in-14-days-${theme}.png`, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(URL);
    await expect(page.getByRole('region', { name: 'Нет мест на эти даты' })).toBeVisible();
    await page.screenshot({ path: `${DIR}/mobile-${theme}.png`, fullPage: true });
  });
}
