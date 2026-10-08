import { canonicalJson } from './canonical';
import { applySectionVariant, SITE_EDITOR_SECTIONS, type EditorField } from './editor';
import { PATCH_INSTRUCTION_MAX, INSTRUCTION_COLUMN_MAX } from './edit';
import { suggestMarketingSlug } from './site-slug';
import { SITE_SPEC_SECTIONS, SITE_SPEC_THEME } from './site-spec';
import { extensionAccess, type ExtensionAccess, type ExtensionState } from '../accounts/extensions';

/**
 * Лицензированный конструктор сайта (MKT9.2, `docs/marketing/licensed-site-builder-v0.md`). Чистые правила без базы и
 * React: доступ по лицензии филиала, адрес сайта при заведении, разбор ответа ассистента (Чат, План, Оформление),
 * направление оформления и его применение без ИИ, правка текста прямо на сайте только в разрешённых полях.
 * Единственный судья документа по-прежнему `validateSiteSpec`.
 */
type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => v !== null && typeof v === 'object' && !Array.isArray(v);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u0009\u000b-\u001f\u007f]/;

export const SITE_ASSISTANT_SCHEMA_VERSION = 'site-assistant/0' as const;
export const SITE_AI_USER_TEXT_MAX = 4000;
export const SITE_AI_ASSISTANT_TEXT_MAX = 12000;
export const SITE_AI_PAYLOAD_MAX_BYTES = 32_768;
export const BUILDER_INSTRUCTIONS_MAX = 5000;
export const BOOKMARK_LABEL_MAX = 120;
export const BOOKMARKS_PER_SITE = 20;
/** Запросов к ИИ сайта на человека в организации за час, все режимы вместе (Чат, План, Оформление, Сборка) */
export const SITE_AI_REQUESTS_PER_HOUR = 10;
export const PLAN_QUESTIONS_MAX = 4;
export const DESIGN_DIRECTIONS = 3;

export type SiteAiMode = 'CHAT' | 'PLAN' | 'DESIGN';
export const SITE_AI_MODES: readonly SiteAiMode[] = ['CHAT', 'PLAN', 'DESIGN'];

// ---------- лицензия ----------

/** Доступ к конструктору по лицензии филиала: те же правила срока, что у расширений организации (§16.3) */
export function siteBuilderAccess(row: ExtensionState | null, now: Date): ExtensionAccess {
  return extensionAccess(row, now);
}

export type SiteBuilderDeniedCode = 'SITE_BUILDER_NOT_ENABLED' | 'SITE_BUILDER_EXPIRED';

/** Отказ записи без действующей лицензии: код для программы и слова для человека */
export function siteBuilderDenied(access: Exclude<ExtensionAccess, 'active'>): { code: SiteBuilderDeniedCode; message: string } {
  return access === 'expired'
    ? { code: 'SITE_BUILDER_EXPIRED', message: 'Срок лицензии конструктора сайта вышел: сайт доступен только для чтения' }
    : { code: 'SITE_BUILDER_NOT_ENABLED', message: 'Конструктор сайта не подключён для этого филиала' };
}

// ---------- заведение сайта ----------

/**
 * Адрес сайта при заведении (bootstrap): подсказка из имени филиала; занятый получает суффикс `-2`, `-3`… по порядку,
 * основа обрезается, чтобы суффикс влез в 40 знаков. Детерминированно: тот же набор занятых даёт тот же адрес
 */
