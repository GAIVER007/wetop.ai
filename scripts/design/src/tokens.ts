/**
 * Токены дизайн-системы стойки: чтение `design/tokens.json` (документ резолвера DTCG 2025.10),
 * разрешение наборов и модификаторов, псевдонимов `{path}` и генерация CSS-переменных.
 *
 * Формат — по сохранённой спецификации `design/docs/dtcg-2025.10/` (Format Module, Color Module,
 * Resolver Module), не по памяти. Поддержано ровно то, что использует наш файл: наборы с inline-источниками,
 * ссылки `#/sets/<имя>` внутри контекстов модификаторов, `$type` на группе, `$deprecated`, `$extensions`,
 * псевдонимы фигурными скобками, типы color / dimension / number / fontFamily / duration / transition / shadow.
 */
export type ColorValue = {
  colorSpace: 'srgb';
  components: [number, number, number];
  alpha?: number;
  hex?: string;
};
export type DimensionValue = { value: number; unit: 'px' | 'rem' };
export type DurationValue = { value: number; unit: 'ms' | 's' };
export type ShadowValue = {
  color: ColorValue | string;
  offsetX: DimensionValue | string;
  offsetY: DimensionValue | string;
  blur: DimensionValue | string;
  spread: DimensionValue | string;
  inset?: boolean;
};
export type TransitionValue = {
  duration: DurationValue | string;
  delay: DurationValue | string;
  timingFunction: [number, number, number, number] | string;
};
export type TokenType =
  | 'color'
  | 'dimension'
  | 'number'
  | 'fontFamily'
  | 'fontWeight'
  | 'duration'
  | 'cubicBezier'
  | 'transition'
  | 'shadow';

export interface Token {
  /** Путь через точку: `color.primary` */
  path: string;
  /** Листовое имя — имя CSS-переменной без `--` */
  name: string;
  type: TokenType;
  /** Значение как в файле: может быть псевдонимом `{path}` или содержать псевдонимы внутри композита */
  value: unknown;
  description?: string;
  deprecated?: string | true;
  /** Выходит ли токен в CSS (группа `$extensions["ai.wetop"].css === false` выключает поддерево) */
  css: boolean;
}

type Json = Record<string, unknown>;
export interface ResolverDocument extends Json {
  version: string;
  sets?: Record<string, { sources: unknown[]; $extensions?: Json; description?: string }>;
  modifiers?: Record<
    string,
    { contexts: Record<string, unknown[]>; default?: string; description?: string }
  >;
  resolutionOrder: Array<{ $ref: string }>;
}
export type Input = Record<string, string>;

const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Ссылка внутри документа: `#/sets/light` → объект по JSON Pointer (RFC 6901). */
export function pointer(doc: Json, ref: string): unknown {
  if (!ref.startsWith('#/')) throw new Error(`Поддерживаются только ссылки внутри документа: ${ref}`);
  let node: unknown = doc;
  for (const raw of ref.slice(2).split('/')) {
    const key = raw.replace(/~1/g, '/').replace(/~0/g, '~');
    if (Array.isArray(node)) node = node[Number(key)];
    else if (isObject(node)) node = node[key];
    else throw new Error(`Ссылка ${ref} не найдена на сегменте «${key}»`);
    if (node === undefined) throw new Error(`Ссылка ${ref} не найдена на сегменте «${key}»`);
  }
  return node;
}

/** Глубокое слияние источников: позднее значение побеждает (Resolver Module, «Sets»). */
function merge(target: Json, source: Json): Json {
  for (const [k, v] of Object.entries(source)) {
    const cur = target[k];
    if (isObject(v) && isObject(cur) && !('$value' in v) && !('$value' in cur)) merge(cur, v);
    else target[k] = isObject(v) ? structuredClone(v) : v;
  }
  return target;
}

