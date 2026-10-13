import { expect, test } from '@playwright/test';

/*
 * Блок «Маркетинг и ИИ» на лендингах направлений (11.10.2026). Правило §19.9: живые карточки только о том,
 * что есть в продукте; ИИ-продавец, сайт с ИИ и анализ конкурентов есть только у гостиниц, у салонов и
 * ресторанов сохраняется data-soon. По согласованному дизайну видимый бейдж убран.
 */
const PAGES = [
  { path: '/for/hotels/', soon: 1 },
  { path: '/for/hostels/', soon: 1 },
  { path: '/for/mini-hotels/', soon: 1 },
  { path: '/for/apart-hotels/', soon: 1 },
  { path: '/for/salons/', soon: 3 },
  { path: '/for/beauty-salons/', soon: 3 },
  { path: '/for/barbershops/', soon: 3 },
  { path: '/for/spa/', soon: 3 },
  { path: '/for/nail-studios/', soon: 3 },
  { path: '/for/cafes/', soon: 3 },
  { path: '/for/bars/', soon: 3 },
  { path: '/for/restaurants/', soon: 3 },
];

for (const page of PAGES) {
  test(`${page.path}: блок «Маркетинг и ИИ», карточки сохраняют статус без бейджей`, async ({ page: p }) => {
    await p.goto(page.path);
    const block = p.locator('#marketing');
    await expect(block).toContainText('Маркетинг и ИИ');
    await expect(block.locator('.card')).toHaveCount(6);
    const soon = block.locator('.card[data-soon]');
    await expect(soon).toHaveCount(page.soon);
    await expect(block.locator('.tag')).toHaveCount(0);
    await expect(block).not.toContainText('Скоро');
    const live = await block.locator('.card:not([data-soon])').allInnerTexts();
    expect(live.join(' ')).toMatch(/Отчётность за каждый день/);
    if (page.soon > 1) {
      // у салона и ресторана нет ИИ-продавца, сайта с ИИ и загрузки конкурентов (только гостиницы)
      expect(live.join(' ')).not.toMatch(/ИИ-продавец|Сайт с ИИ|конкурент/i);
    } else {
      expect(live.join(' ')).toMatch(/ИИ-продавец/);
      expect(live.join(' ')).toMatch(/Анализ конкурентов/);
      await expect(block).toContainText('подключаются к объекту отдельно');
    }
    expect(await block.innerText()).not.toContain('—');
  });
}
