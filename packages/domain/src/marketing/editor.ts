import { SITE_SPEC_ICONS, SITE_SPEC_LOCALES, SITE_SPEC_SECTIONS, SITE_SPEC_THEME } from './site-spec';

/**
 * Редактор управляемого сайта (MKT9, `docs/marketing/site-editor-v0.md`). Здесь только чистые правила, без React:
 * реестр полей 11 секций (варианты и поля сверяются с валидатором тестом), шаблоны новой секции и страницы, новый
 * идентификатор, ссылки на страницу и секцию (удаление с зависимостями запрещено), снятие языка, разбор пути ошибки.
 * Единственный судья документа по-прежнему `validateSiteSpec`.
 */
type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => v !== null && typeof v === 'object' && !Array.isArray(v);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

export interface EditorOption {
  value: string;
  label: string;
}

export type EditorFieldSpec =
  | { kind: 'text'; max: number; multiline?: boolean }
  | { kind: 'textList'; max: number; min: number; maxItems: number }
  | { kind: 'bool' }
  | { kind: 'enum'; options: readonly EditorOption[] }
  | { kind: 'image' }
  | { kind: 'images'; min: number; max: number }
  | { kind: 'cta' }
  /** Код категории: выбор из категорий брифа точного объекта, своего кода нет */
  | { kind: 'category' }
  /** Категории секции цен: только коды карточек размещения этого документа */
  | { kind: 'categoryCodes' }
  | { kind: 'map' }
  | { kind: 'list'; min: number; max: number; itemLabel: string; item: readonly EditorField[] };

export interface EditorField {
  key: string;
  label: string;
  required: boolean;
  spec: EditorFieldSpec;
  /** Поле есть только у этих вариантов секции (картинка героя, карта контактов) */
  variants?: readonly string[];
  hint?: string;
}

export interface EditorSection {
  type: string;
  label: string;
  variants: readonly EditorOption[];
  fields: readonly EditorField[];
}

const ICON_LABEL: Record<string, string> = {
  CLOCK: 'Часы', PARKING: 'Парковка', WIFI: 'Wi-Fi', BREAKFAST: 'Завтрак', LAUNDRY: 'Прачечная', LUGGAGE: 'Багаж',
  KITCHEN: 'Кухня', AIRCON: 'Кондиционер', TRANSFER: 'Трансфер', PETS: 'Животные', ACCESSIBLE: 'Доступная среда',
  FAMILY: 'Семья', QUIET: 'Тишина', CENTER: 'Центр', STATION: 'Вокзал', STAR: 'Звезда',
};
export const EDITOR_ICON_OPTIONS: readonly EditorOption[] = SITE_SPEC_ICONS.map((value) => ({
  value,
  label: ICON_LABEL[value] ?? value,
}));

const text = (key: string, label: string, max: number, required = false, multiline = max > 200): EditorField => ({
  key, label, required, spec: { kind: 'text', max, multiline },
});
const bool = (key: string, label: string): EditorField => ({ key, label, required: false, spec: { kind: 'bool' } });
const icon: EditorField = { key: 'icon', label: 'Значок', required: true, spec: { kind: 'enum', options: EDITOR_ICON_OPTIONS } };
const heading = text('heading', 'Заголовок секции', 80, true);
const option = (value: string, label: string): EditorOption => ({ value, label });