/** Источник контекста или набора: inline-токены или `{ "$ref": "#/sets/x" }` (раскрывается в его sources). */
function expandSources(doc: ResolverDocument, sources: unknown[]): Json[] {
  const out: Json[] = [];
  for (const s of sources) {
    if (!isObject(s)) throw new Error('Источник должен быть объектом');
    if (typeof s['$ref'] === 'string') {
      const target = pointer(doc, s['$ref']);
      if (isObject(target) && Array.isArray(target['sources']))
        out.push(...expandSources(doc, target['sources'] as unknown[]));
      else if (isObject(target)) out.push(target);
      else throw new Error(`Ссылка ${s['$ref']} не указывает на набор или токены`);
    } else out.push(s);
  }
  return out;
}

/** Порядок разрешения (Resolver Module, «Resolution logic»): проверка входа, слияние по порядку. */
export function resolveTree(doc: ResolverDocument, input: Input = {}): Json {
  if (doc.version !== '2025.10') throw new Error(`Версия резолвера должна быть 2025.10, а не ${doc.version}`);
  const modifiers = doc.modifiers ?? {};
  for (const key of Object.keys(input)) {
    const mod = modifiers[key];
    if (!mod) throw new Error(`Неизвестный модификатор во входе: ${key}`);
    if (!(input[key]! in mod.contexts))
      throw new Error(`У модификатора ${key} нет контекста «${input[key]}»`);
  }
  const tree: Json = {};
  for (const item of doc.resolutionOrder) {
    const ref = item.$ref;
    if (ref.startsWith('#/sets/')) {
      const set = pointer(doc, ref) as { sources: unknown[] };
      for (const src of expandSources(doc, set.sources)) merge(tree, src);
    } else if (ref.startsWith('#/modifiers/')) {
      const name = ref.slice('#/modifiers/'.length);
      const mod = modifiers[name];
      if (!mod) throw new Error(`Модификатор ${name} не описан`);
      const context = input[name] ?? mod.default;
      if (context === undefined) throw new Error(`Для модификатора ${name} нужен вход: нет default`);
      for (const src of expandSources(doc, mod.contexts[context] ?? [])) merge(tree, src);
    } else throw new Error(`resolutionOrder: неподдерживаемая ссылка ${ref}`);
  }
  return tree;
}

/** Плоский список токенов с наследованием `$type`, `$deprecated` и выключателя CSS от групп. */
export function flatten(tree: Json): Token[] {
  const out: Token[] = [];
  const walk = (node: Json, path: string[], type: TokenType | undefined, deprecated: string | true | undefined, css: boolean) => {
    const ext = isObject(node['$extensions']) ? (node['$extensions'] as Json)['ai.wetop'] : undefined;
    const cssHere = isObject(ext) && ext['css'] === false ? false : css;
    const typeHere = (typeof node['$type'] === 'string' ? node['$type'] : type) as TokenType | undefined;
    // `$deprecated: false` на токене снимает пометку группы (Format Module, «Deprecated»)
    const own = node['$deprecated'] as string | boolean | undefined;
    const depHere: string | true | undefined = own === undefined ? deprecated : own === false ? undefined : own;
    if ('$value' in node) {
      if (!typeHere) throw new Error(`У токена ${path.join('.')} нет $type ни у него, ни у групп`);
      const t: Token = { path: path.join('.'), name: path[path.length - 1]!, type: typeHere, value: node['$value'], css: cssHere };
      if (typeof node['$description'] === 'string') t.description = node['$description'];
      if (depHere !== undefined) t.deprecated = depHere;
      out.push(t);
      return;
    }
    for (const [k, v] of Object.entries(node)) {
      if (k.startsWith('$')) continue;
      if (isObject(v)) walk(v, [...path, k], typeHere, depHere, cssHere);
    }
  };
  walk(tree, [], undefined, undefined, true);
  return out;
}

const ALIAS = /^\{([^{}]+)\}$/;
export const aliasTarget = (v: unknown): string | null =>
  typeof v === 'string' ? (ALIAS.exec(v)?.[1] ?? null) : null;

