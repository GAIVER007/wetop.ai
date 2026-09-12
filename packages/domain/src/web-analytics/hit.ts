/**
 * Разбор одного события счётчика (план среза 8 §4–5). Приёмник публичный, поэтому всё, что не по форме,
 * отбрасывается молча; что по форме, но длиннее лимита — обрезается. Персональных данных здесь нет по
 * построению: параметры события проходят только через allow-list ключей.
 */
export type HitType = 'pageview' | 'ping' | 'leave' | 'event';

export const HIT_TYPES: readonly HitType[] = ['pageview', 'ping', 'leave', 'event'];
export const EVENT_NAMES = [
  'search',
  'booking_step',
  'phone_click',
  'whatsapp_click',
  'custom',
] as const;
export type EventName = (typeof EVENT_NAMES)[number];
export const PROP_KEYS = [
  'arrival',
  'departure',
  'adults',
  'children',
  'category',
  'rate',
  'step',
] as const;

export const HIT_LIMITS = {
  body: 4096,
  url: 2048,
  referrer: 2048,
  title: 200,
  language: 16,
  timezone: 64,
  propValue: 64,
  props: 2048,
} as const;

export const SITE_KEY_RE = /^pms_[0-9a-f]{12}$/;
const CLIENT_KEY_RE = /^[A-Za-z0-9_-]{8,64}$/;

export type PropValue = string | number | boolean;

export interface ParsedHit {
  siteKey: string;
  visitorKey: string;
  sessionKey: string;
  type: HitType;
  url: URL;
  referrer: string | null;
  width: number | null;
  language: string | null;
  timezone: string | null;
  title: string | null;
  eventName: EventName | null;
  props: Record<string, PropValue> | null;
}

export type HitParse = { ok: true; hit: ParsedHit } | { ok: false; reason: string };

const reject = (reason: string): HitParse => ({ ok: false, reason });

function str(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length ? t.slice(0, max) : null;
}

/** Строка не длиннее лимита; длиннее — null (это не поле для обрезки, а мусор). */
function strOrNull(v: unknown, max: number): string | null {
  return typeof v === 'string' && v.length <= max ? str(v, max) : null;
}

function httpUrl(v: unknown, max: number): URL | null {
  if (typeof v !== 'string' || v.length > max) return null;
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u : null;
  } catch {
    return null;
  }
}

function props(raw: unknown): Record<string, PropValue> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out: Record<string, PropValue> = {};
  for (const key of PROP_KEYS) {
    const v = (raw as Record<string, unknown>)[key];
    if (typeof v === 'string') {
      const t = v.trim().slice(0, HIT_LIMITS.propValue);
      if (t) out[key] = t;
    } else if (typeof v === 'number' && Number.isFinite(v)) out[key] = v;
    else if (typeof v === 'boolean') out[key] = v;
  }
  if (!Object.keys(out).length) return null;
  return JSON.stringify(out).length <= HIT_LIMITS.props ? out : null;
}

export function parseHit(raw: unknown): HitParse {
  let body: unknown = raw;
  if (typeof raw === 'string') {
    if (raw.length > HIT_LIMITS.body) return reject('body too large');
    try {
      body = JSON.parse(raw);
    } catch {
      return reject('body is not JSON');
    }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return reject('body is not an object');
  }
  const b = body as Record<string, unknown>;

  const siteKey = typeof b.k === 'string' && SITE_KEY_RE.test(b.k) ? b.k : null;
  if (!siteKey) return reject('bad site key');
  const visitorKey = typeof b.v === 'string' && CLIENT_KEY_RE.test(b.v) ? b.v : null;
  if (!visitorKey) return reject('bad visitor key');
  const sessionKey = typeof b.s === 'string' && CLIENT_KEY_RE.test(b.s) ? b.s : null;
  if (!sessionKey) return reject('bad session key');
  const type = HIT_TYPES.find((t) => t === b.t) ?? null;
  if (!type) return reject('bad type');
  const url = httpUrl(b.u, HIT_LIMITS.url);
  if (!url) return reject('bad url');

  let eventName: EventName | null = null;
  if (type === 'event') {
    eventName = EVENT_NAMES.find((n) => n === b.n) ?? null;
    if (!eventName) return reject('bad event name');
  }
  const width =
    typeof b.w === 'number' && Number.isFinite(b.w) && b.w >= 0 && b.w <= 10000
      ? Math.round(b.w)
      : null;
  const referrer = httpUrl(b.r, HIT_LIMITS.referrer);

  return {
    ok: true,
    hit: {
      siteKey,
      visitorKey,
      sessionKey,
      type,
      url,
      referrer: referrer ? referrer.toString() : null,
      width,
      language: strOrNull(b.l, HIT_LIMITS.language),
      timezone: strOrNull(b.z, HIT_LIMITS.timezone),
      title: str(b.ti, HIT_LIMITS.title),
      eventName,
      props: type === 'event' ? props(b.p) : null,
    },
  };
}
