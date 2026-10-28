import { applyDesignDirection, type DesignDirection } from './builder';
import type { SiteFacts, SiteFactsVertical } from './site-facts';
import { starterSpecFromFacts } from './starter';

/**
 * Шаблоны готовых сайтов по сегментам (SITE-1, поручение владельца 15.10.2026): у гостиницы, салона и ресторана по три
 * своих шаблона. Выбор шаблона сразу даёт готовый сайт филиала из его данных (`starterSpecFromFacts`: каталог, цены,
 * мастера, меню, часы, контакты), без ИИ и без промптов; дальше сайт правится в редакторе как любой другой.
 *
 * Шаблон это не только цвет: своя тема (словари SiteSpec v0), свой порядок блоков главной и свои варианты секций
 * (карточки или список услуг, мастера карточками или строкой, меню списком или карточками, форма в блоке или
 * карточкой). Чего у филиала нет (мастеров, часов), того блока в сайте не будет: шаблон ничего не выдумывает.
 */
export interface SiteTemplate {
  id: string;
  vertical: SiteFactsVertical;
  name: string;
  description: string;
  /** Тема, первый экран и порядок блоков главной: та же форма, что у направления оформления ИИ */
  direction: DesignDirection;
  /** Вариант секции по её типу; секции, которой нет в сайте, вариант не нужен */
  variants: Readonly<Record<string, string>>;
}

const t = (
  id: string,
  vertical: SiteFactsVertical,
  name: string,
  description: string,
  theme: DesignDirection['theme'],
  sectionOrder: string[],
  variants: Record<string, string>,
): SiteTemplate => ({
  id,
  vertical,
  name,
  description,
  direction: { id, name, shortDescription: description, theme, heroVariant: 'TEXT_ONLY', sectionOrder },
  variants,
});

export const SITE_TEMPLATES: readonly SiteTemplate[] = Object.freeze([
  // ---------- гостиница ----------
  t(
    'hotel-classic',
    'HOSPITALITY',
    'Классический отель',
    'Светлый и спокойный: номера карточками, цены «от» и бронь сразу под ними',
    { preset: 'CALM', accent: 'TEAL', typography: 'MODERN', radius: 'SOFT', density: 'COMFORTABLE', colorScheme: 'LIGHT' },
    ['hero', 'features', 'accommodations', 'pricing', 'booking', 'hours', 'faq', 'contacts', 'cta'],
    { features: 'GRID', accommodations: 'CARDS', hours: 'TABLE', cta: 'BANNER' },
  ),
  t(
    'hotel-boutique',
    'HOSPITALITY',
    'Бутик-отель',
    'Глубокий премиальный фон, антиква и золото, номера крупными строками',
    { preset: 'NIGHT', accent: 'GOLD', typography: 'CLASSIC', radius: 'SHARP', density: 'COMFORTABLE', colorScheme: 'LIGHT' },
    ['hero', 'accommodations', 'features', 'pricing', 'booking', 'faq', 'contacts', 'hours', 'cta'],
    { features: 'LIST', accommodations: 'ROWS', hours: 'COMPACT', cta: 'BANNER' },
  ),
  t(
    'hotel-hostel',
    'HOSPITALITY',
    'Хостел и апарт',
    'Тёплый и плотный: бронь первой, сразу за ней номера и цены',
    { preset: 'WARM', accent: 'TERRACOTTA', typography: 'ROUNDED', radius: 'ROUND', density: 'COMPACT', colorScheme: 'LIGHT' },
    ['hero', 'booking', 'accommodations', 'pricing', 'features', 'faq', 'contacts', 'hours', 'cta'],
    { features: 'GRID', accommodations: 'CARDS', hours: 'COMPACT', cta: 'BANNER' },
  ),
  // ---------- салон красоты ----------
  t(
    'beauty-studio',
    'BEAUTY',
    'Светлая студия',
    'Чистый белый сайт: услуги списком с ценой и временем, мастера карточками, запись в блоке',
    { preset: 'CALM', accent: 'INDIGO', typography: 'MODERN', radius: 'SOFT', density: 'COMFORTABLE', colorScheme: 'LIGHT' },
    ['hero', 'features', 'services', 'staff', 'leadForm', 'hours', 'faq', 'contacts', 'cta'],
    { features: 'GRID', services: 'LIST', staff: 'CARDS', leadForm: 'INLINE', hours: 'TABLE', cta: 'BANNER' },
  ),
  t(
    'beauty-boutique',
    'BEAUTY',
    'Бьюти-бутик',
    'Премиальный: тёмный первый экран, антиква, мастера первыми, услуги карточками',
    { preset: 'NIGHT', accent: 'GOLD', typography: 'CLASSIC', radius: 'SHARP', density: 'COMFORTABLE', colorScheme: 'LIGHT' },
    ['hero', 'staff', 'services', 'features', 'leadForm', 'hours', 'faq', 'contacts', 'cta'],
    { features: 'LIST', services: 'CARDS', staff: 'CARDS', leadForm: 'CARD', hours: 'COMPACT', cta: 'BANNER' },
  ),
  t(
    'beauty-express',
    'BEAUTY',
    'Запись за минуту',
    'Тёплый и яркий: форма записи сразу под первым экраном, услуги и мастера компактно',
    { preset: 'WARM', accent: 'TERRACOTTA', typography: 'ROUNDED', radius: 'ROUND', density: 'COMPACT', colorScheme: 'LIGHT' },
    ['hero', 'leadForm', 'services', 'staff', 'hours', 'features', 'faq', 'contacts', 'cta'],
    { features: 'GRID', services: 'CARDS', staff: 'LIST', leadForm: 'CARD', hours: 'COMPACT', cta: 'BANNER' },
  ),
  // ---------- ресторан ----------
  t(
    'food-cafe',
    'FOOD_SERVICE',
    'Уютное кафе',
    'Тёплые тона, меню списком с ценами, бронь стола и часы работы',
    { preset: 'WARM', accent: 'FOREST', typography: 'ROUNDED', radius: 'ROUND', density: 'COMFORTABLE', colorScheme: 'LIGHT' },
    ['hero', 'features', 'menu', 'leadForm', 'hours', 'faq', 'contacts', 'cta'],
    { features: 'GRID', menu: 'LIST', leadForm: 'INLINE', hours: 'TABLE', cta: 'BANNER' },
  ),
  t(
    'food-restaurant',
    'FOOD_SERVICE',
    'Ресторан',
    'Вечерний премиальный стиль: антиква, золото, меню карточками и бронь стола карточкой',
    { preset: 'NIGHT', accent: 'GOLD', typography: 'CLASSIC', radius: 'SHARP', density: 'COMFORTABLE', colorScheme: 'LIGHT' },
    ['hero', 'menu', 'features', 'leadForm', 'hours', 'faq', 'contacts', 'cta'],
    { features: 'LIST', menu: 'CARDS', leadForm: 'CARD', hours: 'COMPACT', cta: 'BANNER' },
  ),
  t(
    'food-delivery',
    'FOOD_SERVICE',
    'Быстрый заказ',
    'Свежий светлый сайт: бронь стола первой, меню компактно, часы рядом',
    { preset: 'COAST', accent: 'TEAL', typography: 'MODERN', radius: 'SOFT', density: 'COMPACT', colorScheme: 'LIGHT' },
    ['hero', 'leadForm', 'menu', 'hours', 'features', 'faq', 'contacts', 'cta'],
    { features: 'GRID', menu: 'LIST', leadForm: 'CARD', hours: 'COMPACT', cta: 'BANNER' },
  ),
]);