/** Полное значение токена без псевдонимов (и внутри композитов), с защитой от циклов. */
export function resolveValue(tokens: Map<string, Token>, value: unknown, stack: string[] = []): unknown {
  const target = aliasTarget(value);
  if (target) {
    if (stack.includes(target)) throw new Error(`Цикл псевдонимов: ${[...stack, target].join(' → ')}`);
    const t = tokens.get(target);
    if (!t) throw new Error(`Псевдоним указывает на несуществующий токен: {${target}}`);
    return resolveValue(tokens, t.value, [...stack, target]);
  }
  if (Array.isArray(value)) return value.map((v) => resolveValue(tokens, v, stack));
  if (isObject(value))
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveValue(tokens, v, stack)]));
  return value;
}

// ── Рендер значений в CSS ──
const clamp255 = (c: number) => Math.round(Math.min(1, Math.max(0, c)) * 255);
export function cssColor(c: ColorValue): string {
  if (c.colorSpace !== 'srgb') throw new Error(`Цветовое пространство ${c.colorSpace} в CSS не рендерим`);
  const [r, g, b] = c.components.map(clamp255) as [number, number, number];
  if (c.alpha !== undefined && c.alpha < 1) return `rgba(${r},${g},${b},${String(c.alpha).replace(/^0\./, '.')})`;
  if (c.hex) return c.hex.toLowerCase();
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}
/** Ноль без единицы — как в прежнем tokens.css (`0 6px 24px …`); спецификация требует unit только в JSON. */
const cssDim = (d: DimensionValue) => (d.value === 0 ? '0' : `${d.value}${d.unit}`);
const cssDur = (d: DurationValue) => `${d.value}${d.unit}`;
const GENERIC = new Set(['sans-serif', 'serif', 'monospace', 'system-ui', 'ui-monospace', 'ui-sans-serif', 'cursive', 'fantasy']);
const cssFamily = (f: string | string[]) =>
  (Array.isArray(f) ? f : [f]).map((n) => (GENERIC.has(n) || n.startsWith('-') ? n : `'${n}'`)).join(', ');

/**
 * Значение в CSS. Псевдоним на другой токен, выходящий в CSS, остаётся `var(--имя)` —
 * так `--info: var(--primary)` в тёмной теме следует за акцентом сам.
 */
export function cssValue(tokens: Map<string, Token>, token: Token, raw: unknown = token.value): string {
  const target = aliasTarget(raw);
  if (target) {
    const t = tokens.get(target);
    if (!t) throw new Error(`Псевдоним {${target}} у ${token.path} не найден`);
    resolveValue(tokens, raw, [token.path]); // цепочка должна разрешаться: цикл var(--a)→var(--b)→var(--a) CSS не спасёт
    if (t.css) return `var(--${t.name})`;
    return cssValue(tokens, t, t.value);
  }
  const v = resolveValue(tokens, raw) as never;
  switch (token.type) {
    case 'color':
      return cssColor(v);
    case 'dimension':
      return cssDim(v);
    case 'duration':
      return cssDur(v);
    case 'number':
    case 'fontWeight':
      return String(v);
    case 'fontFamily':
      return cssFamily(v);
    case 'cubicBezier':
      return `cubic-bezier(${(v as number[]).join(', ')})`;
    case 'transition': {
      const t = v as { duration: DurationValue; delay: DurationValue; timingFunction: number[] };
      const delay = t.delay.value ? ` ${cssDur(t.delay)}` : '';
      return `${cssDur(t.duration)}${delay} cubic-bezier(${t.timingFunction.join(', ')})`;
    }
    case 'shadow': {
      const list = (Array.isArray(v) ? v : [v]) as Array<{
        color: ColorValue; offsetX: DimensionValue; offsetY: DimensionValue; blur: DimensionValue; spread: DimensionValue; inset?: boolean;
      }>;
      // цвет тени может быть псевдонимом на семантику — тогда var(--…), как у кольца фокуса
      const colorOf = (i: number) => {
        const rawShadow = Array.isArray(raw) ? raw[i] : raw;
        const c = isObject(rawShadow) ? rawShadow['color'] : undefined;
        const ct = aliasTarget(c);
        const tok = ct ? tokens.get(ct) : undefined;
        return tok && tok.css ? `var(--${tok.name})` : cssColor(list[i]!.color);
      };
      return list
        .map((s, i) =>
          [s.inset ? 'inset' : '', cssDim(s.offsetX), cssDim(s.offsetY), cssDim(s.blur), s.spread.value ? cssDim(s.spread) : '', colorOf(i)]
            .filter(Boolean)
            .join(' '),
        )
        .join(', ');
    }
    default:
      throw new Error(`Тип ${token.type} у ${token.path} в CSS не рендерим`);
  }
}

