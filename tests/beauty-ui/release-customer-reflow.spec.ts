import { test, expect } from '../ui/fixtures';
// Регрессия приёмки 18.10 (release-acceptance-20261018, PR #669 закрыт без слияния): экран клиентов на 320 px
// при удвоенном шрифте не уходит вбок ни в светлой, ни в тёмной теме
import { seed, date } from './tz11-helpers';

for (const theme of ['light', 'dark'] as const) {
  test(`customer controls fit 320px at double text size ${theme}`, async ({ page, request }, testInfo) => {
    await seed(page, request);
    await page.setViewportSize({ width: 320, height: 844 });
    await page.emulateMedia({ colorScheme: theme });
    await page.goto(`/customers?date=${date}`);
    await page.evaluate(() => {
      for (const element of document.querySelectorAll<HTMLElement>('main h1, main .page__subtitle, main .btn, main .field > span, main .inp, main td, main .beauty-note, main summary')) {
        element.style.fontSize = `${parseFloat(getComputedStyle(element).fontSize) * 2}px`;
      }
    });
    const geometry = await page.evaluate(() => ({
      viewport: innerWidth,
      width: document.documentElement.scrollWidth,
      overflow: [...document.querySelectorAll<HTMLElement>('main, main *')].flatMap(element => {
        const rect = element.getBoundingClientRect();
        return rect.right > innerWidth + 1 ? [{ tag: element.tagName, class: element.className, x: rect.x, right: rect.right, width: rect.width, whiteSpace: getComputedStyle(element).whiteSpace, minWidth: getComputedStyle(element).minWidth }] : [];
      }),
    }));
    await testInfo.attach('geometry.json', { body: JSON.stringify(geometry), contentType: 'application/json' });
    await page.screenshot({ path: testInfo.outputPath(`customers-320-double-text-${theme}.png`), fullPage: true });
    expect(geometry.width, JSON.stringify(geometry)).toBeLessThanOrEqual(geometry.viewport);
    await expect(page.getByRole('button', { name: 'Добавить клиента', exact: true })).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Импортировать клиентов', exact: true })).toBeInViewport();
    await expect(page.getByRole('searchbox', { name: 'Поиск по имени или телефону', exact: true })).toBeInViewport();
  });
}
