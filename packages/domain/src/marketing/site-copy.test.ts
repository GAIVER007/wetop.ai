import { describe, expect, it } from 'vitest';
import { SITE_COPY_COUNT, siteCopySuggestion } from './site-copy';

/** «Предложить текст»: сильные тексты по направлению, с названием филиала, по кругу, в пределах полей SiteSpec */
describe('готовые продающие тексты сайта', () => {
  const verticals = ['BEAUTY', 'HOSPITALITY', 'FOOD_SERVICE'] as const;

  it('у каждого направления не меньше трёх разных вариантов', () => {
    for (const v of verticals) {
      expect(SITE_COPY_COUNT(v)).toBeGreaterThanOrEqual(3);
      const headings = new Set(Array.from({ length: SITE_COPY_COUNT(v) }, (_, i) => siteCopySuggestion(v, i, 'Тест').heading));
      expect(headings.size).toBe(SITE_COPY_COUNT(v));
    }
  });

  it('название филиала подставляется, варианты идут по кругу', () => {
    const a = siteCopySuggestion('BEAUTY', 0, 'Студия Айна');
    expect(a.about).toContain('Студия Айна');
    expect(a.about).not.toContain('{name}');
    expect(siteCopySuggestion('BEAUTY', SITE_COPY_COUNT('BEAUTY'), 'Студия Айна')).toEqual(a);
    expect(siteCopySuggestion('BEAUTY', -1, 'X')).toEqual(siteCopySuggestion('BEAUTY', SITE_COPY_COUNT('BEAUTY') - 1, 'X'));
  });

  it('влезают в пределы SiteSpec: заголовок 80, подзаголовок 200, абзац 600; без длинного тире', () => {
    for (const v of verticals)
      for (let i = 0; i < SITE_COPY_COUNT(v); i += 1) {
        const c = siteCopySuggestion(v, i, 'Очень длинное название филиала для проверки');
        expect(c.heading.length).toBeLessThanOrEqual(80);
        expect(c.subheading.length).toBeLessThanOrEqual(200);
        for (const p of c.about.split('\n\n')) expect(p.length).toBeLessThanOrEqual(600);
        expect(JSON.stringify(c)).not.toContain('\u2014');
      }
  });
});
