import type { SiteBriefInput } from './brief';
import { canonicalJson } from './canonical';
import { siteSpecAssetRefs } from './assets';
import { validateSiteSpec, type SiteSpecError, type SiteSpecResult } from './site-spec';

/**
 * Правила ИИ-правки готового сайта (MKT9, `docs/marketing/site-editor-v0.md` §6, контракт бота `site-edit/0`). Отдельно
 * от первой генерации (`checkGeneratedSpec`, MKT6): там ИИ строит документ из брифа, здесь меняет существующую версию
 * и не может выдумать то, чего в ней не было. Команда человека это данные, а не правила: границы держит платформа.
 */
export const SITE_EDIT_SCHEMA_VERSION = 'site-edit/0' as const;
export const PATCH_INSTRUCTION_MAX = 1800;
/** Текст команды SECTION короче: конверт с id страницы и секции обязан влезть в `generation_runs.instruction` (2000) */
export const SECTION_INSTRUCTION_MAX = 1500;
export const INSTRUCTION_COLUMN_MAX = 2000;
export const SECTION_DEFAULT_INSTRUCTION = 'Пересобери эту секцию, сохранив её назначение.';

const ID_RE = /^[a-z0-9][a-z0-9-]{0,47}$/;
// управляющие символы, кроме перевода строки: команда это обычный текст в несколько строк
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u0009\u000b-\u001f\u007f]/;

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => v !== null && typeof v === 'object' && !Array.isArray(v);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const same = (a: unknown, b: unknown) => canonicalJson(a ?? null) === canonicalJson(b ?? null);

/** Команда человека: обрезка краёв, переводы строк к `\n`, без управляющих символов, с пределом; пустая только если можно */
export function parseEditInstruction(
  raw: unknown,
  max: number,
  optional: boolean,
): { ok: true; text: string | null } | { ok: false; message: string } {
  if (raw === undefined || raw === null) return optional ? { ok: true, text: null } : { ok: false, message: 'instruction: напишите, что изменить' };
  if (typeof raw !== 'string') return { ok: false, message: 'instruction: строка' };
  const text = raw.replace(/\r\n?/g, '\n').trim();
  if (!text) return optional ? { ok: true, text: null } : { ok: false, message: 'instruction: напишите, что изменить' };
  if (CONTROL_RE.test(text)) return { ok: false, message: 'instruction: управляющие символы недопустимы' };
  if ([...text].length > max) return { ok: false, message: `instruction: не длиннее ${max} знаков` };
  return { ok: true, text };
}

export interface SectionTarget {
  pageId: string;
  sectionId: string;
}

/**
 * Конверт команды SECTION в `generation_runs.instruction`: первая строка это канонический JSON заголовка
 * `{"pageId","sectionId","v":1}`, после перевода строки текст человека как есть (пусто: команда по умолчанию). Текст не
 * экранируется, поэтому длина конверта ограничена заранее: заголовок до 100 знаков плюс текст до 1500 меньше 2000
 * (кавычки и обратные косые в JSON удвоили бы худший случай)
 */
export function encodeSectionInstruction(target: SectionTarget, text: string | null): string {
  if (!ID_RE.test(target.pageId) || !ID_RE.test(target.sectionId)) throw new Error('Неверный id цели');
  if (text !== null && ([...text].length > SECTION_INSTRUCTION_MAX || CONTROL_RE.test(text) || !text.trim()))
    throw new Error('Неверный текст команды');
  const out = `${canonicalJson({ v: 1, pageId: target.pageId, sectionId: target.sectionId })}\n${text ?? ''}`;
  if ([...out].length > INSTRUCTION_COLUMN_MAX) throw new Error('Конверт команды длиннее колонки');
  return out;
}