/** Реестр редактора: подписи, варианты и поля каждой из 11 секций SiteSpec v0 */
export const SITE_EDITOR_SECTIONS: Readonly<Record<string, EditorSection>> = Object.freeze({
  hero: {
    type: 'hero',
    label: 'Первый экран',
    variants: [option('IMAGE_FULL', 'Фото на весь экран'), option('IMAGE_SIDE', 'Фото сбоку'), option('TEXT_ONLY', 'Только текст')],
    fields: [
      heading,
      text('subheading', 'Подзаголовок', 200),
      { key: 'image', label: 'Фото', required: true, spec: { kind: 'image' }, variants: ['IMAGE_FULL', 'IMAGE_SIDE'] },
      { key: 'primaryAction', label: 'Главная кнопка', required: true, spec: { kind: 'cta' } },
      { key: 'secondaryAction', label: 'Вторая кнопка', required: false, spec: { kind: 'cta' } },
    ],
  },
  about: {
    type: 'about',
    label: 'О гостинице',
    variants: [option('TEXT_ONLY', 'Только текст'), option('TEXT_IMAGE', 'Текст и фото')],
    fields: [
      heading,
      { key: 'paragraphs', label: 'Абзацы', required: true, spec: { kind: 'textList', max: 600, min: 1, maxItems: 6 } },
      { key: 'image', label: 'Фото', required: true, spec: { kind: 'image' }, variants: ['TEXT_IMAGE'] },
    ],
  },
  features: {
    type: 'features',
    label: 'Преимущества',
    variants: [option('GRID', 'Сетка'), option('LIST', 'Список')],
    fields: [
      heading,
      {
        key: 'items', label: 'Преимущества', required: true,
        spec: { kind: 'list', min: 2, max: 8, itemLabel: 'Преимущество', item: [icon, text('title', 'Название', 60, true), text('text', 'Текст', 200, true, false)] },
      },
    ],
  },
  accommodations: {
    type: 'accommodations',
    label: 'Номера',
    variants: [option('CARDS', 'Карточки'), option('ROWS', 'Строки')],
    fields: [
      heading,
      {
        key: 'items', label: 'Категории', required: true,
        spec: {
          kind: 'list', min: 1, max: 20, itemLabel: 'Категория',
          item: [
            { key: 'categoryCode', label: 'Категория гостиницы', required: true, spec: { kind: 'category' } },
            text('title', 'Название на сайте', 60, true),
            text('description', 'Описание', 400, true),
            { key: 'images', label: 'Фото категории', required: false, spec: { kind: 'images', min: 0, max: 6 } },
            { key: 'highlights', label: 'Коротко о главном', required: false, spec: { kind: 'textList', max: 40, min: 0, maxItems: 6 } },
          ],
        },
      },
      bool('showLiveCapacity', 'Показывать вместимость'),
      bool('showFromPrice', 'Показывать цену «от»'),
      { key: 'itemAction', label: 'Кнопка у категории', required: false, spec: { kind: 'cta' } },
    ],
  },
  amenities: {
    type: 'amenities',
    label: 'Удобства',
    variants: [option('LIST', 'Список'), option('ICONS', 'Значки')],
    fields: [
      heading,
      {
        key: 'items', label: 'Удобства', required: true,
        spec: { kind: 'list', min: 1, max: 24, itemLabel: 'Удобство', item: [icon, text('label', 'Название', 60, true), text('note', 'Пояснение', 120)] },
      },
    ],
  },
  pricing: {
    type: 'pricing',
    label: 'Цены',
    variants: [option('FROM_PRICES', 'Цены «от»')],
    fields: [
      heading,
      {
        key: 'categoryCodes', label: 'Категории', required: true, spec: { kind: 'categoryCodes' },
        hint: 'Цена «от» загружается автоматически по тарифу бронирования.',
      },
      text('note', 'Примечание', 300),
    ],
  },
  gallery: {
    type: 'gallery',
    label: 'Галерея',
    variants: [option('GRID', 'Сетка'), option('CAROUSEL', 'Карусель')],
    fields: [heading, { key: 'images', label: 'Фото', required: true, spec: { kind: 'images', min: 3, max: 24 } }],
  },
  booking: {
    type: 'booking',
    label: 'Бронирование',
    variants: [option('INLINE', 'Форма на странице')],
    fields: [heading, text('note', 'Примечание', 300), bool('showCheckInOut', 'Показывать время заезда и выезда')],
  },
  contacts: {
    type: 'contacts',
    label: 'Контакты',
    variants: [option('PLAIN', 'Без карты'), option('WITH_MAP', 'С картой')],
    fields: [
      heading,
      bool('showPhone', 'Показывать телефон'),
      bool('showWhatsapp', 'Показывать WhatsApp'),
      bool('showEmail', 'Показывать почту'),
      bool('showAddress', 'Показывать адрес'),
      { key: 'map', label: 'Карта', required: false, spec: { kind: 'map' }, variants: ['WITH_MAP'] },
      text('directions', 'Как добраться', 400),
    ],
  },
  faq: {
    type: 'faq',
    label: 'Вопросы и ответы',
    variants: [option('ACCORDION', 'Раскрывающиеся'), option('LIST', 'Список')],
    fields: [
      heading,
      {
        key: 'items', label: 'Вопросы', required: true,
        spec: { kind: 'list', min: 1, max: 30, itemLabel: 'Вопрос', item: [text('question', 'Вопрос', 200, true, false), text('answer', 'Ответ', 1000, true)] },
      },
      bool('emitStructuredData', 'Разметка вопросов для поисковиков'),
    ],
  },
  cta: {
    type: 'cta',
    label: 'Призыв',
    variants: [option('BANNER', 'Полоса'), option('SPLIT', 'С фото')],
    fields: [
      heading,
      { key: 'action', label: 'Кнопка', required: true, spec: { kind: 'cta' } },
      text('text', 'Текст', 300),
      { key: 'image', label: 'Фото', required: true, spec: { kind: 'image' }, variants: ['SPLIT'] },
    ],
  },
} satisfies Record<string, EditorSection>);

