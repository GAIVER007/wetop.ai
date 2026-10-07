import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  parseAssetKind,
  parseDefaultAlt,
  siteAssetStorageKey,
  siteSpecAssetRefs,
  sniffImageType,
  SITE_ASSET_LIMITS,
} from './index';

const EXAMPLE = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../../../../docs/marketing/sitespec-v0.example.json'), 'utf8'),
);

const bytes = (...parts: Array<number[] | string>) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === 'string' ? [...Buffer.from(p, 'latin1')] : p)));

describe('MKT8: ссылки документа на ассеты', () => {
  it('пример SiteSpec: все ссылки с ожидаемым видом и путём', () => {
    expect(siteSpecAssetRefs(EXAMPLE)).toEqual([
      { assetId: '6f1c2a90-3b4d-4e5f-8a6b-7c8d9e0f1a2b', expectedKind: 'LOGO', path: 'site.brand.logo.assetId' },
      { assetId: '7a2d3b01-4c5e-4f60-9b7c-8d9e0f1a2b3c', expectedKind: 'FAVICON', path: 'site.brand.faviconAssetId' },
      { assetId: '8b3e4c12-5d6f-4071-8c8d-9e0f1a2b3c4d', expectedKind: 'IMAGE', path: 'pages[0].seo.og.imageAssetId' },
      { assetId: '8b3e4c12-5d6f-4071-8c8d-9e0f1a2b3c4d', expectedKind: 'IMAGE', path: 'pages[0].sections[0].image.assetId' },
      { assetId: '9c4f5d23-6e70-4182-9d9e-0f1a2b3c4d5e', expectedKind: 'IMAGE', path: 'pages[0].sections[1].image.assetId' },
      { assetId: 'a1b2c3d4-0e1f-4a2b-8c3d-4e5f6a7b8c9d', expectedKind: 'IMAGE', path: 'pages[0].sections[3].items[0].images[0].assetId' },
      { assetId: 'b2c3d4e5-1f20-4b3c-9d4e-5f6a7b8c9d0e', expectedKind: 'IMAGE', path: 'pages[0].sections[3].items[1].images[0].assetId' },
      { assetId: 'c3d4e5f6-2031-4c4d-8e5f-6a7b8c9d0e1f', expectedKind: 'IMAGE', path: 'pages[0].sections[6].images[0].assetId' },
      { assetId: 'd4e5f607-3142-4d5e-9f60-7b8c9d0e1f20', expectedKind: 'IMAGE', path: 'pages[0].sections[6].images[1].assetId' },
      { assetId: 'e5f60718-4253-4e6f-8071-8c9d0e1f2031', expectedKind: 'IMAGE', path: 'pages[0].sections[6].images[2].assetId' },
    ]);
  });

  it('картинка в cta, id в верхнем регистре приводится к нижнему', () => {
    const id = '0A1B2C3D-4E5F-4061-8728-394A5B6C7D8E';
    const spec = {
      site: {},
      pages: [{ seo: {}, sections: [{ type: 'cta', image: { assetId: id, alt: { ru: 'x' } } }] }],
    };
    expect(siteSpecAssetRefs(spec)).toEqual([
      { assetId: id.toLowerCase(), expectedKind: 'IMAGE', path: 'pages[0].sections[0].image.assetId' },
    ]);
  });

  it('только известные места схемы: тот же ключ в чужом месте не ссылка', () => {
    const spec = {
      site: { contacts: { assetId: '0a1b2c3d-4e5f-4061-8728-394a5b6c7d8e' } },
      pages: [{ sections: [{ type: 'faq', image: { assetId: '0a1b2c3d-4e5f-4061-8728-394a5b6c7d8e' } }] }],
    };
    expect(siteSpecAssetRefs(spec)).toEqual([]);
  });

  it('документ без картинок и мусор на входе: пусто', () => {
    expect(siteSpecAssetRefs({ site: {}, pages: [] })).toEqual([]);
    expect(siteSpecAssetRefs(null)).toEqual([]);
    expect(siteSpecAssetRefs({ pages: 'x' })).toEqual([]);
  });
});

