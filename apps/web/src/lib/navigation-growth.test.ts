import { describe, expect, it } from 'vitest';
import { CLOSED_ACCESS, menuSectionsFor } from './navigation';
const owner = { ...CLOSED_ACCESS, role: 'OWNER' as const };
describe('Продажи и маркетинг всех направлений', () => {
  for (const vertical of ['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE'] as const) {
    it(`${vertical}: видит оба раздела`, () => {
      const sections = menuSectionsFor(owner, vertical);
      expect(sections.find((s) => s.id === 'sales')?.items.map((i) => i.href)).toContain('/sales');
      expect(sections.find((s) => s.id === 'marketing')?.items.map((i) => i.href)).toContain(
        '/marketing',
      );
    });
  }
  it('не добавляет гостиничные каналы салону и ресторану', () => {
    for (const vertical of ['BEAUTY', 'FOOD_SERVICE'] as const) {
      expect(
        menuSectionsFor(owner, vertical)
          .flatMap((s) => s.items)
          .map((i) => i.href),
      ).not.toContain('/channels');
    }
  });
});
