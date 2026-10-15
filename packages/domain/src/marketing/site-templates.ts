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
    ['hero', 'features', 'accommodations', 'pricing', 'booking', 'hours', 'contacts', 'cta'],
    { features: 'GRID', accommodations: 'CARDS', hours: 'TABLE', cta: 'BANNER' },
  ),
  t(
    'hotel-boutique',
    'HOSPITALITY',
    'Бутик-отель',
    'Глубокий премиальный фон, антиква и золото, номера крупными строками',
    { preset: 'NIGHT', accent: 'GOLD', typography: 'CLASSIC', radius: 'SHARP', density: 'COMFORTABLE', colorScheme: 'LIGHT' },
    ['hero', 'accommodations', 'features', 'pricing', 'booking', 'contacts', 'hours', 'cta'],
    { features: 'LIST', accommodations: 'ROWS', hours: 'COMPACT', cta: 'BANNER' },
  ),
  t(
    'hotel-hostel',
    'HOSPITALITY',
    'Хостел и апарт',
    'Тёплый и плотный: бронь первой, сразу за ней номера и цены',
    { preset: 'WARM', accent: 'TERRACOTTA', typography: 'ROUNDED', radius: 'ROUND', density: 'COMPACT', colorScheme: 'LIGHT' },
    ['hero', 'booking', 'accommodations', 'pricing', 'features', 'contacts', 'hours', 'cta'],
    { features: 'GRID', accommodations: 'CARDS', hours: 'COMPACT', cta: 'BANNER' },
  ),
  // ---------- салон красоты ----------
  t(
    'beauty-studio',
    'BEAUTY',
    'Светлая студия',
    'Чистый белый сайт: услуги списком с ценой и временем, мастера карточками, запись в блоке',
    { preset: 'CALM', accent: 'INDIGO', typography: 'MODERN', radius: 'SOFT', density: 'COMFORTABLE', colorScheme: 'LIGHT' },
    ['hero', 'features', 'services', 'staff', 'leadForm', 'hours', 'contacts', 'cta'],
    { features: 'GRID', services: 'LIST', staff: 'CARDS', leadForm: 'INLINE', hours: 'TABLE', cta: 'BANNER' },
  ),
  t(
    'beauty-boutique',
    'BEAUTY',
    'Бьюти-бутик',
    'Премиальный: тёмный первый экран, антиква, мастера первыми, услуги карточками',
    { preset: 'NIGHT', accent: 'GOLD', typography: 'CLASSIC', radius: 'SHARP', density: 'COMFORTABLE', colorScheme: 'LIGHT' },
    ['hero', 'staff', 'services', 'features', 'leadForm', 'hours', 'contacts', 'cta'],
    { features: 'LIST', services: 'CARDS', staff: 'CARDS', leadForm: 'CARD', hours: 'COMPACT', cta: 'BANNER' },
  ),
  t(
    'beauty-express',
    'BEAUTY',
    'Запись за минуту',
    'Тёплый и яркий: форма записи сразу под первым экраном, услуги и мастера компактно',
    { preset: 'WARM', accent: 'TERRACOTTA', typography: 'ROUNDED', radius: 'ROUND', density: 'COMPACT', colorScheme: 'LIGHT' },
    ['hero', 'leadForm', 'services', 'staff', 'hours', 'features', 'contacts', 'cta'],
    { features: 'GRID', services: 'CARDS', staff: 'LIST', leadForm: 'CARD', hours: 'COMPACT', cta: 'BANNER' },
  ),
  // ---------- ресторан ----------
  t(
    'food-cafe',
    'FOOD_SERVICE',
    'Уютное кафе',
    'Тёплые тона, меню списком с ценами, бронь стола и часы работы',
    { preset: 'WARM', accent: 'FOREST', typography: 'ROUNDED', radius: 'ROUND', density: 'COMFORTABLE', colorScheme: 'LIGHT' },
    ['hero', 'features', 'menu', 'leadForm', 'hours', 'contacts', 'cta'],
    { features: 'GRID', menu: 'LIST', leadForm: 'INLINE', hours: 'TABLE', cta: 'BANNER' },
  ),
  t(
    'food-restaurant',
    'FOOD_SERVICE',
    'Ресторан',
    'Вечерний премиальный стиль: антиква, золото, меню карточками и бронь стола карточкой',
    { preset: 'NIGHT', accent: 'GOLD', typography: 'CLASSIC', radius: 'SHARP', density: 'COMFORTABLE', colorScheme: 'LIGHT' },
    ['hero', 'menu', 'features', 'leadForm', 'hours', 'contacts', 'cta'],
    { features: 'LIST', menu: 'CARDS', leadForm: 'CARD', hours: 'COMPACT', cta: 'BANNER' },
  ),
  t(
    'food-delivery',
    'FOOD_SERVICE',
    'Быстрый заказ',
    'Свежий светлый сайт: бронь стола первой, меню компактно, часы рядом',
    { preset: 'COAST', accent: 'TEAL', typography: 'MODERN', radius: 'SOFT', density: 'COMPACT', colorScheme: 'LIGHT' },
    ['hero', 'leadForm', 'menu', 'hours', 'features', 'contacts', 'cta'],
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
 * Готовый сайт по шаблону: заготовка филиала по фактам, тема и порядок блоков шаблона, варианты секций шаблона. Тот же
 * документ дают те же факты и тот же шаблон. Шаблон чужого сегмента или неизвестный: `null`
 */
export function templateSiteSpec(facts: SiteFacts, templateId: unknown): Rec | null {
  const tpl = siteTemplateById(templateId);
  if (!tpl || tpl.vertical !== facts.vertical) return null;
  const spec = applyDesignDirection(starterSpecFromFacts(facts), tpl.direction) as Rec;
  for (const page of (spec['pages'] as Rec[]) ?? [])
    page['sections'] = ((page['sections'] as Rec[]) ?? []).map((s) => {
      const variant = tpl.variants[String(s['type'])];
      return variant ? { ...s, variant } : s;
    });
  return spec;
}
