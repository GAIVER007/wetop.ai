/**
 * Черновики постов «Контента» (docs/marketing/content-drafts-proposal.md, контракт `content-draft/0`, утверждено
 * 23.10.2026). Модель советует, код решает: 1–2 варианта (A/B), длины, хештеги, CTA из закрытого списка. Ссылки и
 * телефоны модель не пишет, их подставляет домен по CTA из карточки филиала. Цифры, которых нет в фактах карточки и
 * теме, возвращаются предупреждением («проверьте»), а не молча.
 */

import type { SiteFacts, SiteFactsMoney } from './site-facts';

export const CONTENT_CHANNELS = ['INSTAGRAM', 'FACEBOOK', 'TELEGRAM', 'WHATSAPP_STATUS'] as const;
export type ContentChannel = (typeof CONTENT_CHANNELS)[number];
export const CONTENT_CTAS = ['BOOK_ONLINE', 'WHATSAPP', 'CALL', 'VISIT', 'NONE'] as const;
export type ContentCta = (typeof CONTENT_CTAS)[number];
export const CONTENT_TONES = ['FRIENDLY', 'BUSINESS'] as const;
export type ContentTone = (typeof CONTENT_TONES)[number];
export const CONTENT_ORIGINS = ['AI', 'MANUAL'] as const;
export type ContentOrigin = (typeof CONTENT_ORIGINS)[number];

export const CONTENT_LIMITS = { topic: 500, title: 200, body: 2200, hook: 150, hashtags: 10, hashtag: 50 } as const;

export class ContentDraftError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContentDraftError';
  }
}

export interface ContentVariant {
  hook: string;
  title: string | null;
  body: string;
  hashtags: string[];
  cta: ContentCta;
}

export interface ContentDraftInput {
  channel: ContentChannel;
  topic: string;
  title: string | null;
  body: string;
  hashtags: string[];
  cta: ContentCta | null;
  origin: ContentOrigin;
  plannedOn: string | null;
}

const URL_RE = /\b(?:https?:\/\/|www\.)\S+/gi;
// телефон: 9+ цифр подряд с пробелами, скобками и дефисами, необязательный +
const PHONE_RE = /\+?\d[\d\s()-]{7,}\d/g;

/** Убирает длинное тире (правило проекта), лишние пробелы; пусто: null */
const clean = (v: unknown, max: number, multiline = false): string | null => {
  if (typeof v !== 'string') return null;
  let s = v.replace(/\s*\u2014\s*/g, ', ');
  s = multiline
    ? s.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n')
    : s.replace(/\s+/g, ' ');
  s = s.trim().slice(0, max).trim();
  return s === '' ? null : s;
};

const stripContacts = (s: string) =>
  s.replace(URL_RE, '').replace(PHONE_RE, '').replace(/[ \t]{2,}/g, ' ').replace(/ +([,.!?])/g, '$1').trim();

const tag = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.replace(/^#+/, '').replace(/\s+/g, '').slice(0, CONTENT_LIMITS.hashtag);
  return t === '' ? null : t;
};

const tags = (v: unknown): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const x of Array.isArray(v) ? v : []) {
    const t = tag(x);
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    result.push(t);
    if (result.length === CONTENT_LIMITS.hashtags) break;
  }
  return result;
};

const ctaOf = (v: unknown): ContentCta =>
  typeof v === 'string' && (CONTENT_CTAS as readonly string[]).includes(v) ? (v as ContentCta) : 'NONE';

/** Ответ бота `content-draft/0` → 1–2 проверенных варианта. Иначе ContentDraftError (бот перегенерирует один раз). */
export function normalizeContentVariants(spec: unknown): ContentVariant[] {
  if (!spec || typeof spec !== 'object') throw new ContentDraftError('ИИ ответил не по схеме');
  const raw = (spec as { variants?: unknown }).variants;
  if (!Array.isArray(raw) || raw.length === 0) throw new ContentDraftError('ИИ не предложил текст поста');
  const variants: ContentVariant[] = [];
  for (const item of raw.slice(0, 2)) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const bodyRaw = clean(r.body, CONTENT_LIMITS.body * 2, true);
    const body = bodyRaw ? clean(stripContacts(bodyRaw), CONTENT_LIMITS.body, true) : null;
    if (!body) continue;
    variants.push({
      hook: clean(r.hook, CONTENT_LIMITS.hook) ?? body.split('\n')[0]!.slice(0, CONTENT_LIMITS.hook),
      title: clean(r.title, CONTENT_LIMITS.title),
      body,
      hashtags: tags(r.hashtags),
      cta: ctaOf(r.cta),
    });
  }
  if (variants.length === 0) throw new ContentDraftError('ИИ не предложил текст поста');
  return variants;
}

