/**
 * Письмо гостю с подтверждением брони (ADR-144, закрывает Q-115 для почты).
 *
 * Простой текст без ссылок, как письмо-приглашение: письмо от системы бронирования не должно выглядеть
 * фишингом. Адрес гостя приходит из формы брони и здесь не сохраняется (ADR-018: пока база вне РК,
 * настоящая почта гостя в базу не пишется). Языки: русский, казахский, английский, китайский.
 * Казахский и китайский тексты проверяет носитель языка до выкладки.
 */

import type { MailMessage } from './sender';

export type BookingLetterLang = 'ru' | 'kk' | 'en' | 'zh';

export interface BookingLetterInput {
  to: string;
  lang: BookingLetterLang;
  guestFirstName: string;
  propertyName: string;
  confirmationNumber: string;
  categoryName: string;
  /** ISO-даты проживания */
  arrivalDate: string;
  departureDate: string;
  nights: number;
  adults: number;
  /** Сумма в тиынах строкой (ADR-008) */
  totalMinor: string;
  currency: string;
  checkInTime: string;
  checkOutTime: string;
}

/** 123456789 → «1 234 567,89 ₸»; копейки только когда они есть */
export function formatMoneyMinor(minor: string, currency: string): string {
  const neg = minor.startsWith('-');
  const digits = (neg ? minor.slice(1) : minor).padStart(3, '0');
  const int = digits.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const frac = digits.slice(-2);
  const sym = currency === 'KZT' ? '₸' : currency;
  return `${neg ? '-' : ''}${int}${frac === '00' ? '' : `,${frac}`} ${sym}`;
}

const dmy = (iso: string): string => {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
};

interface Words {
  subject: (n: string, p: string) => string;
  hello: (name: string) => string;
  accepted: (p: string) => string;
  number: string;
  checkIn: (date: string, time: string) => string;
  checkOut: (date: string, time: string) => string;
  stay: (category: string, adults: number, nights: number) => string;
  total: (money: string) => string;
  keep: string;
  change: (p: string) => string;
}

const WORDS: Record<BookingLetterLang, Words> = {
  ru: {
    subject: (n, p) => `Бронь ${n} подтверждена: ${p}`,
    hello: (name) => `Здравствуйте, ${name}!`,
    accepted: (p) => `Ваша бронь в «${p}» принята.`,
    number: 'Номер брони',
    checkIn: (d, t) => `Заезд: ${d} с ${t}`,
    checkOut: (d, t) => `Выезд: ${d} до ${t}`,
    stay: (c, a, n) => `${c}, гостей: ${a}, ночей: ${n}`,
    total: (m) => `Сумма: ${m}. Оплата при заселении.`,
    keep: 'Сохраните номер брони, его спросят при заселении.',
    change: (p) => `Чтобы изменить или отменить бронь, свяжитесь с «${p}».`,
  },
  kk: {
    subject: (n, p) => `${n} брондау расталды: ${p}`,
    hello: (name) => `Сәлеметсіз бе, ${name}!`,
    accepted: (p) => `«${p}» орнындағы брондауыңыз қабылданды.`,
    number: 'Брондау нөмірі',
    checkIn: (d, t) => `Келу: ${d}, ${t} бастап`,
    checkOut: (d, t) => `Кету: ${d}, ${t} дейін`,
    stay: (c, a, n) => `${c}, қонақтар: ${a}, түндер: ${n}`,
    total: (m) => `Сомасы: ${m}. Төлем орналасу кезінде.`,
    keep: 'Брондау нөмірін сақтаңыз, оны орналасу кезінде сұрайды.',
    change: (p) => `Брондауды өзгерту немесе болдырмау үшін «${p}» әкімшілігіне хабарласыңыз.`,
  },
  en: {
    subject: (n, p) => `Booking ${n} confirmed: ${p}`,
    hello: (name) => `Hello, ${name}!`,
    accepted: (p) => `Your booking at ${p} is confirmed.`,
    number: 'Booking number',
    checkIn: (d, t) => `Check-in: ${d} from ${t}`,
    checkOut: (d, t) => `Check-out: ${d} until ${t}`,
    stay: (c, a, n) => `${c}, guests: ${a}, nights: ${n}`,
    total: (m) => `Total: ${m}. Payment on arrival.`,
    keep: 'Please keep the booking number, you will be asked for it at check-in.',
    change: (p) => `To change or cancel the booking, please contact ${p}.`,
  },
  zh: {
    subject: (n, p) => `预订 ${n} 已确认：${p}`,
    hello: (name) => `您好，${name}！`,
    accepted: (p) => `您在 ${p} 的预订已确认。`,
    number: '预订号',
    checkIn: (d, t) => `入住：${d} ${t} 起`,
    checkOut: (d, t) => `退房：${d} ${t} 前`,
    stay: (c, a, n) => `${c}，客人：${a}，晚数：${n}`,
    total: (m) => `总价：${m}。入住时付款。`,
    keep: '请保存预订号，入住时需要出示。',
    change: (p) => `如需更改或取消预订，请联系 ${p}。`,
  },
};

export function bookingConfirmationLetter(input: BookingLetterInput): MailMessage {
  const w = WORDS[input.lang] ?? WORDS.ru;
  const sep = input.lang === 'zh' ? '：' : ': ';
  const text = [
    w.hello(input.guestFirstName),
    '',
    w.accepted(input.propertyName),
    '',
    `${w.number}${sep}${input.confirmationNumber}`,
    w.checkIn(dmy(input.arrivalDate), input.checkInTime),
    w.checkOut(dmy(input.departureDate), input.checkOutTime),
    w.stay(input.categoryName, input.adults, input.nights),
    w.total(formatMoneyMinor(input.totalMinor, input.currency)),
    '',
    w.keep,
    w.change(input.propertyName),
    '',
    input.propertyName,
  ].join('\n');
  return { to: input.to, subject: w.subject(input.confirmationNumber, input.propertyName), text };
}
