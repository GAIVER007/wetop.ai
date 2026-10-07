import { pagePath, sectionVisible, type RenderContext } from './render/context';
import { esc, tx } from './render/text';
import type { LocalizedText, Page, PublicFacts, SiteSpec } from './types';

/**
 * SEO рантайма (план MKT4 §9). Индексация разрешена только в окружении `production` **и** при основном хосте; в MKT4
 * нет ни того, ни другого, поэтому везде `noindex`, а canonical не выдумывается (тега нет, пока `primaryHost` `null`).
 */
export interface SeoSettings {
  /** Окружение разрешает индексацию: только `production` с основным хостом */
  indexable: boolean;
  /** `https://<основной хост>`; null: canonical и og:url не выводятся */
  canonicalOrigin: string | null;
  /** Откуда строить адреса карты сайта: основной хост, а в dev и staging хост запроса */
  sitemapOrigin: string;
}

export function seoSettings(envName: string, primaryHost: string | null, requestOrigin: string): SeoSettings {
  const canonicalOrigin = envName === 'production' && primaryHost ? `https://${primaryHost}` : null;
  return { indexable: canonicalOrigin !== null, canonicalOrigin, sitemapOrigin: canonicalOrigin ?? requestOrigin };
}

const OG_LOCALE: Record<string, string> = { ru: 'ru_RU', kk: 'kk_KZ', en: 'en_US' };

export function pageTitle(page: Page, spec: SiteSpec, locale: string): string {
  const own = tx(page.seo.title, locale as never);
  if (own) return own;
  const base = tx(page.title, locale as never);
  const template = tx(spec.site.seo.titleTemplate, locale as never);
  return template ? template.replace('%s', base) : base;
}

export function pageIndexed(page: Page, spec: SiteSpec, seo: SeoSettings): boolean {
  return seo.indexable && spec.site.seo.robots === 'INDEX' && page.seo.index === true;
}

/** JSON в `<script type="application/ld+json">` не исполняется, но `<` экранируется, чтобы не закрыть тег */
export function jsonForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

const SCHEMA_TYPE: Record<string, string> = {
  HOTEL: 'Hotel',
  HOSTEL: 'Hostel',
  APARTMENT: 'Apartment',
  LODGING: 'LodgingBusiness',
};

export function structuredData(ctx: RenderContext, seo: SeoSettings): unknown[] {
  const { spec, locale, page } = ctx;
  const out: unknown[] = [];
  if (page.isHome) {
    const sd = spec.site.seo.structuredData;
    const contacts = spec.site.contacts ?? {};
    const business: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': SCHEMA_TYPE[sd.type] ?? 'LodgingBusiness',
      name: tx(spec.site.displayName, locale),
    };
    const description = tx(page.seo.description, locale);
    if (description) business['description'] = description;
    if (seo.canonicalOrigin) business['url'] = `${seo.canonicalOrigin}/`;
    if (sd.includeAddress) {
      const address = tx(contacts.address, locale);
      if (address) business['address'] = { '@type': 'PostalAddress', streetAddress: address };
      if (contacts.phone) business['telephone'] = contacts.phone;
    }
    if (sd.includeGeo && contacts.geo)
      business['geo'] = { '@type': 'GeoCoordinates', latitude: contacts.geo.lat, longitude: contacts.geo.lng };
    const amenities = spec.pages
      .flatMap((p) => p.sections)
      .filter((s) => s.type === 'amenities')
      .flatMap((s) => (Array.isArray(s['items']) ? (s['items'] as Array<{ label: LocalizedText }>) : []))
      .map((i) => ({ '@type': 'LocationFeatureSpecification', name: tx(i.label, locale), value: true }));
    if (amenities.length) business['amenityFeature'] = amenities;
    const facts: PublicFacts | null = ctx.facts;
    if (facts?.checkInTime) business['checkinTime'] = facts.checkInTime;
    if (facts?.checkOutTime) business['checkoutTime'] = facts.checkOutTime;
    out.push(business);
  }
  const faqs = page.sections.filter((s) => s.type === 'faq' && s['emitStructuredData'] === true && sectionVisible(s, ctx));
  const questions = faqs.flatMap((s) =>
    (Array.isArray(s['items']) ? (s['items'] as Array<{ question: LocalizedText; answer: LocalizedText }>) : []).map((i) => ({
      '@type': 'Question',
      name: tx(i.question, locale),
      acceptedAnswer: { '@type': 'Answer', text: tx(i.answer, locale) },
    })),
  );
  if (questions.length) out.push({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: questions });
  return out;
}

export function renderHead(ctx: RenderContext, seo: SeoSettings, cssHref: string): string {
  const { spec, page, locale } = ctx;
  const title = pageTitle(page, spec, locale);
  const description = tx(page.seo.description, locale);
  const robots = pageIndexed(page, spec, seo) ? 'index, follow' : 'noindex, nofollow';
  const url = seo.canonicalOrigin ? `${seo.canonicalOrigin}${pagePath(page)}` : null;
  const ogTitle = tx(page.seo.og?.title, locale) || title;
  const ogDescription = tx(page.seo.og?.description, locale) || description;
  const meta = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${esc(title)}</title>`,
    description ? `<meta name="description" content="${esc(description)}">` : '',
    `<meta name="robots" content="${robots}">`,
    url ? `<link rel="canonical" href="${esc(url)}">` : '',
    '<meta property="og:type" content="website">',
    `<meta property="og:title" content="${esc(ogTitle)}">`,
    ogDescription ? `<meta property="og:description" content="${esc(ogDescription)}">` : '',
    `<meta property="og:site_name" content="${esc(tx(spec.site.displayName, locale))}">`,
    `<meta property="og:locale" content="${OG_LOCALE[locale] ?? 'ru_RU'}">`,
    url ? `<meta property="og:url" content="${esc(url)}">` : '',
    `<link rel="stylesheet" href="${esc(cssHref)}">`,
    ...structuredData(ctx, seo).map((d) => `<script type="application/ld+json">${jsonForScript(d)}</script>`),
  ];
  return meta.filter(Boolean).join('');
}

export function robotsTxt(spec: SiteSpec, seo: SeoSettings): string {
  if (!seo.indexable || spec.site.seo.robots !== 'INDEX') return 'User-agent: *\nDisallow: /\n';
  return `User-agent: *\nAllow: /\n\nSitemap: ${seo.sitemapOrigin}/sitemap.xml\n`;
}

/** Только индексируемые страницы с `includeInSitemap`; в dev и staging индексации нет, карта пустая */
export function sitemapXml(spec: SiteSpec, seo: SeoSettings): string {
  const pages = spec.pages.filter((p) => p.seo.includeInSitemap === true && pageIndexed(p, spec, seo));
  const urls = pages.map((p) => `<url><loc>${esc(`${seo.sitemapOrigin}${pagePath(p)}`)}</loc></url>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>\n`;
}
