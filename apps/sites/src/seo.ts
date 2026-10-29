import { pagePath, sectionVisible, type RenderContext } from './render/context';
import { esc, tx } from './render/text';
import { moneyDecimal } from './render/price-format';
import type { LocalizedText, Page, PublicFacts, Section, SiteSpec } from './types';

/**
 * SEO рантайма (план MKT4 §9). Индексация разрешена только в окружении `production` **и** при основном хосте
 * (с MKT7 его даёт строка `site_domains`); иначе `noindex`, а canonical не выдумывается (тега нет без `primaryHost`).
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
  // SITE-2: салон и ресторан
  BEAUTY_SALON: 'BeautySalon',
  RESTAURANT: 'Restaurant',
  CAFE: 'CafeOrCoffeeShop',
};

const DAY_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
type Rec = Record<string, unknown>;
const items = (v: unknown): Rec[] => (Array.isArray(v) ? (v as Rec[]) : []);

/** Часы работы из первой видимой секции `hours` сайта: `OpeningHoursSpecification` по каждому дню */
function openingHours(spec: SiteSpec): unknown[] {
  const section = spec.pages.flatMap((p) => p.sections).find((s) => s.type === 'hours');
  return items(section?.['days'])
    .filter((d) => typeof d['weekday'] === 'number' && DAY_OF_WEEK[d['weekday'] as number])
    .map((d) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: `https://schema.org/${DAY_OF_WEEK[d['weekday'] as number]}`,
      opens: d['open'],
      closes: d['close'],
    }));
}

function offer(money: unknown): Rec | null {
  const m = moneyDecimal(money);
  return m ? { '@type': 'Offer', price: m.price, priceCurrency: m.currency } : null;
}

/** Ресторан: меню целиком в `hasMenu` (Menu → MenuSection → MenuItem с ценой из снимка документа) */
function menuOf(sections: Section[], locale: Parameters<typeof tx>[1]): Rec | null {
  const menus = sections.filter((s) => s.type === 'menu');
  const hasMenuSection = menus.flatMap((m) =>
    items(m['categories']).map((c) => ({
      '@type': 'MenuSection',
      name: tx(c['title'] as LocalizedText, locale),
      hasMenuItem: items(c['items']).map((i) => {
        const item: Rec = { '@type': 'MenuItem', name: tx(i['title'] as LocalizedText, locale) };
        const description = tx(i['description'] as LocalizedText | undefined, locale);
        if (description) item['description'] = description;
        const o = offer(i['price']);
        if (o) item['offers'] = o;
        return item;
      }),
    })),
  );
  return hasMenuSection.length ? { '@type': 'Menu', hasMenuSection } : null;
}

/** Салон: услуги с ценой из снимка документа в `hasOfferCatalog` */
function servicesOf(sections: Section[], locale: Parameters<typeof tx>[1]): Rec | null {
  const list = sections
    .filter((s) => s.type === 'services')
    .flatMap((s) => items(s['items']))
    .map((i) => {
      const o: Rec = offer(i['price']) ?? { '@type': 'Offer' };
      o['itemOffered'] = { '@type': 'Service', name: tx(i['title'] as LocalizedText, locale) };
      return o;
    });
  return list.length ? { '@type': 'OfferCatalog', name: 'Services', itemListElement: list } : null;
}

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
    const vertical = spec.site.vertical;
    if (vertical === 'HOSPITALITY') {
      const facts: PublicFacts | null = ctx.facts;
      if (facts?.checkInTime) business['checkinTime'] = facts.checkInTime;
      if (facts?.checkOutTime) business['checkoutTime'] = facts.checkOutTime;
    } else {
      // SITE-2: часы, меню и услуги только из снимка документа, который собран из данных филиала
      const all = spec.pages.flatMap((p) => p.sections).filter((s) => sectionVisible(s, ctx));
      const hours = openingHours(spec);
      if (hours.length) business['openingHoursSpecification'] = hours;
      if (vertical === 'FOOD_SERVICE') {
        const menu = menuOf(all, locale);
        if (menu) business['hasMenu'] = menu;
      }
      if (vertical === 'BEAUTY') {
        const catalog = servicesOf(all, locale);
        if (catalog) business['hasOfferCatalog'] = catalog;
      }
    }
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
  const assetUrl = (id: unknown) => (typeof id === 'string' ? ctx.assets[id.toLowerCase()] ?? ctx.assets[id] : undefined);
  const ogImage = assetUrl(page.seo.og?.imageAssetId);
  const favicon = assetUrl(spec.site.brand?.faviconAssetId);
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
    // MKT8: картинка соцсетей страницы и фавиконка из карты подписанных адресов; нет адреса, нет и тега
    ogImage ? `<meta property="og:image" content="${esc(ogImage)}">` : '',
    favicon ? `<link rel="icon" href="${esc(favicon)}">` : '',
    `<link rel="stylesheet" href="${esc(cssHref)}">`,
    ...structuredData(ctx, seo).map((d) => `<script type="application/ld+json">${jsonForScript(d)}</script>`),
  ];
  return meta.filter(Boolean).join('');
}

