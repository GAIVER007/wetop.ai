import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Сторож ИИ-слопа в интерфейсе стойки (план дизайн-системы, шаг 8; DESIGN.md §3, §5, §13, §14, §15).
 *
 * Читает исходники `apps/web/src` и считает по файлам то, что документ запрещает и что можно поймать регуляркой:
 * цвет мимо токенов, отступ вне шкалы, капс, тень у блока на странице, `window.confirm`, «A · B · C» и стрелка
 * в конце текста, шрифт мельче 12 px, литералы радиуса и z-index. Печатные формы (`/print/`) и страница
 * `/design-system` не проверяются: первые не трогаем по решению владельца, вторая показывает состояния.
 *
 * Нарушения на 15.09.2026 записаны в `design-slop.baseline.json` (снимок «как сейчас» из DESIGN.md), и тест
 * держит храповик: новое нарушение — красный; починили — тоже красный, пока снимок не обновлён
 * (`DESIGN_SLOP_UPDATE=1 npx vitest run tests/unit/design-slop.test.ts`), чтобы снимок всегда равнялся коду.
 * Без снимка тест красный на каждом нарушении — так он и был впервые запущен.
 */
const ROOT = resolve(import.meta.dirname, '../..');
const SRC = resolve(ROOT, 'apps/web/src');
const BASELINE = resolve(import.meta.dirname, 'design-slop.baseline.json');

const SPACE_SCALE = new Set([0, 4, 8, 16, 24, 32, 40, 48, 64]);
const RADIUS_TOKENS = new Set(['50%', '0', '9999px']); // круг, «без скругления» и pill — единственные литералы

type Counts = Record<string, Record<string, number>>; // правило → файл → число нарушений

interface Rule {
  id: string;
  why: string;
  ext: RegExp;
  find: (src: string) => number;
}

const count = (src: string, re: RegExp) => [...src.matchAll(re)].length;

/** Значения свойства в CSS: `padding: 12px 20px` → ['12px','20px']. */
function values(src: string, prop: RegExp): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(prop)) out.push(...(m[1] ?? '').trim().split(/\s+/));
  return out;
}

