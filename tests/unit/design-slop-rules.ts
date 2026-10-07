import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, normalize, relative, resolve } from 'node:path';

/**
 * Сторож ИИ-слопа в интерфейсе стойки (план дизайн-системы, шаг 8; DESIGN.md §3, §5, §13, §14, §15).
 *
 * Читает исходники `apps/web/src` и считает по файлам то, что документ запрещает и что можно поймать регуляркой:
 * цвет мимо токенов, отступ вне шкалы, капс, тень у блока на странице, `window.confirm`, «A · B · C» и стрелка
 * в конце текста, шрифт мельче 12 px, литералы радиуса и z-index. Печатные формы (`/print/`) и страница
 * `/design-system` не проверяются: первые не трогаем по решению владельца, вторая показывает состояния.
 *
 * Нарушения на 15.09.2026 записаны в `design-slop.baseline.json` (снимок «как сейчас» из DESIGN.md), и тест
 * держит храповик: новое нарушение: красный; починили: тоже красный, пока снимок не обновлён
 * (`DESIGN_SLOP_UPDATE=1 npx vitest run tests/unit/design-slop.test.ts`), чтобы снимок всегда равнялся коду.
 * Без снимка тест красный на каждом нарушении: так он и был впервые запущен.
 *
 * MV8.5 DS0a (07.10.2026, решения владельца): шрифт и отступы только токенами, `style={…}` только для
 * геометрии из данных, точки перелома только шесть литералов `ALLOWED_BREAKPOINTS`, слои только по договору
 * `LAYER_CONTRACT` (DESIGN.md §20.6), `.tsx` без импортов ловится как сирота. Исключение `slop-allow` действует
 * только для названного правила и только с причиной: `slop-allow: inline-style позиция плашки из данных`.
 */
const ROOT = resolve(import.meta.dirname, '../..');
const SRC = resolve(ROOT, 'apps/web/src');

const SPACE_SCALE = new Set([0, 4, 8, 16, 24, 32, 40, 48, 64]);
const RADIUS_TOKENS = new Set(['50%', '0', '9999px']); // круг, «без скругления» и pill: единственные литералы

/** Точки перелома, утверждённые владельцем 07.10.2026: границы 600 / 960 / 1280 (DESIGN.md §4.1) */
export const ALLOWED_BREAKPOINTS = [
  'max-width: 600px',
  'min-width: 601px',
  'max-width: 960px',
  'min-width: 961px',
  'max-width: 1279px',
  'min-width: 1280px',
] as const;

/** Порядок слоёв каскада (DESIGN.md §20.6); переводит файлы на слои DS0b */
export const LAYER_CONTRACT = ['reset', 'tokens', 'base', 'components', 'sections', 'utilities'] as const;

export type Counts = Record<string, Record<string, number>>; // правило → файл → число нарушений

export interface Rule {
  id: string;
  why: string;
  ext: RegExp;
  /** `file`: путь от корня репозитория; нужен правилам, которые смотрят на файл целиком */
  find: (src: string, file: string) => number;
}

const count = (src: string, re: RegExp) => [...src.matchAll(re)].length;

const SPACE_PROP =
  /(?:^|[;{\s])(?:padding|margin|gap|row-gap|column-gap)(?:-(?:top|right|bottom|left|block|inline))?\s*:\s*([^;}!]+)/gm;
