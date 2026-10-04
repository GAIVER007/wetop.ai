/**
 * Генератор токенов стойки (DESIGN.md §2, ADR-048).
 *
 * design/tokens.json (W3C DTCG 2025.10) → apps/web/src/app/tokens.css с прежними именами переменных
 * и design/contrast.md с таблицей контраста для каждой темы. Файл CSS руками не правится: тест
 * scripts/design/build-tokens.test.ts сверяет его с выводом генератора.
 *
 * Запуск: npm run design:tokens
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

export const TOKENS_FILE = 'design/tokens.json';
export const CSS_FILE = 'apps/web/src/app/tokens.css';
export const CONTRAST_FILE = 'design/contrast.md';
const THEMES_EXT = 'kz.wetop.themes';
const CSS_EXT = 'kz.wetop.css';

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };
type Group = { [k: string]: Json };
export interface ThemeSpec {
  selector: string;
  colorScheme: 'light' | 'dark';
  media?: string;
  $description?: string;
}
export interface EmittedToken {
  path: string;
  cssVar: string;
  type: string;
  /** значение по темам после разрешения ссылок; light — всегда */
  values: Record<string, Json>;
  deprecated?: string;
}
export interface TokenTree {
  themes: Record<string, ThemeSpec>;
  tokens: EmittedToken[];
  /** любой токен по пути, для тестов и таблицы контраста */
  resolve: (path: string, theme?: string) => { type: string; value: Json };
}

const isObject = (v: Json): v is Group => typeof v === 'object' && v !== null && !Array.isArray(v);
const isAlias = (v: Json): v is string => typeof v === 'string' && /^\{[^{}]+\}$/.test(v);

export function loadTokens(root = process.cwd()): TokenTree {
  const raw = JSON.parse(readFileSync(resolvePath(root, TOKENS_FILE), 'utf8')) as Group;
  return parseTokens(raw);
}

export function parseTokens(raw: Group): TokenTree {
  const themes = ((raw['$extensions'] as Group | undefined)?.[THEMES_EXT] ?? {}) as Record<
    string,
    ThemeSpec
  >;
  if (!themes['light']) throw new Error('tokens.json: нет темы light в $extensions');

  // 1. Собираем листья с унаследованным $type
  const leaves = new Map<string, { node: Group; type: string }>();
  const walk = (node: Group, path: string[], inheritedType: string | undefined) => {
    const type = typeof node['$type'] === 'string' ? (node['$type'] as string) : inheritedType;
    if ('$value' in node) {
      if (!type)
        throw new Error(`tokens.json: у ${path.join('.')} нет $type ни у него, ни у группы`);
      leaves.set(path.join('.'), { node, type });
      return;
    }
    for (const [key, child] of Object.entries(node)) {
      if (key.startsWith('$')) continue;
      if (!isObject(child))
        throw new Error(`tokens.json: ${[...path, key].join('.')} — не группа и не токен`);
      walk(child, [...path, key], type);
    }
  };
  walk(raw, [], undefined);

  // 2. Разрешение ссылок, с защитой от цикла
  const resolveValue = (value: Json, theme: string, stack: string[]): Json => {
    if (isAlias(value)) {
      const ref = value.slice(1, -1);
      if (stack.includes(ref))
        throw new Error(`tokens.json: цикл ссылок ${[...stack, ref].join(' → ')}`);
      const target = leaves.get(ref);
      if (!target)
        throw new Error(
          `tokens.json: ссылка на несуществующий токен {${ref}} из ${stack.at(-1) ?? '?'}`,
        );
      return resolveValue(themedRaw(target.node, theme), theme, [...stack, ref]);
    }
    if (Array.isArray(value)) return value.map((v) => resolveValue(v, theme, stack));
    if (isObject(value)) {
      const out: Group = {};
      for (const [k, v] of Object.entries(value)) out[k] = resolveValue(v, theme, stack);
      return out;
    }
    return value;
  };
  const themedRaw = (node: Group, theme: string): Json => {
    const ext = node['$extensions'] as Group | undefined;
    const overrides = ext?.[THEMES_EXT] as Group | undefined;
    if (theme !== 'light' && overrides && theme in overrides) return overrides[theme]!;
    return node['$value']!;
  };
  const resolve = (path: string, theme = 'light') => {
    const leaf = leaves.get(path);
    if (!leaf) throw new Error(`tokens.json: нет токена ${path}`);
    return { type: leaf.type, value: resolveValue(themedRaw(leaf.node, theme), theme, [path]) };
  };

  // 3. Каждый лист должен разрешаться уже сейчас: битая ссылка — ошибка на входе, а не при первом var()
  for (const path of leaves.keys()) resolve(path, 'light');

  // 4. Токены, выходящие в CSS
  const tokens: EmittedToken[] = [];
  for (const [path, { node, type }] of leaves) {
    const ext = node['$extensions'] as Group | undefined;
    const css = ext?.[CSS_EXT] as Group | undefined;
    if (!css || typeof css['var'] !== 'string') continue;
    const overrides = (ext?.[THEMES_EXT] ?? {}) as Group;
    const values: Record<string, Json> = { light: resolve(path, 'light').value };
    for (const theme of Object.keys(themes)) {
      if (theme === 'light') continue;
      // тема наследуется и через ссылку: если сам токен или цель ссылки имеют значение для темы
      const inherits = hasThemeValue(node, theme, leaves, new Set());
      if (theme in overrides || inherits) values[theme] = resolve(path, theme).value;
    }
    const token: EmittedToken = { path, cssVar: css['var'] as string, type, values };
    if (typeof node['$deprecated'] === 'string') token.deprecated = node['$deprecated'];
    tokens.push(token);
  }
  return { themes, tokens, resolve };
}

