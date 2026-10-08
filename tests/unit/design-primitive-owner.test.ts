import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

/**
 * MV8.5 DS0b: у примитива один владелец (план `plans/mv8-5-ds0b-css-foundation-2026-10-07.md`, DESIGN.md §20.6).
 *
 * Определение примитива: правило, селектор которого начинается с класса примитива и не содержит
 * комбинатора (`.btn`, `.btn:hover`, `.btn--sm`, `.badge::before`). Такие правила живут только в
 * `components.css`, и каждый селектор там встречается один раз в своём медиазапросе. Раздел, которому
 * нужен другой вид, пишет свой класс или селектор с контекстом (`.board .btn`), а не второе `.btn`.
 */
export const PRIMITIVES = [
  'btn',
  'panel',
  'stat',
  'tbl',
  'page__title',
  'seg',
  'badge',
  'inp',
  'field',
  // MV8.5 DS1b (DESIGN.md §8.1): вкладки, чипы и полоса инструментов; `.seg` выше: переключатель
  'tabs',
  'chip',
  'toolbar',
];
const ROOT = resolve(import.meta.dirname, '../..');
const SRC = resolve(ROOT, 'apps/web/src');
const OWNER = 'apps/web/src/app/components.css';

export interface PrimitiveRule {
  file: string;
  context: string;
  selector: string;
  primitive: string;
}

/** Определения примитивов в одном файле CSS */
export function primitiveRules(css: string, file: string): PrimitiveRule[] {
  const out: PrimitiveRule[] = [];
  postcss.parse(css).walkRules((rule) => {
    let context = '';
    for (let p = rule.parent; p && p.type !== 'root'; p = p.parent) {
      const at = p as postcss.AtRule;
      if (at.name !== 'layer') context = `@${at.name} ${at.params} ${context}`;
    }
    for (const raw of rule.selectors) {
      const selector = raw.trim().replace(/\s+/g, ' ');
      if (/[\s>+~]/.test(selector)) continue;
      // блок, его модификатор `--` и элемент `__`; соседние имена (`.stats`, `.btn-group`) не считаются
      const primitive = PRIMITIVES.find((p) =>
        new RegExp(`^\\.${p}(?:(?:--|__)[\\w-]*)?(?![\\w-])`).test(selector),
      );
      // `.tbl.dir-table--stays`: класс раздела рядом с примитивом, это вариант раздела, а не примитив
      const classes = [
        ...selector.replace(/\[[^\]]*\]|:not\([^)]*\)/g, '').matchAll(/\.([\w-]+)/g),
      ].map((m) => m[1]!);
      const own = (c: string) =>
        /^(is|has)-/.test(c) ||
        PRIMITIVES.some((p) => new RegExp(`^${p}(?:(?:--|__)[\\w-]*)?$`).test(c));
      if (primitive && classes.every(own))
        out.push({ file, context: context.trim(), selector, primitive });
    }
  });
  return out;
}

/** Нарушения: определение вне владельца или повтор селектора в том же медиазапросе */
export function ownerViolations(rules: PrimitiveRule[], owner = OWNER): string[] {
  const seen = new Map<string, string>();
  const problems: string[] = [];
  for (const r of rules) {
    if (r.file !== owner)
      problems.push(
        `${r.file}: ${r.context} ${r.selector} (примитив .${r.primitive} вне ${owner})`,
      );
    const key = `${r.context}|${r.selector}`;
    if (seen.has(key)) problems.push(`${r.file}: ${r.context} ${r.selector} определён второй раз`);
    seen.set(key, r.file);
  }
  return problems;
}

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

describe('примитив определён один раз (DS0b)', () => {
  it('ловит второе определение и определение вне владельца на образце', () => {
    const owner = primitiveRules('.btn { color: red } .btn:hover { color: blue }', OWNER);
    const other = primitiveRules(
      '.btn { height: 30px } .board .btn { height: 20px } .tbl.dir-table { width: 0 }',
      'apps/web/src/app/x.css',
    );
    expect(other).toHaveLength(1);
    expect(ownerViolations([...owner, ...other])).toHaveLength(2);
    const twice = primitiveRules('.panel { padding: 0 } .stat { gap: 0 } .panel { gap: 0 }', OWNER);
    expect(ownerViolations(twice)).toEqual([`${OWNER}:  .panel определён второй раз`]);
  });

  it('медиазапрос и модификатор считаются своими селекторами, соседние классы нет', () => {
    const rules = primitiveRules(
      '.btn { a: 1 } @media (max-width: 600px) { .btn { a: 2 } } .btn--sm { a: 3 } .btn-group { a: 4 } .stats { a: 5 } .stat__value { a: 6 }',
      OWNER,
    );
    expect(rules.map((r) => r.selector)).toEqual(['.btn', '.btn', '.btn--sm', '.stat__value']);
    expect(ownerViolations(rules)).toEqual([]);
  });

  it('в живом коде стойки каждый примитив определён один раз и только в components.css', () => {
    const rules = walk(SRC)
      .filter((f) => f.endsWith('.css'))
      .flatMap((f) => primitiveRules(readFileSync(f, 'utf8'), relative(ROOT, f)));
    for (const p of PRIMITIVES)
      expect(
        rules.some((r) => r.selector === `.${p}`),
        `.${p} определён`,
      ).toBe(true);
    expect(ownerViolations(rules)).toEqual([]);
  });

  it('globals.css объявляет порядок слоёв первым: layout.tsx импортирует его до любого модуля', () => {
    // CSS, который компонент импортирует выше, объявил бы свой слой раньше и перевернул порядок слоёв
    const layout = readFileSync(join(SRC, 'app', 'layout.tsx'), 'utf8');
    const first = /^import\s+[^;]+;/m.exec(layout)?.[0];
    expect(first).toBe("import './globals.css';");
    const globals = readFileSync(join(SRC, 'app', 'globals.css'), 'utf8').replace(
      /\/\*[\s\S]*?\*\//g,
      '',
    );
    expect(
      globals
        .trimStart()
        .startsWith('@layer reset, tokens, base, components, sections, utilities;'),
    ).toBe(true);
  });
});
