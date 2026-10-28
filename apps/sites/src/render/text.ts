import type { Locale, LocalizedText } from '../types';

/** Экранирование для текста и значений атрибутов: весь текст документа проходит здесь, разметки из SiteSpec нет */
export function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );
}

/** Текст на языке сайта; валидатор гарантирует ключ `defaultLocale`, а рантайм v0 публикует только его */
export function tx(text: LocalizedText | undefined, locale: Locale): string {
  return text?.[locale] ?? '';
}

/** Только `https:` без логина, пароля и порта; иначе ссылки нет (второй рубеж после валидатора) */
export function safeHttps(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    return url.href;
  } catch {
    return null;
  }
}

const PHONE_RE = /^\+[1-9][0-9]{9,14}$/;
export const phoneHref = (phone: unknown) => (typeof phone === 'string' && PHONE_RE.test(phone) ? `tel:${phone}` : null);
export const whatsappHref = (phone: unknown) =>
  typeof phone === 'string' && PHONE_RE.test(phone) ? `https://wa.me/${phone.slice(1)}` : null;
export const mailHref = (email: unknown) =>
  typeof email === 'string' && /^[^\s<>@]+@[^\s<>@]+$/.test(email) && email.length <= 254 ? `mailto:${email}` : null;

/** Подписи оболочки рантайма; казахские строки до проверки носителем языка (как печатные формы, §7 CLAUDE.md) */
export interface UiStrings {
  skip: string;
  checkIn: (from: string) => string;
  checkOut: (to: string) => string;
  bookingUnavailable: string;
  callUs: string;
  capacity: (n: number) => string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  map: string;
  googleMaps: string;
  madeWith: string;
  privacy: string;
  menu: string;
  footerNav: string;
  notFoundTitle: string;
  notFoundText: string;
  home: string;
  book: string;
  // SITE-2: салон, ресторан, форма заявки, закреплённая кнопка
  appoint: string;
  bookTable: string;
  callback: string;
  writeWhatsapp: string;
  minutes: (n: number) => string;
  grams: (n: number) => string;
  priceFrom: (price: string) => string;
  weekdays: readonly string[];
  weekdaysShort: readonly string[];
  formName: string;
  formPhone: string;
  formComment: string;
  formService: string;
  formMaster: string;
  formAnyMaster: string;
  formDate: string;
  formTime: string;
  formParty: string;
  formSend: string;
  formSending: string;
  formDone: string;
  formError: string;
  formUnavailable: string;
  quickActions: string;
}

