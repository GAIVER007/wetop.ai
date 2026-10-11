import { expect, test } from '@playwright/test';

/*
 * Ритм лендингов (11.10.2026, владелец: «отступы везде одинаково»): между соседними блоками `.landing`
 * одно и то же расстояние на компьютере и телефоне. Ловит блок, который принёс свой внешний отступ.
 */
const PAGES = [
  '/for/hotels/', '/for/salons/', '/for/restaurants/', '/for/hostels/', '/for/mini-hotels/',
  '/for/apart-hotels/', '/for/beauty-salons/', '/for/barbershops/', '/for/spa/', '/for/nail-studios/',
  '/for/cafes/', '/for/bars/',
];

for (const width of [1440, 390]) {
  test(`одинаковые отступы между блоками лендингов, ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const problems: string[] = [];
    for (const path of PAGES) {
      await page.goto(path);
      const gaps = await page.locator('.landing').evaluate((root) => {
        const boxes = [...root.children]
          .filter((el) => el.tagName !== 'SCRIPT')
          .map((el) => el.getBoundingClientRect());
        return boxes.slice(1).map((box, i) => Math.round(box.top - boxes[i]!.bottom));
      });
      if (gaps.length < 4) problems.push(`${path}: блоков меньше пяти`);
      const spread = Math.max(...gaps) - Math.min(...gaps);
      if (spread > 2) problems.push(`${path}: отступы ${gaps.join(', ')}`);
    }
    expect(problems).toEqual([]);
  });
}
