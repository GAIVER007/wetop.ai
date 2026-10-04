/**
 * Запросы виджета бронирования с сайта (срез 9, план §4): разбор и проверка формы до того, как она попадёт
 * в правила брони. Бизнес-правила (доступность, цена, ограничения, ячейка) здесь не решаются — это делает
 * `ReservationsService.create`, тот же путь, что у стойки. Здесь только форма: даты в окне, гости, телефон,
 * honeypot против ботов, обрезка длин.
 */
import { normalizePromoCode } from '../rates/discounts';
import { SITE_KEY_RE } from '../web-analytics/hit';

export const BOOKING_WINDOW = {
  /** Заезд не позже чем через столько дней от сегодня */
  maxLeadDays: 365,
  maxNights: 30,
  maxAdults: 8,
} as const;

export const BOOKING_LIMITS = {
  name: 80,
  comment: 500,
  email: 120,
} as const;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const CLIENT_KEY_RE = /^[A-Za-z0-9_-]{8,64}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CATEGORY_RE = /^[A-Za-z0-9_-]{1,64}$/;

export interface QuoteRequest {
  siteKey: string;
  arrivalDate: string;
  departureDate: string;
  adults: number;
  /** Промокод (DATA_MODEL §20): нормализованный, `null` — не введён */
  promoCode: string | null;
}

/** Языки гостя: письмо подтверждения и виджет (ADR-144). Русский по умолчанию. */
export const GUEST_LANGS = ['ru', 'kk', 'en', 'zh'] as const;
export type GuestLang = (typeof GUEST_LANGS)[number];

/** «EN-us» → en, «zh-CN» → zh, «kz» → kk; незнакомый язык — русский, а не отказ: бронь важнее языка письма */
export function parseGuestLang(v: unknown): GuestLang {
  const head = typeof v === 'string' ? v.trim().toLowerCase().split(/[-_]/)[0] : '';
  if (head === 'kz') return 'kk';
  return (GUEST_LANGS as readonly string[]).includes(head ?? '') ? (head as GuestLang) : 'ru';
}

export interface BookingRequest extends QuoteRequest {
  categoryCode: string;
  /** Язык гостя (ADR-144) */
  lang: GuestLang;
  guest: { firstName: string; lastName: string; phone: string; email: string | null };
  comment: string | null;
  visitorKey: string | null;
  sessionKey: string | null;
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; reason: string };

const fail = (reason: string): Parsed<never> => ({ ok: false, reason });

const isIso = (s: unknown): s is string =>
  typeof s === 'string' &&
  ISO.test(s) &&
  !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) &&
  new Date(Date.parse(`${s}T00:00:00Z`)).toISOString().slice(0, 10) === s;

const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

function text(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

/** Телефон: только цифры; 8XXXXXXXXXX и 7XXXXXXXXXX → +7…; иначе + и цифры (≥ 10). */
export function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) return null;
  if (digits.length === 11 && (digits.startsWith('8') || digits.startsWith('7'))) {
    return `+7${digits.slice(1)}`;
  }
  return `+${digits}`;
}

/** Даты и гости — общая часть quote и book. `today` — дата объекта (YYYY-MM-DD). */
export function parseQuoteRequest(raw: unknown, today: string): Parsed<QuoteRequest> {
  if (!raw || typeof raw !== 'object') return fail('body is not an object');
  const b = raw as Record<string, unknown>;
  const siteKey = typeof b.k === 'string' && SITE_KEY_RE.test(b.k) ? b.k : null;
  if (!siteKey) return fail('bad site key');
  if (!isIso(b.arrival) || !isIso(b.departure)) return fail('даты: YYYY-MM-DD');
  const arrivalDate = b.arrival;
  const departureDate = b.departure;
  if (arrivalDate < today) return fail('заезд не раньше сегодняшнего дня');
  if (departureDate <= arrivalDate) return fail('выезд позже заезда');
  if (daysBetween(today, arrivalDate) > BOOKING_WINDOW.maxLeadDays) {
    return fail(`заезд не позже чем через ${BOOKING_WINDOW.maxLeadDays} дней`);
  }
  if (daysBetween(arrivalDate, departureDate) > BOOKING_WINDOW.maxNights) {
    return fail(`не больше ${BOOKING_WINDOW.maxNights} ночей`);
  }
  const adults = Number(b.adults);
  if (!Number.isInteger(adults) || adults < 1 || adults > BOOKING_WINDOW.maxAdults) {
    return fail(`гостей: от 1 до ${BOOKING_WINDOW.maxAdults}`);
  }
  // промокод — необязательное поле; введён, но записан неверно — отказ словами, а не молчаливое «без скидки»
  const promoRaw = typeof b.promo === 'string' ? b.promo.trim() : '';
  const promoCode = promoRaw === '' ? null : normalizePromoCode(promoRaw);
  if (promoRaw !== '' && !promoCode) return fail('промокод записан неверно');
  return { ok: true, value: { siteKey, arrivalDate, departureDate, adults, promoCode } };
}

export function parseBookingRequest(raw: unknown, today: string): Parsed<BookingRequest> {
  const quote = parseQuoteRequest(raw, today);
  if (!quote.ok) return quote;
  const b = raw as Record<string, unknown>;
  // honeypot: поле «website» скрыто от людей, боты его заполняют
  if (typeof b.website === 'string' && b.website.trim() !== '') return fail('honeypot');
  const categoryCode =
    typeof b.category === 'string' && CATEGORY_RE.test(b.category) ? b.category : null;
  if (!categoryCode) return fail('категория обязательна');
  const g = b.guest && typeof b.guest === 'object' ? (b.guest as Record<string, unknown>) : {};
  const firstName = text(g.firstName, BOOKING_LIMITS.name + 1);
  const lastName = text(g.lastName, BOOKING_LIMITS.name + 1);
  if (!firstName || firstName.length > BOOKING_LIMITS.name) return fail('имя: от 1 до 80 символов');
  if (!lastName || lastName.length > BOOKING_LIMITS.name)
    return fail('фамилия: от 1 до 80 символов');
  const phone = normalizePhone(g.phone);
  if (!phone) return fail('телефон: не меньше 10 цифр');
  const emailRaw = text(g.email, BOOKING_LIMITS.email + 1).toLowerCase();
  if (emailRaw && (!EMAIL_RE.test(emailRaw) || emailRaw.length > BOOKING_LIMITS.email)) {
    return fail('почта не похожа на адрес');
  }
  const comment = text(b.comment, BOOKING_LIMITS.comment);
  const key = (v: unknown) => (typeof v === 'string' && CLIENT_KEY_RE.test(v) ? v : null);
  return {
    ok: true,
    value: {
      ...quote.value,
      categoryCode,
      guest: { firstName, lastName, phone, email: emailRaw || null },
      comment: comment || null,
      lang: parseGuestLang(b.lang),
      visitorKey: key(b.v),
      sessionKey: key(b.s),
    },
  };
}
