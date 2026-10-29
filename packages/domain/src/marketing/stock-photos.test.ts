import { describe, expect, it } from 'vitest';
import { siteSpecAssetRefs } from './assets';
import { STOCK_PHOTOS, isStockAssetId, stockAssetMap, stockPhotoFor } from './stock-photos';
import { SITE_TEMPLATES, applySiteTemplate, templateSiteSpec } from './site-templates';
import { validateSiteSpec } from './site-spec';
import { starterSpecFromFacts } from './starter';
import { buildSiteFacts, type SiteFacts } from './site-facts';

/**
 * Подбор фото (владелец: «фото, когда у клиента нет своих», 29.10.2026). У каждого шаблона своё фото первого экрана
 * из набора WETOP (Pexels, свободная лицензия); своё фото клиента не заменяется.
 */
const facts = (vertical: SiteFacts['vertical']): SiteFacts =>
  buildSiteFacts({
    vertical,
    location: { id: 'loc', name: 'Тест', address: null, phone: null, whatsapp: null, city: null },
    catalog: { kind: vertical === 'HOSPITALITY' ? 'rooms' : vertical === 'BEAUTY' ? 'services' : 'menu', items: [] },
    staff: [],
    hours: { days: [], checkInTime: null, checkOutTime: null },
    photosCount: 0,
    reviews: null,
  } as never);

type Rec = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const hero = (spec: Rec) => (spec['pages'] as Rec[])[0]!['sections'].find((s: Rec) => s['type'] === 'hero');

describe('набор фото WETOP', () => {
  it('у каждого шаблона своё фото, адрес только https images.pexels.com, id это UUID', () => {
    for (const tpl of SITE_TEMPLATES) {
      const photo = stockPhotoFor(tpl.id);
      expect(photo, tpl.id).not.toBeNull();
      expect(new URL(photo!.url).origin).toBe('https://images.pexels.com');
      expect(isStockAssetId(photo!.assetId)).toBe(true);
    }
    expect(new Set(STOCK_PHOTOS.map((p) => p.assetId)).size).toBe(STOCK_PHOTOS.length);
  });

  it('новый сайт по шаблону: первый экран с фото набора, документ проходит схему', () => {
    for (const tpl of SITE_TEMPLATES) {
      const spec = templateSiteSpec(facts(tpl.vertical), tpl.id) as Rec;
      const h = hero(spec);
      expect(h['variant'], tpl.id).not.toBe('TEXT_ONLY');
      expect(h['image']['assetId']).toBe(stockPhotoFor(tpl.id)!.assetId);
      expect(Object.keys(h['image']['alt'])).toEqual(['ru']);
      expect(validateSiteSpec(spec).ok, tpl.id).toBe(true);
    }
  });

  it('смена шаблона меняет фото набора; своё фото клиента остаётся', () => {
    const base = templateSiteSpec(facts('BEAUTY'), 'beauty-studio') as Rec;
    const swapped = applySiteTemplate(base, 'beauty-boutique') as Rec;
    expect(hero(swapped)['image']['assetId']).toBe(stockPhotoFor('beauty-boutique')!.assetId);
    const own = structuredClone(base);
    hero(own)['image'] = { assetId: '00000001-0000-4000-8000-000000000001', alt: { ru: 'Наш зал' } };
    hero(own)['variant'] = 'IMAGE_SIDE';
    const kept = applySiteTemplate(own, 'beauty-boutique') as Rec;
    expect(hero(kept)['image']['assetId']).toBe('00000001-0000-4000-8000-000000000001');
  });

  it('карта адресов: только фото набора из документа; чужие id не попадают', () => {
    const spec = templateSiteSpec(facts('FOOD_SERVICE'), 'food-cafe') as Rec;
    const map = stockAssetMap(siteSpecAssetRefs(spec));
    expect(map).toEqual({ [stockPhotoFor('food-cafe')!.assetId]: stockPhotoFor('food-cafe')!.url });
    expect(stockAssetMap([{ assetId: '00000001-0000-4000-8000-000000000001', expectedKind: 'IMAGE', path: 'x' }])).toEqual({});
  });

  it('заготовка без шаблона не трогается: первый экран без фото', () => {
    expect(hero(starterSpecFromFacts(facts('HOSPITALITY')))['variant']).toBe('TEXT_ONLY');
  });
});
