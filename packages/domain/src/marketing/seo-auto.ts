import type { SiteFacts, SiteFactsCatalogItem, SiteFactsHoursDay, SiteFactsMoney } from './site-facts';

/**
 * SEO и GEO сразу при создании сайта (поручение владельца 28.10.2026, аудит «Сайт и SEO» S7). Из данных WETOP без
 * ручной работы и без ИИ: заголовок страницы с видом бизнеса и городом, описание с главными услугами, блюдами или
 * номерами, и «Вопросы и ответы» с разметкой FAQ. Это то, что Google показывает в выдаче, а ИИ-поисковики (ChatGPT,
 * Perplexity, Gemini) цитируют: короткий вопрос и точный ответ с ценой, часами и адресом.
 *
 * Только факты филиала: нет адреса, нет вопроса «где вы»; нет цен, нет вопроса о ценах. Чистые функции без сети:
 * те же факты дают тот же текст. Входной текст уже очищен вызывающим (`clean`), здесь только сборка и пределы.
 */
export type SeoLocale = 'ru' | 'kk' | 'en';
export const AUTO_FAQ_ID = 'sec-faq';
const TITLE_MAX = 60;
const DESCRIPTION_MAX = 160;

const WEEKDAY = {
  ru: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
  kk: ['Жс', 'Дс', 'Сс', 'Ср', 'Бс', 'Жм', 'Сб'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
} as const;

const W = {
  ru: {
    kind: { HOSPITALITY: 'гостиница', BEAUTY: 'салон красоты', FOOD_SERVICE: 'ресторан' },
    address: (a: string) => `Адрес: ${a}.`,
    tailBeauty: 'Запись онлайн.',
    tailFood: 'Меню с ценами и бронь стола онлайн.',
    tailHotel: 'Бронирование онлайн без посредников.',
    checkTimes: (i: string | null, o: string | null) => [i ? `Заезд с ${i}` : '', o ? `выезд до ${o}` : ''].filter(Boolean).join(', ') + '.',
    qBookBeauty: (n: string) => `Как записаться в ${n}?`,
    aBookBeauty: 'Выберите услугу, мастера и время в форме записи на сайте. Запись сразу появляется у салона, свободное время видно в форме.',
    aCallBeauty: 'Оставьте имя и телефон в форме на сайте: мы перезвоним и подберём время.',
    qBookFood: 'Как забронировать стол?',
    aBookFood: 'В форме на сайте: выберите дату, время и число гостей. Бронь сразу появляется у ресторана.',
    qBookHotel: 'Как забронировать номер?',
    aBookHotel: 'Выберите даты в форме бронирования на сайте: свободные номера и цена видны сразу, без посредников и комиссий.',
    orCall: (p: string) => ` Или позвоните: ${p}.`,
    qPrices: { BEAUTY: 'Сколько стоят услуги?', FOOD_SERVICE: 'Сколько стоят блюда?', HOSPITALITY: 'Сколько стоит номер?' },
    pricesTail: { BEAUTY: 'Все цены на сайте в разделе «Услуги».', FOOD_SERVICE: 'Всё меню с ценами на сайте.', HOSPITALITY: '' },
    qHours: 'Когда вы работаете?',
    qCheck: 'Во сколько заезд и выезд?',
    qRooms: 'Какие есть номера?',
    guests: (n: number) => `до ${n} ${n === 1 ? 'гостя' : 'гостей'}`,
    qWhere: 'Где вы находитесь?',
  },
  kk: {
    kind: { HOSPITALITY: 'қонақ үй', BEAUTY: 'сұлулық салоны', FOOD_SERVICE: 'мейрамхана' },
    address: (a: string) => `Мекенжай: ${a}.`,
    tailBeauty: 'Онлайн жазылу.',
    tailFood: 'Бағасы бар мәзір және онлайн үстел брондау.',
    tailHotel: 'Делдалсыз онлайн брондау.',
    checkTimes: (i: string | null, o: string | null) => [i ? `Кіру ${i} бастап` : '', o ? `шығу ${o} дейін` : ''].filter(Boolean).join(', ') + '.',
    qBookBeauty: (n: string) => `${n} салонына қалай жазылуға болады?`,
    aBookBeauty: 'Сайттағы жазылу формасында қызметті, шеберді және уақытты таңдаңыз. Жазылу салонға бірден түседі.',
    aCallBeauty: 'Сайттағы формаға атыңыз бен телефоныңызды қалдырыңыз: біз хабарласып, уақыт таңдаймыз.',
    qBookFood: 'Үстелді қалай брондауға болады?',
    aBookFood: 'Сайттағы формада күнді, уақытты және қонақтар санын таңдаңыз. Бронь мейрамханаға бірден түседі.',
    qBookHotel: 'Нөмірді қалай брондауға болады?',
    aBookHotel: 'Сайттағы брондау формасында күндерді таңдаңыз: бос нөмірлер мен баға бірден көрінеді, делдалсыз.',
    orCall: (p: string) => ` Немесе қоңырау шалыңыз: ${p}.`,
    qPrices: { BEAUTY: 'Қызметтер қанша тұрады?', FOOD_SERVICE: 'Тағамдар қанша тұрады?', HOSPITALITY: 'Нөмір қанша тұрады?' },
    pricesTail: { BEAUTY: 'Барлық бағалар сайттағы «Қызметтер» бөлімінде.', FOOD_SERVICE: 'Бағасы бар толық мәзір сайтта.', HOSPITALITY: '' },
    qHours: 'Қашан жұмыс істейсіздер?',
    qCheck: 'Кіру және шығу уақыты қашан?',
    qRooms: 'Қандай нөмірлер бар?',
    guests: (n: number) => `${n} қонаққа дейін`,
    qWhere: 'Сіздер қайда орналасқансыздар?',
  },
  en: {
    kind: { HOSPITALITY: 'hotel', BEAUTY: 'beauty salon', FOOD_SERVICE: 'restaurant' },
    address: (a: string) => `Address: ${a}.`,
    tailBeauty: 'Book online.',
    tailFood: 'Menu with prices and online table booking.',
    tailHotel: 'Book online directly, no middlemen.',
    checkTimes: (i: string | null, o: string | null) => [i ? `Check-in from ${i}` : '', o ? `check-out until ${o}` : ''].filter(Boolean).join(', ') + '.',
    qBookBeauty: (n: string) => `How do I book at ${n}?`,
    aBookBeauty: 'Choose a service, a specialist and a time in the booking form on the website. Your booking reaches the salon right away.',
    aCallBeauty: 'Leave your name and phone in the form on the website: we will call you back and find a time.',
    qBookFood: 'How do I book a table?',
    aBookFood: 'Use the form on the website: choose the date, time and number of guests. Your booking reaches the restaurant right away.',
    qBookHotel: 'How do I book a room?',
    aBookHotel: 'Choose your dates in the booking form on the website: available rooms and the price show up right away, with no middlemen or fees.',
    orCall: (p: string) => ` Or call us: ${p}.`,
    qPrices: { BEAUTY: 'How much do services cost?', FOOD_SERVICE: 'How much do dishes cost?', HOSPITALITY: 'How much is a room?' },
    pricesTail: { BEAUTY: 'All prices are in the Services section.', FOOD_SERVICE: 'The full menu with prices is on the website.', HOSPITALITY: '' },
    qHours: 'What are your opening hours?',
    qCheck: 'What are check-in and check-out times?',
    qRooms: 'What rooms do you have?',
    guests: (n: number) => `up to ${n} ${n === 1 ? 'guest' : 'guests'}`,
    qWhere: 'Where are you located?',
  },
} as const;

/** Деньги из minor units строкой без float (AGENTS §12): «15000» QAR → «150 QAR», «450050» → «4500.50» */
export function moneyText(m: SiteFactsMoney): string {
  const minor = m.minor.replace(/^-/, '');
  const whole = minor.length > 2 ? minor.slice(0, -2) : '0';
  const cents = minor.padStart(3, '0').slice(-2);
  return `${whole.replace(/^0+(?=\d)/, '')}${cents === '00' ? '' : `.${cents}`} ${m.currency}`;
}

const chars = (s: string) => [...s].length;
const cut = (s: string, max: number) => (chars(s) > max ? `${[...s].slice(0, max - 1).join('').trimEnd()}…` : s);

/** Часы по дням недели с понедельника, одинаковые соседние дни склеены: «Пн–Пт 10:00–21:00, Сб 11:00–18:00» */
export function hoursText(days: SiteFactsHoursDay[], locale: SeoLocale): string {
  const order = [1, 2, 3, 4, 5, 6, 0];
  const by = new Map(days.filter((d) => d.open !== d.close).map((d) => [d.weekday, `${d.open}–${d.close}`]));
  const groups: Array<{ from: number; to: number; time: string }> = [];
  for (const wd of order) {
    const time = by.get(wd);
    if (!time) continue;
    const last = groups.at(-1);
    if (last && last.time === time && order.indexOf(wd) === order.indexOf(last.to) + 1) last.to = wd;
    else groups.push({ from: wd, to: wd, time });
  }
  const name = WEEKDAY[locale];
  return groups.map((g) => `${g.from === g.to ? name[g.from] : `${name[g.from]}–${name[g.to]}`} ${g.time}`).join(', ');
}

export interface AutoSeoInput {
  facts: SiteFacts;
  locale: SeoLocale;
  /** Очищенные вызывающим тексты: имя, адрес, город, телефон E.164, названия позиций каталога */
  name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  items: SiteFactsCatalogItem[];
  itemName: (i: SiteFactsCatalogItem) => string;
}

/** Заголовок страницы для поисковиков: «Имя: вид бизнеса, Город»; не влезает, без города, затем просто имя */
export function autoSeoTitle(x: AutoSeoInput): string {
  const kind = W[x.locale].kind[x.facts.vertical];
  for (const t of [x.city ? `${x.name}: ${kind}, ${x.city}` : '', `${x.name}: ${kind}`, x.name]) if (t && chars(t) <= TITLE_MAX) return t;
  return cut(x.name, TITLE_MAX);
}

/** Описание для выдачи: что здесь есть (до трёх позиций), адрес, как записаться; лишнее отпадает, а не обрезается */
export function autoSeoDescription(x: AutoSeoInput): string {
  const w = W[x.locale];
  const v = x.facts.vertical;
  const tail = v === 'BEAUTY' ? w.tailBeauty : v === 'FOOD_SERVICE' ? w.tailFood : w.tailHotel;
  const head = x.city && v === 'HOSPITALITY' ? `${x.name}, ${x.city}` : x.name;
  const checks = v === 'HOSPITALITY' && (x.facts.hours.checkInTime || x.facts.hours.checkOutTime) ? w.checkTimes(x.facts.hours.checkInTime, x.facts.hours.checkOutTime) : '';
  const build = (n: number, withAddress: boolean) => {
    const names = x.items.slice(0, n).map(x.itemName);
    return [names.length ? `${head}: ${names.join(', ')}.` : `${head}.`, checks, withAddress && x.address ? w.address(x.address) : '', tail]
      .filter(Boolean)
      .join(' ');
  };
  for (const withAddress of [true, false]) for (let n = Math.min(3, x.items.length); n >= 0; n--) {
    const d = build(n, withAddress);
    if (chars(d) <= DESCRIPTION_MAX) return d;
  }
  return cut(build(0, false), DESCRIPTION_MAX);
}

/** Вопросы и ответы из фактов: как записаться, цены, часы или заезд, номера, адрес. Первый вопрос есть всегда */
export function autoFaqItems(x: AutoSeoInput): Array<{ question: string; answer: string }> {
  const w = W[x.locale];
  const v = x.facts.vertical;
  const call = x.phone ? w.orCall(x.phone) : '';
  const out: Array<{ question: string; answer: string }> = [];
  if (v === 'BEAUTY') out.push({ question: cut(w.qBookBeauty(x.name), 200), answer: (x.items.length ? w.aBookBeauty : w.aCallBeauty) + call });
  if (v === 'FOOD_SERVICE') out.push({ question: w.qBookFood, answer: w.aBookFood + call });
  if (v === 'HOSPITALITY') out.push({ question: w.qBookHotel, answer: w.aBookHotel + call });

  const priced = x.items.filter((i) => i.price).slice(0, 6);
  if (priced.length && v !== 'HOSPITALITY') {
    const list = priced.map((i) => `${x.itemName(i)}: ${moneyText(i.price!)}`).join(', ');
    out.push({ question: w.qPrices[v], answer: cut(`${list}. ${w.pricesTail[v]}`.trim(), 1000) });
  }
  if (v === 'HOSPITALITY') {
    if (x.facts.hours.checkInTime || x.facts.hours.checkOutTime)
      out.push({ question: w.qCheck, answer: w.checkTimes(x.facts.hours.checkInTime, x.facts.hours.checkOutTime) });
    const rooms = x.items.slice(0, 10).map((i) => (typeof i.capacityAdults === 'number' && i.capacityAdults > 0 ? `${x.itemName(i)} (${w.guests(i.capacityAdults)})` : x.itemName(i)));
    if (rooms.length) out.push({ question: w.qRooms, answer: cut(`${rooms.join(', ')}.`, 1000) });
  } else {
    const hours = hoursText(x.facts.hours.days, x.locale);
    if (hours) out.push({ question: w.qHours, answer: `${hours}.` });
  }
  if (x.address) out.push({ question: w.qWhere, answer: w.address(x.city && !x.address.includes(x.city) ? `${x.city}, ${x.address}` : x.address) });
  return out;
}

/**
 * Все вопросы, которые автоматический блок может задать для направления и имени. Живое обновление пересобирает блок
 * `sec-faq` по свежим фактам, только пока все вопросы в нём из этого набора (владелец блок не переписывал): иначе блок
 * владельца не трогается.
 */
export function autoFaqQuestionSet(x: AutoSeoInput): Set<string> {
  const w = W[x.locale];
  const v = x.facts.vertical;
  const book = v === 'BEAUTY' ? cut(w.qBookBeauty(x.name), 200) : v === 'FOOD_SERVICE' ? w.qBookFood : w.qBookHotel;
  return new Set([book, w.qPrices[v], w.qHours, w.qCheck, w.qRooms, w.qWhere]);
}
