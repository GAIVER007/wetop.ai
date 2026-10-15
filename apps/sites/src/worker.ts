import { normalizeSiteHost, parseSitesBaseDomain, previewHost } from '../../../packages/domain/src/marketing/host';
import { ContractClient, fetchPreview, type ContractResult } from './contract';
import { apiOriginOf, BASE_SECURITY_HEADERS, CACHE, contentSecurityPolicy, safeAssetUrl } from './headers';
import { RenderError, type RenderContext } from './render/context';
import { CSS_PATH, PRICES_PATH } from './assets';
import { pageNeedsPrices, renderNotFound, renderPage } from './render/page';
import { PRICES_JS } from './render/prices-script';
import { SITE_CSS } from './render/theme';
import { robotsTxt, seoSettings, sitemapXml, type SeoSettings } from './seo';
import type { Env, Page, RuntimeCurrent, SiteSpec } from './types';

/**
 * Публичный рантайм сайтов WETOP (MKT4, Q-269: Cloudflare Worker, origin сайта). Полномочие одно: имя хоста запроса.
 * Ни сессии, ни куки `wetop_scope`, ни выбора организации; в API ходит только `GET /sites-runtime/current` и, на хосте
 * превью `preview.<SITES_BASE_DOMAIN>` (MKT7), `GET /sites-runtime/preview` с токеном из адреса.
 */
