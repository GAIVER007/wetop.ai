import type { SiteBriefInput } from './brief';
import { SITE_BRIEF_LOCALES } from './brief';
import { validateSiteSpec, type SiteSpecError, type SiteSpecResult } from './site-spec';

/**
 * Правила генерации сайта ИИ (MKT6, `docs/marketing/site-generation-v0.md`, Q-274 решён владельцем 07.10.2026). Только
 * чистые функции: бюджет и расход токенов, сутки UTC, повторы, языки из брифа и проверка ответа модели платформой
 * поверх того же `validateSiteSpec`, что у ручной версии. База, воркер и бот здесь не нужны.
 */
export const SITE_GENERATION_SCHEMA_VERSION = 'site-generation/0' as const;
export const SITE_GENERATION_DEFAULT_BUDGET = 150_000;
export const SITE_GENERATION_MAX_ATTEMPTS = 3;
/** Аренда воркера на одну попытку: больше таймаута запроса к ИИ (4 минуты) */
export const SITE_GENERATION_LEASE_MS = 5 * 60_000;
/** Пауза перед второй и третьей попыткой */
export const SITE_GENERATION_BACKOFF_MS: readonly number[] = [30_000, 60_000, 120_000];

export const GENERATION_ERROR_CODES = [
  'SCHEMA_INVALID',
  'MODEL_UNAVAILABLE',
  'BUDGET_EXCEEDED',
  'TIMEOUT',
  'REJECTED_CONTENT',
  'USAGE_UNAVAILABLE',
  'BRIEF_CHANGED',
  'BASE_VERSION_CHANGED',
  /** Повтор дожил до следующих суток UTC: вчерашний run не тратит сегодняшний бюджет */
  'BUDGET_DAY_CHANGED',
  /** MKT9.2: лицензия конструктора филиала кончилась или выключена до платного вызова; не повторяется */
  'LICENSE_UNAVAILABLE',
] as const;
export type GenerationErrorCode = (typeof GENERATION_ERROR_CODES)[number];

const RETRYABLE: ReadonlySet<GenerationErrorCode> = new Set(['MODEL_UNAVAILABLE', 'TIMEOUT', 'SCHEMA_INVALID']);

/** Текст ошибки для человека: постоянный, без ответа модели, промпта и данных */
export const GENERATION_ERROR_TEXT: Record<GenerationErrorCode, string> = {
  SCHEMA_INVALID: 'ИИ вернул документ, который не прошёл проверку',
  MODEL_UNAVAILABLE: 'Модель ИИ недоступна',
  BUDGET_EXCEEDED: 'Дневной лимит генерации сайтов исчерпан: попробуйте завтра',
  TIMEOUT: 'ИИ не ответил вовремя',
  REJECTED_CONTENT: 'Модель ИИ отказалась отвечать на эти данные',
  USAGE_UNAVAILABLE: 'Расход токенов неизвестен: новые генерации сегодня остановлены',
  BRIEF_CHANGED: 'Данные филиала изменились: запустите генерацию заново',
  BASE_VERSION_CHANGED: 'Сайт уже изменили: генерация не применена',
  BUDGET_DAY_CHANGED: 'Повтор перешёл на следующие сутки: запустите генерацию заново',
  LICENSE_UNAVAILABLE: 'Конструктор сайта не активен для этого филиала: ИИ не запускался',
};

export function isGenerationErrorCode(value: unknown): value is GenerationErrorCode {
  return typeof value === 'string' && (GENERATION_ERROR_CODES as readonly string[]).includes(value);
}

/**
 * Дневной бюджет из окружения. Нет значения: 150 000. Не целое положительное число: генерация выключена, а не
 * безлимитна (ноль никогда не значит «без предела»).
 */