export const SITE_EDITOR_SECTION_TYPES: readonly string[] = Object.keys(SITE_SPEC_SECTIONS);

export const LOCALE_LABEL: Readonly<Record<string, string>> = Object.freeze({ ru: 'RU', kk: 'KK', en: 'EN' });
export const EDITOR_LOCALES: readonly string[] = SITE_SPEC_LOCALES;

export const THEME_OPTIONS: Readonly<Record<keyof typeof SITE_SPEC_THEME, readonly EditorOption[]>> = Object.freeze({
  preset: SITE_SPEC_THEME.preset.map((v) => option(v, ({ CALM: 'Спокойная', WARM: 'Тёплая', NIGHT: 'Вечерняя', COAST: 'Морская' } as Rec)[v] as string)),
  accent: SITE_SPEC_THEME.accent.map((v) => option(v, ({ TEAL: 'Бирюзовый', INDIGO: 'Индиго', TERRACOTTA: 'Терракота', FOREST: 'Хвойный', GRAPHITE: 'Графит', GOLD: 'Золотой' } as Rec)[v] as string)),
  typography: SITE_SPEC_THEME.typography.map((v) => option(v, ({ MODERN: 'Современный', CLASSIC: 'Классический', ROUNDED: 'Мягкий' } as Rec)[v] as string)),
  radius: SITE_SPEC_THEME.radius.map((v) => option(v, ({ SHARP: 'Прямые углы', SOFT: 'Слегка скруглённые', ROUND: 'Скруглённые' } as Rec)[v] as string)),
  density: SITE_SPEC_THEME.density.map((v) => option(v, ({ COMPACT: 'Плотно', COMFORTABLE: 'Свободно' } as Rec)[v] as string)),
  colorScheme: SITE_SPEC_THEME.colorScheme.map((v) => option(v, 'Светлая')),
});

/** Текст на языке, иначе на первом заполненном: для подписей в структуре и разнице */
export function localizedText(value: unknown, locale: string): string {
  if (typeof value === 'string') return value;
  if (!isRec(value)) return '';
  const own = value[locale];
  if (typeof own === 'string' && own.trim()) return own;
  const first = Object.values(value).find((v) => typeof v === 'string' && v.trim());
  return typeof first === 'string' ? first : '';
}

/** Все идентификаторы страниц и секций документа */
export function specIds(spec: unknown): Set<string> {
  const ids = new Set<string>();
  if (!isRec(spec)) return ids;
  for (const page of list(spec['pages'])) {
    if (!isRec(page)) continue;
    if (typeof page['id'] === 'string') ids.add(page['id']);
    for (const s of list(page['sections'])) if (isRec(s) && typeof s['id'] === 'string') ids.add(s['id']);
  }
  return ids;
}

/** Новый идентификатор вида `prefix-N` (§SiteSpec: латиница, цифры, дефис, до 48): наименьший свободный N */
export function newSpecId(prefix: string, taken: ReadonlySet<string>): string {
  const base = prefix.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'id';
  for (let n = 1; ; n += 1) {
    const id = `${base}-${n}`;
    if (!taken.has(id)) return id;
  }
}

const t = (locale: string, value: string) => ({ [locale]: value });

/**
 * Новая секция: id, вариант и минимальное содержимое на языке по умолчанию (другие языки не заполняются копией).
 * Категории: первая категория брифа и первая карточка документа; их нет, поле пустое и подсветится проверкой
 */
