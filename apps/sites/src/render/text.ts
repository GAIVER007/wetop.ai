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
  madeWith: string;
  privacy: string;
  menu: string;
  footerNav: string;
  notFoundTitle: string;
  notFoundText: string;
  home: string;
  book: string;
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
    madeWith: 'Сайт сделан на WETOP',
    privacy: 'Политика конфиденциальности',
    menu: 'Основное меню',
    footerNav: 'Ссылки сайта',
    notFoundTitle: 'Страница не найдена',
    notFoundText: 'Такой страницы на сайте нет.',
    home: 'На главную',
    book: 'Забронировать',
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
    madeWith: 'Сайт WETOP-та жасалған',
    privacy: 'Құпиялылық саясаты',
    menu: 'Негізгі мәзір',
    footerNav: 'Сайт сілтемелері',
    notFoundTitle: 'Бет табылмады',
    notFoundText: 'Сайтта мұндай бет жоқ.',
    home: 'Басты бетке',
    book: 'Брондау',
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
    madeWith: 'Site made with WETOP',
    privacy: 'Privacy policy',
    menu: 'Main menu',
    footerNav: 'Site links',
    notFoundTitle: 'Page not found',
    notFoundText: 'There is no such page on this site.',
    home: 'Go to home page',
    book: 'Book',
  },
};
export const ui = (locale: Locale): UiStrings => UI[locale] ?? UI.ru;
