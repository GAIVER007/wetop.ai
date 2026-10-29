import type { SiteFacts, SiteFactsVertical } from './site-facts';
import { starterText } from './starter';

/**
 * Фраза первого экрана (владелец 28.10.2026: «вместо названия фраза, как у профессиональных сайтов»). Заголовок это
 * короткая продающая фраза под стиль шаблона (тон по шрифту темы) и под то, чем занимается бизнес; подзаголовок
 * собран из фактов филиала: название (оно остаётся в первом экране для SEO и GEO), разделы услуг или меню, номера,
 * город и способ записи. Ничего не выдумываем: ни стажа, ни скидок, ни отзывов, ни «лучших цен», ни скорости
 * подтверждения; фразы это настроение, а не обещания. Детерминированно: те же факты, тон и номер дают тот же текст.
 */
export type HeroTone = 'LUXE' | 'BOLD' | 'CLEAN';
export type HeroLocale = 'ru' | 'kk' | 'en';
export interface HeroCopy {
  heading: string;
  subheading: string;
}
type BeautyFocus = 'LASH' | 'NAILS' | 'HAIR' | 'GENERAL';

/** Тон по шрифту темы: антиква премиальная, широкий и мягкий гротеск смелые, остальное спокойное */
export function heroTone(typography: unknown): HeroTone {
  if (typography === 'LUXE' || typography === 'CLASSIC') return 'LUXE';
  if (typography === 'BOLD' || typography === 'ROUNDED') return 'BOLD';
  return 'CLEAN';
}

export const HERO_COPY_COUNT = 3;

type Phrases = Record<HeroTone, readonly [string, string, string]>;
const PHRASES: Record<HeroLocale, Record<SiteFactsVertical, Phrases>> = {
  ru: {
    BEAUTY: {
      LUXE: ['{focus}', 'Красота в каждой детали', 'Ваш ритуал красоты'],
      BOLD: ['Время сиять', 'Красота без скуки', 'Ярко. Смело. Про вас'],
      CLEAN: ['Спокойный уход за собой', 'Чистая красота без спешки', 'Забота, которую чувствуешь'],
    },
    HOSPITALITY: {
      LUXE: ['Ваш спокойный дом в поездке', 'Отель для особых поездок', 'Место, куда хочется вернуться'],
      BOLD: ['Заселяйтесь и вперёд', 'Ваша база для приключений', 'Уютно, просто, по-своему'],
      CLEAN: ['Спокойный сон в поездке', 'Просто и уютно', 'Отдых без лишних хлопот'],
    },
    FOOD_SERVICE: {
      LUXE: ['Вечер, который хочется повторить', 'Вкус, ради которого возвращаются', 'Ужин как событие'],
      BOLD: ['Вкусно. Громко. С друзьями', 'Голодны? Вам к нам', 'Приходите голодными'],
      CLEAN: ['Простая еда с характером', 'Честный вкус каждый день', 'Место для неспешного обеда'],
    },
  },
  kk: {
    BEAUTY: {
      LUXE: ['{focus}', 'Әр детальдағы сұлулық', 'Сіздің сұлулық рәсіміңіз'],
      BOLD: ['Жарқырайтын уақыт', 'Зерікпейтін сұлулық', 'Жарқын. Батыл. Сіз туралы'],
      CLEAN: ['Өзіңе байсалды күтім', 'Асықпай таза сұлулық', 'Сезілетін қамқорлық'],
    },
    HOSPITALITY: {
      LUXE: ['Сапардағы тыныш үйіңіз', 'Ерекше сапарларға арналған қонақүй', 'Қайта оралғың келетін орын'],
      BOLD: ['Орналасып, алға', 'Шытырман сапарларға базаңыз', 'Жайлы, қарапайым, өзіңше'],
      CLEAN: ['Сапардағы тыныш ұйқы', 'Қарапайым әрі жайлы', 'Артық әуресіз демалыс'],
    },
    FOOD_SERVICE: {
      LUXE: ['Қайталағың келетін кеш', 'Қайта оралатын дәм', 'Оқиғадай кешкі ас'],
      BOLD: ['Дәмді. Көңілді. Достармен', 'Қарныңыз ашты ма? Бізге келіңіз', 'Аш келіңіз'],
      CLEAN: ['Мінезі бар қарапайым тағам', 'Күн сайын адал дәм', 'Асықпай түскі ас ішетін орын'],
    },
  },
  en: {
    BEAUTY: {
      LUXE: ['{focus}', 'Beauty in every detail', 'Your beauty ritual'],
      BOLD: ['Time to shine', 'Beauty, never boring', 'Bright. Bold. All about you'],
      CLEAN: ['Calm, mindful self-care', 'Clean beauty, no rush', 'Care you can feel'],
    },
    HOSPITALITY: {
      LUXE: ['Your quiet home away from home', 'A hotel for special trips', 'A place worth coming back to'],
      BOLD: ['Check in and go', 'Your base for adventures', 'Cosy, simple, your way'],
      CLEAN: ['Restful sleep on the road', 'Simple and cosy', 'A stay without the fuss'],
    },
    FOOD_SERVICE: {
      LUXE: ['An evening worth repeating', 'Flavours worth returning for', 'Dinner as an occasion'],
      BOLD: ['Tasty. Loud. With friends', 'Hungry? Come over', 'Come hungry'],
      CLEAN: ['Simple food with character', 'Honest flavour every day', 'A place for an unhurried lunch'],
    },
  },
};

