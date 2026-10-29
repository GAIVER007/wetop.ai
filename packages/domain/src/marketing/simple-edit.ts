import { validateSiteSpec } from './site-spec';

/**
 * Простой экран сайта (SITE-1, решение владельца 15.10.2026): сайт это зеркало данных WETOP, клиент делает пять вещей:
 * выбирает шаблон, ставит фото, правит 2–3 текста, включает и выключает блоки, публикует. Здесь чистые правки
 * документа для этих действий: каждая возвращает новый документ, входной не меняется, а правка, после которой
 * документ стал бы неверным, не применяется (возвращается входной). Списки услуг, мастеров, меню, часы и контакты
 * берутся из WETOP (`liveSiteSpec`), здесь их не правят.
 */
type Rec = Record<string, unknown>;
export interface SimpleImage {
  assetId: string;
  alt: Record<string, string>;
}

/** Блоки, которые клиент может выключить; остальные (первый экран, услуги, меню, форма, контакты) нужны всегда */
export const SIMPLE_BLOCKS: ReadonlyArray<{ type: string; label: string; hint: string }> = Object.freeze([
  { type: 'features', label: 'Преимущества', hint: 'Почему выбирают вас' },
  { type: 'staff', label: 'Мастера', hint: 'Из сотрудников WETOP' },
  { type: 'hours', label: 'Часы работы', hint: 'Из графика WETOP' },
  { type: 'faq', label: 'Вопросы и ответы', hint: 'Для Google и ИИ-поиска, из данных WETOP' },
  { type: 'cta', label: 'Призыв записаться', hint: 'Блок в конце страницы' },
]);

export interface SimpleSiteState {
  heroHeading: string;
  heroSubheading: string;
  heroPhoto: SimpleImage | null;
  about: string;
  gallery: SimpleImage[];
  /** Блок по типу: есть ли он на главной */
  blocks: Record<string, boolean>;
}

const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const localeOf = (spec: Rec) => {
  const site = isRec(spec['site']) ? spec['site'] : {};
  return typeof site['defaultLocale'] === 'string' ? site['defaultLocale'] : 'ru';
};
const textIn = (v: unknown, locale: string) => (isRec(v) && typeof v[locale] === 'string' ? (v[locale] as string) : '');
function homeOf(spec: Rec): Rec | null {
  const pages = Array.isArray(spec['pages']) ? (spec['pages'] as Rec[]) : [];
  return pages.find((p) => p['isHome'] === true) ?? pages[0] ?? null;
}
const sectionsOf = (page: Rec | null) => (page && Array.isArray(page['sections']) ? (page['sections'] as Rec[]) : []);
const asImage = (v: unknown): SimpleImage | null =>
  isRec(v) && typeof v['assetId'] === 'string' && isRec(v['alt']) ? { assetId: v['assetId'], alt: v['alt'] as Record<string, string> } : null;

/** Правка копии главной; итог прошёл валидатор, иначе входной документ */
function edit(spec: Rec, fn: (home: Rec, doc: Rec) => void): Rec {
  const doc = clone(spec);
  const home = homeOf(doc);
  if (!home) return spec;
  fn(home, doc);
  if (JSON.stringify(doc) === JSON.stringify(spec)) return spec;
  return validateSiteSpec(doc).ok ? doc : spec;
}