/** Строгий разбор конверта: заголовок ровно с полями v, pageId, sectionId и v = 1; иначе null */
export function decodeSectionInstruction(raw: string | null): { target: SectionTarget; text: string | null } | null {
  if (!raw) return null;
  const cut = raw.indexOf('\n');
  if (cut < 0) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw.slice(0, cut));
  } catch {
    return null;
  }
  if (!isRec(value)) return null;
  if (Object.keys(value).sort().join(',') !== 'pageId,sectionId,v' || value['v'] !== 1) return null;
  const { pageId, sectionId } = value;
  if (typeof pageId !== 'string' || !ID_RE.test(pageId) || typeof sectionId !== 'string' || !ID_RE.test(sectionId)) return null;
  const rest = raw.slice(cut + 1);
  if (rest === '') return { target: { pageId, sectionId }, text: null };
  if (!rest.trim() || [...rest].length > SECTION_INSTRUCTION_MAX || CONTROL_RE.test(rest)) return null;
  return { target: { pageId, sectionId }, text: rest };
}

/** Где цель в документе: страница по id и секция по id именно на этой странице */
export function findSection(spec: unknown, target: SectionTarget): { pageIndex: number; sectionIndex: number; section: Rec } | null {
  if (!isRec(spec)) return null;
  const pages = list(spec['pages']);
  const pageIndex = pages.findIndex((p) => isRec(p) && p['id'] === target.pageId);
  if (pageIndex < 0) return null;
  const sections = list((pages[pageIndex] as Rec)['sections']);
  const sectionIndex = sections.findIndex((s) => isRec(s) && s['id'] === target.sectionId);
  return sectionIndex < 0 ? null : { pageIndex, sectionIndex, section: sections[sectionIndex] as Rec };
}

/** Все внешние адреса документа (ссылки и кнопки EXTERNAL, соцсети) */
function externalUrls(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => externalUrls(v, out));
  else if (isRec(value)) {
    if ((value['kind'] === 'EXTERNAL' || typeof value['network'] === 'string') && typeof value['url'] === 'string') out.add(value['url']);
    for (const v of Object.values(value)) externalUrls(v, out);
  }
  return out;
}

function categoryCodes(value: unknown, path: string, out: Array<{ path: string; code: unknown }>): typeof out {
  if (Array.isArray(value)) value.forEach((v, i) => categoryCodes(v, `${path}[${i}]`, out));
  else if (isRec(value)) {
    if (value['categoryCode'] !== undefined) out.push({ path: `${path}.categoryCode`, code: value['categoryCode'] });
    list(value['categoryCodes']).forEach((code, i) => out.push({ path: `${path}.categoryCodes[${i}]`, code }));
    for (const [k, v] of Object.entries(value)) if (k !== 'categoryCodes') categoryCodes(v, path ? `${path}.${k}` : k, out);
  }
  return out;
}

export type EditMode = { mode: 'PATCH' } | { mode: 'SECTION'; target: SectionTarget };

/**
 * Ответ модели на правку глазами платформы. Сначала тот же валидатор SiteSpec v0, затем границы правки:
 * - PATCH: личность, контакты, юридическое, языки, SEO сайта, интеграции, страницы (число, порядок, id, адрес,
 *   главная, SEO) как в базе; разметка FAQ как в базе; картинки и внешние адреса только из базы; категории из брифа;
 * - SECTION: всё, кроме целевой секции, канонически равно базе; у цели тот же id, тип и место, картинки и внешние
 *   адреса только из базовой цели, категории из брифа.
 * Любое нарушение: документ не принимается (`SCHEMA_INVALID` у задачи).
 */
