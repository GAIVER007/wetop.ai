import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss from 'postcss';
import { expect, it } from 'vitest';
const root = resolve(import.meta.dirname, '../..');
const css = postcss.parse(
  readFileSync(resolve(root, 'apps/web/src/components/primitives.css'), 'utf8'),
);

it('flat surfaces are owned by components and the obsolete glass override is removed', () => {
  expect(existsSync(resolve(root, 'apps/web/src/app/glass.css'))).toBe(false);
  const design = readFileSync(resolve(root, 'DESIGN.md'), 'utf8');
  const list = /## 20\.3[\s\S]*?```\n([\s\S]*?)```/.exec(design)?.[1];
  expect(list).toBeTruthy();
  for (const selector of list!.trim().split(/\s+/)) {
    const rules: postcss.Rule[] = [];
    css.walkRules((rule) => {
      if (rule.selectors.includes(selector)) rules.push(rule);
    });
    expect(rules.length, selector).toBeGreaterThan(0);
    const declarations = Object.fromEntries(
      rules.flatMap((rule) =>
        rule.nodes
          .filter((node): node is postcss.Declaration => node.type === 'decl')
          .map((node) => [node.prop, node.value]),
      ),
    );
    expect(declarations['background'], selector).toBe('var(--surface-solid)');
    expect(declarations['box-shadow'], selector).toBe('none');
    expect(declarations['backdrop-filter'], selector).toBe('none');
    expect(declarations['background-image'], selector).toBe('none');
  }
});

it('decorative body layers stay disabled and sticky table headers remain opaque', () => {
  const globals = readFileSync(resolve(root, 'apps/web/src/app/globals.css'), 'utf8');
  expect(globals).toMatch(/body::before,\s*body::after\s*\{[^}]*content:\s*none/);
  for (const selector of ['.board', '.board thead th', '.board td.board__unit', '.tbl thead th']) {
    let opaque = false;
    css.walkRules((rule) => {
      if (rule.selectors.includes(selector))
        rule.walkDecls('background', (d) => {
          opaque ||= d.value === 'var(--surface-solid)';
        });
    });
    expect(opaque, selector).toBe(true);
  }
});