/**
 * ИИ-поисковики (GEO, поручение владельца 28.10.2026): поиск ChatGPT, Perplexity, Gemini и Claude приходит своими
 * ботами. `User-agent: *` их уже пускает, но названные явно не путаются с запретами хостинга и видят `llms.txt`.
 */
export const AI_SEARCH_BOTS = ['OAI-SearchBot', 'ChatGPT-User', 'GPTBot', 'PerplexityBot', 'Google-Extended', 'ClaudeBot', 'Applebot-Extended'];

export function robotsTxt(spec: SiteSpec, seo: SeoSettings): string {
  if (!seo.indexable || spec.site.seo.robots !== 'INDEX') return 'User-agent: *\nDisallow: /\n';
  const bots = AI_SEARCH_BOTS.map((b) => `User-agent: ${b}\nAllow: /\n`).join('\n');
  return `User-agent: *\nAllow: /\n\n${bots}\nSitemap: ${seo.sitemapOrigin}/sitemap.xml\n# llms: ${seo.sitemapOrigin}/llms.txt\n`;
}

/** Строка без переводов строк и разметки заголовков: в llms.txt ничего не ломает структуру */
const line = (s: string) => s.replace(/\s+/g, ' ').replace(/^#+\s*/, '').trim();

/**
 * `/llms.txt` (GEO): короткая сводка сайта для ИИ-поисковиков по llmstxt.org. Только индексируемый сайт на основном
 * хосте; иначе пусто. Всё из опубликованного документа: имя, описание главной, адрес и телефон (если их показывают
 * поисковикам), услуги, меню или номера с ценами, часы, вопросы и ответы, ссылки на страницы из карты сайта.
 */
export function llmsTxt(spec: SiteSpec, seo: SeoSettings): string {
  if (!seo.indexable || spec.site.seo.robots !== 'INDEX' || !seo.canonicalOrigin) return '';
  const locale = spec.site.defaultLocale as Parameters<typeof tx>[1];
  const home = spec.pages.find((p) => p.isHome);
  if (!home) return '';
  const out: string[] = [`# ${line(tx(spec.site.displayName, locale))}`, ''];
  const description = line(tx(home.seo.description, locale));
  if (description) out.push(`> ${description}`, '');
  const contacts = spec.site.contacts ?? {};
  const facts: string[] = [];
  if (spec.site.seo.structuredData.includeAddress) {
    const address = line(tx(contacts.address, locale));
    if (address) facts.push(`- Address: ${address}`);
    if (contacts.phone) facts.push(`- Phone: ${contacts.phone}`);
  }
  const all = spec.pages.flatMap((p) => p.sections);
  const hours = openingHours(spec) as Array<{ dayOfWeek: string; opens: string; closes: string }>;
  if (hours.length) facts.push(`- Hours: ${hours.map((h) => `${h.dayOfWeek.replace('https://schema.org/', '').slice(0, 3)} ${h.opens}-${h.closes}`).join(', ')}`);
  facts.push(`- Website: ${seo.canonicalOrigin}/`);
  out.push(...facts, '');
  const priced = (title: unknown, price: unknown) => {
    const name = line(tx(title as LocalizedText, locale));
    const m = moneyDecimal(price);
    return name ? `- ${name}${m ? `: ${m.price} ${m.currency}` : ''}` : '';
  };
  const services = all.filter((s) => s.type === 'services').flatMap((s) => items(s['items'])).map((i) => priced(i['title'], i['price'])).filter(Boolean);
  if (services.length) out.push('## Services', ...services.slice(0, 60), '');
  const menu = all.filter((s) => s.type === 'menu').flatMap((s) => items(s['categories'])).flatMap((c) => items(c['items'])).map((i) => priced(i['title'], i['price'])).filter(Boolean);
  if (menu.length) out.push('## Menu', ...menu.slice(0, 80), '');
  const rooms = all.filter((s) => s.type === 'accommodations').flatMap((s) => items(s['items'])).map((i) => priced(i['title'], undefined)).filter(Boolean);
  if (rooms.length) out.push('## Rooms', ...rooms.slice(0, 20), '');
  const qa = all
    .filter((s) => s.type === 'faq')
    .flatMap((s) => items(s['items']))
    .map((i) => [line(tx(i['question'] as LocalizedText, locale)), line(tx(i['answer'] as LocalizedText, locale))])
    .filter(([q, a]) => q && a);
  if (qa.length) out.push('## FAQ', '', ...qa.flatMap(([q, a]) => [`### ${q}`, a!, '']));
  const pages = spec.pages.filter((p) => p.seo.includeInSitemap === true && pageIndexed(p, spec, seo));
  out.push('## Pages', ...pages.map((p) => `- [${line(tx(p.title, locale)) || line(tx(spec.site.displayName, locale))}](${seo.canonicalOrigin}${pagePath(p)})`), '');
  return out.join('\n');
}

/** Только индексируемые страницы с `includeInSitemap`; в dev и staging индексации нет, карта пустая */
export function sitemapXml(spec: SiteSpec, seo: SeoSettings): string {
  const pages = spec.pages.filter((p) => p.seo.includeInSitemap === true && pageIndexed(p, spec, seo));
  const urls = pages.map((p) => `<url><loc>${esc(`${seo.sitemapOrigin}${pagePath(p)}`)}</loc></url>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>\n`;
}