describe('MKT8: тип файла по содержимому', () => {
  it('JPEG, PNG, WebP по сигнатуре', () => {
    expect(sniffImageType(bytes([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]))).toBe('jpeg');
    expect(sniffImageType(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]))).toBe('png');
    expect(sniffImageType(bytes('RIFF', [0x24, 0, 0, 0], 'WEBPVP8 '))).toBe('webp');
  });

  it('SVG, GIF, AVIF, HEIC, TIFF, BMP, PDF, HTML, XML, случайное и пустое: не картинка', () => {
    const rejected = [
      bytes('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
      bytes('<?xml version="1.0"?><svg/>'),
      bytes('GIF89a', [1, 0, 1, 0]),
      bytes([0, 0, 0, 0x1c], 'ftypavif', [0, 0, 0, 0]),
      bytes([0, 0, 0, 0x18], 'ftypheic', [0, 0, 0, 0]),
      bytes('II*', [0], [8, 0, 0, 0]),
      bytes('MM', [0, 0x2a]),
      bytes('BM', [0, 0, 0, 0]),
      bytes('%PDF-1.7'),
      bytes('<!doctype html><html></html>'),
      bytes('RIFF', [0x24, 0, 0, 0], 'WAVEfmt '),
      bytes([0x13, 0x37, 0xde, 0xad, 0xbe, 0xef, 0, 1, 2, 3, 4, 5]),
      bytes([0xff, 0xd8]),
      new Uint8Array(0),
    ];
    for (const b of rejected) expect(sniffImageType(b)).toBeNull();
  });
});

describe('MKT8: вид ассета, ALT и ключ объекта', () => {
  it('вид только из трёх', () => {
    expect(parseAssetKind('IMAGE')).toBe('IMAGE');
    expect(parseAssetKind('LOGO')).toBe('LOGO');
    expect(parseAssetKind('FAVICON')).toBe('FAVICON');
    for (const bad of ['image', 'SVG', '', null, undefined, 1]) expect(parseAssetKind(bad)).toBeNull();
  });

  it('ALT: ru, kk, en, до 150 знаков, обычный текст; пустой объект и null снимают подсказку', () => {
    expect(parseDefaultAlt({ ru: ' Фасад ', en: 'Facade' })).toEqual({ ok: true, value: { ru: 'Фасад', en: 'Facade' } });
    expect(parseDefaultAlt(null)).toEqual({ ok: true, value: null });
    expect(parseDefaultAlt({})).toEqual({ ok: true, value: null });
    expect(parseDefaultAlt({ ru: '   ' })).toEqual({ ok: true, value: null });
    for (const bad of [
      { de: 'Fassade' },
      { ru: 'x'.repeat(151) },
      { ru: '<img src=x onerror=alert(1)>' },
      { ru: 'a\u0000b' },
      { ru: '{{name}}' },
      { ru: 5 },
      ['ru'],
      'Фасад',
    ])
      expect(parseDefaultAlt(bad).ok).toBe(false);
    expect(parseDefaultAlt({ ru: 'я'.repeat(150) }).ok).toBe(true);
  });

  it('ключ объекта: филиал, id, sha256; фавиконка PNG, остальное WebP', () => {
    const loc = '11111111-1111-4111-8111-111111111111';
    const id = '22222222-2222-4222-8222-222222222222';
    const sha = 'c'.repeat(64);
    expect(siteAssetStorageKey(loc, id, sha, 'IMAGE')).toBe(`site-assets/${loc}/${id}/${sha}.webp`);
    expect(siteAssetStorageKey(loc, id, sha, 'LOGO')).toBe(`site-assets/${loc}/${id}/${sha}.webp`);
    expect(siteAssetStorageKey(loc, id, sha, 'FAVICON')).toBe(`site-assets/${loc}/${id}/${sha}.png`);
  });

  it('пределы ТЗ: 10 МиБ, 40 млн точек, сторона 12 000, выход 2400 / 1600 / 512, WebP 82', () => {
    expect(SITE_ASSET_LIMITS).toEqual({
      maxUploadBytes: 10 * 1024 * 1024,
      maxInputPixels: 40_000_000,
      maxInputSide: 12_000,
      imageMaxSide: 2400,
      logoMaxSide: 1600,
      faviconSide: 512,
      webpQuality: 82,
    });
  });
});
