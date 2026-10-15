import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALLOWED_BREAKPOINTS, LAYER_CONTRACT } from './design-slop-rules';

/**
 * Утверждённая шкала стойки (MV8.5 DS0a, решения владельца 07.10.2026): отступы, размеры шрифта, радиусы,
 * точки перелома и слои каскада. Значения токенов живут в `design/tokens.json`, сюда попадают через
 * сгенерированный `tokens.css` (его сверяет с источником `build-tokens.test.ts`). Тест держит закрытый
 * список: новый размер шрифта или отступа без решения владельца даёт красный, а не тихий новый токен.
 */
const ROOT = resolve(import.meta.dirname, '../..');
const TOKENS = readFileSync(resolve(ROOT, 'apps/web/src/app/tokens.css'), 'utf8');
const DESIGN = readFileSync(resolve(ROOT, 'DESIGN.md'), 'utf8');

/** Значения первой (светлой) темы: `--name: 8px;` → { name: '8px' } */
function rootTokens(css: string): Record<string, string> {
  const block = /:root[^{]*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]));
}

/** Раздел DESIGN.md от заголовка до следующего заголовка того же уровня */
function section(title: RegExp): string {
  const start = DESIGN.search(title);
  expect(start, `раздел ${title}`).toBeGreaterThan(-1);
  const rest = DESIGN.slice(start);
  const next = rest.slice(1).search(/\n## /);
  return next === -1 ? rest : rest.slice(0, next + 1);
}

const SCALE = {
  space: ['4px', '8px', '16px', '24px', '32px', '40px', '48px', '64px'],
  text: ['13px', '14px', '15px', '17px', '19px', '22px', '26px', '30px'],
  radius: ['4px', '8px', '10px', '16px', '20px', '999px'],
};
const TEXT = ['text-xs', 'text-sm', 'text-md', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl', 'text-4xl'];
const RADIUS = ['radius-xs', 'radius-sm', 'radius-control', 'radius', 'radius-lg', 'radius-full'];

/** Расхождения шкалы в `tokens.css` с утверждённым списком; пустой список значит «совпадает» */
function scaleProblems(css: string): string[] {
  const t = rootTokens(css);
  const out: string[] = [];
  const space = Object.keys(t)
    .filter((n) => /^space-\d+$/.test(n))
    .map((n) => t[n]!)
    .sort((a, b) => parseFloat(a) - parseFloat(b));
  if (space.join() !== SCALE.space.join()) out.push(`отступы: ${space.join(', ')}`);
  const sizes = Object.keys(t).filter((n) => /^text-(?:xs|sm|md|lg|\d?xl)$/.test(n));
  if (sizes.length !== TEXT.length) out.push(`лишний размер шрифта: ${sizes.filter((n) => !TEXT.includes(n)).join(', ')}`);
  if (TEXT.map((n) => t[n]).join() !== SCALE.text.join()) out.push(`шрифт: ${TEXT.map((n) => t[n]).join(', ')}`);
  if (RADIUS.map((n) => t[n]).join() !== SCALE.radius.join()) out.push(`радиусы: ${RADIUS.map((n) => t[n]).join(', ')}`);
  return out;
}

describe('утверждённая шкала (DESIGN.md §4.1)', () => {
  it('tokens.css совпадает со шкалой: отступы 4…64, шрифт 13…30, радиусы 4…20 и круг', () => {
    expect(scaleProblems(TOKENS)).toEqual([]);
  });

  it('подменённый отступ, новый размер шрифта и чужой радиус ловятся', () => {
    const bad = TOKENS.replace('--space-2: 8px;', '--space-2: 12px;')
      .replace('--text-xs: 13px;', '--text-xs: 13px;\n  --text-5xl: 36px;')
      .replace('--radius-lg: 20px;', '--radius-lg: 24px;');
    expect(scaleProblems(bad)).toHaveLength(3);
  });

  it('шкала записана в DESIGN.md закрытым списком', () => {
    const scale = section(/\n### 4\.1\. Утверждённая шкала/);
    for (const line of [
      '4, 8, 16, 24, 32, 40, 48, 64',
      '13, 14, 15, 17, 19, 22, 26, 30',
      '4, 8, 10, 16, 20',
    ])
      expect(scale, line).toContain(line);
  });
});

describe('точки перелома (DESIGN.md §4.1)', () => {
  it('в документе те же шесть литералов, что разрешает сторож, и границы 600 / 960 / 1280', () => {
    const scale = section(/\n### 4\.1\. Утверждённая шкала/);
    expect(scale).toContain('600 / 960 / 1280');
    for (const b of ALLOWED_BREAKPOINTS) expect(scale, b).toContain(`\`${b}\``);
    expect(scale).toMatch(/var\(\)[^\n]*@media/);
  });
});

describe('слои каскада (DESIGN.md §20.6)', () => {
  it('договор о слоях в документе совпадает со сторожем', () => {
    const layers = section(/\n## 20\.6\. Слои каскада/);
    expect(layers).toContain(`@layer ${LAYER_CONTRACT.join(', ')}`);
  });
});
