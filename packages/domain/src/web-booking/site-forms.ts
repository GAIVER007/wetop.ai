/**
 * Формы управляемого сайта салона, ресторана и «Перезвоните мне» (SITE-4, SITE-5; ADR-185, план
 * `plans/site-seo-flow-2026-10-15.md` §2). Здесь только разбор формы: ключ сайта, поля, ключ запроса, ловушка для ботов,
 * длины. Свободно ли время, работает ли мастер, принимает ли ресторан брони в этот день, решают правила стойки.
 */
import { createHash } from 'node:crypto';
import { SITE_KEY_RE } from '../web-analytics/hit';
import { normalizePhone, type Parsed } from './request';

export const SITE_FORM_LIMITS = {
  name: 100,
  comment: 1000,
  /** Меток перехода не больше и каждая не длиннее */
  sourceKeys: 10,
  sourceValue: 300,
  /** Гостей в брони стола с сайта не больше, правило филиала (`max_party_size`) может сузить */
  maxPartySize: 50,
} as const;

/** Ключ запроса формы: UUID v4, как `creationKey` брони с сайта (MKT1B BOOK-2) */
const REQUEST_KEY_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const INSTANT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;
/** Ключи меток перехода: `utm_source`, `referrer`, `page` и подобные */
const SOURCE_KEY_RE = /^[a-z][a-z0-9_]{0,39}$/;

const fail = (reason: string): Parsed<never> => ({ ok: false, reason });
const obj = (raw: unknown): Record<string, unknown> | null =>
  raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max + 1) : '');

export function isCalendarDate(v: unknown): v is string {
  return (
    typeof v === 'string' &&
    DATE_RE.test(v) &&
    !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) &&
    new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v
  );
}

/** Общее у всех форм: ключ сайта, имя, телефон, комментарий, ключ запроса, ловушка */
interface Contact {
  siteKey: string;
  name: string;
  phone: string;
  comment: string | null;
  requestKey: string;
}

function contact(b: Record<string, unknown>): Parsed<Contact> {
  const siteKey = typeof b.k === 'string' && SITE_KEY_RE.test(b.k) ? b.k : null;
  if (!siteKey) return fail('bad site key');
  // ловушка: поле «website» скрыто от людей, боты его заполняют
  if (typeof b.website === 'string' && b.website.trim() !== '') return fail('honeypot');
  const name = text(b.name, SITE_FORM_LIMITS.name);
  if (!name || name.length > SITE_FORM_LIMITS.name) return fail(`имя: от 1 до ${SITE_FORM_LIMITS.name} символов`);
  const phone = normalizePhone(b.phone);
  if (!phone) return fail('телефон: не меньше 10 цифр');
  const comment = text(b.comment, SITE_FORM_LIMITS.comment);
  if (comment.length > SITE_FORM_LIMITS.comment) return fail(`комментарий: не больше ${SITE_FORM_LIMITS.comment} символов`);
  if (typeof b.requestKey !== 'string' || !REQUEST_KEY_RE.test(b.requestKey)) return fail('requestKey: UUID v4');
  return { ok: true, value: { siteKey, name, phone, comment: comment || null, requestKey: b.requestKey.toLowerCase() } };
}

/** Отпечаток формы: тот же ключ запроса с другим содержимым это не повтор, а 409 */
export function siteFormFingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

// ───────────── салон ─────────────

export interface BeautySlotsQuery {
  siteKey: string;
  serviceId: string;
  employeeId: string | null;
  date: string;
}

export function parseBeautySlotsQuery(raw: unknown): Parsed<BeautySlotsQuery> {
  const b = obj(raw);
  if (!b) return fail('body is not an object');
  const siteKey = typeof b.k === 'string' && SITE_KEY_RE.test(b.k) ? b.k : null;
  if (!siteKey) return fail('bad site key');
  if (typeof b.service !== 'string' || !UUID_RE.test(b.service)) return fail('service: UUID услуги');
  const employee = b.employee === undefined || b.employee === '' ? null : b.employee;
  if (employee !== null && (typeof employee !== 'string' || !UUID_RE.test(employee))) return fail('employee: UUID мастера');
  if (!isCalendarDate(b.date)) return fail('date: YYYY-MM-DD');
  return {
    ok: true,
    value: { siteKey, serviceId: b.service.toLowerCase(), employeeId: employee?.toLowerCase() ?? null, date: b.date },
  };
}

/** Сколько услуг подряд можно записать с сайта за один визит */
export const BEAUTY_BOOK_MAX_SERVICES = 5;

export interface BeautyBookRequest extends Contact {
  /** первая услуга визита (по ней свободные окна и прежние ответы) */
  serviceId: string;
  /** все услуги визита по порядку, подряд к одному мастеру; одна услуга: [serviceId] */
  serviceIds: string[];
  /** null: «любой свободный мастер» */
  employeeId: string | null;
  startsAt: Date;
}

