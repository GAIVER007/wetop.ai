import { describe, expect, it } from 'vitest';
import {
  ALLOWED_BREAKPOINTS,
  LAYER_CONTRACT,
  RULES,
  findOrphans,
  withoutAllowed,
} from './design-slop-rules';

/**
 * Сторожа MV8.5 DS0a на подложенных образцах (план `plans/mv8-5-ds0a-foundation-guards-2026-10-07.md` §2).
 * Храповик против живого кода живёт в `design-slop.test.ts`; здесь доказывается, что каждое правило
 * ловит нарушение и пропускает разрешённое, иначе снимок держал бы пустое правило.
 */
const rule = (id: string) => {
  const r = RULES.find((x) => x.id === id);
  expect(r, `правило ${id}`).toBeDefined();
  return r!;
};
const hits = (id: string, src: string, file = 'apps/web/src/app/x/sample.css') => rule(id).find(src, file);

describe('font-literal: размер шрифта только через --text-*', () => {
  it('ловит px, rem, em и число в CSS и TSX', () => {
    expect(hits('font-literal', '.a { font-size: 14px; }')).toBe(1);
    expect(hits('font-literal', '.a { font-size: 0.875rem; }')).toBe(1);
    expect(hits('font-literal', '.a { font-size: 1.2em; }')).toBe(1);
    expect(hits('font-literal', '<p style={{ fontSize: 13 }} />', 'x.tsx')).toBe(1);
    expect(hits('font-literal', "<p style={{ fontSize: '15px' }} />", 'x.tsx')).toBe(1);
  });
  it('пропускает токен и inherit', () => {
    expect(hits('font-literal', '.a { font-size: var(--text-sm); } .b { font-size: inherit; }')).toBe(0);
    expect(hits('font-literal', "<p style={{ fontSize: 'var(--text-xs)' }} />", 'x.tsx')).toBe(0);
  });
});

describe('space-literal-not-var: отступ только через --space-*', () => {
  it('ловит литерал даже на шкале', () => {
    expect(hits('space-literal-not-var', '.a { padding: 8px 16px; }')).toBe(2);
    expect(hits('space-literal-not-var', '.a { margin-top: -4px; gap: 1rem; }')).toBe(2);
  });
  it('пропускает 0, auto и токены', () => {
    expect(hits('space-literal-not-var', '.a { padding: 0 var(--space-2); margin: 0 auto; gap: 0px; }')).toBe(0);
  });
});

describe('inline-style: style={…} в TSX', () => {
  it('ловит каждый style=', () => {
    expect(hits('inline-style', '<div style={{ marginTop: 8 }} /><i style={s} />', 'x.tsx')).toBe(2);
  });
  it('не смотрит в CSS', () => {
    expect(rule('inline-style').ext.test('x.css')).toBe(false);
  });
});

describe('breakpoint-literal: только шесть утверждённых литералов', () => {
  it('список утверждён владельцем 07.10', () => {
    expect([...ALLOWED_BREAKPOINTS]).toEqual([
      'max-width: 600px',
      'min-width: 601px',
      'max-width: 960px',
      'min-width: 961px',
      'max-width: 1279px',
      'min-width: 1280px',
    ]);
  });
  it('пропускает утверждённые пары, в том числе без пробела, и печать', () => {
    const ok = ALLOWED_BREAKPOINTS.map((b) => `@media (${b}) { .a { color: red } }`).join('\n');
    expect(hits('breakpoint-literal', ok)).toBe(0);
    expect(hits('breakpoint-literal', '@media (max-width:600px) { .a {} } @media print { .b {} }')).toBe(0);
    expect(
      hits('breakpoint-literal', '@media (min-width: 601px) and (max-width: 960px) { .a {} }'),
    ).toBe(0);
  });
  it('ловит новый долг: 599, 768, 1024, 1200, rem, var() и диапазоны', () => {
    expect(hits('breakpoint-literal', '@media (max-width: 599px) {}')).toBe(1);
    expect(hits('breakpoint-literal', '@media (min-width: 768px) and (max-width: 1024px) {}')).toBe(2);
    expect(hits('breakpoint-literal', '@media (max-width: 1200px) {}')).toBe(1);
    expect(hits('breakpoint-literal', '@media (max-width: 40rem) {}')).toBe(1);
    expect(hits('breakpoint-literal', '@media (max-width: var(--bp-sm)) {}')).toBe(1);
    expect(hits('breakpoint-literal', '@media (width <= 600px) {}')).toBe(1);
  });
  it('смотрит и matchMedia в TSX', () => {
    expect(hits('breakpoint-literal', "matchMedia('(max-width: 600px)')", 'x.tsx')).toBe(0);
    expect(hits('breakpoint-literal', "matchMedia('(max-width: 700px)')", 'x.tsx')).toBe(1);
  });
});

describe('layer-name: только слои договора', () => {
  it('договор DESIGN.md §20.6', () => {
    expect([...LAYER_CONTRACT]).toEqual(['reset', 'tokens', 'base', 'components', 'sections', 'utilities']);
  });
  it('пропускает слои договора и ловит чужие', () => {
    expect(hits('layer-name', '@layer reset, tokens, base, components, sections, utilities;')).toBe(0);
    expect(hits('layer-name', '@layer components { .btn {} }')).toBe(0);
    expect(hits('layer-name', '@layer overrides { .btn {} } @layer base, hacks;')).toBe(2);
  });
});

describe('orphan-module: .tsx, который никто не импортирует', () => {
  const files = {
    'app/today/page.tsx': "import { A } from './a';\nimport('./lazy');",
    'app/today/a.tsx': "export { B } from '../../components/b';",
    'components/b.tsx': 'export const B = 1;',
    'app/today/lazy.tsx': 'export default 1;',
    'app/today/dead.tsx': 'export const Dead = 1;',
    'app/today/loading.tsx': 'export default 1;',
    'components/alias-user.tsx': "import { C } from '@/components/c';",
    'components/c.tsx': 'export const C = 1;',
    'lib/util.ts': 'export const u = 1;',
  };
  it('находит только настоящую сироту', () => {
    expect(findOrphans(files)).toEqual(['app/today/dead.tsx', 'components/alias-user.tsx']);
  });
});

describe('slop-allow: исключение только для названного правила и с причиной', () => {
  it('убирает строку для своего правила, если есть причина', () => {
    const line = "<i style={{ left }} /* slop-allow: inline-style позиция плашки из данных */ />";
    expect(withoutAllowed(line, 'inline-style')).toBe('');
    expect(withoutAllowed(line, 'font-literal')).toBe(line);
  });
  it('без причины или без имени правила не исключает', () => {
    for (const line of ['<i style={{ left }} /* slop-allow */ />', '<i style={{ left }} /* slop-allow: inline-style */ />'])
      expect(withoutAllowed(line, 'inline-style')).toBe(line);
  });
});
