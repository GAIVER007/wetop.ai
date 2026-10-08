import { describe, expect, it } from 'vitest';
import { ctx, exampleSpec } from './test/fixtures';
import { jsonForScript, pageTitle, renderHead, robotsTxt, seoSettings, sitemapXml, structuredData } from './seo';

const DEV = seoSettings('dev', null, 'http://stepnoy.localhost:8788');
const STAGING_WITH_HOST = seoSettings('staging', 'hotel.example.kz', 'https://wetop-sites-staging.example.workers.dev');
const PROD = seoSettings('production', 'hotel.example.kz', 'https://hotel.example.kz');

describe('индексация и canonical: только production и основной хост', () => {
  it('dev без основного хоста: noindex, canonical и og:url нет', () => {
    const head = renderHead(ctx(), DEV, '/_wetop/site.css');
    expect(head).toContain('<meta name="robots" content="noindex, nofollow">');
    expect(head).not.toContain('rel="canonical"');
    expect(head).not.toContain('og:url');
  });

  it('staging даже с хостом боевой canonical не выдумывает', () => {
    expect(STAGING_WITH_HOST.indexable).toBe(false);
    const head = renderHead(ctx(), STAGING_WITH_HOST, '/x.css');
    expect(head).not.toContain('rel="canonical"');
    expect(head).toContain('noindex');
  });

  it('production с основным хостом: index, canonical на основной хост', () => {
    const head = renderHead(ctx(), PROD, '/x.css');
    expect(head).toContain('<meta name="robots" content="index, follow">');
    expect(head).toContain('<link rel="canonical" href="https://hotel.example.kz/">');
    expect(head).toContain('<meta property="og:url" content="https://hotel.example.kz/">');
  });

  it('production, но сайт NOINDEX или страница без индекса: noindex', () => {
    const spec = exampleSpec();
    spec.site.seo.robots = 'NOINDEX';
    expect(renderHead(ctx({ spec, page: spec.pages[0]! }), PROD, '/x.css')).toContain('noindex, nofollow');
    const spec2 = exampleSpec();
    spec2.pages[0]!.seo.index = false;
    expect(renderHead(ctx({ spec: spec2, page: spec2.pages[0]! }), PROD, '/x.css')).toContain('noindex, nofollow');
  });
});

describe('мета страницы', () => {
  it('title из SEO страницы, иначе через titleTemplate', () => {
    const spec = exampleSpec();
    expect(pageTitle(spec.pages[0]!, spec, 'ru')).toBe('Гостиница у вокзала в Астане');
    const privacy = spec.pages.find((p) => !p.isHome)!;
    delete privacy.seo.title;
    expect(pageTitle(privacy, spec, 'ru')).toBe(`${privacy.title.ru}, гостиница «Степной ветер»`);
  });

  it('description, viewport, Open Graph, стили файлом', () => {
    const head = renderHead(ctx(), DEV, '/_wetop/site-abc.css');
    expect(head).toContain('<meta name="viewport" content="width=device-width, initial-scale=1">');
    expect(head).toMatch(/<meta name="description" content="Номера и койко-места рядом с вокзалом\./);
    expect(head).toContain('<meta property="og:title" content="Гостиница «Степной ветер»">');
    expect(head).toContain('<meta property="og:locale" content="ru_RU">');
    expect(head).toContain('<link rel="stylesheet" href="/_wetop/site-abc.css">');
  });
});

describe('JSON-LD', () => {
  it('Hotel на главной: имя, адрес, телефон, гео, удобства, время заезда из publicFacts', () => {
    const [hotel] = structuredData(ctx(), PROD) as Array<Record<string, unknown>>;
    expect(hotel).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'Hotel',
      name: 'Гостиница «Степной ветер»',
      url: 'https://hotel.example.kz/',
      address: { '@type': 'PostalAddress', streetAddress: 'Астана, ул. Вымышленная, 10' },
      telephone: '+77010000000',
      geo: { '@type': 'GeoCoordinates', latitude: 51.1694, longitude: 71.4491 },
      checkinTime: '14:00',
      checkoutTime: '12:00',
    });
    expect((hotel!['amenityFeature'] as unknown[]).length).toBeGreaterThan(0);
  });

  it('без флагов адреса и гео их нет; без основного хоста нет url', () => {
    const spec = exampleSpec();
    spec.site.seo.structuredData = { type: 'HOSTEL', includeAddress: false, includeGeo: false };
    const [hostel] = structuredData(ctx({ spec, page: spec.pages[0]! }), DEV) as Array<Record<string, unknown>>;
    expect(hostel!['@type']).toBe('Hostel');
    expect(hostel).not.toHaveProperty('address');
    expect(hostel).not.toHaveProperty('telephone');
    expect(hostel).not.toHaveProperty('geo');
    expect(hostel).not.toHaveProperty('url');
  });

  it('FAQPage при emitStructuredData', () => {
    const data = structuredData(ctx(), DEV) as Array<Record<string, unknown>>;
    expect(data.some((d) => d['@type'] === 'FAQPage')).toBe(true);
  });

  it('в ld+json знак < экранируется: тег скрипта не закрыть', () => {
    expect(jsonForScript({ name: '</script><script>alert(1)</script>' })).not.toContain('</script>');
    expect(jsonForScript({ name: 'a b' })).toBe('{"name":"a\\u2028b"}');
    const spec = exampleSpec();
    spec.site.displayName = { ru: 'А < Б' };
    const head = renderHead(ctx({ spec, page: spec.pages[0]! }), DEV, '/x.css');
    expect(head).toContain('"name":"А \\u003c Б"');
    expect(head).toMatch(/<script type="application\/ld\+json">/);
  });
});

describe('robots.txt и sitemap.xml', () => {
  it('dev и staging: всё закрыто, карта пуста', () => {
    expect(robotsTxt(exampleSpec(), DEV)).toBe('User-agent: *\nDisallow: /\n');
    expect(sitemapXml(exampleSpec(), DEV)).not.toContain('<url>');
  });

  it('production: разрешено, ссылка на карту; в карте только индексируемые страницы с includeInSitemap', () => {
    const spec = exampleSpec();
    expect(robotsTxt(spec, PROD)).toBe('User-agent: *\nAllow: /\n\nSitemap: https://hotel.example.kz/sitemap.xml\n');
    const xml = sitemapXml(spec, PROD);
    expect(xml).toContain('<loc>https://hotel.example.kz/</loc>');
    for (const p of spec.pages.filter((p) => !p.seo.includeInSitemap)) expect(xml).not.toContain(`/${p.slug}<`);
  });

  it('сайт NOINDEX: закрыт и в production', () => {
    const spec = exampleSpec();
    spec.site.seo.robots = 'NOINDEX';
    expect(robotsTxt(spec, PROD)).toContain('Disallow: /');
    expect(sitemapXml(spec, PROD)).not.toContain('<url>');
  });
});