export function checkEditedSpec(spec: unknown, baseSpec: unknown, input: SiteBriefInput, edit: EditMode): SiteSpecResult {
  const checked = validateSiteSpec(spec);
  const errors: SiteSpecError[] = checked.ok ? [] : [...checked.errors];
  if (!isRec(spec) || !isRec(baseSpec)) return checked.ok ? { ok: false, errors: [{ path: '', code: 'type', message: 'Ожидается объект' }] } : checked;
  const fail = (path: string, code: string, message: string) => errors.push({ path, code, message });
  const known = new Set(input.accommodations.map((a) => a.categoryCode));

  if (edit.mode === 'SECTION') {
    const before = findSection(baseSpec, edit.target);
    const after = findSection(spec, edit.target);
    if (!before) fail('', 'unknown_target', 'Цели нет в базовой версии');
    else if (!after || after.pageIndex !== before.pageIndex || after.sectionIndex !== before.sectionIndex)
      fail(`pages[${before.pageIndex}].sections[${before.sectionIndex}]`, 'target_moved', 'Секция осталась на своём месте');
    else {
      const path = `pages[${after.pageIndex}].sections[${after.sectionIndex}]`;
      if (after.section['id'] !== before.section['id'] || after.section['type'] !== before.section['type'])
        fail(path, 'target_identity', 'У секции тот же id и тип');
      // всё, кроме цели, канонически как в базе: цель в выходе подменяется базовой и документы сравниваются целиком
      const probe = structuredClone(spec);
      ((probe['pages'] as Rec[])[after.pageIndex]!['sections'] as unknown[])[after.sectionIndex] = before.section;
      if (!same(probe, baseSpec)) fail('', 'outside_target', 'Меняется только выбранная секция');
      const baseAssets = new Set(siteSpecAssetRefs({ pages: [{ sections: [before.section] }] }).map((r) => r.assetId));
      for (const ref of siteSpecAssetRefs({ pages: [{ sections: [after.section] }] }))
        if (!baseAssets.has(ref.assetId)) fail(ref.path.replace(/^pages\[0\]\.sections\[0\]/, path), 'foreign_asset', 'Новые картинки выбирает человек');
      const baseUrls = externalUrls(before.section);
      for (const url of externalUrls(after.section)) if (!baseUrls.has(url)) fail(path, 'invented_link', 'Новые внешние ссылки не допускаются');
      for (const ref of categoryCodes(after.section, path, []))
        if (typeof ref.code !== 'string' || !known.has(ref.code)) fail(ref.path, 'unknown_category', 'Категории нет в брифе');
    }
    return errors.length ? { ok: false, errors } : checked;
  }

  const site = isRec(spec['site']) ? spec['site'] : {};
  const baseSite = isRec(baseSpec['site']) ? baseSpec['site'] : {};
  for (const key of ['vertical', 'displayName', 'locales', 'defaultLocale', 'contacts', 'legal', 'seo'])
    if (!same(site[key], baseSite[key])) fail(`site.${key}`, 'immutable_field', 'ИИ это поле не меняет');
  if (!same(spec['integrations'], baseSpec['integrations'])) fail('integrations', 'immutable_field', 'ИИ это поле не меняет');

  const pages = list(spec['pages']);
  const basePages = list(baseSpec['pages']);
  if (pages.length !== basePages.length) fail('pages', 'immutable_field', 'ИИ не добавляет и не удаляет страницы');
  basePages.forEach((bp, i) => {
    const p = pages[i];
    if (!isRec(bp) || !isRec(p)) return;
    for (const key of ['id', 'slug', 'isHome', 'seo'])
      if (!same(p[key], bp[key])) fail(`pages[${i}].${key}`, 'immutable_field', 'ИИ это поле не меняет');
  });
  // разметка FAQ для поисковиков: настройка человека (MKT11 отвечает за ИИ-SEO)
  const baseFaq = new Map<string, unknown>();
  for (const bp of basePages) for (const s of list(isRec(bp) ? bp['sections'] : null)) if (isRec(s)) baseFaq.set(String(s['id']), s['emitStructuredData']);
  pages.forEach((p, i) =>
    list(isRec(p) ? p['sections'] : null).forEach((s, j) => {
      if (isRec(s) && s['type'] === 'faq' && !same(s['emitStructuredData'], baseFaq.get(String(s['id']))))
        fail(`pages[${i}].sections[${j}].emitStructuredData`, 'immutable_field', 'ИИ это поле не меняет');
    }),
  );
  const baseAssets = new Set(siteSpecAssetRefs(baseSpec).map((r) => r.assetId));
  for (const ref of siteSpecAssetRefs(spec)) if (!baseAssets.has(ref.assetId)) fail(ref.path, 'foreign_asset', 'Новые картинки выбирает человек');
  const baseUrls = externalUrls(baseSpec);
  for (const url of externalUrls(spec)) if (!baseUrls.has(url)) fail('', 'invented_link', 'Новые внешние ссылки не допускаются');
  for (const ref of categoryCodes(spec, '', []))
    if (typeof ref.code !== 'string' || !known.has(ref.code)) fail(ref.path.replace(/^\./, ''), 'unknown_category', 'Категории нет в брифе');
  return errors.length ? { ok: false, errors } : checked;
}
