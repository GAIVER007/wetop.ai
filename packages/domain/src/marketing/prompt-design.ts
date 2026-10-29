import { heroCopy, heroTone, type HeroLocale } from './hero-copy';
import { applyDesignDirection, type DesignDirection, type DesignTheme } from './builder';
import type { SiteFacts, SiteFactsVertical } from './site-facts';
import { starterSpecFromFacts } from './starter';
import { SITE_SPEC_DARK_ACCENTS, SITE_SPEC_DARK_PRESETS } from './site-spec';
import { isStockAssetId, stockImage, stockPhotoFor, type StockPhoto } from './stock-photos';

/**
 * Свой дизайн сайта по промту (владелец 29.10.2026: «сто клиентов, а всего три шаблона: у всех одинаковые сайты;
 * переверни логику, сайт полностью по промту»). Человек пишет, какой сайт ему нужен; по словам промта и по самому
 * филиалу выбирается своё сочетание фона, акцента, шрифтов, углов, плотности, порядка блоков главной и вида каждой
 * секции. Это главный путь «Создать свой сайт»; готовые стили остаются запасным путём.
 *
 * Без ИИ, без сети и без времени: тот же промт у того же филиала даёт тот же дизайн (повтор и превью совпадают с тем,
 * что сохранит сервер), другой филиал с тем же промтом получает другое сочетание (зерно из id филиала). Работает и
 * когда модель ИИ на сервере не подключена; когда подключена, ИИ потом переписывает тексты по тому же промту.
 *
 * Читаемость не на совести случая: тёмный фон только с тёмной схемой и светлым акцентом, светлый с тёмным
 * (те же правила, что у валидатора SiteSpec). Данные филиала не выдумываются: блоки и тексты из `starterSpecFromFacts`.
 */

type Rec = Record<string, unknown>;

export const SITE_PROMPT_MAX = 1800;

/** Слова промта по смыслу: ru, kk, en; совпадение по началу слова (корень), регистр не важен */
const MOODS = {
  dark: ['тёмн', 'темн', 'чёрн', 'черн', 'ночн', 'вечерн', 'noir', 'dark', 'black', 'night', 'қара', 'түнгі'],
  luxury: ['премиум', 'премиал', 'роскош', 'люкс', 'элит', 'дорог', 'бутик', 'luxur', 'premium', 'elegant', 'элегант', 'шик', 'сән'],
  bright: ['ярк', 'смел', 'молод', 'весел', 'весёл', 'поп', 'сочн', 'bright', 'bold', 'fun', 'young', 'pop', 'жарқын'],
  calm: ['спокой', 'тих', 'уют', 'нежн', 'мягк', 'calm', 'cozy', 'cosy', 'soft', 'gentle', 'тыныш', 'жайлы'],
  natural: ['эко', 'натурал', 'природ', 'зелен', 'зелён', 'органик', 'eco', 'natural', 'green', 'organic', 'табиғ'],
  minimal: ['минимал', 'строг', 'чист', 'лаконич', 'просто', 'clean', 'minimal', 'simple', 'strict', 'қарапайым'],
  sea: ['мор', 'пляж', 'берег', 'озер', 'озёр', 'sea', 'beach', 'coast', 'ocean', 'теңіз'],
  warm: ['тёпл', 'тепл', 'солн', 'домашн', 'семейн', 'warm', 'sunny', 'family', 'home', 'жылы', 'отбасы'],
  classic: ['классич', 'традиц', 'винтаж', 'ретро', 'classic', 'vintage', 'retro', 'классик'],
  modern: ['современ', 'модн', 'технол', 'городск', 'modern', 'urban', 'trend', 'заманауи'],
  fast: ['быстр', 'срочн', 'запис', 'брон', 'онлайн', 'fast', 'quick', 'book', 'online', 'жылдам'],
  team: ['мастер', 'команд', 'специалист', 'стилист', 'шеф', 'team', 'master', 'stylist', 'chef', 'шебер'],
  pink: ['розов', 'пудр', 'pink', 'rose', 'қызғылт'],
  gold: ['золот', 'gold', 'алтын'],
  blue: ['син', 'голуб', 'blue', 'көк'],
} as const;
export type SitePromptMood = keyof typeof MOODS;

