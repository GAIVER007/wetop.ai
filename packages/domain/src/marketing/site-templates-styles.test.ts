import { describe, expect, it } from 'vitest';
import { siteTemplatesFor } from './site-templates';

/**
 * Владелец 28.10.2026: «3 шаблона, а бизнесов 100, и у всех одинаковый сайт». У каждого направления три шаблона
 * разного характера: тёмная роскошь, яркий поп и эко-минимал, с разными фоном, акцентом и шрифтом.
 */
describe('три шаблона направления разного характера', () => {
  for (const vertical of ['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE']) {
    it(vertical, () => {
      const themes = siteTemplatesFor(vertical).map((t) => t.direction.theme);
      expect(themes.map((t) => t.typography).sort()).toEqual(['BOLD', 'CLEAN', 'LUXE']);
      expect(themes.map((t) => t.preset).sort()).toEqual(['NOIR', 'PEACH', 'SAGE']);
      expect(new Set(themes.map((t) => t.accent)).size).toBe(3);
      expect(themes.filter((t) => t.colorScheme === 'DARK')).toHaveLength(1);
    });
  }
});
