import { describe, expect, it } from 'vitest';
import { ACCENTS, PRESETS, themeClasses } from './theme';

/** WCAG 2.x: относительная яркость и контраст; AA для обычного текста 4,5:1 */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x! + 0.05) / (y! + 0.05);
};

describe('контраст каждого пресета и акцента (SiteSpec v0 §5): WCAG AA 4,5:1', () => {
  for (const [preset, p] of Object.entries(PRESETS))
    for (const [accent, a] of Object.entries(ACCENTS))
      it(`${preset} + ${accent}`, () => {
        const pairs: Array<[string, string, string]> = [
          ['текст на фоне', p.text, p.bg],
          ['текст на подложке', p.text, p.surface],
          ['вторичный текст на фоне', p.muted, p.bg],
          ['вторичный текст на подложке', p.muted, p.surface],
          ['ссылка на фоне', a.accent, p.bg],
          ['ссылка на подложке', a.accent, p.surface],
          ['текст кнопки', a.onAccent, a.accent],
        ];
        for (const [label, fg, bg] of pairs) expect(contrast(fg, bg), label).toBeGreaterThanOrEqual(4.5);
      });
});

describe('тема документа в классы', () => {
  const theme = { preset: 'CALM', accent: 'TEAL', typography: 'MODERN', radius: 'SOFT', density: 'COMFORTABLE', colorScheme: 'LIGHT' };
  it('значения из словарей', () => {
    expect(themeClasses(theme)).toBe('p-calm a-teal t-modern r-soft d-comfortable');
  });
  it.each([
    ['preset', 'NEON'],
    ['accent', '#ff0000'],
    ['colorScheme', 'DARK'],
    ['typography', 'Comic Sans'],
  ])('%s=%s: отказ', (field, value) => {
    expect(() => themeClasses({ ...theme, [field]: value })).toThrow();
  });
});