export function newSection(
  type: string,
  ctx: { locale: string; taken: ReadonlySet<string>; categories: readonly string[]; cardCodes: readonly string[] },
): Rec {
  const shape = SITE_EDITOR_SECTIONS[type];
  if (!shape) throw new Error(`Секции «${type}» нет в реестре`);
  const id = newSpecId(`sec-${type}`, ctx.taken);
  const l = ctx.locale;
  const book = { label: t(l, 'Забронировать'), action: { kind: 'BOOK' } };
  const base: Rec = { id, type, variant: shape.variants[0]!.value, heading: t(l, shape.label) };
  switch (type) {
    case 'hero':
      return { ...base, variant: 'TEXT_ONLY', primaryAction: book };
    case 'about':
      return { ...base, variant: 'TEXT_ONLY', paragraphs: [t(l, 'Расскажите о гостинице.')] };
    case 'features':
      return {
        ...base,
        items: [
          { icon: 'STAR', title: t(l, 'Преимущество'), text: t(l, 'Коротко о нём.') },
          { icon: 'CLOCK', title: t(l, 'Преимущество'), text: t(l, 'Коротко о нём.') },
        ],
      };
    case 'accommodations':
      return { ...base, items: [{ categoryCode: ctx.categories[0] ?? '', title: t(l, 'Номер'), description: t(l, 'Описание номера.') }] };
    case 'amenities':
      return { ...base, items: [{ icon: 'WIFI', label: t(l, 'Wi-Fi') }] };
    case 'pricing':
      return { ...base, categoryCodes: ctx.cardCodes.slice(0, 1) };
    case 'gallery':
      return { ...base, images: [] };
    case 'faq':
      return { ...base, items: [{ question: t(l, 'Вопрос'), answer: t(l, 'Ответ.') }] };
    case 'cta':
      return { ...base, variant: 'BANNER', action: book };
    default:
      return base;
  }
}

/** Копия секции с новым id; содержимое то же */
export function duplicateSection(section: Rec, taken: ReadonlySet<string>): Rec {
  const copy = structuredClone(section);
  copy['id'] = newSpecId(`sec-${String(section['type'] ?? 'section')}`, taken);
  return copy;
}

/** Новая страница (не главная): адрес из свободного `page-N`, SEO по умолчанию «индексировать, в карте сайта» */
export function newPage(ctx: { locale: string; taken: ReadonlySet<string>; slugs: ReadonlySet<string> }): Rec {
  const id = newSpecId('page', ctx.taken);
  let n = 1;
  while (ctx.slugs.has(`page-${n}`)) n += 1;
  return {
    id,
    slug: `page-${n}`,
    isHome: false,
    title: t(ctx.locale, 'Новая страница'),
    seo: { index: true, includeInSitemap: true, canonical: 'SELF' },
    sections: [{ id: newSpecId('sec-about', new Set([...ctx.taken, id])), type: 'about', variant: 'TEXT_ONLY', heading: t(ctx.locale, 'О гостинице'), paragraphs: [t(ctx.locale, 'Текст страницы.')] }],
  };
}

/** Адрес страницы: только то, что требует схема (нижний регистр, латиница, цифры, дефис); текст пользователя иначе не трогается */
export function normalizePageSlug(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-/, '').slice(0, 60);
}

/** Смена варианта: поля, которых у нового варианта нет (картинка героя без фото, карта без карты), снимаются */
export function applySectionVariant(section: Rec, variant: string): Rec {
  const shape = SITE_EDITOR_SECTIONS[String(section['type'])];
  const next: Rec = { ...section, variant };
  for (const field of shape?.fields ?? []) if (field.variants && !field.variants.includes(variant)) delete next[field.key];
  return next;
}

export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const out = [...items];
  if (from < 0 || from >= out.length || to < 0 || to >= out.length || from === to) return out;
  const [item] = out.splice(from, 1);
  out.splice(to, 0, item!);
  return out;
}

export interface SpecReference {
  path: string;
  /** Где ссылка, словами: «Шапка: Номера», «Страница «Главная», секция «Номера»» */
  where: string;
}

function whereOf(spec: Rec, path: string, locale: string): string {
  const nav = /^navigation\.(header|footer)\[(\d+)\]/.exec(path);
  if (nav) {
    const item = list((spec['navigation'] as Rec | undefined)?.[nav[1]!])[Number(nav[2])];
    const label = localizedText(isRec(item) ? item['label'] : null, locale);
    return `${nav[1] === 'header' ? 'Шапка' : 'Подвал'}: ${label || `пункт ${Number(nav[2]) + 1}`}`;
  }
  if (path.startsWith('navigation.headerCta')) return 'Кнопка в шапке';
  if (path === 'site.legal.privacyPageId') return 'Политика конфиденциальности сайта';
  const sec = /^pages\[(\d+)\]\.sections\[(\d+)\]/.exec(path);
  if (sec) {
    const page = list(spec['pages'])[Number(sec[1])] as Rec | undefined;
    const section = list(page?.['sections'])[Number(sec[2])] as Rec | undefined;
    return `Страница «${localizedText(page?.['title'], locale)}», секция «${localizedText(section?.['heading'], locale)}»`;
  }
  return path;
}

