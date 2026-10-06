import { ContractClient, type ContractResult } from './contract';
import { apiOriginOf, BASE_SECURITY_HEADERS, CACHE, contentSecurityPolicy } from './headers';
import { RenderError, type RenderContext } from './render/context';
import { renderNotFound, renderPage } from './render/page';
import { SITE_CSS } from './render/theme';
import { robotsTxt, seoSettings, sitemapXml } from './seo';
import type { Env, Page } from './types';

/**
 * Публичный рантайм сайтов WETOP (MKT4, Q-269: Cloudflare Worker, origin сайта). Полномочие одно: имя хоста запроса.
 * Ни сессии, ни куки `wetop_scope`, ни выбора организации; в API ходит только `GET /sites-runtime/current`.
 */
function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export const CSS_PATH = `/_wetop/site-${fnv1a(SITE_CSS)}.css`;

type Log = (event: Record<string, unknown>) => void;

export interface Runtime {
  fetch(request: Request): Promise<Response>;
}

export function createRuntime(
  env: Env,
  options: { fetchImpl?: typeof fetch; now?: () => number; log?: Log } = {},
): Runtime {
  const log: Log = options.log ?? ((event) => console.error(JSON.stringify(event)));
  const contract = new ContractClient(env, options.fetchImpl, options.now, log);
  const envName = env.SITES_ENV || 'dev';
  return {
    async fetch(request) {
      if (request.method !== 'GET' && request.method !== 'HEAD')
        return plain('Method Not Allowed', 405, { Allow: 'GET, HEAD', 'Cache-Control': CACHE.none });
      const url = new URL(request.url);
      if (url.pathname === CSS_PATH)
        return respond(request, SITE_CSS, 200, { 'Content-Type': 'text/css; charset=utf-8', 'Cache-Control': CACHE.immutable });
      if (url.pathname === '/favicon.ico') return plain('Not Found', 404, { 'Cache-Control': CACHE.notFound });
      const host = url.hostname.toLowerCase().replace(/\.$/, '');
      const result = await contract.get(host);
      if (result.kind !== 'ok') return refusal(request, result);
      const { current, spec } = result;
      const seo = seoSettings(envName, current.primaryHost, url.origin);
      const noindex = !seo.indexable || spec.site.seo.robots !== 'INDEX';
      const extra: Record<string, string> = noindex ? { 'X-Robots-Tag': 'noindex, nofollow' } : {};
      if (url.pathname === '/robots.txt')
        return respond(request, robotsTxt(spec, seo), 200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': CACHE.page, ...extra });
      if (url.pathname === '/sitemap.xml')
        return respond(request, sitemapXml(spec, seo), 200, { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': CACHE.page, ...extra });
      if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
        const location = url.pathname.replace(/\/+$/, '') || '/';
        return new Response(null, { status: 301, headers: { Location: location + url.search, 'Cache-Control': CACHE.page, ...BASE_SECURITY_HEADERS } });
      }
      const home = spec.pages.find((p) => p.isHome)!;
      let slug: string;
      try {
        slug = decodeURIComponent(url.pathname.slice(1));
      } catch {
        slug = '\u0000';
      }
      const page: Page | undefined = slug === '' ? home : spec.pages.find((p) => !p.isHome && p.slug === slug);
      const apiOrigin = apiOriginOf(current.publicApiUrl);
      const bookingLive =
        spec.integrations.booking.mode === 'WETOP_WIDGET' && current.bookingEnabled && !!current.publicKey && !!apiOrigin;
      const ctx: RenderContext = {
        spec,
        locale: spec.site.defaultLocale,
        page: page ?? home,
        facts: current.publicFacts,
        publicKey: current.publicKey,
        bookingLive,
        apiOrigin,
        assets: current.assets ?? {},
      };
      const analytics = spec.integrations.analytics.mode === 'WETOP_TRACKER' && !!current.publicKey;
      const bookingOnPage = bookingLive && !!page?.sections.some((s) => s.type === 'booking');
      const csp = contentSecurityPolicy({ apiOrigin, analytics, booking: bookingOnPage });
      let html: string;
      try {
        html = page ? renderPage(ctx, seo, CSS_PATH) : renderNotFound(ctx, seo, CSS_PATH);
      } catch (error) {
        log({ event: 'sites.render_failed', siteId: current.siteId, versionId: current.versionId, reason: (error as Error).message, renderError: error instanceof RenderError });
        return unavailable(request);
      }
      const pageNoindex = !page || noindex || !page.seo.index;
      return respond(request, html, page ? 200 : 404, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': CACHE.page,
        'Content-Security-Policy': csp,
        ...(pageNoindex ? { 'X-Robots-Tag': 'noindex, nofollow' } : {}),
      });
    },
  };
}

function respond(request: Request, body: string, status: number, headers: Record<string, string>): Response {
  return new Response(request.method === 'HEAD' ? null : body, { status, headers: { ...BASE_SECURITY_HEADERS, ...headers } });
}

function plain(text: string, status: number, headers: Record<string, string>): Response {
  return new Response(text, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Robots-Tag': 'noindex, nofollow', ...BASE_SECURITY_HEADERS, ...headers },
  });
}

const NEUTRAL_CSP = "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'";

/** Отказ без имени сайта: неизвестный хост и снятый сайт неотличимы; сбой API и неверный документ дают 503 */
function refusal(request: Request, result: Exclude<ContractResult, { kind: 'ok' }>): Response {
  if (result.kind === 'not_found')
    return respond(request, neutral('404', 'Сайт не найден', 'Site not found'), 404, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': CACHE.notFound,
      'Content-Security-Policy': NEUTRAL_CSP,
      'X-Robots-Tag': 'noindex, nofollow',
    });
  return unavailable(request);
}

function unavailable(request: Request): Response {
  return respond(request, neutral('503', 'Сайт временно недоступен', 'Site temporarily unavailable'), 503, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': CACHE.none,
    'Retry-After': '30',
    'Content-Security-Policy': NEUTRAL_CSP,
    'X-Robots-Tag': 'noindex, nofollow',
  });
}

function neutral(code: string, ru: string, en: string): string {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>${code}</title><style>body{font-family:system-ui,sans-serif;margin:0;padding:48px 20px;color:#1c2630;background:#fff}</style></head><body><main><h1>${ru}</h1><p lang="en">${en}</p></main></body></html>`;
}