export function bootstrapSlug(name: string, taken: ReadonlySet<string>): string {
  const base = suggestMarketingSlug(name);
  if (!taken.has(base)) return base;
  for (let n = 2; n < 1000; n += 1) {
    const suffix = `-${n}`;
    const candidate = `${base.slice(0, 40 - suffix.length).replace(/-+$/g, '')}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error('Не нашлось свободного адреса сайта');
}

function cleanText(raw: unknown, max: number, optional: boolean, label: string): { ok: true; value: string | null } | { ok: false; message: string } {
  if (raw === undefined || raw === null) return optional ? { ok: true, value: null } : { ok: false, message: `${label}: обязательно` };
  if (typeof raw !== 'string') return { ok: false, message: `${label}: строка` };
  const value = raw.replace(/\r\n?/g, '\n').trim();
  if (!value) return optional ? { ok: true, value: null } : { ok: false, message: `${label}: обязательно` };
  if (CONTROL_RE.test(value)) return { ok: false, message: `${label}: управляющие символы недопустимы` };
  if ([...value].length > max) return { ok: false, message: `${label}: не длиннее ${max} знаков` };
  return { ok: true, value };
}

/** Знания проекта: постоянные указания ИИ этого сайта, до 5000 знаков; пусто снимает */
export function parseBuilderInstructions(raw: unknown) {
  return cleanText(raw, BUILDER_INSTRUCTIONS_MAX, true, 'Знания проекта');
}

export function parseBookmarkLabel(raw: unknown) {
  return cleanText(raw, BOOKMARK_LABEL_MAX, false, 'Подпись закладки');
}

/** Запрос человека к ассистенту: до 4000 знаков; пустой можно только там, где режим это допускает (оформление) */
export function parseAssistantText(raw: unknown, optional: boolean) {
  return cleanText(raw, SITE_AI_USER_TEXT_MAX, optional, 'Запрос');
}

// ---------- ответ ассистента ----------

export interface PlanQuestion {
  id: string;
  question: string;
  options: string[];
  allowCustom: boolean;
}

export interface DesignTheme {
  preset: string;
  accent: string;
  typography: string;
  radius: string;
  density: string;
  colorScheme: string;
}

export interface DesignDirection {
  id: string;
  name: string;
  shortDescription: string;
  theme: DesignTheme;
  heroVariant: string;
  sectionOrder: string[];
}

export type AssistantPayload =
  | { kind: 'CHAT'; suggestBuild: boolean; suggestPublish: boolean }
  | { kind: 'QUESTIONS'; questions: PlanQuestion[] }
  | {
      kind: 'PLAN';
      summary: string;
      affectedPages: string[];
      affectedSections: string[];
      steps: string[];
      tradeoffs: string[];
      buildInstruction: string;
    }
  | { kind: 'DESIGN'; directions: DesignDirection[] };

export type AssistantResult = { ok: true; assistantText: string; payload: AssistantPayload } | { ok: false; errors: string[] };

const ID_RE = /^[a-z0-9][a-z0-9-]{0,47}$/;
const URL_RE = /https?:\/\/|www\./i;
const TAG_RE = /<\/?[a-z!]|[{}]/i;

class Reader {
  errors: string[] = [];
  keys(v: unknown, path: string, allowed: string[], required: string[] = allowed): v is Rec {
    if (!isRec(v)) {
      this.errors.push(`${path}: объект`);
      return false;
    }
    for (const k of Object.keys(v)) if (!allowed.includes(k)) this.errors.push(`${path}.${k}: лишнее поле`);
    for (const k of required) if (!(k in v)) this.errors.push(`${path}.${k}: нет поля`);
    return true;
  }
  /** Текст для человека: без разметки, кода и ссылок, если `plain` */
  text(v: unknown, path: string, max: number, plain = false): string {
    if (typeof v !== 'string' || !v.trim()) {
      this.errors.push(`${path}: непустая строка`);
      return '';
    }
    const t = v.replace(/\r\n?/g, '\n').trim();
    if ([...t].length > max) this.errors.push(`${path}: не длиннее ${max}`);
    if (CONTROL_RE.test(t)) this.errors.push(`${path}: управляющие символы`);
    if (plain && (URL_RE.test(t) || TAG_RE.test(t))) this.errors.push(`${path}: без разметки и ссылок`);
    return t;
  }
  strings(v: unknown, path: string, min: number, max: number, itemMax: number, plain = true): string[] {
    if (!Array.isArray(v) || v.length < min || v.length > max) {
      this.errors.push(`${path}: от ${min} до ${max} строк`);
      return [];
    }
    return v.map((s, i) => this.text(s, `${path}[${i}]`, itemMax, plain));
  }
  bool(v: unknown, path: string): boolean {
    if (v === undefined) return false;
    if (typeof v !== 'boolean') this.errors.push(`${path}: да или нет`);
    return v === true;
  }
  oneOf(v: unknown, path: string, allowed: readonly string[]): string {
    if (typeof v !== 'string' || !allowed.includes(v)) this.errors.push(`${path}: одно из ${allowed.join(', ')}`);
    return String(v);
  }
}

function readDirection(r: Reader, v: unknown, path: string): DesignDirection | null {
  if (!r.keys(v, path, ['id', 'name', 'shortDescription', 'theme', 'heroVariant', 'sectionOrder'])) return null;
  const id = typeof v['id'] === 'string' && ID_RE.test(v['id']) ? v['id'] : (r.errors.push(`${path}.id: идентификатор`), '');
  const name = r.text(v['name'], `${path}.name`, 60, true);
  const shortDescription = r.text(v['shortDescription'], `${path}.shortDescription`, 200, true);
  const themeKeys = Object.keys(SITE_SPEC_THEME) as Array<keyof typeof SITE_SPEC_THEME>;
  const theme = {} as DesignTheme;
  if (r.keys(v['theme'], `${path}.theme`, themeKeys))
    for (const key of themeKeys) theme[key] = r.oneOf((v['theme'] as Rec)[key], `${path}.theme.${key}`, SITE_SPEC_THEME[key]);
  const heroVariant = r.oneOf(v['heroVariant'], `${path}.heroVariant`, SITE_SPEC_SECTIONS['hero'] ?? []);
  const order = list(v['sectionOrder']);
  if (!Array.isArray(v['sectionOrder']) || order.length < 1 || order.length > Object.keys(SITE_SPEC_SECTIONS).length)
    r.errors.push(`${path}.sectionOrder: список типов секций`);
  const sectionOrder = order.map((t, i) => r.oneOf(t, `${path}.sectionOrder[${i}]`, Object.keys(SITE_SPEC_SECTIONS)));
  if (new Set(sectionOrder).size !== sectionOrder.length) r.errors.push(`${path}.sectionOrder: без повторов`);
  return { id, name, shortDescription, theme, heroVariant, sectionOrder };
}

/**
 * Ответ бота глазами платформы: строгая форма по режиму, лишнее поле или нарушение предела означает отказ всего
 * ответа (`SCHEMA_INVALID` у задачи). Текст ответа показывается человеку как текст, без разметки
 */
export function parseAssistantResult(mode: SiteAiMode, raw: unknown): AssistantResult {
  const r = new Reader();
  let assistantText = '';
  let payload: AssistantPayload | null = null;
  if (mode === 'CHAT') {
    if (r.keys(raw, 'result', ['answer', 'suggestBuild', 'suggestPublish'], ['answer'])) {
      assistantText = r.text(raw['answer'], 'result.answer', SITE_AI_ASSISTANT_TEXT_MAX);
      payload = { kind: 'CHAT', suggestBuild: r.bool(raw['suggestBuild'], 'result.suggestBuild'), suggestPublish: r.bool(raw['suggestPublish'], 'result.suggestPublish') };
    }
  } else if (mode === 'PLAN') {
    const kind = isRec(raw) ? raw['kind'] : undefined;
    if (kind === 'QUESTIONS') {
      if (r.keys(raw, 'result', ['kind', 'intro', 'questions'], ['kind', 'questions'])) {
        const intro = raw['intro'] === undefined ? null : r.text(raw['intro'], 'result.intro', 500);
        const items = list(raw['questions']);
        if (!Array.isArray(raw['questions']) || items.length < 1 || items.length > PLAN_QUESTIONS_MAX)
          r.errors.push(`result.questions: от 1 до ${PLAN_QUESTIONS_MAX}`);
        const questions = items.map((q, i): PlanQuestion => {
          const p = `result.questions[${i}]`;
          if (!r.keys(q, p, ['id', 'question', 'options', 'allowCustom'], ['id', 'question', 'options'])) return { id: '', question: '', options: [], allowCustom: false };
          const id = typeof q['id'] === 'string' && ID_RE.test(q['id']) ? q['id'] : (r.errors.push(`${p}.id: идентификатор`), '');
          return {
            id,
            question: r.text(q['question'], `${p}.question`, 300, true),
            options: r.strings(q['options'], `${p}.options`, 2, 6, 120),
            allowCustom: r.bool(q['allowCustom'], `${p}.allowCustom`),
          };
        });
        if (new Set(questions.map((q) => q.id)).size !== questions.length) r.errors.push('result.questions: id без повторов');
        assistantText = intro ?? 'Чтобы составить план, ответьте на несколько вопросов.';
        payload = { kind: 'QUESTIONS', questions };
      }
    } else if (kind === 'PLAN') {
      if (r.keys(raw, 'result', ['kind', 'summary', 'affectedPages', 'affectedSections', 'steps', 'tradeoffs', 'buildInstruction'])) {
        const ids = (v: unknown, p: string) => {
          if (!Array.isArray(v) || v.length > 50 || !v.every((x) => typeof x === 'string' && ID_RE.test(x))) {
            r.errors.push(`${p}: список id`);
            return [];
          }
          return v as string[];
        };
        const summary = r.text(raw['summary'], 'result.summary', 600, true);
        payload = {
          kind: 'PLAN',
          summary,
          affectedPages: ids(raw['affectedPages'], 'result.affectedPages'),
          affectedSections: ids(raw['affectedSections'], 'result.affectedSections'),
          steps: r.strings(raw['steps'], 'result.steps', 1, 10, 300),
          tradeoffs: r.strings(raw['tradeoffs'], 'result.tradeoffs', 0, 5, 300),
          buildInstruction: r.text(raw['buildInstruction'], 'result.buildInstruction', PATCH_INSTRUCTION_MAX),
        };
        assistantText = summary;
      }
    } else r.errors.push('result.kind: QUESTIONS или PLAN');
  } else {
    if (r.keys(raw, 'result', ['directions'])) {
      const items = list(raw['directions']);
      if (!Array.isArray(raw['directions']) || items.length !== DESIGN_DIRECTIONS) r.errors.push(`result.directions: ровно ${DESIGN_DIRECTIONS}`);
      const directions = items.map((d, i) => readDirection(r, d, `result.directions[${i}]`)).filter((d): d is DesignDirection => d !== null);
      if (new Set(directions.map((d) => d.id)).size !== directions.length) r.errors.push('result.directions: id без повторов');
      assistantText = 'Три варианта оформления: выберите один.';
      payload = { kind: 'DESIGN', directions };
    }
  }
  if (payload && new TextEncoder().encode(JSON.stringify(payload)).length > SITE_AI_PAYLOAD_MAX_BYTES) r.errors.push('result: больше 32 КиБ');
  if (r.errors.length || !payload) return { ok: false, errors: r.errors.length ? r.errors : ['result: пусто'] };
  return { ok: true, assistantText, payload };
}

// ---------- направление оформления ----------

/**
 * Применить направление без ИИ: тема целиком, вариант первого экрана главной (если для него хватает данных: вариант с
 * фото без фото не ставится) и порядок блоков главной (названные типы по порядку, остальные следом в прежнем порядке).
 * Тексты, картинки, страницы и всё остальное не меняются; результат снова проверяет `validateSiteSpec`
 */
export function applyDesignDirection(spec: unknown, direction: DesignDirection): Rec {
  const next = structuredClone(isRec(spec) ? spec : {}) as Rec;
  next['theme'] = { ...(isRec(next['theme']) ? next['theme'] : {}), ...direction.theme };
  for (const page of list(next['pages'])) {
    if (!isRec(page) || page['isHome'] !== true) continue;
    const sections = list(page['sections']).filter(isRec);
    const rank = (s: Rec) => {
      const i = direction.sectionOrder.indexOf(String(s['type']));
      return i < 0 ? direction.sectionOrder.length : i;
    };
    const ordered = sections.map((s, i) => ({ s, i })).sort((a, b) => rank(a.s) - rank(b.s) || a.i - b.i).map((x) => x.s);
    page['sections'] = ordered.map((s) => {
      if (s['type'] !== 'hero' || s['variant'] === direction.heroVariant) return s;
      const needsImage = direction.heroVariant !== 'TEXT_ONLY';
      if (needsImage && !isRec(s['image'])) return s;
      return applySectionVariant(s, direction.heroVariant);
    });
  }
  return next;
}

/**
 * Конверт первой сборки с выбранным направлением в `generation_runs.instruction`: первая строка канонический JSON
 * `{"v":1,"design":{…}}`, после перевода строки пожелания человека (пусто: без пожеланий). Воркер применяет тему сам,
 * модели уходит только описание словами
 */
export function encodeDesignInstruction(design: DesignDirection, text: string | null): string {
  const out = `${canonicalJson({ v: 1, design })}\n${text ?? ''}`;
  if ([...out].length > INSTRUCTION_COLUMN_MAX) throw new Error('Конверт оформления длиннее колонки');
  return out;
}

export function decodeDesignInstruction(raw: string | null): { design: DesignDirection; text: string | null } | null {
  if (!raw) return null;
  const cut = raw.indexOf('\n');
  if (cut < 0) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw.slice(0, cut));
  } catch {
    return null;
  }
  if (!isRec(value) || Object.keys(value).sort().join(',') !== 'design,v' || value['v'] !== 1) return null;
  const r = new Reader();
  const design = readDirection(r, value['design'], 'design');
  if (!design || r.errors.length) return null;
  const rest = raw.slice(cut + 1);
  return { design, text: rest.trim() ? rest : null };
}

/** Пожелания для модели словами: что выбрал человек и что он написал сам */
export function designInstructionText(decoded: { design: DesignDirection; text: string | null }): string {
  const d = decoded.design;
  const line = `Оформление «${d.name}»: ${d.shortDescription}. Порядок блоков главной: ${d.sectionOrder.join(', ')}.`;
  return decoded.text ? `${decoded.text}\n\n${line}` : line;
}

// ---------- правка текста прямо на сайте ----------

export interface InlineTextTarget {
  /** Путь в документе, как у ошибок валидатора: `pages[0].sections[1].heading` */
  path: string;
  /** Предел поля в знаках */
  max: number;
  /** Текст на языке правки (пусто, если перевода ещё нет) */
  value: string;
}

function fieldTargets(record: Rec, fields: readonly EditorField[], base: string, locale: string, out: InlineTextTarget[]) {
  // целью становятся только текст, список текстов, подпись кнопки и тексты внутри списков; выбор категории, картинки,
  // карта, переключатели и значки сюда не попадают ни одной веткой
  for (const field of fields) {
    const value = record[field.key];
    const path = `${base}.${field.key}`;
    if (field.spec.kind === 'text') {
      if (isRec(value)) out.push({ path, max: field.spec.max, value: String(value[locale] ?? '') });
    } else if (field.spec.kind === 'textList') {
      const max = field.spec.max;
      list(value).forEach((v, i) => isRec(v) && out.push({ path: `${path}[${i}]`, max, value: String(v[locale] ?? '') }));
    } else if (field.spec.kind === 'cta') {
      if (isRec(value) && isRec(value['label'])) out.push({ path: `${path}.label`, max: 30, value: String(value['label'][locale] ?? '') });
    } else if (field.spec.kind === 'list') {
      const item = field.spec.item;
      list(value).forEach((v, i) => isRec(v) && fieldTargets(v, item, `${path}[${i}]`, locale, out));
    }
  }
}

/**
 * Тексты, которые можно править прямо на сайте (режим «Текст»): заголовки и тексты секций, подписи кнопок, пункты меню,
 * слоган. Цены, наличие, бронь, тарифы, даты, коды категорий, картинки, ссылки, контакты, юридическое, адреса страниц и
 * идентификаторы сюда не попадают по построению: берутся только текстовые поля реестра редактора
 */
export function inlineTextTargets(spec: unknown, locale: string): InlineTextTarget[] {
  const out: InlineTextTarget[] = [];
  if (!isRec(spec)) return out;
  const site = isRec(spec['site']) ? spec['site'] : {};
  const brand = isRec(site['brand']) ? site['brand'] : {};
  if (isRec(brand['tagline'])) out.push({ path: 'site.brand.tagline', max: 120, value: String(brand['tagline'][locale] ?? '') });
  const nav = isRec(spec['navigation']) ? spec['navigation'] : {};
  for (const [key, max] of [['header', 30], ['footer', 40]] as const)
    list(nav[key]).forEach((item, i) => {
      if (isRec(item) && isRec(item['label'])) out.push({ path: `navigation.${key}[${i}].label`, max, value: String(item['label'][locale] ?? '') });
    });
  list(spec['pages']).forEach((page, p) => {
    if (!isRec(page)) return;
    list(page['sections']).forEach((section, s) => {
      if (!isRec(section)) return;
      const shape = SITE_EDITOR_SECTIONS[String(section['type'])];
      if (!shape) return;
      const variant = String(section['variant']);
      fieldTargets(section, shape.fields.filter((f) => !f.variants || f.variants.includes(variant)), `pages[${p}].sections[${s}]`, locale, out);
    });
  });
  return out;
}

/** Путь в части: `a.b[2].c` → ['a','b',2,'c'] */
function pathParts(path: string): Array<string | number> | null {
  if (!/^[a-zA-Z]+(?:\[\d+\]|\.[a-zA-Z]+)*$/.test(path)) return null;
  const parts: Array<string | number> = [];
  for (const m of path.matchAll(/([a-zA-Z]+)|\[(\d+)\]/g)) parts.push(m[1] !== undefined ? m[1] : Number(m[2]));
  return parts;
}

/**
 * Правка одного текста на языке `locale`: путь только из `inlineTextTargets`, текст обрезан по краям, не пустой и не
 * длиннее предела поля. Возвращает новый документ; старый не меняется
 */
export function setInlineText(spec: unknown, path: string, locale: string, raw: string): { ok: true; spec: Rec } | { ok: false; message: string } {
  const target = inlineTextTargets(spec, locale).find((t) => t.path === path);
  if (!target) return { ok: false, message: 'Этот текст на сайте не правится: откройте форму блока' };
  const parsed = cleanText(raw, target.max, false, 'Текст');
  if (!parsed.ok) return { ok: false, message: parsed.message };
  const parts = pathParts(path);
  if (!parts) return { ok: false, message: 'Неверный путь' };
  const next = structuredClone(spec) as Rec;
  let node: unknown = next;
  for (const part of parts) node = (node as Record<string | number, unknown>)[part];
  if (!isRec(node)) return { ok: false, message: 'Неверный путь' };
  node[locale] = parsed.value;
  return { ok: true, spec: next };
}