/** Числа текста как нормализованные строки: «15 000» → 15000, «20 %» → 20%. Время и даты пропускаются. */
function numbers(text: string): string[] {
  const t = text
    .replace(/\b\d{1,2}:\d{2}\b/g, ' ')
    .replace(/\b\d{1,2}\.\d{1,2}(?:\.\d{2,4})?\b/g, ' ');
  const found: string[] = [];
  for (const m of t.matchAll(/\d[\d\s\u00a0]*\d|\d/g)) {
    const digits = m[0].replace(/[\s\u00a0]/g, '');
    const after = t.slice((m.index ?? 0) + m[0].length).trimStart();
    found.push(after.startsWith('%') ? `${digits}%` : digits);
  }
  return found;
}

/**
 * Цифры поста, которых нет ни в фактах карточки, ни в теме: «проверьте». Проценты сверяются с процентами и числами
 * входа, суммы и стаж с числами входа. Повторы схлопываются, порядок появления сохраняется.
 */
export function checkDraftFacts(body: string, facts: readonly string[], topic: string): string[] {
  const known = new Set<string>();
  for (const n of numbers([...facts, topic].join('\n'))) {
    known.add(n);
    known.add(n.replace(/%$/, ''));
  }
  const warnings: string[] = [];
  for (const n of numbers(body)) {
    const bare = n.replace(/%$/, '');
    if (known.has(n) || (n.endsWith('%') ? known.has(`${bare}%`) || known.has(bare) : known.has(bare))) continue;
    if (!warnings.includes(n)) warnings.push(n);
  }
  return warnings;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const validDate = (s: string) => {
  const m = ISO_DATE.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!));
  return d.getUTCFullYear() === +m[1]! && d.getUTCMonth() === +m[2]! - 1 && d.getUTCDate() === +m[3]!;
};

/** Черновик, который сохраняет человек: строгая проверка, без молчаливой обрезки текста. */
export function normalizeContentDraft(input: unknown): ContentDraftInput {
  if (!input || typeof input !== 'object') throw new ContentDraftError('Пустой черновик');
  const r = input as Record<string, unknown>;
  if (typeof r.channel !== 'string' || !(CONTENT_CHANNELS as readonly string[]).includes(r.channel))
    throw new ContentDraftError('Выберите канал публикации');
  if (typeof r.origin !== 'string' || !(CONTENT_ORIGINS as readonly string[]).includes(r.origin))
    throw new ContentDraftError('Неизвестное происхождение черновика');
  const topic = typeof r.topic === 'string' ? r.topic.trim() : '';
  if (topic.length > CONTENT_LIMITS.topic) throw new ContentDraftError('Тема длиннее 500 знаков');
  const body = typeof r.body === 'string' ? r.body.trim() : '';
  if (!body) throw new ContentDraftError('Напишите текст поста');
  if (body.length > CONTENT_LIMITS.body) throw new ContentDraftError('Текст длиннее 2 200 знаков');
  const title = typeof r.title === 'string' && r.title.trim() ? r.title.trim() : null;
  if (title && title.length > CONTENT_LIMITS.title) throw new ContentDraftError('Заголовок длиннее 200 знаков');
  const rawTags = Array.isArray(r.hashtags) ? r.hashtags : [];
  if (rawTags.length > CONTENT_LIMITS.hashtags) throw new ContentDraftError('Не больше 10 хештегов');
  const hashtags = rawTags.map(tag).filter((t): t is string => t !== null);
  let cta: ContentCta | null = null;
  if (r.cta !== undefined && r.cta !== null && r.cta !== '') {
    if (typeof r.cta !== 'string' || !(CONTENT_CTAS as readonly string[]).includes(r.cta))
      throw new ContentDraftError('Неизвестная кнопка действия');
    cta = r.cta as ContentCta;
  }
  let plannedOn: string | null = null;
  if (r.plannedOn !== undefined && r.plannedOn !== null && r.plannedOn !== '') {
    if (typeof r.plannedOn !== 'string' || !validDate(r.plannedOn)) throw new ContentDraftError('Неверный день публикации');
    plannedOn = r.plannedOn;
  }
  return {
    channel: r.channel as ContentChannel,
    topic,
    title,
    body,
    hashtags,
    cta,
    origin: r.origin as ContentOrigin,
    plannedOn,
  };
}