export { CSS_PATH, PRICES_PATH };

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
  // Q-271: то же правило, что у API (не wetop.ai и не его поддомен, только имя хоста); неверное значение выключает превью
  const base = parseSitesBaseDomain(env.SITES_BASE_DOMAIN);
  const preview = base.ok ? previewHost(base.domain) : null;
  return {
    async fetch(request) {
      if (request.method !== 'GET' && request.method !== 'HEAD')
        return plain('Method Not Allowed', 405, { Allow: 'GET, HEAD', 'Cache-Control': CACHE.none });
      const url = new URL(request.url);
      if (url.pathname === CSS_PATH)
        return respond(request, SITE_CSS, 200, { 'Content-Type': 'text/css; charset=utf-8', 'Cache-Control': CACHE.immutable });
      if (url.pathname === PRICES_PATH)
        return respond(request, PRICES_JS, 200, {
          'Content-Type': 'application/javascript; charset=utf-8',
          'Cache-Control': CACHE.immutable,
        });
      if (url.pathname === '/favicon.ico') return plain('Not Found', 404, { 'Cache-Control': CACHE.notFound });
      // один нормализатор хоста с API (packages/domain/src/marketing/host.ts): IP и имя из одной части не сайт
      const host = normalizeSiteHost(url.hostname);
      if (!host) return refusal(request, { kind: 'not_found' });
      if (preview && host === preview) return servePreview(request, url);
      const result = await contract.get(host);
      if (result.kind !== 'ok') return refusal(request, result);
      const { current, spec } = result;
      // не основной хост сайта: 301 на основной с тем же путём и запросом (MKT7, совместимо со своими доменами MKT10)
      if (current.primaryHost && host !== current.primaryHost)
        return new Response(null, {
          status: 301,
          headers: { Location: `https://${current.primaryHost}${url.pathname}${url.search}`, 'Cache-Control': CACHE.page, ...BASE_SECURITY_HEADERS },
        });
      return renderSite(request, url, current, spec, seoSettings(envName, current.primaryHost, url.origin), null);
    },
  };

  /**
   * Превью (MKT7): токен из адреса уходит в API как есть, версию решает API. Всегда `noindex`, `private, no-store`,
   * `no-referrer`; карты сайта нет, `robots.txt` запрещает всё. Ключа сайта в ответе нет, поэтому ни счётчика, ни
   * виджета, ни цены «от», ни брони
   */
  async function servePreview(request: Request, url: URL): Promise<Response> {
    if (url.pathname === '/robots.txt')
      return respond(request, 'User-agent: *\nDisallow: /\n', 200, { 'Content-Type': 'text/plain; charset=utf-8', ...PREVIEW_HEADERS });
    const token = url.searchParams.get('token');
    if (url.pathname === '/sitemap.xml' || !token) return previewRefusal(request, 404);
    const result = await fetchPreview(env, token, options.fetchImpl);
    if (result.kind === 'not_found') return previewRefusal(request, 404);
    if (result.kind === 'expired') return previewRefusal(request, 410);
    if (result.kind !== 'ok') return unavailable(request);
    const seo: SeoSettings = { indexable: false, canonicalOrigin: null, sitemapOrigin: url.origin };
    const { expiresAt: _exp, state: _state, ...rest } = result.preview;
    void _exp;
    void _state;
    return renderSite(request, url, { ...rest, state: 'PUBLISHED' }, result.spec, seo, token);
  }

  /** `previewToken`: токен превью (тогда это превью) или `null` для публичного сайта */
  function renderSite(request: Request, url: URL, current: RuntimeCurrent, spec: SiteSpec, seo: SeoSettings, previewToken: string | null): Response {
    const preview = previewToken !== null;
    const noindex = preview || !seo.indexable || spec.site.seo.robots !== 'INDEX';
    const extra: Record<string, string> = preview
      ? PREVIEW_HEADERS
      : noindex
        ? { 'X-Robots-Tag': 'noindex, nofollow' }
        : {};
    if (url.pathname === '/robots.txt')
      return respond(request, robotsTxt(spec, seo), 200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': CACHE.page, ...extra });
    if (url.pathname === '/sitemap.xml')
      return respond(request, sitemapXml(spec, seo), 200, { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': CACHE.page, ...extra });
    if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
      const location = url.pathname.replace(/\/+$/, '') || '/';
      return new Response(null, {
        status: 301,
        headers: { Location: location + url.search, 'Cache-Control': preview ? CACHE.preview : CACHE.page, ...BASE_SECURITY_HEADERS, ...(preview ? PREVIEW_HEADERS : {}) },
      });
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
    // MKT8: адреса картинок только из контракта и только безопасные; негодный выбрасывается и пишется в лог (без адреса)
    const assets: Record<string, string> = {};
    const imageOrigins = new Set<string>();
    for (const [assetId, raw] of Object.entries(current.assets ?? {})) {
      const safe = safeAssetUrl(raw);
      if (!safe) {
        log({ event: 'sites.asset_url_rejected', siteId: current.siteId, assetId });
        continue;
      }
      assets[assetId] = safe.toString();
      imageOrigins.add(safe.origin);
    }
    const bookingLive =
      !preview && spec.integrations.booking.mode === 'WETOP_WIDGET' && current.bookingEnabled && !!current.publicKey && !!apiOrigin;
    const ctx: RenderContext = {
      spec,
      locale: spec.site.defaultLocale,
      page: page ?? home,
      facts: current.publicFacts,
      publicKey: preview ? null : current.publicKey,
      bookingLive,
      apiOrigin,
      assets,
      previewToken,
    };
    const analytics = !preview && spec.integrations.analytics.mode === 'WETOP_TRACKER' && !!current.publicKey;
    const bookingOnPage = bookingLive && !!page?.sections.some((s) => s.type === 'booking');
    const csp = contentSecurityPolicy({
      apiOrigin,
      analytics,
      booking: bookingOnPage,
      prices: !!page && pageNeedsPrices(ctx),
      imageOrigins: [...imageOrigins].sort(),
    });
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
      ...(preview ? PREVIEW_HEADERS : {}),
    });
  }
}

/** Превью никогда не индексируется, не кэшируется общими кэшами и не отдаёт адрес с токеном в Referer */
const PREVIEW_HEADERS: Readonly<Record<string, string>> = {
  'X-Robots-Tag': 'noindex, nofollow',
  'Cache-Control': CACHE.preview,
  'Referrer-Policy': 'no-referrer',
};

function previewRefusal(request: Request, status: 404 | 410): Response {
  const body =
    status === 410
      ? neutral('410', 'Ссылка предпросмотра устарела', 'Preview link expired')
      : neutral('404', 'Сайт не найден', 'Site not found');
  return respond(request, body, status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': NEUTRAL_CSP,
    ...PREVIEW_HEADERS,
  });
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
