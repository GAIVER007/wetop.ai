import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { build, ROOT } from './build-tokens';

/**
 * Каждая `var(--…)` в CSS и TSX стойки должна быть токеном из design/tokens.json
 * или локальной переменной, объявленной в том же коде (`--dot` бейджа, `--min` сетки, ширины колонок шахматки).
 * Печатные формы не трогаем (план, §3.1), но переменные у них те же.
 */
const WEB = resolve(ROOT, 'apps/web/src');
const files = readdirSync(WEB, { recursive: true, encoding: 'utf8' })
  .filter((f) => /\.(css|tsx)$/.test(f) && !f.includes('.test.'))
  .map((f) => resolve(WEB, f));

describe('переменные CSS стойки', () => {
  const tokenVars = new Set([...build().css.matchAll(/^\s+--([a-z0-9-]+):/gm)].map((m) => m[1]!));
  const localVars = new Set<string>();
  const used = new Map<string, string>();
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/(?:^|[\s{;])--([a-z0-9-]+)\s*:/gm)) localVars.add(m[1]!);
    for (const m of text.matchAll(/['"]--([a-z0-9-]+)['"]\s*:/g)) localVars.add(m[1]!);
    for (const m of text.matchAll(/var\(--([a-z0-9-]+)/g)) used.set(m[1]!, file.slice(ROOT.length + 1));
  }
  it('используются только токены или локально объявленные переменные', () => {
    const unknown = [...used].filter(([name]) => !name.endsWith('-') && !tokenVars.has(name) && !localVars.has(name));
    expect(unknown, unknown.map(([n, f]) => `--${n} в ${f}`).join('\n')).toEqual([]);
  });
  it('в токенах есть каждая переменная, которую код берёт из tokens.css', () => {
    for (const name of ['bg', 'surface', 'text', 'primary', 'st-confirmed', 'radius', 'space-4', 'font', 'shadow'])
      expect(tokenVars.has(name), `--${name}`).toBe(true);
  });
});
