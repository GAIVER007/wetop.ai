import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { applyDesignDirection, decodeDesignInstruction, encodeDesignInstruction } from './builder';
import {
  DESIGN_PRESETS,
  designPresetById,
  designPresetDirection,
  designTripleCount,
  pickDesignTriple,
} from './design-presets';
import { SITE_SPEC_SECTIONS, SITE_SPEC_THEME, validateSiteSpec } from './site-spec';

const SPEC = JSON.parse(readFileSync(resolve(__dirname, '../../../../docs/marketing/sitespec-v0.example.json'), 'utf8'));
const key = (theme: Record<string, string>) => Object.values(theme).join('/');

describe('готовые направления оформления (SITE-1)', () => {
  it('не меньше девяти, id без повторов, тема из словарей SiteSpec v0', () => {
    expect(DESIGN_PRESETS.length).toBeGreaterThanOrEqual(9);
    expect(new Set(DESIGN_PRESETS.map((p) => p.id)).size).toBe(DESIGN_PRESETS.length);
    for (const p of DESIGN_PRESETS) {
      for (const [k, allowed] of Object.entries(SITE_SPEC_THEME))
        expect(allowed, `${p.id}.${k}`).toContain((p.theme as unknown as Record<string, string>)[k]);
      expect(SITE_SPEC_SECTIONS['hero']).toContain(p.heroVariant);
      for (const t of p.sectionOrder) expect(Object.keys(SITE_SPEC_SECTIONS)).toContain(t);
      expect(new Set(p.sectionOrder).size).toBe(p.sectionOrder.length);
    }
  });

  it('темы заметно разные: ни одной одинаковой пары темы', () => {
    expect(new Set(DESIGN_PRESETS.map((p) => key(p.theme as unknown as Record<string, string>))).size).toBe(DESIGN_PRESETS.length);
  });

  it('проходит ту же проверку, что ответ ИИ: конверт первой сборки кодируется и читается без потерь', () => {
    for (const p of DESIGN_PRESETS) {
      const direction = designPresetDirection(p);
      expect(Object.keys(direction).sort()).toEqual(['heroVariant', 'id', 'name', 'sectionOrder', 'shortDescription', 'theme']);
      expect(decodeDesignInstruction(encodeDesignInstruction(direction, 'Акцент на тишину'))).toEqual({ design: direction, text: 'Акцент на тишину' });
    }
  });

  it('применённое направление оставляет документ валидным', () => {
    for (const p of DESIGN_PRESETS) {
      const next = applyDesignDirection(SPEC, designPresetDirection(p));
      expect(validateSiteSpec(next).ok, p.id).toBe(true);
      expect(next['theme']).toEqual(p.theme);
    }
  });

  it('по id находит своё направление; чужое и не строка: null', () => {
    expect(designPresetById('deep-premium')?.name).toBe('Глубокий премиум');
    expect(designPresetById('nope')).toBeNull();
    expect(designPresetById(5)).toBeNull();
    expect(designPresetById(undefined)).toBeNull();
  });
});

describe('pickDesignTriple: три разных и «Другие варианты»', () => {
  it.each(['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE'])('%s: в тройке светлое, глубокое и тёплое, разные пресеты', (vertical) => {
    for (let page = 0; page < 6; page++) {
      const triple = pickDesignTriple(vertical, page);
      expect(triple.map((p) => p.family)).toEqual(['LIGHT', 'DEEP', 'WARM']);
      expect(new Set(triple.map((p) => p.id)).size).toBe(3);
    }
  });

  it('листание даёт новые тройки, пока не пройдёт весь набор, затем по кругу', () => {
    const n = designTripleCount();
    const seen = new Set<string>();
    for (let page = 0; page < n; page++) for (const p of pickDesignTriple('HOSPITALITY', page)) seen.add(p.id);
    expect(seen.size).toBe(DESIGN_PRESETS.length);
    expect(pickDesignTriple('HOSPITALITY', n).map((p) => p.id)).toEqual(pickDesignTriple('HOSPITALITY', 0).map((p) => p.id));
  });

  it('детерминированно; направления начинают с разных троек; отрицательная и дробная страница не ломают', () => {
    expect(pickDesignTriple('BEAUTY', 1)).toEqual(pickDesignTriple('BEAUTY', 1));
    expect(pickDesignTriple('BEAUTY', 0).map((p) => p.id)).not.toEqual(pickDesignTriple('HOSPITALITY', 0).map((p) => p.id));
    expect(pickDesignTriple(null, -1)).toHaveLength(3);
    expect(pickDesignTriple('X', 1.7).map((p) => p.id)).toEqual(pickDesignTriple('HOSPITALITY', 1).map((p) => p.id));
    expect(pickDesignTriple('HOSPITALITY', Number.NaN)).toHaveLength(3);
  });
});