/** Контакты филиала для строки действия: подставляет домен, не модель */
export interface ContentContacts {
  siteUrl: string | null;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
}

/** «800000» KZT → «8000 KZT», «450050» → «4500.50»: строкой, без float (AGENTS §12). Валюты с двумя знаками */
function money(m: SiteFactsMoney): string {
  const minor = m.minor.replace(/^-/, '');
  const sign = m.minor.startsWith('-') ? '-' : '';
  const whole = minor.length > 2 ? minor.slice(0, -2) : '0';
  const cents = minor.padStart(3, '0').slice(-2);
  return `${sign}${whole.replace(/^0+(?=\d)/, '')}${cents === '00' ? '' : `.${cents}`} ${m.currency}`;
}

/** Факты карточки строками для `content-draft/0`: только данные WETOP, без выдумки; не больше 40 строк */
export function contentFactsOf(f: SiteFacts): string[] {
  const out: string[] = [`Название: ${f.location.name}`];
  if (f.location.city) out.push(`Город: ${f.location.city}`);
  if (f.location.address) out.push(`Адрес: ${f.location.address}`);
  for (const i of f.catalog.items) {
    const parts: string[] = [];
    if (i.price) parts.push(money(i.price));
    else if (i.priceFrom) parts.push(`от ${money(i.priceFrom)}`);
    if (i.durationMin) parts.push(`${i.durationMin} мин`);
    if (i.capacityAdults) parts.push(`до ${i.capacityAdults} гостей`);
    const name = i.category ? `${i.name} (${i.category})` : i.name;
    out.push(parts.length ? `${name}: ${parts.join(', ')}` : name);
  }
  for (const e of f.staff) out.push(e.specialization ? `Мастер: ${e.name} (${e.specialization})` : `Мастер: ${e.name}`);
  if (f.hours.checkInTime && f.hours.checkOutTime)
    out.push(`Заезд с ${f.hours.checkInTime}, выезд до ${f.hours.checkOutTime}`);
  if (f.reviews) out.push(`Оценка гостей: ${f.reviews.avg} из 5, отзывов ${f.reviews.count}`);
  return out.slice(0, 40).map((x) => x.slice(0, 300));
}

/** Кнопки, для которых в карточке есть данные; «без кнопки» есть всегда */
export function availableContentCtas(c: ContentContacts): ContentCta[] {
  const out: ContentCta[] = [];
  if (c.siteUrl) out.push('BOOK_ONLINE');
  if (c.whatsapp) out.push('WHATSAPP');
  if (c.phone) out.push('CALL');
  if (c.address) out.push('VISIT');
  out.push('NONE');
  return out;
}

const digits = (s: string) => s.replace(/\D/g, '');

/** Строка действия по кнопке из данных филиала; нет данных: null (кнопку не печатаем) */
export function contentCtaLine(cta: ContentCta, c: ContentContacts): string | null {
  switch (cta) {
    case 'BOOK_ONLINE':
      return c.siteUrl ? `Записаться онлайн: ${c.siteUrl}` : null;
    case 'WHATSAPP':
      return c.whatsapp && digits(c.whatsapp) ? `Написать в WhatsApp: https://wa.me/${digits(c.whatsapp)}` : null;
    case 'CALL':
      return c.phone ? `Звоните: ${c.phone}` : null;
    case 'VISIT':
      return c.address ? `Ждём вас: ${c.address}` : null;
    default:
      return null;
  }
}

/** Готовый к копированию пост: текст, строка действия из карточки, хештеги */
export function composeContentPost(
  v: Pick<ContentVariant, 'body' | 'hashtags'> & { cta: ContentCta | null },
  c: ContentContacts,
): string {
  const parts = [v.body.trim()];
  const line = v.cta ? contentCtaLine(v.cta, c) : null;
  if (line) parts.push(line);
  if (v.hashtags.length) parts.push(v.hashtags.map((t) => `#${t}`).join(' '));
  return parts.join('\n\n');
}