const KEYWORD_FONT = /^(?:var\(|inherit|initial|unset|revert)/;

/** Условия медиазапросов: `@media` в CSS и строках TSX, строка `matchMedia('…')` */
function mediaPreludes(src: string): string[] {
  const out = [...src.matchAll(/@media([^{]+)\{/g)].map((m) => m[1]!);
  for (const m of src.matchAll(/matchMedia\(\s*['"`]([^'"`]+)['"`]/g)) out.push(m[1]!);
  return out;
}

function breakpointDebt(prelude: string): number {
  const allowed = new Set<string>(ALLOWED_BREAKPOINTS);
  let n = count(prelude, /var\(/g) + count(prelude, /\bwidth\s*[<>]=?|[<>]=?\s*width\b/g);
  for (const m of prelude.matchAll(/\b(min|max)-width\s*:\s*([^)]+)\)/g)) {
    const value = m[2]!.trim();
    if (value.includes('var(')) continue; // уже посчитано выше
    if (!allowed.has(`${m[1]}-width: ${value}`)) n += 1;
  }
  return n;
}

/** Строка `slop-allow: <правило> <причина>` не считается только для названного правила */
export function withoutAllowed(src: string, ruleId: string): string {
  return src
    .split('\n')
    .map((line) => {
      const m = /slop-allow:\s*([a-z-]+(?:\s*,\s*[a-z-]+)*)[\s\-\u2013\u2014:,]+[\p{L}\d]/u.exec(line);
      if (!m) return line;
      return m[1]!.split(/\s*,\s*/).includes(ruleId) ? '' : line;
    })
    .join('\n');
}

const ROUTE_FILE =
  /^(?:page|layout|loading|error|not-found|template|default|route|global-error|opengraph-image|icon|apple-icon)\.tsx$/;

/**
 * `.tsx`, которые никто не импортирует и которые не файлы маршрутов Next. `files`: путь от `apps/web/src`
 * → текст. Учитываются `import … from`, `export … from`, `import('…')`, относительные пути и `@/`.
 */
export function findOrphans(files: Record<string, string>): string[] {
  const known = new Set(Object.keys(files));
  const imported = new Set<string>();
  for (const [file, src] of Object.entries(files)) {
    for (const m of src.matchAll(/(?:\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)['"]([^'"]+)['"]/g)) {
      const spec = m[1]!;
      let base: string;
      if (spec.startsWith('.')) base = normalize(join(dirname(file), spec));
      else if (spec.startsWith('@/')) base = spec.slice(2);
      else continue;
      for (const c of [base, `${base}.tsx`, `${base}.ts`, `${base}/index.tsx`, `${base}/index.ts`])
        if (known.has(c)) imported.add(c);
    }
  }
  return [...known]
    .filter((f) => f.endsWith('.tsx') && !imported.has(f) && !ROUTE_FILE.test(f.split('/').pop()!))
    .sort();
}

let orphanCache: Set<string> | undefined;
/** Сироты живого `apps/web/src`, путями от корня репозитория; импорты ищутся по всем файлам, включая печать */
function orphanSet(): Set<string> {
  if (orphanCache) return orphanCache;
  const all: Record<string, string> = {};
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = resolve(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(name) && !name.includes('.test.')) all[relative(SRC, p)] = readFileSync(p, 'utf8');
    }
  };
  walk(SRC);
  orphanCache = new Set(findOrphans(all).map((f) => relative(ROOT, resolve(SRC, f))));
  return orphanCache;
}

/** Значения свойства в CSS: `padding: 12px 20px` → ['12px','20px']. */
function values(src: string, prop: RegExp): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(prop)) out.push(...(m[1] ?? '').trim().split(/\s+/));
  return out;
}

export const RULES: Rule[] = [
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
    why: 'подпись «A · B · C» (DESIGN.md §14): отдельные строки или таблица',
    ext: /\.tsx$/,
    find: (s) => count(s, / · /g),
  },
  {
    id: 'trailing-arrow',
    why: 'стрелка в конце ссылки или текста «Все брони →» (DESIGN.md §15); стрелка периода «14.09 → 17.09» и стрелка, которая сама и есть всё содержимое элемента, не считаются',
    ext: /\.tsx$/,
    // Не считаем стрелку, перед которой в строке нет текста: `<span> → </span>` и `{' → '}`: это период
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
  {
    id: 'font-literal',
    why: 'размер шрифта литералом вместо --text-* (DESIGN.md §4.1, MV8.5 DS0a)',
    ext: /\.(css|tsx)$/,
    find: (s) =>
      [...s.matchAll(/font-size\s*:\s*([^;}]+)/g)].filter((m) => !KEYWORD_FONT.test(m[1]!.trim())).length +
      [...s.matchAll(/fontSize\s*:\s*([^,}\n]+)/g)].filter(
        (m) => !KEYWORD_FONT.test(m[1]!.trim().replace(/^['"`]/, '')),
      ).length,
  },
  {
    id: 'space-literal-not-var',
    why: 'отступ литералом вместо --space-*, даже на шкале (DESIGN.md §4.1, MV8.5 DS0a)',
    ext: /\.css$/,
    find: (s) =>
      values(s, SPACE_PROP).filter((v) => /^-?\d*\.?\d+(?:px|rem|em)$/.test(v) && parseFloat(v) !== 0).length,
  },
  {
    id: 'inline-style',
    why: 'style={…} в TSX: только геометрия из данных и только с `slop-allow: inline-style <причина>` (MV8.5 DS0a)',
    ext: /\.tsx$/,
    find: (s) => count(s, /\bstyle=\{/g),
  },
  {
    id: 'breakpoint-literal',
    why: 'точка перелома вне max 600 / min 601 / max 960 / min 961 / max 1279 / min 1280, var() или диапазон в @media (DESIGN.md §4.1)',
    ext: /\.(css|tsx)$/,
    find: (s) => mediaPreludes(s).reduce((n, p) => n + breakpointDebt(p), 0),
  },
  {
    id: 'layer-name',
    why: '@layer вне договора reset, tokens, base, components, sections, utilities (DESIGN.md §20.6)',
    ext: /\.css$/,
    find: (s) =>
      [...s.matchAll(/@layer\s+([^;{]+)/g)]
        .flatMap((m) => m[1]!.split(',').map((x) => x.trim()))
        .filter((name) => !(LAYER_CONTRACT as readonly string[]).includes(name)).length,
  },
  {
    id: 'orphan-module',
    why: '.tsx, который никто не импортирует и который не файл маршрута Next (MV8.5 DS0a)',
    ext: /\.tsx$/,
    find: (_s, file) => (orphanSet().has(file) ? 1 : 0),
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
    // Строка `slop-allow: <правило> <причина>` не считается для этого правила (DESIGN.md §15)
    const raw = readFileSync(p, 'utf8');
    const rel = relative(ROOT, p);
    for (const r of RULES) {
      if (!r.ext.test(p)) continue;
      const n = r.find(withoutAllowed(raw, r.id), rel);
      if (n) out[r.id]![rel] = n;
    }
  }
  return out;
}