/** Уникальный id секции в документе */
function freeId(doc: Rec, base: string): string {
  const used = new Set(((doc['pages'] as Rec[] | undefined) ?? []).flatMap((p) => sectionsOf(p).map((s) => String(s['id']))));
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

/** Куда вставить новый блок: после первого найденного из списка, иначе перед формой или контактами, иначе в конец */
function insertAfter(home: Rec, section: Rec, after: string[]): void {
  const list = sectionsOf(home);
  for (const type of after) {
    const i = list.findIndex((s) => s['type'] === type);
    if (i >= 0) {
      list.splice(i + 1, 0, section);
      return;
    }
  }
  const tail = list.findIndex((s) => s['type'] === 'leadForm' || s['type'] === 'contacts' || s['type'] === 'cta');
  if (tail >= 0) list.splice(tail, 0, section);
  else list.push(section);
}

/** Убрать ссылки меню и подвала на удалённые секции */
function dropNav(doc: Rec, ids: Set<string>): void {
  const nav = isRec(doc['navigation']) ? doc['navigation'] : null;
  if (!nav) return;
  for (const key of ['header', 'footer'])
    if (Array.isArray(nav[key]))
      nav[key] = (nav[key] as Rec[]).filter((item) => {
        const target = isRec(item['target']) ? item['target'] : null;
        return !(target && target['kind'] === 'SECTION' && ids.has(String(target['sectionId'])));
      });
}

export function simpleSiteState(spec: Rec): SimpleSiteState {
  const locale = localeOf(spec);
  const list = sectionsOf(homeOf(spec));
  const hero = list.find((s) => s['type'] === 'hero');
  const about = list.find((s) => s['type'] === 'about');
  const gallery = list.find((s) => s['type'] === 'gallery');
  const blocks: Record<string, boolean> = {};
  for (const b of SIMPLE_BLOCKS) blocks[b.type] = list.some((s) => s['type'] === b.type);
  return {
    heroHeading: textIn(hero?.['heading'], locale),
    heroSubheading: textIn(hero?.['subheading'], locale),
    heroPhoto: asImage(hero?.['image']),
    about: ((about?.['paragraphs'] as unknown[] | undefined) ?? []).map((p) => textIn(p, locale)).filter(Boolean).join('\n\n'),
    gallery: ((gallery?.['images'] as unknown[] | undefined) ?? []).map(asImage).filter((x): x is SimpleImage => x !== null),
    blocks,
  };
}

/** Заголовок или подзаголовок первого экрана на языке; пустой подзаголовок убирает его, пустой заголовок не принимается */
export function setHeroText(spec: Rec, field: 'heading' | 'subheading', locale: string, value: string): Rec {
  const text = value.replace(/\s+/g, ' ').trim();
  return edit(spec, (home) => {
    const hero = sectionsOf(home).find((s) => s['type'] === 'hero');
    if (!hero) return;
    if (!text) {
      if (field === 'subheading') delete hero['subheading'];
      return;
    }
    hero[field] = { ...(isRec(hero[field]) ? hero[field] : {}), [locale]: text };
  });
}

/** Фото первого экрана: с фото вариант на всю ширину (или сохраняется выбранный вариант с фото), без фото только текст */
export function setHeroPhoto(spec: Rec, image: SimpleImage | null): Rec {
  return edit(spec, (home) => {
    const hero = sectionsOf(home).find((s) => s['type'] === 'hero');
    if (!hero) return;
    if (image) {
      hero['image'] = { assetId: image.assetId, alt: image.alt };
      if (hero['variant'] === 'TEXT_ONLY') hero['variant'] = 'IMAGE_FULL';
    } else {
      delete hero['image'];
      hero['variant'] = 'TEXT_ONLY';
    }
  });
}

/** «О нас»: абзацы по пустой строке (до 6); блок создаётся после услуг, меню или номеров; пустой текст убирает блок */
export function setAboutText(spec: Rec, locale: string, value: string): Rec {
  const paragraphs = value
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 6)
    .map((p) => ({ [locale]: p.slice(0, 600) }));
  return edit(spec, (home, doc) => {
    const list = sectionsOf(home);
    const i = list.findIndex((s) => s['type'] === 'about');
    if (!paragraphs.length) {
      if (i >= 0) {
        const [gone] = list.splice(i, 1);
        dropNav(doc, new Set([String(gone!['id'])]));
      }
      return;
    }
    if (i >= 0) {
      list[i]!['paragraphs'] = paragraphs;
      return;
    }
    const heading = locale === 'kk' ? 'Біз туралы' : locale === 'en' ? 'About us' : 'О нас';
    insertAfter(home, { id: freeId(doc, 'sec-about'), type: 'about', variant: 'TEXT_ONLY', heading: { [locale]: heading }, paragraphs }, [
      'services',
      'menu',
      'accommodations',
    ]);
  });
}

/** Галерея: от трёх фото блок есть (до 24), меньше трёх блока нет; ставится после «О нас», мастеров или услуг */
export function setGalleryPhotos(spec: Rec, images: SimpleImage[]): Rec {
  const picked = images.slice(0, 24).map((x) => ({ assetId: x.assetId, alt: x.alt }));
  return edit(spec, (home, doc) => {
    const list = sectionsOf(home);
    const i = list.findIndex((s) => s['type'] === 'gallery');
    if (picked.length < 3) {
      if (i >= 0) {
        const [gone] = list.splice(i, 1);
        dropNav(doc, new Set([String(gone!['id'])]));
      }
      return;
    }
    if (i >= 0) {
      list[i]!['images'] = picked;
      return;
    }
    const locale = localeOf(doc);
    const heading = locale === 'kk' ? 'Біздің жұмыстар' : locale === 'en' ? 'Our work' : 'Наши работы';
    insertAfter(home, { id: freeId(doc, 'sec-gallery'), type: 'gallery', variant: 'GRID', heading: { [locale]: heading }, images: picked }, [
      'about',
      'staff',
      'services',
      'menu',
      'accommodations',
    ]);
  });
}

/**
 * Включить или выключить необязательный блок. Выключение убирает блок и ссылки на него в меню; включение берёт блок
 * из шаблона (документ, собранный тем же шаблоном по свежим фактам) и ставит его на место по порядку шаблона. Блока
 * нет и в шаблоне (например, мастеров нет в WETOP): документ без изменений
 */