export interface ThemeCss {
  /** имя переменной без `--` → строка CSS */
  vars: Map<string, string>;
  tokens: Map<string, Token>;
}
export function resolveTheme(doc: ResolverDocument, input: Input): ThemeCss {
  const tokens = new Map<string, Token>();
  for (const t of flatten(resolveTree(doc, input))) tokens.set(t.path, t);
  const vars = new Map<string, string>();
  for (const t of tokens.values()) {
    if (!t.css) continue;
    if (vars.has(t.name)) throw new Error(`Имя CSS-переменной повторяется: --${t.name} (${t.path})`);
    vars.set(t.name, cssValue(tokens, t));
  }
  return { vars, tokens };
}

/** Итоговое значение токена без псевдонимов (для контраста и проверок). */
export function resolvedValue(theme: ThemeCss, path: string): unknown {
  const t = theme.tokens.get(path);
  if (!t) throw new Error(`Токен ${path} не найден`);
  return resolveValue(theme.tokens, t.value);
}
export const byName = (theme: ThemeCss, name: string): Token => {
  const t = [...theme.tokens.values()].find((x) => x.css && x.name === name);
  if (!t) throw new Error(`Нет CSS-токена --${name}`);
  return t;
};

// ── Генерация файла ──
export const TOKENS_CSS_HEADER =
  '/* Сгенерировано scripts/design/build-tokens.ts из design/tokens.json — руками не править (DESIGN.md §2, ADR-047). */';

function block(selector: string, scheme: 'light' | 'dark', vars: Map<string, string>, only?: Map<string, string>, indent = ''): string {
  const lines = [`${indent}${selector} {`, `${indent}  color-scheme: ${scheme};`];
  for (const [name, value] of vars) {
    if (only && only.get(name) === value) continue;
    lines.push(`${indent}  --${name}: ${value};`);
  }
  lines.push(`${indent}}`);
  return lines.join('\n');
}

export function renderTokensCss(doc: ResolverDocument): string {
  const light = resolveTheme(doc, { theme: 'light', media: 'screen' });
  const dark = resolveTheme(doc, { theme: 'dark', media: 'screen' });
  const contrast = resolveTheme(doc, { theme: 'contrast', media: 'screen' });
  const print = resolveTheme(doc, { theme: 'light', media: 'print' });
  const printDark = resolveTheme(doc, { theme: 'dark', media: 'print' });
  // Печать перекрывает и тёмную тему (блок стоит позже [data-theme='dark'] при той же специфичности),
  // поэтому в него идут все токены, которые печать задаёт, а не только отличия от светлой.
  const printVars = new Map<string, string>();
  for (const [k, v] of print.vars)
    if (light.vars.get(k) !== v || dark.vars.get(k) !== printDark.vars.get(k)) printVars.set(k, v);
  return [
    TOKENS_CSS_HEADER,
    block(":root, [data-theme='light']", 'light', light.vars),
    block("[data-theme='dark']", 'dark', dark.vars, light.vars),
    block("[data-theme='contrast']", 'light', contrast.vars, light.vars),
    `@media print {\n${block(':root', 'light', printVars, undefined, '  ')}\n}`,
    '',
  ].join('\n');
}

