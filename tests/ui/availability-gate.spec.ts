import { test, expect } from '@playwright/test';

/**
 * Витрина шагов «Свободных мест» для визуального подтверждения владельца (ТЗ — ADR-110,
 * `plans/tz-availability-2026-09-27.md` §10): light/dark снимки экрана на подставном API.
 * AV1 — `reports/availability-av1-2026-09-27/` (подтверждён 28.09), AV2 (цены «от») —
 * `reports/availability-av2-2026-09-28/` (владелец — «давай продолжай» 28.09); AV3 (места и форма брони) — папка ниже.
 */
const DIR = 'reports/availability-av3-2026-09-28';
const URL = '/rooms/availability?arrival=2026-10-01&departure=2026-10-04&guests=2';

// Даты в полях — как на машине владельца (ru), а не en-US хрома CI
test.use({ locale: 'ru-RU' });

for (const theme of ['light', 'dark'] as const) {
  test(`витрина AV3: ${theme}`, async ({ page, request }) => {
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
    const rows = page.locator('.fund-availability article');
    // номер: список мест и «Выбрать автоматически»
    await rows.filter({ hasText: 'Двухместный номер' }).getByText('Показать номера').click();
    await page.screenshot({ path: `${DIR}/room-units-${theme}.png`, fullPage: true });
    // койки на двоих: одна отмечена, вторую назначит система
    await page.goto(URL);
    const bed = rows.filter({ hasText: 'Мужской общий номер' });
    await bed.getByText('Показать места').click();
    await bed
      .getByRole('button', { name: /^Выбрать койку / })
      .first()
      .click();
    await expect(bed.getByRole('status')).toBeVisible();
    await page.screenshot({ path: `${DIR}/beds-picked-${theme}.png`, fullPage: true });
    // форма брони открывается заполненной; снимок — страницей по той же ссылке (панель поверх экрана
    // целиком не снимается)
    const href = await bed
      .getByRole('link', { name: 'Создать бронь', exact: true })
      .getAttribute('href');
    await page.goto(href!);
    await expect(page.getByTestId('placement-fields')).toHaveCount(2);
    await page.screenshot({ path: `${DIR}/booking-prefilled-${theme}.png`, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(URL);
    await rows.filter({ hasText: 'Мужской общий номер' }).getByText('Показать места').click();
    // снимок всей страницы — от начала: после прокрутки шапка и нижнее меню встают посреди кадра
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `${DIR}/mobile-${theme}.png`, fullPage: true });
  });
}