export function parseBeautyBookRequest(raw: unknown): Parsed<BeautyBookRequest> {
  const b = obj(raw);
  if (!b) return fail('body is not an object');
  const c = contact(b);
  if (!c.ok) return c;
  let serviceIds: string[];
  if (b.serviceIds !== undefined) {
    if (!Array.isArray(b.serviceIds) || b.serviceIds.length === 0 || b.serviceIds.length > BEAUTY_BOOK_MAX_SERVICES)
      return fail(`serviceIds: от 1 до ${BEAUTY_BOOK_MAX_SERVICES} услуг`);
    if (b.serviceIds.some((id) => typeof id !== 'string' || !UUID_RE.test(id))) return fail('serviceIds: UUID услуг');
    serviceIds = (b.serviceIds as string[]).map((id) => id.toLowerCase());
    if (new Set(serviceIds).size !== serviceIds.length) return fail('serviceIds: услуга повторяется');
    if (b.serviceId !== undefined && (typeof b.serviceId !== 'string' || b.serviceId.toLowerCase() !== serviceIds[0]))
      return fail('serviceId: первая услуга списка');
  } else {
    if (typeof b.serviceId !== 'string' || !UUID_RE.test(b.serviceId)) return fail('serviceId: UUID услуги');
    serviceIds = [b.serviceId.toLowerCase()];
  }
  const employee = b.employeeId === undefined || b.employeeId === null || b.employeeId === '' ? null : b.employeeId;
  if (employee !== null && (typeof employee !== 'string' || !UUID_RE.test(employee))) return fail('employeeId: UUID мастера');
  if (typeof b.startsAt !== 'string' || !INSTANT_RE.test(b.startsAt) || Number.isNaN(Date.parse(b.startsAt)))
    return fail('startsAt: время ISO 8601 с поясом');
  return {
    ok: true,
    value: {
      ...c.value,
      serviceId: serviceIds[0]!,
      serviceIds,
      employeeId: employee?.toLowerCase() ?? null,
      startsAt: new Date(b.startsAt),
    },
  };
}

/** Содержимое записи для отпечатка: без ключа сайта, токена проверки и ловушки */
export const beautyBookFingerprint = (r: BeautyBookRequest) =>
  siteFormFingerprint([
    'beauty',
    // одна услуга: прежний отпечаток (повтор формы старого сайта узнаётся), несколько: весь состав
    r.serviceIds.length > 1 ? r.serviceIds.join(',') : r.serviceId,
    r.employeeId,
    r.startsAt.toISOString(),
    r.name,
    r.phone,
    r.comment,
  ]);

// ───────────── ресторан ─────────────

export interface FoodReserveRequest extends Contact {
  /** Дата и время в поясе филиала */
  date: string;
  time: string;
  partySize: number;
}

export function parseFoodReserveRequest(raw: unknown): Parsed<FoodReserveRequest> {
  const b = obj(raw);
  if (!b) return fail('body is not an object');
  const c = contact(b);
  if (!c.ok) return c;
  if (!isCalendarDate(b.date)) return fail('date: YYYY-MM-DD');
  if (typeof b.time !== 'string' || !TIME_RE.test(b.time)) return fail('time: ЧЧ:ММ');
  const partySize = Number(b.partySize);
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > SITE_FORM_LIMITS.maxPartySize)
    return fail(`гостей: от 1 до ${SITE_FORM_LIMITS.maxPartySize}`);
  return { ok: true, value: { ...c.value, date: b.date, time: b.time, partySize } };
}

export const foodReserveFingerprint = (r: FoodReserveRequest) =>
  siteFormFingerprint(['food', r.date, r.time, r.partySize, r.name, r.phone, r.comment]);

// ───────────── заявка без слота ─────────────

export type SiteLeadKind = 'CALLBACK' | 'OTHER';

export interface SiteLeadRequest extends Contact {
  kind: SiteLeadKind;
  /** Метки перехода: строковые значения, только разрешённые ключи */
  source: Record<string, string> | null;
}

export function parseSiteLeadRequest(raw: unknown): Parsed<SiteLeadRequest> {
  const b = obj(raw);
  if (!b) return fail('body is not an object');
  const c = contact(b);
  if (!c.ok) return c;
  const kind = b.kind === undefined ? 'CALLBACK' : b.kind;
  if (kind !== 'CALLBACK' && kind !== 'OTHER') return fail('kind: CALLBACK или OTHER');
  let source: Record<string, string> | null = null;
  if (b.source !== undefined && b.source !== null) {
    const s = obj(b.source);
    if (!s) return fail('source: объект меток');
    const entries = Object.entries(s);
    if (entries.length > SITE_FORM_LIMITS.sourceKeys) return fail(`source: не больше ${SITE_FORM_LIMITS.sourceKeys} меток`);
    source = {};
    for (const [k, v] of entries) {
      if (!SOURCE_KEY_RE.test(k)) return fail(`source: метка ${k.slice(0, 40)} не подходит`);
      if (typeof v !== 'string') return fail(`source.${k}: строка`);
      source[k] = v.trim().slice(0, SITE_FORM_LIMITS.sourceValue);
    }
    if (!Object.keys(source).length) source = null;
  }
  return { ok: true, value: { ...c.value, kind, source } };
}

export const siteLeadFingerprint = (r: SiteLeadRequest) =>
  siteFormFingerprint(['lead', r.kind, r.name, r.phone, r.comment, r.source]);

// ───────────── статус заявки (стойка) ─────────────

export type SiteLeadStatus = 'NEW' | 'IN_PROGRESS' | 'DONE' | 'SPAM';
export const SITE_LEAD_STATUSES: readonly SiteLeadStatus[] = ['NEW', 'IN_PROGRESS', 'DONE', 'SPAM'];

export function isSiteLeadStatus(v: unknown): v is SiteLeadStatus {
  return typeof v === 'string' && (SITE_LEAD_STATUSES as readonly string[]).includes(v);
}