const RULES: Rule[] = [
  {
    id: 'color-literal',
    why: 'цвет мимо токенов (DESIGN.md §2): hex или rgb() вне tokens.css',
    ext: /\.(css|tsx)$/,
    find: (s) => count(s, /(?<![\w-])#[0-9a-fA-F]{3,8}\b|\brgba?\(/g),
  },
  {
    id: 'space-off-scale',
    why: 'отступ вне шкалы 4/8/16/24/32/40/48/64 (DESIGN.md §3)',
    ext: /\.css$/,
    find: (s) =>
      values(
        s,
        /(?:^|[;{\s])(?:padding|margin|gap|row-gap|column-gap)(?:-(?:top|right|bottom|left|block|inline))?\s*:\s*([^;}!]+)/gm,
      ).filter((v) => /^-?\d+(?:\.\d+)?px$/.test(v) && !SPACE_SCALE.has(Math.abs(parseFloat(v))))
        .length,
  },
  {
    id: 'uppercase',
    why: 'капс (DESIGN.md §14, §15): text-transform: uppercase',
    ext: /\.(css|tsx)$/,
    find: (s) => count(s, /text-?[tT]ransform\s*:\s*['"]?uppercase/g),
  },
  {
    id: 'shadow-on-page',
    why: 'тень у блока на странице (DESIGN.md §5): box-shadow, который не --shadow-floating, не кольцо фокуса (--ring) и не inset',
    ext: /\.(css|tsx)$/,
    find: (s) =>
      [...s.matchAll(/box-?[sS]hadow\s*:\s*([^;}'"]+)/g)]
        .map((m) => (m[1] ?? '').trim())
        .filter(
          (v) =>
            v !== 'none' &&
            !v.includes('--shadow-floating') &&
            !v.includes('--ring') &&
            !v.startsWith('inset') &&
            !/^0 0 0 \d/.test(v),
        ).length,
  },
  {
    id: 'window-confirm',
    why: 'window.confirm вместо окна подтверждения с суммой (DESIGN.md §8, §15)',
    ext: /\.tsx$/,
    find: (s) => count(s, /\bwindow\.confirm\(/g),
  },
  {
    id: 'dot-separator',
    why: 'подпись «A · B · C» (DESIGN.md §14) — отдельные строки или таблица',
    ext: /\.tsx$/,
    find: (s) => count(s, / · /g),
  },
  {
    id: 'trailing-arrow',
    why: 'стрелка в конце ссылки или текста «Все брони →» (DESIGN.md §15); стрелка периода «14.09 → 17.09» и стрелка, которая сама и есть всё содержимое элемента, не считаются',
    ext: /\.tsx$/,
    // Не считаем стрелку, перед которой в строке нет текста: `<span> → </span>` и `{' → '}` — это период
    find: (s) => count(s, /(?<![>{]['"`]?\s{0,4})[→↗](?=\s*(?:<\/|['"`]|\{'\s*\}|$))/gm),
  },
  {
    id: 'font-under-12',
    why: 'шрифт мельче 12 px (DESIGN.md §6)',
    ext: /\.(css|tsx)$/,
    find: (s) => count(s, /font-?[sS]ize\s*:\s*(?:1[01]|[1-9])(?:px|\b)(?!\d|\.)/g),
  },
  {
    id: 'radius-literal',
    why: 'литерал радиуса вместо --radius-sm/control/lg (DESIGN.md §5); 50 % и 0 разрешены',
    ext: /\.css$/,
    find: (s) =>
      [...s.matchAll(/border-radius\s*:\s*([^;}]+)/g)]
        .map((m) => (m[1] ?? '').trim())
        .filter((v) => !v.includes('var(') && !RADIUS_TOKENS.has(v)).length,
  },
  {
    id: 'z-index-literal',
    why: 'литерал z-index вместо --z-* (DESIGN.md §13)',
    ext: /\.css$/,
    find: (s) => count(s, /z-index\s*:\s*-?\d+/g),
  },
];

function files(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = resolve(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === 'design-system' || name === 'print') continue;
      out.push(...files(p));
    } else if (/\.(css|tsx)$/.test(name) && !name.includes('.test.') && name !== 'tokens.css') {
      out.push(p);
    }
  }
  return out.sort();
}

export function scan(): Counts {
  const out: Counts = {};
  for (const r of RULES) out[r.id] = {};
  for (const p of files(SRC)) {
    // Строка с пометкой `slop-allow` не считается: исключение объясняется рядом и в DESIGN.md §15
    const src = readFileSync(p, 'utf8')
      .split('\n')
      .filter((line) => !line.includes('slop-allow'))
      .join('\n');
    const rel = relative(ROOT, p);
    for (const r of RULES) {
      if (!r.ext.test(p)) continue;
      const n = r.find(src);
      if (n) out[r.id]![rel] = n;
    }
  }
  return out;
}

describe('design: сторож ИИ-слопа (DESIGN.md §15)', () => {
  const actual = scan();

  if (process.env.DESIGN_SLOP_UPDATE) {
    writeFileSync(BASELINE, `${JSON.stringify(actual, null, 2)}\n`);
  }
  const baseline: Counts = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {};

  for (const r of RULES) {
    it(`${r.id}: ${r.why}`, () => {
      const got = actual[r.id] ?? {};
      const was = baseline[r.id] ?? {};
      const worse = Object.entries(got)
        .filter(([f, n]) => n > (was[f] ?? 0))
        .map(([f, n]) => `${f}: ${was[f] ?? 0} → ${n}`);
      const better = Object.entries(was)
        .filter(([f, n]) => (got[f] ?? 0) < n)
        .map(([f, n]) => `${f}: ${n} → ${got[f] ?? 0}`);
      expect(
        worse,
        `новые нарушения — исправьте или объясните в reports/design-audit-*.md`,
      ).toEqual([]);
      expect(better, `нарушений стало меньше — обновите снимок: DESIGN_SLOP_UPDATE=1`).toEqual([]);
    });
  }

  it('снимок покрывает все правила', () => {
    expect(Object.keys(baseline).sort()).toEqual(RULES.map((r) => r.id).sort());
  });
});
