import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalizeSiteHost, parseSitesBaseDomain, platformHost, previewHost, siteSpecMediaPaths } from './index';

const EXAMPLE = JSON.parse(
  readFileSync(resolve(__dirname, '../../../../docs/marketing/sitespec-v0.example.json'), 'utf8'),
) as Record<string, unknown>;

describe('MKT7: один нормализатор хоста для API, рантайма и Worker', () => {
  it.each([
    ['отель.кз', 'xn--e1amhq6c.xn--g1af'],
    ['Luxx-Отель.Example.KZ', 'xn--luxx--3we6bw0b4g.example.kz'],
    ['münchen.de:8787', 'xn--mnchen-3ya.de'],
    ['xn--e1amhq6c.xn--g1af.', 'xn--e1amhq6c.xn--g1af'],
  ])('IDN в punycode: %s → %s', (raw, host) => {
    expect(normalizeSiteHost(raw)).toBe(host);
  });

  it.each(['https://hotel.kz', 'hotel.kz/', 'hotel.kz?x=1', 'hotel.kz#a', 'hotel.kz:99999', 'hotel.kz:', '[::1]', 'a b.kz'])(
    'не хост: %s → null',
    (raw) => {
      expect(normalizeSiteHost(raw)).toBeNull();
    },
  );
});

describe('MKT7: SITES_BASE_DOMAIN (Q-271)', () => {
  it.each([
    ['sites.test', 'sites.test'],
    ['Hotels-Wetop.KZ', 'hotels-wetop.kz'],
    ['wetopsites.com', 'wetopsites.com'],
  ])('годится %s', (raw, base) => {
    expect(parseSitesBaseDomain(raw)).toEqual({ ok: true, domain: base });
  });

  it.each([
    [undefined, 'не задан'],
    ['', 'не задан'],
    ['https://sites.test', 'только имя хоста'],
    ['sites.test/', 'только имя хоста'],
    ['sites.test:443', 'только имя хоста'],
    ['localhost', 'только имя хоста'],
    ['wetop.ai', 'не wetop.ai'],
    ['WETOP.AI.', 'не wetop.ai'],
    ['sites.wetop.ai', 'не wetop.ai'],
    ['a.b.wetop.ai', 'не wetop.ai'],
  ])('отказ %s', (raw, reason) => {
    const parsed = parseSitesBaseDomain(raw);
    expect(parsed.ok).toBe(false);
    expect(parsed.ok ? '' : parsed.message).toContain(reason);
  });

  it('адрес сайта и превью строит только сервер из slug и базы', () => {
    expect(platformHost('luxx-aparts', 'sites.test')).toBe('luxx-aparts.sites.test');
    expect(previewHost('sites.test')).toBe('preview.sites.test');
  });
});

describe('MKT7: медиа в документе до MKT8', () => {
  it('пример SiteSpec с галереей и картинками: пути всех ссылок', () => {
    const paths = siteSpecMediaPaths(EXAMPLE);
    expect(paths.length).toBeGreaterThan(0);
    expect(paths.some((p) => p.endsWith('assetId') || p.endsWith('AssetId'))).toBe(true);
  });

  it('документ без картинок и галереи: пусто', () => {
    const spec = {
      site: { brand: { name: 'x' } },
      pages: [{ sections: [{ type: 'hero', variant: 'TEXT_ONLY' }, { type: 'faq', items: [] }] }],
    };
    expect(siteSpecMediaPaths(spec)).toEqual([]);
  });

  it('галерея без картинок всё равно медиа', () => {
    expect(siteSpecMediaPaths({ pages: [{ sections: [{ type: 'gallery', items: [] }] }] })).toEqual(['pages[0].sections[0]']);
  });
});
