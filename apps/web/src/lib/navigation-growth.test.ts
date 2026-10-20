import { describe, expect, it } from 'vitest';
import { CLOSED_ACCESS, menuSectionsFor } from './navigation';
const owner = { ...CLOSED_ACCESS, role: 'OWNER' as const };
describe('Продажи и маркетинг всех направлений', () => {
  for (const vertical of ['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE'] as const) {
    // с верхним меню 17.10.2026 «Продажи» и «Маркетинг» один раздел «Продвижение»
    it(`${vertical}: продажи и маркетинг в «Продвижении»`, () => {
      const sections = menuSectionsFor(owner, vertical);
      expect(sections.find((s) => s.id === 'sales')).toBeUndefined();
      expect(sections.find((s) => s.id === 'marketing')?.items.map((i) => i.href)).toEqual(
        expect.arrayContaining(['/marketing', '/sales', '/ai-agents']),
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
