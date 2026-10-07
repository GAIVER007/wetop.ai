import { canonicalJson } from './canonical';
import { siteSpecAssetRefs } from './assets';
import { localizedText } from './editor';

/**
 * Смысловая разница двух версий SiteSpec (MKT9, `docs/marketing/site-editor-v0.md` §5). Не построчный JSON, а события
 * для человека: что поменялось у сайта, какие страницы и секции добавлены, удалены, переставлены, у каких секций другой
 * вариант или содержимое, какие картинки добавлены, убраны или заменены. Страницы и секции узнаются по `id`;
 * перестановка это `moved`, а не «удалили и добавили». Порядок вывода детерминирован.
 */
type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => v !== null && typeof v === 'object' && !Array.isArray(v);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const same = (a: unknown, b: unknown) => canonicalJson(a ?? null) === canonicalJson(b ?? null);

export type SiteSpecChangeArea = 'site' | 'page' | 'section' | 'asset';
export type SiteSpecChangeKind = 'added' | 'removed' | 'moved' | 'changed' | 'variant' | 'replaced';

export interface SiteSpecChange {
  area: SiteSpecChangeArea;
  kind: SiteSpecChangeKind;
  /** Сайт: displayName, tagline, locales, contacts, legal, seo, theme, integrations, navigation; страница: title, slug, seo, settings; секция: page (перенос на другую страницу) */
  field?: string;
  pageId?: string;
  sectionId?: string;
  sectionType?: string;
  /** Название страницы или заголовок секции на языке по умолчанию (новой версии, у удалённого старой) */
  label?: string;
  /** Вариант секции или картинка: было и стало */
  from?: string;
  to?: string;
  /** Место картинки: logo, favicon, page:<id>:og, section:<id>:image, section:<id>:images, section:<id>:items */
  slot?: string;
}

const SITE_FIELDS: Array<[string, (spec: Rec) => unknown]> = [
  ['displayName', (s) => (s['site'] as Rec | undefined)?.['displayName']],
  ['tagline', (s) => ((s['site'] as Rec | undefined)?.['brand'] as Rec | undefined)?.['tagline']],
  ['locales', (s) => [(s['site'] as Rec | undefined)?.['locales'], (s['site'] as Rec | undefined)?.['defaultLocale']]],
  ['contacts', (s) => (s['site'] as Rec | undefined)?.['contacts']],
  ['legal', (s) => (s['site'] as Rec | undefined)?.['legal']],
  ['seo', (s) => (s['site'] as Rec | undefined)?.['seo']],
  ['theme', (s) => s['theme']],
  ['integrations', (s) => s['integrations']],
  ['navigation', (s) => s['navigation']],
];

interface PageInfo {
  id: string;
  page: Rec;
  sections: Array<{ id: string; section: Rec }>;
}

function pagesOf(spec: Rec): PageInfo[] {
  return list(spec['pages'])
    .filter(isRec)
    .filter((p) => typeof p['id'] === 'string')
    .map((p) => ({
      id: p['id'] as string,
      page: p,
      sections: list(p['sections'])
        .filter(isRec)
        .filter((s) => typeof s['id'] === 'string')
        .map((s) => ({ id: s['id'] as string, section: s })),
    }));
}

/** Элементы, не входящие в наибольшую общую подпоследовательность: они и «переставлены» */
function movedIds(from: readonly string[], to: readonly string[]): Set<string> {
  const common = new Set(from.filter((id) => to.includes(id)));
  const a = from.filter((id) => common.has(id));
  const b = to.filter((id) => common.has(id));
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i -= 1)
    for (let j = b.length - 1; j >= 0; j -= 1)
      dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
  const keep = new Set<string>();
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      keep.add(a[i]!);
      i += 1;
      j += 1;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) i += 1;
    else j += 1;
  }
  return new Set(b.filter((id) => !keep.has(id)));
}

/** Содержимое секции без служебных полей и без ссылок на картинки: картинки идут отдельными событиями */
function content(section: Rec): string {
  const strip = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(strip);
    if (!isRec(v)) return v;
    const out: Rec = {};
    for (const [k, x] of Object.entries(v)) if (!['assetId', 'imageAssetId', 'faviconAssetId'].includes(k)) out[k] = strip(x);
    return out;
  };
  const { id: _id, type: _type, variant: _variant, ...rest } = section;
  return canonicalJson(strip(rest));
}

function slotsOf(spec: Rec): Map<string, string[]> {
  const pages = list(spec['pages']);
  const slots = new Map<string, string[]>();
  for (const ref of siteSpecAssetRefs(spec)) {
    let slot: string;
    if (ref.path.startsWith('site.brand.logo')) slot = 'logo';
    else if (ref.path === 'site.brand.faviconAssetId') slot = 'favicon';
    else {
      const m = /^pages\[(\d+)\](?:\.sections\[(\d+)\]\.(images|image|items)\b)?/.exec(ref.path);
      const page = m ? (pages[Number(m[1])] as Rec | undefined) : undefined;
      if (!m || !page) continue;
      if (!m[2]) slot = `page:${String(page['id'])}:og`;
      else {
        const section = list(page['sections'])[Number(m[2])] as Rec | undefined;
        slot = `section:${String(section?.['id'])}:${m[3]}`;
      }
    }
    const ids = slots.get(slot) ?? [];
    if (!ids.includes(ref.assetId)) ids.push(ref.assetId);
    slots.set(slot, ids);
  }
  return slots;
}

