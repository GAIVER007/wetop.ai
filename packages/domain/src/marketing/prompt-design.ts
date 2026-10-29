import { applyDesignDirection, type DesignDirection, type DesignTheme } from './builder';
import type { SiteFacts, SiteFactsVertical } from './site-facts';
import { starterSpecFromFacts } from './starter';
import { SITE_SPEC_DARK_ACCENTS, SITE_SPEC_DARK_PRESETS } from './site-spec';

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
  return {
    direction: { id, name, shortDescription: text.slice(0, 160), theme, heroVariant: 'TEXT_ONLY', sectionOrder },
    variants,
    moods,
  };
}

/** Применить дизайн к документу: тема, порядок главной и виды секций без обязательной картинки */
export function applySitePromptDesign(spec: unknown, design: SitePromptDesign): Rec {
  const next = applyDesignDirection(spec, design.direction) as Rec;
  for (const page of (next['pages'] as Rec[] | undefined) ?? [])
    page['sections'] = ((page['sections'] as Rec[] | undefined) ?? []).map((section) => {
      const variant = design.variants[String(section['type'])];
      return variant && VARIANTS[String(section['type'])]?.includes(variant) ? { ...section, variant } : section;
    });
  return next;
}

/** Готовый сайт по промту из фактов филиала: блоки и тексты из данных, свой дизайн по промту */
export function promptSiteSpec(facts: SiteFacts, prompt: string, seed = facts.location.id): Rec {
  return applySitePromptDesign(starterSpecFromFacts(facts), sitePromptDesign(prompt, facts.vertical, seed));
}