function hasThemeValue(
  node: Group,
  theme: string,
  leaves: Map<string, { node: Group; type: string }>,
  seen: Set<Group>,
): boolean {
  if (seen.has(node)) return false;
  seen.add(node);
  const ext = node['$extensions'] as Group | undefined;
  const overrides = ext?.[THEMES_EXT] as Group | undefined;
  if (overrides && theme in overrides) return true;
  const value = node['$value'];
  const refs: string[] = [];
  const collect = (v: Json | undefined) => {
    if (isAlias(v ?? null)) refs.push((v as string).slice(1, -1));
    else if (Array.isArray(v)) v.forEach(collect);
    else if (isObject(v ?? null)) Object.values(v as Group).forEach(collect);
  };
  collect(value);
  return refs.some((ref) => {
    const target = leaves.get(ref);
    return !!target && hasThemeValue(target.node, theme, leaves, seen);
  });
}

/* ---------- сериализация в CSS ---------- */

const num = (v: Json): number => {
  if (typeof v !== 'number') throw new Error(`ожидалось число, получено ${JSON.stringify(v)}`);
  return v;
};
const dim = (v: Json): string => {
  if (!isObject(v)) throw new Error(`ожидался размер {value, unit}, получено ${JSON.stringify(v)}`);
  return `${num(v['value']!)}${String(v['unit'] ?? 'px')}`;
};
export function cssColor(v: Json): string {
  if (!isObject(v)) throw new Error(`ожидался цвет, получено ${JSON.stringify(v)}`);
  const alpha = v['alpha'] === undefined ? 1 : num(v['alpha']!);
  const hex = typeof v['hex'] === 'string' ? v['hex'] : undefined;
  const comps = (v['components'] as Json[]).map(num);
  const [r, g, b] = comps.map((c) => Math.round(c * 255)) as [number, number, number];
  if (alpha === 1)
    return hex ?? `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
const fontFamily = (v: Json): string =>
  (Array.isArray(v) ? v : [v]).map((f) => (/\s/.test(String(f)) ? `'${f}'` : String(f))).join(', ');
const shadow = (v: Json): string => {
  const one = (s: Json) => {
    if (!isObject(s)) throw new Error('тень: ожидался объект');
    return `${dim(s['offsetX']!)} ${dim(s['offsetY']!)} ${dim(s['blur']!)} ${dim(s['spread']!)} ${cssColor(s['color']!)}`;
  };
  return (Array.isArray(v) ? v : [v]).map(one).join(', ');
};
const duration = (v: Json): string => dim(v);
const bezier = (v: Json): string => `cubic-bezier(${(v as Json[]).map(num).join(', ')})`;
const transition = (v: Json): string => {
  if (!isObject(v)) throw new Error('переход: ожидался объект');
  const delay =
    isObject(v['delay']!) && num((v['delay'] as Group)['value']!) > 0 ? ` ${dim(v['delay']!)}` : '';
  return `${duration(v['duration']!)} ${bezier(v['timingFunction']!)}${delay}`;
};
export function toCss(type: string, value: Json): string {
  switch (type) {
    case 'color':
      return cssColor(value);
    case 'dimension':
    case 'duration':
      return dim(value);
    case 'fontFamily':
      return fontFamily(value);
    case 'fontWeight':
    case 'number':
      return String(num(value));
    case 'shadow':
      return shadow(value);
    case 'cubicBezier':
      return bezier(value);
    case 'transition':
      return transition(value);
    default:
      throw new Error(`tokens.json: тип ${type} не сериализуется в CSS`);
  }
}

export function buildTokensCss(tree: TokenTree): string {
  const lines: string[] = [
    '/*',
    ' * СГЕНЕРИРОВАНО из design/tokens.json командой `npm run design:tokens` — руками не править.',
    ' * Правила и смысл каждого токена — DESIGN.md. Тест scripts/design/build-tokens.test.ts',
    ' * сверяет этот файл с генератором: ручная правка делает его красным.',
    ' */',
  ];
  for (const [name, spec] of Object.entries(tree.themes)) {
    const body: string[] = [`  color-scheme: ${spec.colorScheme};`];
    for (const t of tree.tokens) {
      if (!(name in t.values) && name !== 'contrast') continue;
      const note = t.deprecated && name === 'light' ? ' /* устарел */' : '';
      body.push(`  ${t.cssVar}: ${toCss(t.type, t.values[name] ?? t.values.light!)};${note}`);
    }
    if (body.length === 1) continue;
    const block = [`${spec.selector} {`, ...body, '}'];
    if (spec.media) lines.push(`@media ${spec.media} {`, ...block.map((l) => `  ${l}`), '}');
    else lines.push(...block);
  }
  return `${lines.join('\n')}\n`;
}

/* ---------- контраст ---------- */

export interface ContrastPair {
  /** что на чём: текст на фоне, граница на фоне, кольцо фокуса на фоне */
  fg: string;
  bg: string;
  /** 4.5 для текста, 3 для границ, значков и кольца фокуса (WCAG 1.4.3, 1.4.11) */
  min: 4.5 | 3;
  note: string;
}
export const CONTRAST_PAIRS: ContrastPair[] = [
  { fg: 'color.semantic.text', bg: 'color.semantic.bg', min: 4.5, note: 'текст на странице' },
  { fg: 'color.semantic.text', bg: 'color.semantic.surface', min: 4.5, note: 'текст на панели' },
  {
    fg: 'color.semantic.text-2',
    bg: 'color.semantic.surface',
    min: 4.5,
    note: 'подпись поля, ссылка в таблице',
  },
  {
    fg: 'color.semantic.muted',
    bg: 'color.semantic.surface',
    min: 4.5,
    note: 'подсказка на панели',
  },
  { fg: 'color.semantic.muted', bg: 'color.semantic.bg', min: 4.5, note: 'подсказка на странице' },
  {
    fg: 'color.semantic.muted',
    bg: 'color.semantic.surface-muted',
    min: 4.5,
    note: 'заголовок колонки таблицы',
  },
  {
    fg: 'color.semantic.muted',
    bg: 'color.semantic.row-hover',
    min: 4.5,
    note: 'подпись в строке под курсором',
  },
  {
    fg: 'color.semantic.primary',
    bg: 'color.semantic.surface',
    min: 4.5,
    note: 'ссылка, активный пункт',
  },
  { fg: 'color.semantic.primary', bg: 'color.semantic.bg', min: 4.5, note: 'ссылка на странице' },
  {
    fg: 'color.semantic.on-primary',
    bg: 'color.semantic.primary',
    min: 4.5,
    note: 'текст главной кнопки',
  },
  {
    fg: 'color.semantic.primary',
    bg: 'color.semantic.primary-soft',
    min: 4.5,
    note: 'бейдж «инфо», активный пункт меню',
  },
  {
    fg: 'color.semantic.success',
    bg: 'color.semantic.surface',
    min: 4.5,
    note: 'слово «заселён», свободно',
  },
  { fg: 'color.semantic.success', bg: 'color.semantic.success-soft', min: 4.5, note: 'бейдж «ок»' },
  {
    fg: 'color.semantic.warning',
    bg: 'color.semantic.surface',
    min: 4.5,
    note: 'слово «внимание»',
  },
  {
    fg: 'color.semantic.warning',
    bg: 'color.semantic.warning-soft',
    min: 4.5,
    note: 'бейдж «внимание», кнопка «Незаезд»',
  },
  { fg: 'color.semantic.danger', bg: 'color.semantic.surface', min: 4.5, note: 'долг, ошибка' },
  {
    fg: 'color.semantic.danger',
    bg: 'color.semantic.danger-soft',
    min: 4.5,
    note: 'бейдж «ошибка», кнопка «Отменить»',
  },
  {
    fg: 'color.semantic.chip-fg',
    bg: 'color.semantic.chip-bg',
    min: 4.5,
    note: 'нейтральный бейдж',
  },
  {
    fg: 'color.semantic.text',
    bg: 'color.status.confirmed',
    min: 4.5,
    note: 'имя на плашке «подтверждена»',
  },
  {
    fg: 'color.semantic.text',
    bg: 'color.status.checked-in',
    min: 4.5,
    note: 'имя на плашке «заселён»',
  },
  {
    fg: 'color.semantic.text',
    bg: 'color.status.checked-out',
    min: 4.5,
    note: 'имя на плашке «выселен»',
  },
  {
    fg: 'color.semantic.text',
    bg: 'color.status.tentative',
    min: 4.5,
    note: 'имя на плашке «предварительная»',
  },
  {
    fg: 'color.semantic.text',
    bg: 'color.status.blocked',
    min: 4.5,
    note: 'причина на блокировке',
  },
  {
    fg: 'color.semantic.focus',
    bg: 'color.semantic.bg',
    min: 3,
    note: 'кольцо фокуса на странице',
  },
  {
    fg: 'color.semantic.focus',
    bg: 'color.semantic.surface',
    min: 3,
    note: 'кольцо фокуса на панели',
  },
  {
    fg: 'color.semantic.border-input',
    bg: 'color.semantic.surface',
    min: 3,
    note: 'граница поля ввода (1.4.11)',
  },
  {
    fg: 'color.semantic.border',
    bg: 'color.semantic.surface',
    min: 3,
    note: 'граница панели — декоративная, порог 3:1 справочно',
  },
  {
    fg: 'color.semantic.border-soft',
    bg: 'color.semantic.surface',
    min: 3,
    note: 'линия между строками — декоративная, справочно',
  },
  {
    fg: 'color.semantic.warning-border',
    bg: 'color.semantic.warning-bg',
    min: 3,
    note: 'рамка предупреждения — декоративная, справочно',
  },
  {
    fg: 'color.semantic.danger-border',
    bg: 'color.semantic.danger-soft',
    min: 3,
    note: 'рамка ошибки — декоративная, справочно',
  },
  {
    fg: 'color.semantic.warning',
    bg: 'color.status.tentative',
    min: 4.5,
    note: 'глиф «?» на плашке «предварительная»',
  },
  {
    fg: 'color.semantic.success',
    bg: 'color.status.checked-in',
    min: 4.5,
    note: 'глиф «✓» на плашке «заселён»',
  },
];

const luminance = (hex: string): number => {
  const c = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(c.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export function contrastRatio(fgHex: string, bgHex: string): number {
  const a = luminance(fgHex);
  const b = luminance(bgHex);
  return Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 100) / 100;
}

export interface ContrastRow extends ContrastPair {
  theme: string;
  fgHex: string;
  bgHex: string;
  ratio: number;
  ok: boolean;
}
export function contrastReport(
  tree: TokenTree,
  themes = ['light', 'dark', 'contrast'],
): ContrastRow[] {
  const rows: ContrastRow[] = [];
  for (const theme of themes) {
    for (const pair of CONTRAST_PAIRS) {
      const fg = tree.resolve(pair.fg, theme).value;
      const bg = tree.resolve(pair.bg, theme).value;
      const fgHex = cssColor(fg);
      const bgHex = cssColor(bg);
      if (!fgHex.startsWith('#') || !bgHex.startsWith('#'))
        throw new Error(
          `контраст считается только для непрозрачных цветов: ${pair.fg} / ${pair.bg}`,
        );
      const ratio = contrastRatio(fgHex, bgHex);
      rows.push({ ...pair, theme, fgHex, bgHex, ratio, ok: ratio >= pair.min });
    }
  }
  return rows;
}

export function buildContrastMd(rows: ContrastRow[]): string {
  const out: string[] = [
    '# Контраст токенов по темам',
    '',
    'Сгенерировано из `design/tokens.json` командой `npm run design:tokens` — руками не править.',
    'Порог 4,5:1 для текста (WCAG 1.4.3), 3:1 для границ полей, значков и кольца фокуса (1.4.11).',
    'Пары, не проходящие порог, перечислены в `scripts/design/build-tokens.test.ts` как известные и',
    'закрываются срезом 7.4 плана: тест краснеет и на новое нарушение, и на молча исправленное.',
    '',
  ];
  for (const theme of [...new Set(rows.map((r) => r.theme))]) {
    out.push(
      `## Тема ${theme}`,
      '',
      '| Пара | Что это | Цвета | Контраст | Порог | Итог |',
      '|---|---|---|---|---|---|',
    );
    for (const r of rows.filter((x) => x.theme === theme)) {
      const short = (p: string) =>
        p.replace('color.semantic.', '').replace('color.status.', 'status.');
      out.push(
        `| ${short(r.fg)} / ${short(r.bg)} | ${r.note} | \`${r.fgHex}\` на \`${r.bgHex}\` | ${r.ratio.toFixed(2).replace('.', ',')}:1 | ${String(r.min).replace('.', ',')}:1 | ${r.ok ? 'да' : '**нет**'} |`,
      );
    }
    out.push('');
  }
  return `${out.join('\n')}`;
}

if (process.argv[1] && /build-tokens\.(ts|js)$/.test(process.argv[1])) {
  const root = process.cwd();
  const tree = loadTokens(root);
  const css = buildTokensCss(tree);
  writeFileSync(resolvePath(root, CSS_FILE), css);
  const rows = contrastReport(tree);
  writeFileSync(resolvePath(root, CONTRAST_FILE), buildContrastMd(rows));
  const bad = rows.filter((r) => !r.ok);
  console.log(
    `${CSS_FILE}: ${tree.tokens.length} переменных, тем: ${Object.keys(tree.themes).join(', ')}\n` +
      `${CONTRAST_FILE}: ${rows.length} пар, не проходят порог: ${bad.length}` +
      (bad.length
        ? `\n  ${bad.map((b) => `${b.theme}: ${b.fg} / ${b.bg} = ${b.ratio}`).join('\n  ')}`
        : ''),
  );
}