const SINGLE = (slot: string) => slot === 'logo' || slot === 'favicon' || slot.endsWith(':og') || slot.endsWith(':image');

export function diffSiteSpecs(fromSpec: unknown, toSpec: unknown): SiteSpecChange[] {
  const from = isRec(fromSpec) ? fromSpec : {};
  const to = isRec(toSpec) ? toSpec : {};
  const locale = String((to['site'] as Rec | undefined)?.['defaultLocale'] ?? (from['site'] as Rec | undefined)?.['defaultLocale'] ?? 'ru');
  const out: SiteSpecChange[] = [];

  for (const [field, get] of SITE_FIELDS) if (!same(get(from), get(to))) out.push({ area: 'site', kind: 'changed', field });

  // страницы
  const fromPages = pagesOf(from);
  const toPages = pagesOf(to);
  const fromById = new Map(fromPages.map((p) => [p.id, p]));
  const toIds = new Set(toPages.map((p) => p.id));
  const movedPages = movedIds(fromPages.map((p) => p.id), toPages.map((p) => p.id));
  for (const p of toPages) {
    const label = localizedText(p.page['title'], locale);
    const before = fromById.get(p.id);
    if (!before) {
      out.push({ area: 'page', kind: 'added', pageId: p.id, label });
      continue;
    }
    if (movedPages.has(p.id)) out.push({ area: 'page', kind: 'moved', pageId: p.id, label });
    for (const [field, key] of [['title', 'title'], ['slug', 'slug'], ['seo', 'seo'], ['settings', 'isHome']] as const)
      if (!same(before.page[key], p.page[key])) out.push({ area: 'page', kind: 'changed', field, pageId: p.id, label });
  }
  for (const p of fromPages)
    if (!toIds.has(p.id)) out.push({ area: 'page', kind: 'removed', pageId: p.id, label: localizedText(p.page['title'], locale) });

  // секции: id уникален во всём документе, поэтому перенос на другую страницу тоже узнаётся
  const fromSections = new Map<string, { pageId: string; section: Rec }>();
  for (const p of fromPages) for (const s of p.sections) fromSections.set(s.id, { pageId: p.id, section: s.section });
  const toSectionIds = new Set<string>();
  for (const p of toPages) {
    const before = fromById.get(p.id);
    const stayed = p.sections.filter((s) => fromSections.get(s.id)?.pageId === p.id).map((s) => s.id);
    const beforeOrder = (before?.sections ?? []).map((s) => s.id).filter((id) => stayed.includes(id));
    const moved = movedIds(beforeOrder, stayed);
    for (const s of p.sections) {
      toSectionIds.add(s.id);
      const type = String(s.section['type']);
      const label = localizedText(s.section['heading'], locale);
      const was = fromSections.get(s.id);
      const base = { area: 'section' as const, pageId: p.id, sectionId: s.id, sectionType: type, label };
      if (!was) {
        out.push({ ...base, kind: 'added' });
        continue;
      }
      if (was.pageId !== p.id) out.push({ ...base, kind: 'moved', field: 'page', from: was.pageId, to: p.id });
      else if (moved.has(s.id)) out.push({ ...base, kind: 'moved' });
      if (was.section['variant'] !== s.section['variant'])
        out.push({ ...base, kind: 'variant', from: String(was.section['variant']), to: String(s.section['variant']) });
      if (content(was.section) !== content(s.section) || was.section['type'] !== s.section['type'])
        out.push({ ...base, kind: 'changed' });
    }
  }
  for (const p of fromPages)
    for (const s of p.sections)
      if (!toSectionIds.has(s.id))
        out.push({
          area: 'section',
          kind: 'removed',
          pageId: p.id,
          sectionId: s.id,
          sectionType: String(s.section['type']),
          label: localizedText(s.section['heading'], locale),
        });

  // картинки по местам
  const before = slotsOf(from);
  const after = slotsOf(to);
  const slots = [...new Set([...before.keys(), ...after.keys()])].sort();
  for (const slot of slots) {
    const a = before.get(slot) ?? [];
    const b = after.get(slot) ?? [];
    if (SINGLE(slot) && a.length === 1 && b.length === 1) {
      if (a[0] !== b[0]) out.push({ area: 'asset', kind: 'replaced', slot, from: a[0]!, to: b[0]! });
      continue;
    }
    for (const id of [...b].sort()) if (!a.includes(id)) out.push({ area: 'asset', kind: 'added', slot, to: id });
    for (const id of [...a].sort()) if (!b.includes(id)) out.push({ area: 'asset', kind: 'removed', slot, from: id });
  }
  return out;
}
