import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  cssColor,
  cssValue,
  flatten,
  resolveTheme,
  resolveTree,
  renderTokensCss,
  type ResolverDocument,
  type Token,
} from './tokens';

/** Маленький документ по спецификации DTCG 2025.10 (Resolver Module): набор, модификатор, псевдонимы. */
const doc: ResolverDocument = {
  version: '2025.10',
  sets: {
    primitives: {
      sources: [
        {
          palette: {
            $type: 'color',
            $extensions: { 'ai.wetop': { css: false } },
            blue: { $value: { colorSpace: 'srgb', components: [0, 0.4, 0.8], hex: '#0066cc' } },
            white: { $value: { colorSpace: 'srgb', components: [1, 1, 1], hex: '#ffffff' } },
            ink: { $value: { colorSpace: 'srgb', components: [0, 0, 0], alpha: 0.5, hex: '#000000' } },
          },
        },
      ],
    },
    semantic: {
      sources: [
        {
          space: { $type: 'dimension', 'space-1': { $value: { value: 4, unit: 'px' } } },
          font: { $type: 'fontFamily', font: { $value: ['-apple-system', 'Inter', 'sans-serif'] } },
          motion: {
            $type: 'transition',
            ease: {
              $value: {
                duration: { value: 180, unit: 'ms' },
                delay: { value: 0, unit: 'ms' },
                timingFunction: [0, 0, 0.58, 1],
              },
            },
          },
        },
      ],
    },
    light: {
      sources: [
        {
          color: {
            $type: 'color',
            primary: { $value: '{palette.blue}' },
            surface: { $value: '{palette.white}' },
            info: { $value: '{color.primary}' },
          },
          elevation: {
            $type: 'shadow',
            shadow: {
              $value: {
                color: '{palette.ink}',
                offsetX: { value: 0, unit: 'px' },
                offsetY: { value: 6, unit: 'px' },
                blur: { value: 24, unit: 'px' },
                spread: { value: 0, unit: 'px' },
              },
            },
          },
        },
      ],
    },
    dark: {
      sources: [{ color: { $type: 'color', primary: { $value: '{palette.white}' } } }],
    },
  },
  modifiers: {
    theme: {
      default: 'light',
      contexts: { light: [{ $ref: '#/sets/light' }], dark: [{ $ref: '#/sets/light' }, { $ref: '#/sets/dark' }], contrast: [{ $ref: '#/sets/light' }] },
    },
    media: { default: 'screen', contexts: { screen: [], print: [{ color: { $type: 'color', surface: { $value: '{palette.white}' } } }] } },
  },
  resolutionOrder: [{ $ref: '#/sets/primitives' }, { $ref: '#/sets/semantic' }, { $ref: '#/modifiers/theme' }, { $ref: '#/modifiers/media' }],
};

describe('резолвер DTCG 2025.10', () => {
  it('сливает наборы по порядку, позднее значение побеждает', () => {
    const light = flatten(resolveTree(doc, { theme: 'light' }));
    const dark = flatten(resolveTree(doc, { theme: 'dark' }));
    expect(light.find((t) => t.path === 'color.primary')?.value).toBe('{palette.blue}');
    expect(dark.find((t) => t.path === 'color.primary')?.value).toBe('{palette.white}');
    expect(dark.find((t) => t.path === 'color.surface')?.value).toBe('{palette.white}');
  });
  it('отвергает неизвестный модификатор, неизвестный контекст и не ту версию', () => {
    expect(() => resolveTree(doc, { size: 'big' })).toThrow(/Неизвестный модификатор/);
    expect(() => resolveTree(doc, { theme: 'sepia' })).toThrow(/нет контекста/);
    expect(() => resolveTree({ ...doc, version: '2024.01' })).toThrow(/2025\.10/);
  });
  it('наследует $type от группы и не выпускает примитивы в CSS', () => {
    const tokens = flatten(resolveTree(doc, {}));
    expect(tokens.find((t) => t.path === 'palette.blue')).toMatchObject({ type: 'color', css: false });
    expect(tokens.find((t) => t.path === 'color.primary')).toMatchObject({ type: 'color', css: true, name: 'primary' });
  });
  it('требует $type у токена без группы с типом', () => {
    expect(() => flatten({ orphan: { $value: 1 } })).toThrow(/нет \$type/);
  });
});

describe('рендер CSS', () => {
  const light = resolveTheme(doc, { theme: 'light' });
  it('псевдоним на примитив даёт значение, на семантику — var(--имя)', () => {
    expect(light.vars.get('primary')).toBe('#0066cc');
    expect(light.vars.get('info')).toBe('var(--primary)');
  });
  it('цвет с альфой — rgba без ведущего нуля, как в прежнем tokens.css', () => {
    expect(cssColor({ colorSpace: 'srgb', components: [1, 1, 1], alpha: 0.88 })).toBe('rgba(255,255,255,.88)');
    expect(cssColor({ colorSpace: 'srgb', components: [0, 0.4, 0.8], hex: '#0066CC' })).toBe('#0066cc');
  });
  it('тень, шрифт, переход и размер рендерятся в прежнем виде', () => {
    expect(light.vars.get('shadow')).toBe('0 6px 24px rgba(0,0,0,.5)');
    expect(light.vars.get('font')).toBe("-apple-system, 'Inter', sans-serif");
    expect(light.vars.get('ease')).toBe('180ms cubic-bezier(0, 0, 0.58, 1)');
    expect(light.vars.get('space-1')).toBe('4px');
  });
  it('цикл псевдонимов и псевдоним в никуда — ошибка', () => {
    const tokens = new Map<string, Token>([
      ['a', { path: 'a', name: 'a', type: 'color', value: '{b}', css: true }],
      ['b', { path: 'b', name: 'b', type: 'color', value: '{a}', css: true }],
    ]);
    expect(() => cssValue(tokens, tokens.get('a')!)).toThrow(/Цикл/);
    const lonely = new Map<string, Token>([['a', { path: 'a', name: 'a', type: 'color', value: '{nope}', css: true }]]);
    expect(() => cssValue(lonely, lonely.get('a')!)).toThrow(/не найден/);
  });
  it('в тёмный и печатный блоки попадают только отличия от светлой темы', () => {
    const css = renderTokensCss(doc);
    expect(css).toContain(":root, [data-theme='light'] {\n  color-scheme: light;\n  --space-1: 4px;");
    const darkBlock = css.slice(css.indexOf("[data-theme='dark']"), css.indexOf("[data-theme='contrast']"));
    expect(darkBlock).toContain('--primary: #ffffff;');
    expect(darkBlock).not.toContain('--surface');
    expect(css).toContain('@media print {\n  :root {\n    color-scheme: light;\n  }\n}');
    expect(css.startsWith('/* Сгенерировано')).toBe(true);
  });
});

describe('контраст', () => {
  const c = (hex: string) => {
    const h = hex.slice(1);
    return { colorSpace: 'srgb' as const, components: [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number] };
  };
  it('чёрный на белом — 21:1, белый на белом — 1:1', () => {
    expect(contrastRatio(c('#000000'), c('#ffffff'))).toBeCloseTo(21, 1);
    expect(contrastRatio(c('#ffffff'), c('#ffffff'))).toBeCloseTo(1, 5);
  });
  it('полупрозрачный передний план смешивается с фоном', () => {
    const half = { ...c('#000000'), alpha: 0.5 };
    expect(contrastRatio(half, c('#ffffff'))).toBeLessThan(contrastRatio(c('#000000'), c('#ffffff')));
    expect(contrastRatio(half, c('#ffffff'))).toBeGreaterThan(3);
  });
});
