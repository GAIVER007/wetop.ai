import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  normalizeSiteHost,
  parseDevSiteHosts,
  SITE_SPEC_SECTIONS,
  siteSpecCategoryCodes,
} from './index';

const EXAMPLE = JSON.parse(
  readFileSync(resolve(__dirname, '../../../../docs/marketing/sitespec-v0.example.json'), 'utf8'),
) as Record<string, unknown>;

describe('MKT4: хост публичного сайта', () => {
  it.each([
    ['Hotel.Example.KZ', 'hotel.example.kz'],
    ['hotel.example.kz:8787', 'hotel.example.kz'],
    ['hotel.example.kz.', 'hotel.example.kz'],
    ['www.hotel.example.kz', 'www.hotel.example.kz'],
    ['  hotel.localhost  ', 'hotel.localhost'],
  ])('%s → %s', (raw, host) => {
    expect(normalizeSiteHost(raw)).toBe(host);
  });

  it.each(['', 'a', 'host with space', 'evil.kz/path', 'a..b', '-bad.kz', 'x'.repeat(254), 'user@host.kz', null, 42])(
    'неверный хост %s → null',
    (raw) => {
      expect(normalizeSiteHost(raw as unknown)).toBeNull();
    },
  );
});

describe('MKT4: карта хостов dev и test', () => {
  const id = '3f1c2a90-3b4d-4e5f-8a6b-7c8d9e0f1a2b';
  it('разбирает пары host=siteId, нормализует хост', () => {
    expect(parseDevSiteHosts(`Stepnoy.Localhost:8787=${id}, other.test=${id.toUpperCase()}`)).toEqual(
      new Map([
        ['stepnoy.localhost', id],
        ['other.test', id],
      ]),
    );
  });
  it('неверные пары пропускаются, пустая строка пустая карта', () => {
    expect(parseDevSiteHosts(`bad, x.test=not-a-uuid, =${id}, ok.test=${id}`)).toEqual(new Map([['ok.test', id]]));
    expect(parseDevSiteHosts(undefined).size).toBe(0);
  });
});

describe('MKT4: коды категорий опубликованной версии', () => {
  it('из accommodations и pricing всех страниц, без повторов', () => {
    expect(siteSpecCategoryCodes(EXAMPLE)).toEqual(['standard-double', 'dorm-bed']);
  });
  it('документ без секций категорий: пусто', () => {
    expect(siteSpecCategoryCodes({ pages: [{ sections: [{ type: 'faq' }] }] })).toEqual([]);
    expect(siteSpecCategoryCodes({})).toEqual([]);
  });
});

describe('MKT4: реестр секций валидатора отдаётся наружу', () => {
  it('11 секций Hospitality с вариантами', () => {
    expect(Object.keys(SITE_SPEC_SECTIONS).sort()).toEqual(
      ['about', 'accommodations', 'amenities', 'booking', 'contacts', 'cta', 'faq', 'features', 'gallery', 'hero', 'pricing'],
    );
    expect(SITE_SPEC_SECTIONS.hero).toEqual(['IMAGE_FULL', 'IMAGE_SIDE', 'TEXT_ONLY']);
  });
});
