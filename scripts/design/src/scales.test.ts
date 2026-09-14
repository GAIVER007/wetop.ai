import { describe, expect, it } from 'vitest';
import { contrastTable, flatten, resolveTree, type DimensionValue } from './tokens';
import { loadTokens } from './build-tokens';

const doc = loadTokens();
const tokens = flatten(resolveTree(doc, { theme: 'light', media: 'screen' }));

describe('шкалы документа ментора (DESIGN.md §3, §6)', () => {
  it('отступы только из шкалы 4, 8, 16, 24, 32, 40, 48, 64; вне шкалы — только с причиной снятия', () => {
    const scale = [4, 8, 16, 24, 32, 40, 48, 64];
    const spaces = tokens.filter((t) => t.path.startsWith('space.'));
    expect(spaces.length).toBeGreaterThanOrEqual(8);
    for (const t of spaces) {
      const px = (t.value as DimensionValue).value;
      if (scale.includes(px)) continue;
      expect(typeof t.deprecated, `--${t.name} = ${px}px вне шкалы без $deprecated с причиной`).toBe('string');
    }
  });
  it('размеры шрифта не мельче 12 px и составляют объявленную шкалу', () => {
    const sizes = tokens.filter((t) => t.path.startsWith('type.fs.')).map((t) => (t.value as DimensionValue).value);
    expect(sizes).toEqual([12, 13, 14, 16, 18, 22, 28]);
  });
  it('имена CSS-переменных не повторяются между группами', () => {
    const names = tokens.filter((t) => t.css).map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('контраст токенов в обеих темах (DESIGN.md §10)', () => {
  const rows = contrastTable(doc);
  it('каждая пара проходит норму или записана исключением с причиной и сроком', () => {
    const bad = rows.filter((r) => !r.ok && !r.excepted);
    expect(bad, bad.map((r) => `${r.theme}: --${r.fg} на --${r.bg} = ${r.ratio.toFixed(2)} < ${r.min}`).join('\n')).toEqual([]);
  });
  it('исключения не протухли: каждое всё ещё действительно не проходит', () => {
    const stale = rows.filter((r) => r.excepted && r.ok);
    expect(stale, stale.map((r) => `${r.theme}: --${r.fg} на --${r.bg} уже проходит — снять исключение`).join('\n')).toEqual([]);
  });
  it('контрастная тема проходит всё без исключений', () => {
    expect(rows.filter((r) => r.theme === 'contrast' && !r.ok)).toEqual([]);
  });
});
