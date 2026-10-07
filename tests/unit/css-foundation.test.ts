import { readFileSync, readdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const src = resolve(root, 'apps/web/src');
const files = readdirSync(src, { recursive: true })
  .map(String)
  .filter((name) => name.endsWith('.css') && !/(?:^|\/)(?:print|design-system)\//.test(name));
const sheets = files.map((file) => ({
  file,
  css: postcss.parse(readFileSync(resolve(src, file), 'utf8')),
}));

describe('DS0b: one owner for each base primitive', () => {
  for (const selector of [
    '.btn',
    '.panel',
    '.stat',
    '.tbl',
    '.page__title',
    '.seg',
    '.badge',
    '.stat__value',
  ]) {
    it(`${selector} has one unconditional definition`, () => {
      const owners: string[] = [];
      for (const { file, css } of sheets) {
        css.walkRules((rule) => {
          if (!rule.selectors.includes(selector)) return;
          let parent = rule.parent;
          while (parent && parent.type !== 'root') {
            if (parent.type === 'atrule' && parent.name !== 'layer') return;
            parent = parent.parent;
          }
          owners.push(`${relative(root, resolve(src, file))}:${rule.source?.start?.line}`);
        });
      }
      expect(owners, selector).toHaveLength(1);
      expect(owners[0]).toMatch(/^apps\/web\/src\/components\/primitives.css:/);
    });
  }
});

it('runtime selectors participate in the cascade and important is restricted to documented utilities', () => {
  let important = 0;
  for (const { file, css } of sheets) {
    if (file === 'app/tokens.css') continue; // Imported with layer(tokens) by globals.css.
    expect(css.first?.toString(), file).toBe(
      '@layer reset, tokens, base, components, sections, utilities',
    );
    css.walkRules((rule) => {
      let parent = rule.parent;
      while (parent && parent.type !== 'root' && !(parent.type === 'atrule' && parent.name === 'layer'))
        parent = parent.parent;
      expect(parent?.type, `${file}: ${rule.selector}`).toBe('atrule');
    });
    css.walkDecls((decl) => {
      if (!decl.important) return;
      important++;
      let parent = decl.parent;
      while (parent && parent.type !== 'root' && !(parent.type === 'atrule' && parent.name === 'layer'))
        parent = parent.parent;
      expect(parent && 'params' in parent ? parent.params : null).toBe('utilities');
      expect(decl.next()?.type).toBe('comment');
      expect(decl.next()?.toString()).toMatch(/slop-allow: important \w+/);
    });
  }
  expect(important).toBeLessThanOrEqual(5);
});

it('the root establishes layer precedence and does not globally import route styles', () => {
  const globals = readFileSync(resolve(src, 'app/globals.css'), 'utf8');
  expect(globals).toMatch(/^@layer reset, tokens, base, components, sections, utilities;/);
  expect(globals).toMatch(/@import ["']\.\/tokens.css["'] layer\(tokens\)/);
  const layout = readFileSync(resolve(src, 'app/layout.tsx'), 'utf8');
  for (const route of [
    'today/desk.css',
    'today/dashboard.css',
    'management/hotel.css',
    'hotel-settings/settings.css',
    'control.css',
    'glass.css',
  ]) {
    expect(layout).not.toContain(route);
  }
});
