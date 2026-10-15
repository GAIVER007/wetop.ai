import type { DesignDirection } from './builder';

/**
 * Готовые направления оформления первого экрана «Сайт и SEO» (SITE-1, `plans/site-seo-flow-2026-10-15.md` §1 шаг 3).
 * Три карточки дизайна появляются сразу и без ИИ: это детерминированный набор, а не ответ модели. Значения темы только
 * из словарей SiteSpec v0 (`SITE_SPEC_THEME`), вариант первого экрана и порядок блоков из реестра секций, поэтому
 * направление проходит ту же проверку, что ответ ИИ (`decodeDesignInstruction`), и применяется `applyDesignDirection`.
 *
 * Сервер берёт направление по id отсюда (доверенный источник): браузер передаёт только `designPresetId`.
 *
 * Тёмной схемы в SiteSpec v0 нет (`colorScheme` только `LIGHT`), поэтому «премиальная» семья держится на пресете
 * NIGHT (глубокий холодный фон), графитовом или золотом акценте и антикве; настоящая тёмная тема требует правки
 * `site-spec.ts` и рантайма `apps/sites` (вне среза SITE-1).
 */
export type DesignPresetFamily = 'LIGHT' | 'DEEP' | 'WARM';

export interface DesignPreset extends DesignDirection {
  family: DesignPresetFamily;
}

// Порядок блоков главной: типы всех трёх направлений (гостиница, салон, ресторан); чего на сайте нет, то пропускается
const HOME_SALES = ['hero', 'features', 'accommodations', 'services', 'menu', 'pricing', 'staff', 'booking', 'leadForm', 'hours', 'gallery', 'faq', 'contacts'];
const HOME_STORY = ['hero', 'about', 'gallery', 'staff', 'accommodations', 'services', 'menu', 'features', 'hours', 'booking', 'leadForm', 'faq', 'contacts'];
const HOME_BOOKING_FIRST = ['hero', 'booking', 'leadForm', 'accommodations', 'services', 'menu', 'pricing', 'staff', 'hours', 'features', 'gallery', 'contacts', 'faq'];

export const DESIGN_PRESETS: readonly DesignPreset[] = Object.freeze([
  // ---------- светлые ----------
  {
    id: 'light-minimal',
    family: 'LIGHT',
    name: 'Светлый минимал',
    shortDescription: 'Белый фон, много воздуха, строгий шрифт без засечек и цены сразу под первым экраном',
    theme: { preset: 'CALM', accent: 'TEAL', typography: 'MODERN', radius: 'SOFT', density: 'COMFORTABLE', colorScheme: 'LIGHT' },
    heroVariant: 'TEXT_ONLY',
    sectionOrder: HOME_SALES,
  },
  {
    id: 'light-coast',
    family: 'LIGHT',
    name: 'Лёгкий бриз',
    shortDescription: 'Свежие морские оттенки, округлый шрифт и мягкие углы, спокойный рассказ о месте',
    theme: { preset: 'COAST', accent: 'FOREST', typography: 'ROUNDED', radius: 'ROUND', density: 'COMFORTABLE', colorScheme: 'LIGHT' },
    heroVariant: 'IMAGE_SIDE',
    sectionOrder: HOME_STORY,
  },
  {
    id: 'light-swiss',
    family: 'LIGHT',
    name: 'Чёткая сетка',
    shortDescription: 'Плотная раскладка, прямые углы, синий акцент и кнопка записи выше всего',
    theme: { preset: 'CALM', accent: 'INDIGO', typography: 'MODERN', radius: 'SHARP', density: 'COMPACT', colorScheme: 'LIGHT' },
    heroVariant: 'TEXT_ONLY',
    sectionOrder: HOME_BOOKING_FIRST,
  },
  // ---------- глубокие, премиальные ----------
  {
    id: 'deep-premium',
    family: 'DEEP',
    name: 'Глубокий премиум',
    shortDescription: 'Глубокий холодный фон, графит и антиква, большой первый экран с фото',
    theme: { preset: 'NIGHT', accent: 'GRAPHITE', typography: 'CLASSIC', radius: 'SHARP', density: 'COMFORTABLE', colorScheme: 'LIGHT' },
    heroVariant: 'IMAGE_FULL',
    sectionOrder: HOME_STORY,
  },
  {
    id: 'deep-gold',
    family: 'DEEP',
    name: 'Вечерний город',
    shortDescription: 'Холодная гамма с золотым акцентом, антиква и бронь сразу после первого экрана',
    theme: { preset: 'NIGHT', accent: 'GOLD', typography: 'CLASSIC', radius: 'SOFT', density: 'COMPACT', colorScheme: 'LIGHT' },
    heroVariant: 'IMAGE_SIDE',
    sectionOrder: HOME_BOOKING_FIRST,
  },
  {
    id: 'deep-indigo',
    family: 'DEEP',
    name: 'Ночной индиго',
    shortDescription: 'Насыщенный индиго, современный шрифт, преимущества и цены крупными карточками',
    theme: { preset: 'NIGHT', accent: 'INDIGO', typography: 'MODERN', radius: 'ROUND', density: 'COMFORTABLE', colorScheme: 'LIGHT' },
    heroVariant: 'TEXT_ONLY',
    sectionOrder: HOME_SALES,
  },
  // ---------- тёплые, яркие ----------
  {
    id: 'warm-bright',
    family: 'WARM',
    name: 'Яркий тёплый',
    shortDescription: 'Кремовый фон, терракотовый акцент, округлый шрифт и дружелюбные крупные кнопки',
    theme: { preset: 'WARM', accent: 'TERRACOTTA', typography: 'ROUNDED', radius: 'ROUND', density: 'COMFORTABLE', colorScheme: 'LIGHT' },
    heroVariant: 'IMAGE_FULL',
    sectionOrder: HOME_SALES,
  },
  {
    id: 'warm-classic',
    family: 'WARM',
    name: 'Тёплый дом',
    shortDescription: 'Тёплая бумага, антиква и золотистый акцент, неспешный рассказ с галереей',
    theme: { preset: 'WARM', accent: 'GOLD', typography: 'CLASSIC', radius: 'SOFT', density: 'COMFORTABLE', colorScheme: 'LIGHT' },
    heroVariant: 'IMAGE_SIDE',
    sectionOrder: HOME_STORY,
  },
  {
    id: 'warm-garden',
    family: 'WARM',
    name: 'Зелёный сад',
    shortDescription: 'Тёплый фон и лесной зелёный акцент, плотная раскладка, запись в одно касание',
    theme: { preset: 'WARM', accent: 'FOREST', typography: 'MODERN', radius: 'SOFT', density: 'COMPACT', colorScheme: 'LIGHT' },
    heroVariant: 'TEXT_ONLY',
    sectionOrder: HOME_BOOKING_FIRST,
  },
] satisfies DesignPreset[]);