/** Какие настроения есть в промте (порядок как в словаре) */
export function promptMoods(prompt: string): SitePromptMood[] {
  const words = prompt.toLocaleLowerCase('ru').split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  return (Object.keys(MOODS) as SitePromptMood[]).filter((mood) => MOODS[mood].some((root) => words.some((w) => w.startsWith(root))));
}

/** FNV-1a 32 бита: зерно без node:crypto, одно и то же в браузере и на сервере */
function seedOf(text: string): number {
  let h = 0x811c9dc5;
  for (const ch of text) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Выбор из списка по зерну и «соли» (у каждого измерения дизайна своя соль, чтобы они не шли в ногу) */
const pick = <T>(list: readonly T[], seed: number, salt: number): T => list[seedOf(`${seed}:${salt}`) % list.length]!;

const LIGHT_PRESETS = ['CALM', 'WARM', 'NIGHT', 'COAST', 'PEACH', 'SAGE'] as const;
const LIGHT_ACCENTS = ['TEAL', 'INDIGO', 'TERRACOTTA', 'FOREST', 'GRAPHITE', 'GOLD', 'FUCHSIA', 'MOSS'] as const;

/** Каталог направления (что продаём) и форма заявки: блоки, которые решают заявку */
const CATALOG: Record<SiteFactsVertical, string[]> = {
  HOSPITALITY: ['accommodations', 'pricing'],
  BEAUTY: ['services', 'staff'],
  FOOD_SERVICE: ['menu'],
};
const FORM: Record<SiteFactsVertical, string> = { HOSPITALITY: 'booking', BEAUTY: 'leadForm', FOOD_SERVICE: 'leadForm' };

/** Варианты секций без обязательной картинки: смена не делает документ неверным */
const VARIANTS: Record<string, readonly string[]> = {
  features: ['GRID', 'LIST'],
  accommodations: ['CARDS', 'ROWS'],
  services: ['LIST', 'CARDS'],
  staff: ['CARDS', 'LIST'],
  menu: ['LIST', 'CARDS'],
  leadForm: ['INLINE', 'CARD'],
  hours: ['TABLE', 'COMPACT'],
};

export interface SitePromptDesign {
  direction: DesignDirection;
  variants: Record<string, string>;
  moods: SitePromptMood[];
  /** Фото первого экрана из набора WETOP по промту и направлению (своё фото клиента главнее) */
  photo: StockPhoto | null;
}

/**
 * Фото набора под промт (владелец 29.10.2026: «стрёмные сайты, почему не используешь фото»): ресницы и брови, ногти
 * или зал салона; бутик, хостел или классика у гостиницы; ресторан, доставка или кафе у общепита
 */
function promptPhoto(text: string, vertical: SiteFactsVertical, has: (m: SitePromptMood) => boolean): StockPhoto | null {
  const low = text.toLocaleLowerCase('ru');
  if (vertical === 'BEAUTY') {
    if (/ресниц|бров|lash|brow|кірпік|қас/.test(low)) return stockPhotoFor('beauty-boutique');
    if (/ногт|маникюр|педикюр|nail|mani|тырнақ/.test(low)) return stockPhotoFor('beauty-express');
    return stockPhotoFor(has('luxury') || has('dark') ? 'beauty-boutique' : 'beauty-studio');
  }
  if (vertical === 'HOSPITALITY')
    return stockPhotoFor(has('luxury') || has('dark') ? 'hotel-boutique' : has('bright') || has('fast') ? 'hotel-hostel' : 'hotel-classic');
  return stockPhotoFor(has('luxury') || has('dark') ? 'food-restaurant' : has('fast') ? 'food-delivery' : 'food-cafe');
}

/**
 * Дизайн по промту: тема, порядок блоков главной и виды секций. `seed` это id филиала (или другое постоянное значение
 * проекта), чтобы два салона с одним промтом не получили один сайт.
 */
export function sitePromptDesign(prompt: string, vertical: SiteFactsVertical, seed: string): SitePromptDesign {
  const text = prompt.trim().slice(0, SITE_PROMPT_MAX);
  const moods = promptMoods(text);
  const has = (m: SitePromptMood) => moods.includes(m);
  const s = seedOf(`${seed}|${vertical}|${text.toLocaleLowerCase('ru')}`);

  // фон и схема: тёмный только по прямой просьбе или по «роскоши» без просьбы о светлом/ярком
  const dark = has('dark') || (has('luxury') && !has('bright') && !has('natural') && !has('sea') && pick([true, false], s, 1));
  let preset: string;
  if (dark) preset = SITE_SPEC_DARK_PRESETS[0]!;
  else if (has('natural') || (has('minimal') && !has('bright'))) preset = pick(['SAGE', 'CALM'], s, 2);
  else if (has('sea')) preset = 'COAST';
  else if (has('bright') || has('pink')) preset = 'PEACH';
  else if (has('warm') || has('calm')) preset = pick(['WARM', 'CALM'], s, 2);
  else if (has('luxury') || has('classic')) preset = 'NIGHT';
  else preset = pick(LIGHT_PRESETS, s, 2);

  let accent: string;
  if (dark) accent = has('pink') ? 'ROSE' : has('gold') || has('luxury') ? 'CHAMPAGNE' : pick(SITE_SPEC_DARK_ACCENTS, s, 3);
  else if (has('pink') || (has('bright') && preset === 'PEACH')) accent = 'FUCHSIA';
  else if (has('gold') || has('luxury')) accent = 'GOLD';
  else if (has('natural')) accent = pick(['MOSS', 'FOREST'], s, 3);
  else if (has('blue') || has('sea')) accent = pick(['TEAL', 'INDIGO'], s, 3);
  else if (has('warm')) accent = 'TERRACOTTA';
  else if (has('minimal')) accent = 'GRAPHITE';
  else accent = pick(LIGHT_ACCENTS, s, 3);

  const typography = has('luxury') || has('classic') ? pick(['LUXE', 'CLASSIC'], s, 4)
    : has('bright') ? 'BOLD'
      : has('minimal') || has('modern') ? 'CLEAN'
        : has('calm') || has('warm') ? 'ROUNDED'
          : pick(['MODERN', 'CLASSIC', 'ROUNDED', 'LUXE', 'BOLD', 'CLEAN'], s, 4);
  const radius = has('luxury') || has('minimal') || has('classic') ? 'SHARP' : has('bright') || has('calm') ? 'ROUND' : pick(['SHARP', 'SOFT', 'ROUND'], s, 5);
  const density = has('minimal') || has('fast') ? 'COMPACT' : pick(['COMPACT', 'COMFORTABLE'], s, 6);
  const theme: DesignTheme = { preset, accent, typography, radius, density, colorScheme: dark ? 'DARK' : 'LIGHT' };

  // порядок главной: заявка первой («быстро/записаться»), команда первой («мастера/шеф»), иначе каталог первым или
  // «почему мы» первыми по зерну; часы, вопросы, контакты и призыв в конце
  const catalog = CATALOG[vertical];
  const form = FORM[vertical];
  const team = vertical === 'BEAUTY' ? ['staff', ...catalog.filter((x) => x !== 'staff')] : catalog;
  let body: string[];
  if (has('fast')) body = [form, ...catalog, 'features'];
  else if (has('team') && vertical === 'BEAUTY') body = [...team, 'features', form];
  else body = pick([[...catalog, 'features', form], ['features', ...catalog, form], [...catalog, form, 'features']], s, 7);
  const tail = pick([['hours', 'faq', 'contacts', 'cta'], ['faq', 'hours', 'contacts', 'cta'], ['hours', 'contacts', 'faq', 'cta']], s, 8);
  const sectionOrder = ['hero', ...body, ...tail];

  const variants: Record<string, string> = {};
  for (const [type, list] of Object.entries(VARIANTS)) variants[type] = pick(list, s, 9 + type.length);
  if (has('minimal')) Object.assign(variants, { features: 'LIST', services: 'LIST', menu: 'LIST', hours: 'COMPACT' });
  if (has('bright') || has('luxury')) Object.assign(variants, { services: 'CARDS', menu: 'CARDS', staff: 'CARDS', leadForm: 'CARD' });

  const id = `prompt-${s.toString(36)}`;
  const name = 'Свой дизайн';
  const photo = promptPhoto(text, vertical, has);
  return {
    direction: { id, name, shortDescription: text.slice(0, 160), theme, heroVariant: photo?.heroVariant ?? 'TEXT_ONLY', sectionOrder },
    variants,
    moods,
    photo,
  };
}

/** Применить дизайн к документу: тема, порядок главной и виды секций без обязательной картинки */
export function applySitePromptDesign(spec: unknown, design: SitePromptDesign): Rec {
  const pages = ((spec as Rec | null)?.['pages'] as Rec[] | undefined) ?? [];
  const home = pages.find((p) => p['isHome'] === true) ?? pages[0];
  const hero = ((home?.['sections'] as Rec[] | undefined) ?? []).find((x) => x['type'] === 'hero');
  const heroImage = hero?.['image'] as Rec | undefined;
  // своё фото клиента главнее: остаётся вместе с его раскладкой первого экрана (как у готовых стилей)
  const ownPhoto = heroImage !== undefined && !isStockAssetId(heroImage['assetId']) && typeof hero?.['variant'] === 'string';
  const withPhoto = structuredClone(spec) as Rec;
  let direction = design.direction;
  if (ownPhoto) direction = { ...direction, heroVariant: hero!['variant'] as DesignDirection['heroVariant'] };
  else if (design.photo) {
    const locales = ((withPhoto['site'] as Rec | undefined)?.['locales'] as string[] | undefined) ?? ['ru'];
    for (const page of (withPhoto['pages'] as Rec[] | undefined) ?? [])
      for (const x of (page['sections'] as Rec[] | undefined) ?? [])
        if (x['type'] === 'hero' && (page['isHome'] === true || page['id'] === home?.['id'])) x['image'] = stockImage(design.photo, locales);
  }
  const next = applyDesignDirection(withPhoto, direction) as Rec;
  for (const page of (next['pages'] as Rec[] | undefined) ?? [])
    page['sections'] = ((page['sections'] as Rec[] | undefined) ?? []).map((section) => {
      const variant = design.variants[String(section['type'])];
      return variant && VARIANTS[String(section['type'])]?.includes(variant) ? { ...section, variant } : section;
    });
  return next;
}

/**
 * Простая главная (владелец 29.10.2026: «не усложняй: главная с офером, список услуг, выбор услуги, мастера и времени,
 * отзывы, призыв»). Порядок один для всех; разные сайты дают тема, вид секций и фото. Внизу адрес и часы одной
 * строкой: по ним карта и поиск (GEO, schema.org часов работы). «Почему мы» и вопросы-ответы при создании не ставятся,
 * их можно включить в редакторе
 */
const SIMPLE_HOME: Record<SiteFactsVertical, string[]> = {
  BEAUTY: ['hero', 'services', 'staff', 'leadForm', 'reviews', 'cta', 'hours', 'contacts'],
  HOSPITALITY: ['hero', 'accommodations', 'pricing', 'booking', 'reviews', 'cta', 'hours', 'contacts'],
  FOOD_SERVICE: ['hero', 'menu', 'leadForm', 'reviews', 'cta', 'hours', 'contacts'],
};
const REVIEWS_TEXT: Record<string, { heading: string; count: (n: number) => string; title: (avg: number) => string; many: (n: number) => string; clients: string }> = {
  ru: { heading: 'Отзывы', title: (a) => `${String(a).replace('.', ',')} из 5`, count: (n) => `Средняя оценка по ${n} отзывам`, many: (n) => `${n} отзывов`, clients: 'Оценки наших клиентов' },
  kk: { heading: 'Пікірлер', title: (a) => `5-тен ${String(a).replace('.', ',')}`, count: (n) => `${n} пікір бойынша орташа баға`, many: (n) => `${n} пікір`, clients: 'Клиенттеріміздің бағасы' },
  en: { heading: 'Reviews', title: (a) => `${a} out of 5`, count: (n) => `Average rating from ${n} reviews`, many: (n) => `${n} reviews`, clients: 'Ratings from our clients' },
};

function simpleHome(spec: Rec, facts: SiteFacts): Rec {
  const order = SIMPLE_HOME[facts.vertical];
  const locales = (((spec['site'] as Rec | undefined)?.['locales'] as string[] | undefined) ?? ['ru']).filter((l) => l in REVIEWS_TEXT);
  const tx = (f: (r: (typeof REVIEWS_TEXT)['ru']) => string) => Object.fromEntries((locales.length ? locales : ['ru']).map((l) => [l, f(REVIEWS_TEXT[l]!)]));
  for (const page of (spec['pages'] as Rec[] | undefined) ?? []) {
    if (page['isHome'] !== true) continue;
    let sections = ((page['sections'] as Rec[] | undefined) ?? []).filter((x) => order.includes(String(x['type'])));
    // отзывы только из настоящей оценки филиала (Google и др.): нет оценки, нет блока, ничего не выдумываем
    const reviews = facts.reviews;
    if (reviews && reviews.count > 0 && Number.isFinite(reviews.avg)) {
      const block = {
        id: 'sec-reviews',
        type: 'features',
        variant: 'GRID',
        heading: tx((r) => r.heading),
        items: [
          { icon: 'STAR', title: tx((r) => r.title(reviews.avg)), text: tx((r) => r.count(reviews.count)) },
          { icon: 'FAMILY', title: tx((r) => r.many(reviews.count)), text: tx((r) => r.clients) },
        ],
      };
      sections = [...sections, block];
    }
    const rank = (x: Rec) => {
      const type = x['id'] === 'sec-reviews' ? 'reviews' : String(x['type']);
      const i = order.indexOf(type);
      return i < 0 ? order.length : i;
    };
    page['sections'] = sections.map((x, i) => ({ x, i })).sort((a, b) => rank(a.x) - rank(b.x) || a.i - b.i).map(({ x }) => x);
    // часы одной строкой внизу, рядом с адресом
    for (const x of page['sections'] as Rec[]) if (x['type'] === 'hours') x['variant'] = 'COMPACT';
  }
  // меню шапки только на оставшиеся блоки
  const ids = new Set(((spec['pages'] as Rec[] | undefined) ?? []).flatMap((p) => ((p['sections'] as Rec[] | undefined) ?? []).map((x) => x['id'])));
  const nav = spec['navigation'] as Rec | undefined;
  if (nav && Array.isArray(nav['header']))
    nav['header'] = (nav['header'] as Rec[]).filter((item) => {
      const target = item['target'] as Rec | undefined;
      return target?.['kind'] !== 'SECTION' || ids.has(target['sectionId']);
    });
  return spec;
}

/** Готовый сайт по промту из фактов филиала: простая главная из данных, свой дизайн и фото по промту */
export function promptSiteSpec(facts: SiteFacts, prompt: string, seed = facts.location.id): Rec {
  const design = sitePromptDesign(prompt, facts.vertical, seed);
  const order = SIMPLE_HOME[facts.vertical].map((t) => (t === 'reviews' ? 'features' : t));
  const simple: SitePromptDesign = { ...design, direction: { ...design.direction, sectionOrder: order } };
  return withOffer(simpleHome(applySitePromptDesign(starterSpecFromFacts(facts), simple), facts), facts, design.direction.theme.typography);
}

/**
 * Оффер первого экрана (владелец 29.10.2026: «как у Брансона или Хормози: цепляющий заголовок, на первом экране всё
 * чётко»): заголовок это результат для клиента, подзаголовок это стопка конкретики из данных (heroCopy), тон по
 * шрифту дизайна. Название филиала остаётся в шапке и в подзаголовке (SEO и GEO).
 */
function withOffer(spec: Rec, facts: SiteFacts, typography: unknown): Rec {
  const locales = (((spec['site'] as Rec | undefined)?.['locales'] as string[] | undefined) ?? ['ru']).filter((l): l is HeroLocale => l === 'ru' || l === 'kk' || l === 'en');
  const tone = heroTone(typography);
  for (const page of (spec['pages'] as Rec[] | undefined) ?? []) {
    if (page['isHome'] !== true) continue;
    for (const x of (page['sections'] as Rec[] | undefined) ?? []) {
      if (x['type'] !== 'hero') continue;
      const copies = (locales.length ? locales : (['ru'] as HeroLocale[])).map((l) => [l, heroCopy(facts, tone, 0, l)] as const);
      x['heading'] = Object.fromEntries(copies.map(([l, c]) => [l, c.heading]));
      x['subheading'] = Object.fromEntries(copies.map(([l, c]) => [l, c.subheading]));
    }
  }
  return spec;
}

/**
 * «Пересобрать дизайн» в редакторе: тема, вид секций и фото по новому промту, а порядок и набор блоков сайта остаются
 * как сейчас (их клиент мог поменять сам)
 */
export function redesignSiteSpec(spec: unknown, prompt: string, vertical: SiteFactsVertical, seed: string): Rec {
  const design = sitePromptDesign(prompt, vertical, seed);
  const pages = ((spec as Rec | null)?.['pages'] as Rec[] | undefined) ?? [];
  const home = pages.find((p) => p['isHome'] === true) ?? pages[0];
  const order = [...new Set(((home?.['sections'] as Rec[] | undefined) ?? []).map((x) => String(x['type'])))];
  return applySitePromptDesign(spec, { ...design, direction: { ...design.direction, sectionOrder: order } });
}