export function siteGenerationBudget(
  raw: string | undefined,
): { enabled: true; budget: number } | { enabled: false; reason: string } {
  const value = raw?.trim() ?? '';
  if (value === '') return { enabled: true, budget: SITE_GENERATION_DEFAULT_BUDGET };
  if (!/^[0-9]+$/.test(value)) return { enabled: false, reason: 'SITE_GENERATION_DAILY_TOKEN_BUDGET не целое число' };
  const budget = Number(value);
  if (!Number.isSafeInteger(budget) || budget <= 0)
    return { enabled: false, reason: 'SITE_GENERATION_DAILY_TOKEN_BUDGET не больше нуля: генерация выключена' };
  return { enabled: true, budget };
}

/** Расход токенов: вход плюс выход. `cached` уже часть входа и второй раз не прибавляется */
export interface TokenUsage {
  input: number | null;
  cached: number | null;
  output: number | null;
}

export function tokensSpent(usage: TokenUsage): number {
  return (usage.input ?? 0) + (usage.output ?? 0);
}

const plus = (a: number | null, b: number | null): number | null => (a === null ? b : b === null ? a : a + b);

/** Сумма по вызовам: «не сообщено» не становится нулём, пока не пришло хотя бы одно число */
export function addUsage(total: TokenUsage, add: TokenUsage): TokenUsage {
  return { input: plus(total.input, add.input), cached: plus(total.cached, add.cached), output: plus(total.output, add.output) };
}

export function utcDayStart(at: Date): Date {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
}

export function sameUtcDay(a: Date, b: Date): boolean {
  return utcDayStart(a).getTime() === utcDayStart(b).getTime();
}

/** Повтор после попытки номер `attempts`: только повторяемые коды и не больше трёх попыток */
export function generationRetry(
  code: GenerationErrorCode,
  attempts: number,
  now: Date,
): { retry: true; at: Date } | { retry: false } {
  if (!RETRYABLE.has(code) || attempts >= SITE_GENERATION_MAX_ATTEMPTS) return { retry: false };
  const pause = SITE_GENERATION_BACKOFF_MS[Math.max(0, attempts - 1)] ?? SITE_GENERATION_BACKOFF_MS.at(-1)!;
  return { retry: true, at: new Date(now.getTime() + pause) };
}

/** Языки сайта: подсказки продавца без повторов и в его порядке, только ru, kk, en; без них русский */
export function generationTargetLocales(input: SiteBriefInput): string[] {
  const allowed = SITE_BRIEF_LOCALES as readonly string[];
  const out: string[] = [];
  for (const locale of input.sellerContent?.siteLocaleHints ?? [])
    if (allowed.includes(locale) && !out.includes(locale)) out.push(locale);
  return out.length > 0 ? out : ['ru'];
}

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => v !== null && typeof v === 'object' && !Array.isArray(v);
const digits = (v: string) => v.replace(/[^0-9]/g, '');
/** Поля картинок SiteSpec v0: до SiteAsset (MKT8) у ИИ их быть не может */
const ASSET_KEYS = new Set(['assetId', 'imageAssetId', 'faviconAssetId', 'image', 'images', 'logo']);

