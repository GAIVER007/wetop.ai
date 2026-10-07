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

  if (site['vertical'] !== 'HOSPITALITY') fail('site.vertical', 'vertical_mismatch', 'Только гостиница');
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
    if (contacts['address'] !== undefined && identity.address === null)
      fail('site.contacts.address', 'invented_contact', 'Адреса в брифе нет');
    for (const key of ['whatsapp', 'geo', 'social'])
      if (contacts[key] !== undefined) fail(`site.contacts.${key}`, 'invented_contact', 'Этих данных в брифе нет');
  }
  if (site['legal'] !== undefined) fail('site.legal', 'legal_not_allowed', 'Юридические данные в брифе не передаются');

  return errors.length > 0 ? { ok: false, errors } : base;
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
