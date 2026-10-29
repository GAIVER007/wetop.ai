import { describe, expect, it } from 'vitest';
import { FONT_FILES, fontPath, siteFontsCss } from './fonts';
import { ACCENTS, PRESETS, SITE_CSS, themeClasses } from './theme';

/**
 * Пилот «А · Тёмная роскошь» (28.10.2026): тёмный фон NOIR, светлые акценты и своя шрифтовая пара LUXE со своего
 * хоста (без Google Fonts: CSP `font-src 'self'`, никаких внешних запросов у посетителя сайта).
 */
describe('тёмная схема', () => {
  const dark = { preset: 'NOIR', accent: 'CHAMPAGNE', typography: 'LUXE', radius: 'SHARP', density: 'COMFORTABLE', colorScheme: 'DARK' };
  it('классы тёмной темы: s-dark и шрифт LUXE', () => {
    expect(themeClasses(dark)).toBe('p-noir a-champagne t-luxe r-sharp d-comfortable s-dark');
  });
  it('светлая тема по-прежнему без класса схемы', () => {
    expect(themeClasses({ ...dark, preset: 'CALM', accent: 'TEAL', typography: 'MODERN', colorScheme: 'LIGHT' })).toBe('p-calm a-teal t-modern r-sharp d-comfortable');
  });
  it('NOIR со светлой схемой рантайм не рисует', () => {
    expect(() => themeClasses({ ...dark, colorScheme: 'LIGHT' })).toThrow();
  });
  it('пресет и акценты тёмной схемы есть в словарях', () => {
    expect(PRESETS['NOIR']).toBeDefined();
    expect(ACCENTS['CHAMPAGNE']).toBeDefined();
    expect(ACCENTS['ROSE']).toBeDefined();
  });
});

describe('шрифты LUXE со своего хоста', () => {
  it('@font-face только на /_wetop/fonts/, кириллица и латиница, swap', () => {
    const css = siteFontsCss();
    expect(css).toContain("font-family:'Cormorant Garamond'");
    expect(css).toContain("font-family:'Jost'");
    expect(css).toContain('font-display:swap');
    expect(css).not.toMatch(/https?:\/\//);
    for (const f of Object.keys(FONT_FILES)) expect(css).toContain(fontPath(f));
    expect(SITE_CSS).toContain(css);
  });
  it('файлы шрифтов настоящие woff2', () => {
    for (const bytes of Object.values(FONT_FILES).map((f) => f.bytes())) expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe('wOF2');
  });
});

describe('первый экран на весь экран', () => {
  it('стили тёмной темы и варианта IMAGE_FULL в общем CSS', () => {
    expect(SITE_CSS).toContain('.s-dark');
    expect(SITE_CSS).toContain('.hero--image_full');
  });
});