// ── Контраст WCAG 2.x ──
const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export const luminance = (c: ColorValue) =>
  0.2126 * lin(c.components[0]) + 0.7152 * lin(c.components[1]) + 0.0722 * lin(c.components[2]);
/** Полупрозрачный передний план смешивается с фоном перед расчётом. */
export function contrastRatio(fg: ColorValue, bg: ColorValue): number {
  const a = fg.alpha ?? 1;
  const mixed: ColorValue = {
    colorSpace: 'srgb',
    components: fg.components.map((c, i) => c * a + bg.components[i]! * (1 - a)) as [number, number, number],
  };
  const l1 = luminance(mixed);
  const l2 = luminance(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

export interface ContrastRow {
  theme: string;
  fg: string;
  bg: string;
  ratio: number;
  min: number;
  ok: boolean;
  excepted?: string;
}
export function contrastTable(doc: ResolverDocument): ContrastRow[] {
  const ext = (doc.sets?.['semantic']?.$extensions?.['ai.wetop'] ?? {}) as {
    contrastPairs?: Array<[string, string, number]>;
    contrastExceptions?: Array<{ pair: [string, string]; themes: string[]; until: string; why: string }>;
  };
  const rows: ContrastRow[] = [];
  for (const theme of ['light', 'dark', 'contrast']) {
    const resolved = resolveTheme(doc, { theme, media: 'screen' });
    for (const [fg, bg, min] of ext.contrastPairs ?? []) {
      const ratio = contrastRatio(
        resolvedValue(resolved, byName(resolved, fg).path) as ColorValue,
        resolvedValue(resolved, byName(resolved, bg).path) as ColorValue,
      );
      const exc = ext.contrastExceptions?.find(
        (e) => e.pair[0] === fg && e.pair[1] === bg && e.themes.includes(theme),
      );
      const row: ContrastRow = { theme, fg, bg, ratio, min, ok: ratio >= min };
      if (exc) row.excepted = `${exc.why} — до: ${exc.until}`;
      rows.push(row);
    }
  }
  return rows;
}

export function renderContrastMd(rows: ContrastRow[]): string {
  const fmt = (n: number) => n.toFixed(2).replace('.', ',');
  const lines = [
    '# Контраст токенов (сгенерировано `scripts/design/build-tokens.ts`, руками не править)',
    '',
    'Пары «текст / фон» должны давать не меньше 4,5:1, «граница / фон» и «кольцо фокуса / фон» — 3:1 (документ ментора, DESIGN.md §10).',
    'Расчёт — по формуле относительной яркости WCAG 2.x; полупрозрачный цвет сначала смешивается с фоном.',
    'Строка «исключение» — известное нарушение с причиной и сроком закрытия; тест `scripts/design/src/scales.test.ts` пропускает только его и валит исключение, которое уже проходит.',
    '',
  ];
  for (const theme of ['light', 'dark', 'contrast']) {
    const title = { light: 'Светлая тема', dark: 'Тёмная тема', contrast: 'Контрастная тема (цель шага 4)' }[theme];
    lines.push(`## ${title}`, '', '| Передний план | Фон | Контраст | Норма | Итог |', '|---|---|---|---|---|');
    for (const r of rows.filter((x) => x.theme === theme))
      lines.push(
        `| \`--${r.fg}\` | \`--${r.bg}\` | ${fmt(r.ratio)}:1 | ${fmt(r.min)}:1 | ${r.ok ? 'проходит' : r.excepted ? `**не проходит**, исключение: ${r.excepted}` : '**НЕ ПРОХОДИТ**'} |`,
      );
    lines.push('');
  }
  return lines.join('\n');
}
