import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
const root = resolve(import.meta.dirname, '../..');
const css = readFileSync(resolve(root, 'apps/web/src/app/glass.css'), 'utf8');
it('shared surfaces have no decorative gradients, white inset rim or blur', () => {
  expect(css).not.toMatch(/(?:radial|linear)-gradient\(/);
  expect(css).not.toMatch(/inset\s+0\s+1px/);
  expect(css).not.toMatch(/backdrop-filter:\s*blur/);
  expect(css).toMatch(/body::before,\s*body::after\s*\{[^}]*content:\s*none/);
});
it('all documented shared surfaces get the flat treatment', () => {
  const design = readFileSync(resolve(root, 'DESIGN.md'), 'utf8');
  const list = /## 20\.3[\s\S]*?```\n([\s\S]*?)```/.exec(design)?.[1];
  expect(list).toBeTruthy();
  const documented = [...list!.matchAll(/\.[a-z0-9_-]+/g)].map(m => m[0]).sort();
  const rule = /\/\* Shared surfaces \*\/([^{]+)\{([^}]+)\}/.exec(css);
  expect(rule).not.toBeNull();
  expect([...rule![1]!.matchAll(/\.[a-z0-9_-]+/g)].map(m => m[0]).sort()).toEqual(documented);
  expect(rule![2]).toContain('box-shadow: none');
  expect(rule![2]).toContain('var(--surface-solid)');
});
it('board and sticky table headers remain opaque', () => {
  const solid = /\.board,[\s\S]*?\{([\s\S]*?)\}/.exec(css)?.[1] ?? '';
  expect(solid).toContain('var(--surface-solid)');
  for (const selector of ['.board', '.board thead th', '.tbl', '.tbl thead th']) expect(css).toContain(selector);
});