/** Три шаблона сегмента в порядке показа */
export function siteTemplatesFor(vertical: string | null | undefined): SiteTemplate[] {
  return SITE_TEMPLATES.filter((s) => s.vertical === vertical);
}

/** Шаблон по id; неизвестный: `null` (сервер отвечает отказом, а не берёт первый попавшийся) */
export function siteTemplateById(id: unknown): SiteTemplate | null {
  return typeof id === 'string' ? (SITE_TEMPLATES.find((s) => s.id === id) ?? null) : null;
}

type Rec = Record<string, unknown>;

/**
 * Варианты секций, которые шаблон меняет безопасно: у них нет обязательной картинки, поэтому смена варианта не делает
 * документ неверным. Первый экран и призыв с картинкой остаются как были (фото человека не теряется)
 */
const SAFE_VARIANTS = new Set(['features', 'accommodations', 'services', 'staff', 'menu', 'leadForm', 'hours']);

/**
 * Смена шаблона у готового сайта (простой редактор, SITE-1): тема, порядок блоков главной и варианты секций шаблона,
 * а тексты, фото, цены и блоки сайта остаются как есть. Первый экран с фото фото сохраняет. Неизвестный шаблон: `null`
 */
export function applySiteTemplate(spec: unknown, templateId: unknown): Rec | null {
  const tpl = siteTemplateById(templateId);
  if (!tpl) return null;
  const pages = ((spec as Rec | null)?.['pages'] as Rec[] | undefined) ?? [];
  const home = pages.find((p) => p['isHome'] === true) ?? pages[0];
  const hero = ((home?.['sections'] as Rec[] | undefined) ?? []).find((s) => s['type'] === 'hero');
  const keepHero = hero && hero['image'] !== undefined && typeof hero['variant'] === 'string';
  const direction: DesignDirection = keepHero ? { ...tpl.direction, heroVariant: hero['variant'] as DesignDirection['heroVariant'] } : tpl.direction;
  const next = applyDesignDirection(spec, direction) as Rec;
  for (const page of (next['pages'] as Rec[] | undefined) ?? [])
    page['sections'] = ((page['sections'] as Rec[] | undefined) ?? []).map((s) => {
      const type = String(s['type']);
      const variant = tpl.variants[type];
      return variant && SAFE_VARIANTS.has(type) ? { ...s, variant } : s;
    });
  return next;
}

/** Какой шаблон сегмента у сайта сейчас: тема и раскладка совпадают с шаблоном; иначе `null` (сайт правили) */
export function currentSiteTemplate(spec: unknown, vertical: string | null | undefined): SiteTemplate | null {
  const theme = JSON.stringify((spec as Rec | null)?.['theme'] ?? null);
  return siteTemplatesFor(vertical).find((t) => JSON.stringify({ ...((spec as Rec)['theme'] as Rec), ...t.direction.theme }) === theme) ?? null;
}

/**
 * Готовый сайт по шаблону: заготовка филиала по фактам, тема и порядок блоков шаблона, варианты секций шаблона. Тот же
 * документ дают те же факты и тот же шаблон. Шаблон чужого сегмента или неизвестный: `null`
 */
export function templateSiteSpec(facts: SiteFacts, templateId: unknown): Rec | null {
  const tpl = siteTemplateById(templateId);
  if (!tpl || tpl.vertical !== facts.vertical) return null;
  return applySiteTemplate(starterSpecFromFacts(facts), tpl.id);
}