export function toggleSiteBlock(spec: Rec, type: string, on: boolean, template: Rec): Rec {
  if (!SIMPLE_BLOCKS.some((b) => b.type === type)) return spec;
  const has = sectionsOf(homeOf(spec)).some((s) => s['type'] === type);
  if (has === on) return spec;
  if (!on)
    return edit(spec, (home, doc) => {
      const gone = sectionsOf(home).filter((s) => s['type'] === type);
      home['sections'] = sectionsOf(home).filter((s) => s['type'] !== type);
      dropNav(doc, new Set(gone.map((s) => String(s['id']))));
    });
  const tplList = sectionsOf(homeOf(template));
  const fromTpl = tplList.find((s) => s['type'] === type);
  if (!fromTpl) return spec;
  return edit(spec, (home, doc) => {
    const list = sectionsOf(home);
    const section = clone(fromTpl);
    section['id'] = freeId(doc, String(section['id']));
    // место по порядку шаблона: после ближайшего предыдущего блока шаблона, который есть в сайте
    const order = tplList.map((s) => s['type']);
    const before = order.slice(0, order.indexOf(type)).reverse();
    let at = -1;
    for (const t of before) {
      at = list.findIndex((s) => s['type'] === t);
      if (at >= 0) break;
    }
    list.splice(at + 1, 0, section);
    // пункт меню шаблона на этот блок возвращается, если он был
    const nav = isRec(doc['navigation']) ? doc['navigation'] : null;
    const tplNav = isRec(template['navigation']) ? template['navigation'] : null;
    const link = ((tplNav?.['header'] as Rec[] | undefined) ?? []).find(
      (h) => isRec(h['target']) && (h['target'] as Rec)['sectionId'] === fromTpl['id'],
    );
    if (nav && link && Array.isArray(nav['header']) && (nav['header'] as Rec[]).length < 7) {
      const copy = clone(link);
      (copy['target'] as Rec)['sectionId'] = section['id'];
      (nav['header'] as Rec[]).push(copy);
    }
  });
}

/**
 * SEO главной в простом экране (аудит «Сайт и SEO» 28.10.2026, S5): заголовок и описание для поисковиков и показ сайта
 * в поиске. Лимиты как у валидатора страницы (60 и 160 знаков), лишнее обрезается, пустое убирает поле.
 */
export const SEO_TITLE_MAX = 60;
export const SEO_DESCRIPTION_MAX = 160;

export interface SimpleSiteSeo {
  title: string;
  description: string;
  /** сайт показывается в поиске: у сайта INDEX и главная с индексом */
  indexed: boolean;
}

export function simpleSiteSeo(spec: Rec): SimpleSiteSeo {
  const locale = localeOf(spec);
  const home = homeOf(spec);
  const seo = home && isRec(home['seo']) ? home['seo'] : {};
  const site = isRec(spec['site']) ? spec['site'] : {};
  const siteSeo = isRec(site['seo']) ? site['seo'] : {};
  return {
    title: textIn(seo['title'], locale),
    description: textIn(seo['description'], locale),
    indexed: siteSeo['robots'] !== 'NOINDEX' && seo['index'] !== false,
  };
}

export function setHomeSeo(spec: Rec, field: 'title' | 'description', locale: string, value: string): Rec {
  const max = field === 'title' ? SEO_TITLE_MAX : SEO_DESCRIPTION_MAX;
  const text = [...value.replace(/\s+/g, ' ').trim()].slice(0, max).join('').trim();
  return edit(spec, (home) => {
    const seo = isRec(home['seo']) ? home['seo'] : (home['seo'] = { index: true, includeInSitemap: true, canonical: 'SELF' });
    if (!text) {
      if (isRec(seo[field])) {
        const rest = { ...(seo[field] as Rec) };
        delete rest[locale];
        if (Object.keys(rest).length) seo[field] = rest;
        else delete seo[field];
      }
      return;
    }
    seo[field] = { ...(isRec(seo[field]) ? seo[field] : {}), [locale]: text };
  });
}

/** Показ в поиске одним переключателем: сайт INDEX/NOINDEX, главная с индексом и в карте сайта или без них */
export function setSiteIndexing(spec: Rec, on: boolean): Rec {
  return edit(spec, (home, doc) => {
    const site = isRec(doc['site']) ? doc['site'] : null;
    if (!site || !isRec(site['seo'])) return;
    (site['seo'] as Rec)['robots'] = on ? 'INDEX' : 'NOINDEX';
    const seo = isRec(home['seo']) ? home['seo'] : (home['seo'] = { canonical: 'SELF' });
    seo['index'] = on;
    seo['includeInSitemap'] = on;
  });
}

/** Вид в выдаче Google: свой заголовок или заголовок первого экрана, иначе имя; адрес без https */
export function searchPreview(spec: Rec, siteUrl: string | null, fallbackName: string): { title: string; description: string; url: string } {
  const own = simpleSiteSeo(spec);
  const st = simpleSiteState(spec);
  const cut = (s: string, max: number) => ([...s].length > max ? `${[...s].slice(0, max - 1).join('')}…` : s);
  return {
    title: cut(own.title || st.heroHeading || fallbackName, SEO_TITLE_MAX),
    description: cut(own.description || st.heroSubheading || st.about.split('\n')[0] || '', SEO_DESCRIPTION_MAX),
    url: (siteUrl ?? '').replace(/^https?:\/\//, '').replace(/\/$/, ''),
  };
}