/** Направление по id набора; неизвестный id: `null` (сервер отвечает отказом, а не берёт первое попавшееся) */
export function designPresetById(id: unknown): DesignPreset | null {
  return typeof id === 'string' ? (DESIGN_PRESETS.find((p) => p.id === id) ?? null) : null;
}

/** Направление без служебного поля семьи: ровно форма `DesignDirection`, как у ответа ИИ */
export function designPresetDirection(preset: DesignPreset): DesignDirection {
  return {
    id: preset.id,
    name: preset.name,
    shortDescription: preset.shortDescription,
    theme: { ...preset.theme },
    heroVariant: preset.heroVariant,
    sectionOrder: [...preset.sectionOrder],
  };
}

const FAMILIES: readonly DesignPresetFamily[] = ['LIGHT', 'DEEP', 'WARM'];
/** Сдвиг по направлению бизнеса: салон, ресторан и гостиница начинают с разных троек */
const VERTICAL_SHIFT: Record<string, number> = { HOSPITALITY: 0, BEAUTY: 1, FOOD_SERVICE: 2 };

/** Сколько разных троек даёт «Другие варианты», прежде чем пойти по кругу */
export function designTripleCount(): number {
  return Math.max(...FAMILIES.map((f) => DESIGN_PRESETS.filter((p) => p.family === f).length));
}

/**
 * Тройка направлений для страницы `page` (0, 1, 2…; «Другие варианты» листает): по одному из каждой семьи (светлое,
 * глубокое, тёплое), поэтому три карточки всегда заметно разные. Детерминированно: та же страница даёт ту же тройку
 */
export function pickDesignTriple(vertical: string | null | undefined, page: number): DesignPreset[] {
  const shift = VERTICAL_SHIFT[vertical ?? ''] ?? 0;
  const n = Number.isFinite(page) ? Math.trunc(page) : 0;
  return FAMILIES.map((family, i) => {
    const pool = DESIGN_PRESETS.filter((p) => p.family === family);
    const at = (((n + shift + i) % pool.length) + pool.length) % pool.length;
    return pool[at]!;
  });
}

