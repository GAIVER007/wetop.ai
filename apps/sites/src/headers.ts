/**
 * Заголовки ответов рантайма (план MKT4 §10). Скрипты только с адреса API WETOP (виджет брони, счётчик) и Turnstile,
 * когда бронь работает; ни `unsafe-inline`, ни `unsafe-eval` для скриптов. Стили `'unsafe-inline'`: виджет вставляет
 * свой `<style>`; свои стили рантайма лежат файлом на том же хосте.
 */
export const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com';

export interface PolicyInput {
  /** Origin публичного API для `/a/*` и `/w/*`; null: скриптов нет вовсе */
  apiOrigin: string | null;
  analytics: boolean;
  booking: boolean;
  /** Скрипт цены «от» (Q-276): свой файл с того же хоста и запрос к API за ценой */
  prices?: boolean;
}

export function contentSecurityPolicy(input: PolicyInput): string {
  const scripts: string[] = [];
  const connect: string[] = [];
  if (input.apiOrigin && input.prices) scripts.push("'self'");
  if (input.apiOrigin && (input.analytics || input.booking || input.prices)) {
    if (input.analytics || input.booking) scripts.push(input.apiOrigin);
    connect.push(input.apiOrigin);
  }
  if (input.apiOrigin && input.booking) {
    scripts.push(TURNSTILE_ORIGIN);
    connect.push(TURNSTILE_ORIGIN);
  }
  return [
    "default-src 'none'",
    `script-src ${scripts.length ? scripts.join(' ') : "'none'"}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    `connect-src ${connect.length ? connect.join(' ') : "'none'"}`,
    `frame-src ${input.apiOrigin && input.booking ? TURNSTILE_ORIGIN : "'none'"}`,
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
  ].join('; ');
}

export const BASE_SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  'X-Frame-Options': 'DENY',
};

export const CACHE = {
  /** HTML, robots.txt, sitemap.xml: коротко, право показа перепроверяется по контракту */
  page: 'public, max-age=60',
  /** Неизменяемый файл стилей с хэшем содержимого в имени */
  immutable: 'public, max-age=31536000, immutable',
  /** 404 без имени сайта */
  notFound: 'public, max-age=30',
  /** 503: не кэшировать */
  none: 'no-store',
  /** Превью (MKT7): только браузер просмотрщика, ни прокси, ни CDN */
  preview: 'private, no-store',
} as const;

/** Origin адреса API или null: адрес только `https:`, а `http:` лишь на 127.0.0.1 и localhost для dev */
export function apiOriginOf(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  try {
    const url = new URL(raw);
    const local = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
    if (url.protocol === 'https:' || (url.protocol === 'http:' && local)) return url.origin;
    return null;
  } catch {
    return null;
  }
}
