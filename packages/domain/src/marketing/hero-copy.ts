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
/**
 * Заголовки по Хормози и Брансону (владелец 29.10.2026): желанный результат клиента, коротко, без выдумок (без
 * стажа, скидок, «лучших» и гарантий). Тон шаблона задаёт голос: премиальный, смелый, спокойный.
 */
const PHRASES: Record<HeroLocale, Record<SiteFactsVertical, Phrases>> = {
  ru: {
    BEAUTY: {
      LUXE: ['{focus}', 'Выходите красивее, чем пришли', 'Красота, которую замечают сразу'],
      BOLD: ['Запишитесь сегодня, сияйте завтра', 'Новый образ за один визит', 'Красота без очередей и звонков'],
      CLEAN: ['Ухоженный вид без лишних хлопот', 'Красота в удобное вам время', 'Запись за минуту, результат надолго'],
    },
    HOSPITALITY: {
      LUXE: ['Номер, в который хочется вернуться', 'Ваша поездка начинается с отдыха', 'Тишина, сон и всё рядом'],
      BOLD: ['Бронируйте напрямую и отдыхайте', 'Заселяйтесь и живите поездкой', 'Ваша база в городе'],
      CLEAN: ['Выспитесь в поездке', 'Уютный номер без переплат', 'Бронь напрямую за минуту'],
    },
    FOOD_SERVICE: {
      LUXE: ['Вечер, который хочется повторить', 'Ужин, о котором будут говорить', 'Стол на вечер, который запомнят'],
      BOLD: ['Голодны? Стол уже ждёт', 'Вкусно, громко, с друзьями', 'Бронируйте стол и приходите голодными'],
      CLEAN: ['Вкусный обед без ожидания', 'Свободный стол в пару касаний', 'Еда, ради которой возвращаются'],
    },
  },
  kk: {
    BEAUTY: {
      LUXE: ['{focus}', 'Келгеннен де әдемі болып шығыңыз', 'Бірден байқалатын сұлулық'],
      BOLD: ['Бүгін жазылыңыз, ертең жарқыраңыз', 'Бір келгенде жаңа бейне', 'Кезексіз әрі қоңыраусыз сұлулық'],
      CLEAN: ['Артық әуресіз күтімді келбет', 'Өзіңізге ыңғайлы уақытта сұлулық', 'Бір минутта жазылу, ұзаққа нәтиже'],
    },
    HOSPITALITY: {
      LUXE: ['Қайта оралғың келетін нөмір', 'Сапарыңыз демалыстан басталады', 'Тыныштық, ұйқы және бәрі жақын'],
      BOLD: ['Тікелей брондап, демалыңыз', 'Орналасып, сапармен өмір сүріңіз', 'Қаладағы базаңыз'],
      CLEAN: ['Сапарда жақсылап ұйықтаңыз', 'Артық төлемсіз жайлы нөмір', 'Бір минутта тікелей брондау'],
    },
    FOOD_SERVICE: {
      LUXE: ['Қайталағың келетін кеш', 'Айтып жүретін кешкі ас', 'Есте қалатын кешке үстел'],
      BOLD: ['Қарныңыз ашты ма? Үстел дайын', 'Дәмді, көңілді, достармен', 'Үстелді брондап, аш келіңіз'],
      CLEAN: ['Күтусіз дәмді түскі ас', 'Бірнеше рет басып бос үстел', 'Қайта оралатын тағам'],
    },
  },
  en: {
    BEAUTY: {
      LUXE: ['{focus}', 'Leave more beautiful than you came', 'Beauty people notice at once'],
      BOLD: ['Book today, shine tomorrow', 'A new look in one visit', 'Beauty without queues or calls'],
      CLEAN: ['Well-groomed without the hassle', 'Beauty at a time that suits you', 'Book in a minute, results that last'],
    },
    HOSPITALITY: {
      LUXE: ['A room you will want to return to', 'Your trip starts with rest', 'Quiet, sleep and everything nearby'],
      BOLD: ['Book direct and relax', 'Check in and live your trip', 'Your base in the city'],
      CLEAN: ['Sleep well on your trip', 'A cosy room without overpaying', 'Book direct in a minute'],
    },
    FOOD_SERVICE: {
      LUXE: ['An evening worth repeating', 'A dinner people talk about', 'A table for a night to remember'],
      BOLD: ['Hungry? Your table is waiting', 'Tasty, loud, with friends', 'Book a table and come hungry'],
      CLEAN: ['A tasty lunch without the wait', 'A free table in a few taps', 'Food worth coming back for'],
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

/** Лёгкость (Хормози: меньше усилий): как клиент получает результат, без звонков и посредников */
const TAIL: Record<HeroLocale, Record<SiteFactsVertical, string>> = {
  ru: { BEAUTY: 'Запись онлайн за минуту, без звонков.', FOOD_SERVICE: 'Стол онлайн за минуту, без звонков.', HOSPITALITY: 'Бронь напрямую на сайте, без посредников.' },
  kk: { BEAUTY: 'Бір минутта онлайн жазылу, қоңыраусыз.', FOOD_SERVICE: 'Бір минутта онлайн үстел, қоңыраусыз.', HOSPITALITY: 'Сайтта тікелей брондау, делдалсыз.' },
  en: { BEAUTY: 'Book online in a minute, no calls.', FOOD_SERVICE: 'Book a table online in a minute, no calls.', HOSPITALITY: 'Book direct on our site, no middlemen.' },
};
const AND: Record<HeroLocale, string> = { ru: 'и', kk: 'және', en: 'and' };
/** Стопка конкретики (Хормози: ценность видна в цифрах): цена «от», время, мастера, гости, оценка */
const STACK = {
  ru: { from: (p: string) => `от ${p}`, dishFrom: (p: string) => `блюда от ${p}`, minutes: (n: number) => `от ${n} минут`, masters: (n: number) => `${n} ${plural(n, ['мастер', 'мастера', 'мастеров'])}`, guests: (n: number) => `до ${n} ${plural(n, ['гостя', 'гостей', 'гостей'])} в номере`, rating: (a: number, n: number) => `${String(a).replace('.', ',')} из 5 по ${n} ${plural(n, ['оценке', 'оценкам', 'оценкам'])}` },
  kk: { from: (p: string) => `${p} бастап`, dishFrom: (p: string) => `тағамдар ${p} бастап`, minutes: (n: number) => `${n} минуттан`, masters: (n: number) => `${n} шебер`, guests: (n: number) => `нөмірде ${n} қонаққа дейін`, rating: (a: number, n: number) => `${n} баға бойынша 5-тен ${String(a).replace('.', ',')}` },
  en: { from: (p: string) => `from ${p}`, dishFrom: (p: string) => `dishes from ${p}`, minutes: (n: number) => `from ${n} min`, masters: (n: number) => `${n} ${n === 1 ? 'specialist' : 'specialists'}`, guests: (n: number) => `up to ${n} guests per room`, rating: (a: number, n: number) => `${a} out of 5 from ${n} ratings` },
} satisfies Record<HeroLocale, unknown>;
function plural(n: number, forms: [string, string, string]): string {
  const a = n % 10, b = n % 100;
  return forms[a === 1 && b !== 11 ? 0 : a >= 2 && a <= 4 && (b < 12 || b > 14) ? 1 : 2];
}
/** Цена без копеек, если они нулевые: «80 QAR», «2 500 KZT» */
function money(minor: bigint, currency: string): string {
  const whole = minor / 100n, cents = minor % 100n;
  const w = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
  // сумма и валюта не разрываются переносом строки
  return `${cents === 0n ? w : `${w},${cents.toString().padStart(2, '0')}`}\u00a0${currency}`;
}
function minPrice(facts: SiteFacts): string | null {
  let best: { minor: bigint; currency: string } | null = null;
  for (const i of facts.catalog.items) {
    const p = i.price ?? i.priceFrom;
    if (!p || !/^\d+$/.test(p.minor)) continue;
    const m = BigInt(p.minor);
    if (m > 0n && (!best || m < best.minor)) best = { minor: m, currency: p.currency };
  }
  return best ? money(best.minor, best.currency) : null;
}

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
  const st = STACK[locale];
  // конкретика из данных: что есть, то и пишем; чего нет, того нет
  const facts2: string[] = [];
  const price = minPrice(facts);
  if (facts.vertical === 'BEAUTY') {
    const mins = facts.catalog.items.map((i) => i.durationMin ?? 0).filter((n) => n > 0);
    if (mins.length) facts2.push(st.minutes(Math.min(...mins)));
    if (facts.staff.length) facts2.push(st.masters(facts.staff.length));
  } else if (facts.vertical === 'HOSPITALITY') {
    const cap = facts.catalog.items.map((i) => i.capacityAdults ?? 0).filter((n) => n > 0);
    if (cap.length) facts2.push(st.guests(Math.max(...cap)));
  }
  if (facts.reviews && facts.reviews.count > 0) facts2.push(st.rating(facts.reviews.avg, facts.reviews.count));
  const build = (list: string[], extra: string[]) => {
    const head = city ? `${name}, ${city}` : name;
    let what = list.length ? joinList(list, locale) : '';
    if (price && facts.vertical === 'BEAUTY' && what) what = `${what} ${st.from(price)}`;
    const parts = [what, ...(price && facts.vertical === 'FOOD_SERVICE' ? [st.dishFrom(price)] : []), ...(price && facts.vertical === 'BEAUTY' && !what ? [st.from(price)] : []), ...extra].filter(Boolean);
    const lead = parts.length ? `${head}: ${parts.join(', ')}` : head;
    return lead.trim() ? `${lead.trim()}. ${tail}` : tail;
  };
  let list = topics(facts);
  let extra = facts2;
  let text = build(list, extra);
  while ([...text].length > 200 && (extra.length || list.length)) {
    if (extra.length) extra = extra.slice(0, -1);
    else list = list.slice(0, -1);
    text = build(list, extra);
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