const UI: Record<Locale, UiStrings> = {
  ru: {
    skip: 'Перейти к содержимому',
    checkIn: (from: string) => `Заезд с ${from}`,
    checkOut: (to: string) => `выезд до ${to}`,
    bookingUnavailable: 'Онлайн-бронирование сейчас недоступно.',
    callUs: 'Позвоните нам',
    capacity: (n: number) => `До ${n} ${n === 1 ? 'гостя' : 'гостей'}`,
    phone: 'Телефон',
    whatsapp: 'WhatsApp',
    email: 'Почта',
    address: 'Адрес',
    map: 'Открыть на карте',
    googleMaps: 'Google Карты',
    madeWith: 'Сайт сделан на WETOP',
    privacy: 'Политика конфиденциальности',
    menu: 'Основное меню',
    footerNav: 'Ссылки сайта',
    notFoundTitle: 'Страница не найдена',
    notFoundText: 'Такой страницы на сайте нет.',
    home: 'На главную',
    book: 'Забронировать',
    appoint: 'Записаться',
    bookTable: 'Забронировать стол',
    callback: 'Перезвоните мне',
    writeWhatsapp: 'WhatsApp',
    minutes: (n: number) => `${n} мин`,
    grams: (n: number) => `${n} г`,
    priceFrom: (price: string) => `от ${price}`,
    weekdays: ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'],
    weekdaysShort: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
    formName: 'Имя',
    formPhone: 'Телефон',
    formComment: 'Комментарий',
    formService: 'Услуга',
    formMaster: 'Мастер',
    formAnyMaster: 'Любой мастер',
    formDate: 'Дата',
    formTime: 'Время',
    formParty: 'Гостей',
    formSend: 'Отправить',
    formSending: 'Отправляем…',
    formDone: 'Заявка принята. Мы свяжемся с вами.',
    formError: 'Не удалось отправить. Попробуйте ещё раз или позвоните нам.',
    formUnavailable: 'Онлайн-запись сейчас недоступна.',
    quickActions: 'Быстрые действия',
  },
  kk: {
    skip: 'Мазмұнға өту',
    checkIn: (from: string) => `Кіру ${from}-ден бастап`,
    checkOut: (to: string) => `шығу ${to}-ге дейін`,
    bookingUnavailable: 'Онлайн брондау қазір қолжетімсіз.',
    callUs: 'Бізге қоңырау шалыңыз',
    capacity: (n: number) => `${n} қонаққа дейін`,
    phone: 'Телефон',
    whatsapp: 'WhatsApp',
    email: 'Пошта',
    address: 'Мекенжай',
    map: 'Картадан ашу',
    googleMaps: 'Google Карталар',
    madeWith: 'Сайт WETOP-та жасалған',
    privacy: 'Құпиялылық саясаты',
    menu: 'Негізгі мәзір',
    footerNav: 'Сайт сілтемелері',
    notFoundTitle: 'Бет табылмады',
    notFoundText: 'Сайтта мұндай бет жоқ.',
    home: 'Басты бетке',
    book: 'Брондау',
    appoint: 'Жазылу',
    bookTable: 'Үстел брондау',
    callback: 'Маған қоңырау шалыңыз',
    writeWhatsapp: 'WhatsApp',
    minutes: (n: number) => `${n} мин`,
    grams: (n: number) => `${n} г`,
    priceFrom: (price: string) => `${price} бастап`,
    weekdays: ['Жексенбі', 'Дүйсенбі', 'Сейсенбі', 'Сәрсенбі', 'Бейсенбі', 'Жұма', 'Сенбі'],
    weekdaysShort: ['Жс', 'Дс', 'Сс', 'Ср', 'Бс', 'Жм', 'Сб'],
    formName: 'Аты',
    formPhone: 'Телефон',
    formComment: 'Пікір',
    formService: 'Қызмет',
    formMaster: 'Шебер',
    formAnyMaster: 'Кез келген шебер',
    formDate: 'Күні',
    formTime: 'Уақыты',
    formParty: 'Қонақтар',
    formSend: 'Жіберу',
    formSending: 'Жіберілуде…',
    formDone: 'Өтінім қабылданды. Біз сізбен хабарласамыз.',
    formError: 'Жіберу мүмкін болмады. Қайталап көріңіз немесе бізге қоңырау шалыңыз.',
    formUnavailable: 'Онлайн жазылу қазір қолжетімсіз.',
    quickActions: 'Жылдам әрекеттер',
  },
  en: {
    skip: 'Skip to content',
    checkIn: (from: string) => `Check-in from ${from}`,
    checkOut: (to: string) => `check-out until ${to}`,
    bookingUnavailable: 'Online booking is not available right now.',
    callUs: 'Call us',
    capacity: (n: number) => `Up to ${n} ${n === 1 ? 'guest' : 'guests'}`,
    phone: 'Phone',
    whatsapp: 'WhatsApp',
    email: 'Email',
    address: 'Address',
    map: 'Open on the map',
    googleMaps: 'Google Maps',
    madeWith: 'Site made with WETOP',
    privacy: 'Privacy policy',
    menu: 'Main menu',
    footerNav: 'Site links',
    notFoundTitle: 'Page not found',
    notFoundText: 'There is no such page on this site.',
    home: 'Go to home page',
    book: 'Book',
    appoint: 'Book a visit',
    bookTable: 'Book a table',
    callback: 'Call me back',
    writeWhatsapp: 'WhatsApp',
    minutes: (n: number) => `${n} min`,
    grams: (n: number) => `${n} g`,
    priceFrom: (price: string) => `from ${price}`,
    weekdays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    weekdaysShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    formName: 'Name',
    formPhone: 'Phone',
    formComment: 'Comment',
    formService: 'Service',
    formMaster: 'Specialist',
    formAnyMaster: 'Any specialist',
    formDate: 'Date',
    formTime: 'Time',
    formParty: 'Guests',
    formSend: 'Send',
    formSending: 'Sending…',
    formDone: 'Request received. We will contact you.',
    formError: 'Could not send. Please try again or call us.',
    formUnavailable: 'Online booking is not available right now.',
    quickActions: 'Quick actions',
  },
};
export const ui = (locale: Locale): UiStrings => UI[locale] ?? UI.ru;