/** Все ссылки PAGE и SECTION документа (навигация, кнопки секций) и страница политики */
function allReferences(spec: Rec): Array<{ path: string; pageId: string; sectionId?: string }> {
  const out: Array<{ path: string; pageId: string; sectionId?: string }> = [];
  const walk = (value: unknown, path: string) => {
    if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${path}[${i}]`));
    else if (isRec(value)) {
      if ((value['kind'] === 'PAGE' || value['kind'] === 'SECTION') && typeof value['pageId'] === 'string')
        out.push({
          path,
          pageId: value['pageId'],
          ...(value['kind'] === 'SECTION' && typeof value['sectionId'] === 'string' ? { sectionId: value['sectionId'] } : {}),
        });
      for (const [k, v] of Object.entries(value)) walk(v, path ? `${path}.${k}` : k);
    }
  };
  walk(spec['navigation'], 'navigation');
  list(spec['pages']).forEach((p, i) => walk(p, `pages[${i}]`));
  const privacy = ((spec['site'] as Rec | undefined)?.['legal'] as Rec | undefined)?.['privacyPageId'];
  if (typeof privacy === 'string') out.push({ path: 'site.legal.privacyPageId', pageId: privacy });
  return out;
}

/** Кто ссылается на страницу (ссылки изнутри самой страницы не в счёт: уходят вместе с ней) */
export function pageReferences(spec: unknown, pageId: string, locale: string): SpecReference[] {
  if (!isRec(spec)) return [];
  const index = list(spec['pages']).findIndex((p) => isRec(p) && p['id'] === pageId);
  const own = `pages[${index}]`;
  return allReferences(spec)
    .filter((r) => r.pageId === pageId && !(r.path === own || r.path.startsWith(`${own}.`)))
    .map((r) => ({ path: r.path, where: whereOf(spec, r.path, locale) }));
}

/** Кто ссылается на секцию (ссылки изнутри самой секции не в счёт) */
export function sectionReferences(spec: unknown, pageId: string, sectionId: string, locale: string): SpecReference[] {
  if (!isRec(spec)) return [];
  const pages = list(spec['pages']);
  const p = pages.findIndex((x) => isRec(x) && x['id'] === pageId);
  const s = list((pages[p] as Rec | undefined)?.['sections']).findIndex((x) => isRec(x) && x['id'] === sectionId);
  const own = `pages[${p}].sections[${s}]`;
  return allReferences(spec)
    .filter((r) => r.pageId === pageId && r.sectionId === sectionId && !(r.path === own || r.path.startsWith(`${own}.`)))
    .map((r) => ({ path: r.path, where: whereOf(spec, r.path, locale) }));
}

const isLocalizedText = (v: unknown): v is Rec =>
  isRec(v) && Object.keys(v).length > 0 && Object.entries(v).every(([k, x]) => SITE_SPEC_LOCALES.includes(k as never) && typeof x === 'string');

/**
 * Язык снят со списка: его тексты убираются из документа (иначе валидатор скажет `locale_not_enabled`); необязательный
 * текст, у которого не осталось ни одного языка, удаляется целиком. Язык по умолчанию так не снимается
 */
export function removeLocale(spec: Rec, locale: string): Rec {
  const copy = structuredClone(spec);
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) value.forEach(walk);
    else if (isRec(value))
      for (const [key, v] of Object.entries(value)) {
        if (isLocalizedText(v)) {
          delete v[locale];
          if (Object.keys(v).length === 0) delete value[key];
        } else walk(v);
      }
  };
  walk(copy);
  const site = copy['site'] as Rec;
  site['locales'] = list(site['locales']).filter((l) => l !== locale);
  return copy;
}

/** Куда вести человека по пути ошибки валидатора */
export function errorLocation(path: string):
  | { area: 'page'; pageIndex: number; sectionIndex: number | null; rest: string }
  | { area: 'site'; rest: string } {
  const m = /^pages\[(\d+)\](?:\.sections\[(\d+)\])?\.?(.*)$/.exec(path);
  if (m) return { area: 'page', pageIndex: Number(m[1]), sectionIndex: m[2] === undefined ? null : Number(m[2]), rest: m[3] ?? '' };
  return { area: 'site', rest: path };
}

/** Коды категорий карточек размещения документа: из них и только из них выбирается секция цен */
export function accommodationCardCodes(spec: unknown): string[] {
  const out: string[] = [];
  if (!isRec(spec)) return out;
  for (const page of list(spec['pages']))
    for (const s of list(isRec(page) ? page['sections'] : null))
      if (isRec(s) && s['type'] === 'accommodations')
        for (const item of list(s['items']))
          if (isRec(item) && typeof item['categoryCode'] === 'string' && item['categoryCode'] && !out.includes(item['categoryCode']))
            out.push(item['categoryCode']);
  return out;
}