/** Обход документа: каждый объект с путём, как пишет пути валидатор */
/** Факт брифа без перефразирования: пробелы по краям, повторы пробелов и регистр не в счёт */
function normFact(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Текст документа (строка или тексты по языкам) на каждом языке равен факту брифа; факта нет: не равен */
function sameFact(value: unknown, fact: string | null): boolean {
  if (fact === null) return false;
  const want = normFact(fact);
  if (typeof value === 'string') return normFact(value) === want;
  if (!isRec(value)) return false;
  const texts = Object.values(value);
  return texts.length > 0 && texts.every((t) => typeof t === 'string' && normFact(t) === want);
}

function walk(value: unknown, path: string, visit: (rec: Rec, path: string) => void): void {
  if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${path}[${i}]`, visit));
  else if (isRec(value)) {
    visit(value, path);
    for (const [key, v] of Object.entries(value)) walk(v, path ? `${path}.${key}` : key, visit);
  }
}

/**
 * Ответ модели глазами платформы: тот же валидатор SiteSpec v0, что у ручной версии, и правила генерации поверх него.
 * Языки ровно заданные, категории только из брифа, ни одной картинки до MKT8, контакты, юридические данные и
 * внешние ссылки только из брифа. Ошибка любого правила: документ не принимается (`SCHEMA_INVALID`).
 */
export function checkGeneratedSpec(spec: unknown, input: SiteBriefInput, targetLocales: readonly string[]): SiteSpecResult {
  const base = validateSiteSpec(spec);
  const errors: SiteSpecError[] = base.ok ? [] : [...base.errors];
  if (!isRec(spec)) return base.ok ? { ok: false, errors: [{ path: '', code: 'type', message: 'Ожидается объект' }] } : base;
  const fail = (path: string, code: string, message: string) => errors.push({ path, code, message });
  const site = isRec(spec['site']) ? spec['site'] : {};

  const vertical = input.vertical ?? 'HOSPITALITY';
  if (site['vertical'] !== vertical) fail('site.vertical', 'vertical_mismatch', `Направление сайта: ${vertical}`);
  const locales = site['locales'];
  if (
    !Array.isArray(locales) ||
    locales.length !== targetLocales.length ||
    locales.some((l, i) => l !== targetLocales[i]) ||
    site['defaultLocale'] !== targetLocales[0]
  )
    fail('site.locales', 'locales_mismatch', `Языки сайта: ${targetLocales.join(', ')}, по умолчанию ${targetLocales[0]}`);

  const known = new Set(input.accommodations.map((a) => a.categoryCode));
  const website = input.channelContent?.website ?? null;
  walk(spec, '', (rec, path) => {
    for (const key of Object.keys(rec))
      if (ASSET_KEYS.has(key)) fail(path ? `${path}.${key}` : key, 'asset_not_allowed', 'Картинок до загрузки фото (MKT8) нет');
    if (rec['type'] === 'gallery') fail(path, 'section_not_allowed', 'Галерея появится с загрузкой фото (MKT8)');
    if (typeof rec['categoryCode'] === 'string' && !known.has(rec['categoryCode']))
      fail(`${path}.categoryCode`, 'unknown_category', 'Категории нет в брифе');
    if (Array.isArray(rec['categoryCodes']))
      rec['categoryCodes'].forEach((code, i) => {
        if (typeof code !== 'string' || !known.has(code))
          fail(`${path}.categoryCodes[${i}]`, 'unknown_category', 'Категории нет в брифе');
      });
    if (rec['kind'] === 'EXTERNAL' && (website === null || rec['url'] !== website))
      fail(`${path}.url`, 'invented_link', 'Внешняя ссылка только на сайт гостиницы из брифа');
  });

  for (const e of catalogFactErrors(spec, input)) errors.push(e);

  const contacts = isRec(site['contacts']) ? site['contacts'] : null;
  if (contacts) {
    const identity = input.identity;
    if (contacts['phone'] !== undefined && (identity.phone === null || digits(String(contacts['phone'])) !== digits(identity.phone)))
      fail('site.contacts.phone', 'invented_contact', 'Телефон только из брифа');
    if (
      contacts['email'] !== undefined &&
      (identity.email === null || String(contacts['email']).trim().toLowerCase() !== identity.email.trim().toLowerCase())
    )
      fail('site.contacts.email', 'invented_contact', 'Почта только из брифа');
    if (contacts['address'] !== undefined && !sameFact(contacts['address'], identity.address))
      fail('site.contacts.address', 'invented_contact', 'Адрес только как в брифе');
    for (const key of ['whatsapp', 'geo', 'social'])
      if (contacts[key] !== undefined) fail(`site.contacts.${key}`, 'invented_contact', 'Этих данных в брифе нет');
  }
  if (site['legal'] !== undefined) fail('site.legal', 'legal_not_allowed', 'Юридические данные в брифе не передаются');
  if (!sameFact(site['displayName'], input.identity.displayNameCandidate))
    fail('site.displayName', 'invented_identity', 'Название только как в брифе');
  const seo = isRec(site['seo']) ? site['seo'] : null;
  const structured = seo && isRec(seo['structuredData']) ? seo['structuredData'] : null;
  if (structured) {
    if (structured['includeGeo'] === true)
      fail('site.seo.structuredData.includeGeo', 'unsupported_binding', 'Координат в брифе нет');
    if (structured['includeAddress'] === true && input.identity.address === null)
      fail('site.seo.structuredData.includeAddress', 'unsupported_binding', 'Адреса в брифе нет');
  }

  return errors.length > 0 ? { ok: false, errors } : base;
}

/**
 * SITE-2: факты каталога в документе только из брифа. Код услуги, блюда и id мастера есть в брифе; цена, длительность и
 * выход блюда ровно как в брифе или их нет; часы работы ровно дни брифа. ИИ эти числа не пишет: их ставит
 * `bindCatalogFacts` до проверки, а правило ловит всё, что поставлено мимо.
 */
export function catalogFactErrors(spec: unknown, input: SiteBriefInput, root = ''): SiteSpecError[] {
  const errors: SiteSpecError[] = [];
  const fail = (path: string, code: string, message: string) => errors.push({ path, code, message });
  const services = new Map((input.services ?? []).map((s) => [s.code, s]));
  const dishes = new Map((input.menu ?? []).flatMap((c) => c.items).map((i) => [i.code, i]));
  const staff = new Set((input.staff ?? []).map((s) => s.id.toLowerCase()));
  const hours = new Set((input.hours ?? []).map((h) => `${h.weekday} ${h.open} ${h.close}`));
  const samePrice = (value: unknown, fact: { priceMinor: string; currency: string }) =>
    isRec(value) && value['minor'] === fact.priceMinor && value['currency'] === fact.currency;
  walk(spec, root, (rec, path) => {
    const at = (key: string) => (path ? `${path}.${key}` : key);
    if (rec['type'] === 'services')
      list(rec['items']).forEach((item, i) => {
        if (!isRec(item)) return;
        const ip = `${at('items')}[${i}]`;
        const fact = typeof item['serviceCode'] === 'string' ? services.get(item['serviceCode']) : undefined;
        if (!fact) return fail(`${ip}.serviceCode`, 'unknown_service', 'Услуги нет в данных салона');
        if (item['price'] !== undefined && !samePrice(item['price'], fact)) fail(`${ip}.price`, 'invented_price', 'Цена только из данных салона');
        if (item['durationMin'] !== undefined && item['durationMin'] !== fact.durationMin)
          fail(`${ip}.durationMin`, 'invented_fact', 'Длительность только из данных салона');
      });
    if (rec['type'] === 'staff')
      list(rec['items']).forEach((item, i) => {
        if (isRec(item) && (typeof item['employeeId'] !== 'string' || !staff.has(item['employeeId'].toLowerCase())))
          fail(`${at('items')}[${i}].employeeId`, 'unknown_employee', 'Мастера нет в данных салона');
      });
    if (rec['type'] === 'menu')
      list(rec['categories']).forEach((cat, c) =>
        list(isRec(cat) ? cat['items'] : null).forEach((item, i) => {
          if (!isRec(item)) return;
          const ip = `${at('categories')}[${c}].items[${i}]`;
          const fact = typeof item['itemCode'] === 'string' ? dishes.get(item['itemCode']) : undefined;
          if (!fact) return fail(`${ip}.itemCode`, 'unknown_menu_item', 'Блюда нет в меню ресторана');
          if (item['price'] !== undefined && !samePrice(item['price'], fact)) fail(`${ip}.price`, 'invented_price', 'Цена только из меню ресторана');
          if (item['weightGrams'] !== undefined && item['weightGrams'] !== fact.weightGrams)
            fail(`${ip}.weightGrams`, 'invented_fact', 'Выход блюда только из меню ресторана');
        }),
      );
    if (rec['type'] === 'hours')
      list(rec['days']).forEach((d, i) => {
        if (isRec(d) && !hours.has(`${String(d['weekday'])} ${String(d['open'])} ${String(d['close'])}`))
          fail(`${at('days')}[${i}]`, 'invented_hours', 'Часы работы только из данных филиала');
      });
  });
  return errors;
}

const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/**
 * SITE-2: платформа ставит факты каталога сама, поверх ответа модели и до проверки: цену, длительность и выход по коду
 * из брифа (нет в брифе: поле снимается), часы работы целиком из брифа. Неизвестные коды не трогаются: их отвергнет
 * `catalogFactErrors`. Документ не меняется на месте
 */
export function bindCatalogFacts(spec: unknown, input: SiteBriefInput): unknown {
  if (!isRec(spec)) return spec;
  const out = structuredClone(spec);
  const services = new Map((input.services ?? []).map((s) => [s.code, s]));
  const dishes = new Map((input.menu ?? []).flatMap((c) => c.items).map((i) => [i.code, i]));
  const set = (rec: Rec, key: string, value: unknown) => {
    if (value === undefined || value === null) delete rec[key];
    else rec[key] = value;
  };
  walk(out, '', (rec) => {
    if (rec['type'] === 'services')
      for (const item of list(rec['items'])) {
        const fact = isRec(item) && typeof item['serviceCode'] === 'string' ? services.get(item['serviceCode']) : undefined;
        if (!isRec(item) || !fact) continue;
        set(item, 'price', { minor: fact.priceMinor, currency: fact.currency });
        set(item, 'durationMin', fact.durationMin);
      }
    if (rec['type'] === 'menu')
      for (const cat of list(rec['categories']))
        for (const item of list(isRec(cat) ? cat['items'] : null)) {
          const fact = isRec(item) && typeof item['itemCode'] === 'string' ? dishes.get(item['itemCode']) : undefined;
          if (!isRec(item) || !fact) continue;
          set(item, 'price', { minor: fact.priceMinor, currency: fact.currency });
          set(item, 'weightGrams', fact.weightGrams);
        }
    if (rec['type'] === 'hours' && (input.hours ?? []).length)
      rec['days'] = (input.hours ?? []).map((h) => ({ weekday: h.weekday, open: h.open, close: h.close }));
  });
  return out;
}

const PATH_RE = /^[A-Za-z0-9_.[\]-]{0,160}$/;
const CODE_RE = /^[a-z_]{1,40}$/;
/** Путь без чужого текста: ключ из ответа модели может нести что угодно, оставляем только последнюю годную часть */
function safePath(path: string): string {
  if (PATH_RE.test(path)) return path;
  const parts = path.split('.');
  while (parts.length > 0 && !PATH_RE.test(parts.join('.'))) parts.pop();
  return parts.join('.');
}

/**
 * Ошибки проверки для повтора: только пары «путь код», без текста сообщения и ответа модели; не длиннее 500 знаков
 * (колонка `error_message`).
 */
export function encodeValidationErrors(errors: readonly SiteSpecError[]): string {
  const lines: string[] = [];
  let length = 0;
  for (const e of errors) {
    if (!CODE_RE.test(e.code)) continue;
    const line = `${safePath(e.path)} ${e.code}`;
    if (length + line.length + 1 > 500) break;
    lines.push(line);
    length += line.length + 1;
  }
  return lines.join('\n');
}

export function decodeValidationErrors(message: string | null): Array<{ path: string; code: string }> {
  if (!message) return [];
  const out: Array<{ path: string; code: string }> = [];
  for (const line of message.split('\n')) {
    const match = /^(\S*) ([a-z_]{1,40})$/.exec(line);
    if (match && PATH_RE.test(match[1]!)) out.push({ path: match[1]!, code: match[2]! });
  }
  return out;
}
