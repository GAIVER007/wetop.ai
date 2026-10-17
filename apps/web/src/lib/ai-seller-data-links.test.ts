import { describe, expect, it } from 'vitest';
import { sellerDataLinks } from './ai-seller';

/** Откуда продавец берёт данные филиала: ссылки своего направления (аудит платформы 17.10.2026, Д11) */
describe('данные ИИ-продавца по направлению', () => {
  const hrefs = (v: Parameters<typeof sellerDataLinks>[0]) => sellerDataLinks(v).map((l) => l.href);
  it('гостиница: карточка объекта, категории номеров, тариф сайта', () => {
    expect(hrefs('HOSPITALITY')).toEqual(['/hotel-settings', '/rooms/categories', '/website/booking']);
  });
  it('салон и ресторан: ни одной гостиничной страницы', () => {
    for (const v of ['BEAUTY', 'FOOD_SERVICE'] as const) {
      expect(hrefs(v).length).toBeGreaterThan(0);
      expect(hrefs(v).filter((h) => /hotel-settings|rooms|website/.test(h))).toEqual([]);
    }
    expect(hrefs('BEAUTY')).toContain('/services');
    expect(hrefs('FOOD_SERVICE')).toContain('/menu');
  });
});