/** Главная фраза премиального салона по тому, чем он занимается */
const FOCUS: Record<HeroLocale, Record<BeautyFocus, string>> = {
  ru: { LASH: 'Взгляд, который запоминают', NAILS: 'Безупречно до кончиков пальцев', HAIR: 'Волосы, которыми любуются', GENERAL: 'Искусство заботы о себе' },
  kk: { LASH: 'Есте қаларлық көзқарас', NAILS: 'Саусақ ұшына дейін мінсіз', HAIR: 'Сүйсіндіретін шаш', GENERAL: 'Өзіңе қамқорлық өнері' },
  en: { LASH: 'A look they remember', NAILS: 'Flawless to the fingertips', HAIR: 'Hair worth admiring', GENERAL: 'The art of self-care' },
};
const FOCUS_RE: ReadonlyArray<[BeautyFocus, RegExp]> = [
  ['LASH', /ресниц|бров|lash|brow|кірпік|қас\b/i],
  ['NAILS', /ногт|маникюр|педикюр|nail|manicure|pedicure|тырнақ/i],
  ['HAIR', /волос|стрижк|окрашив|укладк|hair|шаш/i],
];

const TAIL: Record<HeroLocale, Record<SiteFactsVertical, string>> = {
  ru: { BEAUTY: 'Запись онлайн в удобное время.', FOOD_SERVICE: 'Меню с ценами и бронь стола онлайн.', HOSPITALITY: 'Бронь напрямую на нашем сайте.' },
  kk: { BEAUTY: 'Ыңғайлы уақытқа онлайн жазылу.', FOOD_SERVICE: 'Бағасы бар мәзір және онлайн үстел брондау.', HOSPITALITY: 'Тікелей біздің сайтта брондау.' },
  en: { BEAUTY: 'Book online at a time that suits you.', FOOD_SERVICE: 'Menu with prices and online table booking.', HOSPITALITY: 'Book directly on our website.' },
};
const AND: Record<HeroLocale, string> = { ru: 'и', kk: 'және', en: 'and' };

function beautyFocus(facts: SiteFacts): BeautyFocus {
  const count = new Map<BeautyFocus, number>();
  for (const item of facts.catalog.items) {
    const text = `${item.category ?? ''} ${item.name}`;
    const hit = FOCUS_RE.find(([, re]) => re.test(text));
    if (hit) count.set(hit[0], (count.get(hit[0]) ?? 0) + 1);
  }
  let best: BeautyFocus = 'GENERAL';
  let max = 0;
  for (const [focus] of FOCUS_RE) if ((count.get(focus) ?? 0) > max) [best, max] = [focus, count.get(focus)!];
  return best;
}

/** Первая буква строчной, если это обычное слово (аббревиатуры вроде SPA не трогаем) */
const lower = (s: string) => (s.length > 1 && s[1] === s[1]!.toLowerCase() ? s[0]!.toLowerCase() + s.slice(1) : s);

function joinList(list: string[], locale: HeroLocale): string {
  if (list.length < 2) return list.join('');
  return `${list.slice(0, -1).join(', ')} ${AND[locale]} ${list[list.length - 1]}`;
}

/** Что предлагает филиал: разделы услуг или меню, иначе названия; у гостиницы типы номеров. До трёх, без повторов */
function topics(facts: SiteFacts): string[] {
  const out: string[] = [];
  const push = (raw: string | undefined | null, asWord: boolean) => {
    const t = starterText(raw, 40);
    if (!t) return;
    const v = asWord ? lower(t) : t;
    if (!out.some((x) => x.toLowerCase() === v.toLowerCase())) out.push(v);
  };
  const items = facts.catalog.items;
  if (facts.vertical === 'HOSPITALITY') for (const i of items) push(i.name, false);
  else {
    for (const i of items) push(i.category, true);
    if (!out.length) for (const i of items) push(i.name, true);
  }
  return out.slice(0, 3);
}

function subheading(facts: SiteFacts, locale: HeroLocale): string {
  const name = starterText(facts.location.name, 60) ?? '';
  const city = starterText(facts.location.city, 40);
  const tail = TAIL[locale][facts.vertical];
  const build = (list: string[]) => {
    const what = list.length ? `: ${joinList(list, locale)}` : '';
    const where = city ? (locale === 'ru' ? ` в городе ${city}` : locale === 'kk' ? `, ${city} қаласы` : ` in ${city}`) : '';
    const lead = `${name}${what}${where}`.trim();
    return lead ? `${lead}. ${tail}` : tail;
  };
  let list = topics(facts);
  let text = build(list);
  while ([...text].length > 200 && list.length) {
    list = list.slice(0, -1);
    text = build(list);
  }
  return text;
}

/** Фраза и подзаголовок первого экрана по фактам, тону и номеру варианта (по кругу) */
export function heroCopy(facts: SiteFacts, tone: HeroTone, index: number, locale: HeroLocale = 'ru'): HeroCopy {
  const list = PHRASES[locale][facts.vertical][tone];
  const phrase = list[((index % HERO_COPY_COUNT) + HERO_COPY_COUNT) % HERO_COPY_COUNT]!;
  const heading = phrase === '{focus}' ? FOCUS[locale][beautyFocus(facts)] : phrase;
  return { heading, subheading: subheading(facts, locale) };
}
