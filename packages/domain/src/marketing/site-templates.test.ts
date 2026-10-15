/* eslint-disable @typescript-eslint/no-explicit-any -- тест читает документ по путям */
import { describe, expect, it } from 'vitest';
import { SITE_TEMPLATES, applySiteTemplate, currentSiteTemplate, siteTemplateById, siteTemplatesFor, templateSiteSpec } from './site-templates';
import { buildSiteFacts, type SiteFacts, type SiteFactsSnapshot } from './site-facts';
import { validateSiteSpec } from './site-spec';

/**
 * Шаблоны готовых сайтов по сегментам (SITE-1): по три у гостиницы, салона и ресторана. Выбор шаблона сразу даёт
 * готовый сайт филиала из его данных, без промптов и без ИИ. Каждый шаблон проходит валидатор, шаблоны сегмента разные
 */
const LOC = '0b0e6a1c-0000-4000-8000-000000000001';

function facts(vertical: SiteFactsSnapshot['vertical']): SiteFacts {
  const base: SiteFactsSnapshot = {
    vertical,
    location: { id: LOC, name: 'Филиал «Тест»', address: 'Алматы, ул. Тестовая, 1', phone: '+7 700 000 00 01', whatsapp: null, city: 'Алматы' },
    catalog: { kind: 'rooms', items: [] },
    staff: [],
    hours: { days: [{ weekday: 1, open: '10:00', close: '20:00' }], checkInTime: null, checkOutTime: null },
    photosCount: 0,
    reviews: null,
  };
  if (vertical === 'HOSPITALITY')
    return buildSiteFacts({
      ...base,
      catalog: { kind: 'rooms', items: [{ code: 'std', name: 'Стандарт', capacityAdults: 2 }, { code: 'lux', name: 'Люкс', capacityAdults: 3 }] },
      hours: { days: [], checkInTime: '14:00', checkOutTime: '12:00' },
    });
  if (vertical === 'BEAUTY')
    return buildSiteFacts({
      ...base,
      catalog: {
        kind: 'services',
        items: [
          { code: 'svc-1', name: 'Маникюр', price: { minor: '800000', currency: 'KZT' }, durationMin: 60 },
          { code: 'svc-2', name: 'Стрижка', price: { minor: '500000', currency: 'KZT' }, durationMin: 45 },
        ],
      },
      staff: [{ id: '0b0e6a1c-0000-4000-8000-0000000000a1', name: 'Мастер А', specialization: null }],
    });
  return buildSiteFacts({
    ...base,
    catalog: {
      kind: 'menu',
      items: [
        { code: 'd1', name: 'Бешбармак', price: { minor: '450000', currency: 'KZT' }, category: 'Горячее' },
        { code: 'd2', name: 'Баурсаки', price: { minor: '90000', currency: 'KZT' }, category: 'Выпечка' },
      ],
    },
  });
}

const VERTICALS = ['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE'] as const;
const home = (spec: Record<string, any>) => spec['pages'][0].sections as Array<{ type: string; variant: string }>;

describe('шаблоны готовых сайтов по сегментам', () => {
  it('у каждого сегмента ровно три своих шаблона, id без повторов', () => {
    for (const v of VERTICALS) {
      expect(siteTemplatesFor(v)).toHaveLength(3);
      expect(siteTemplatesFor(v).every((x) => x.vertical === v)).toBe(true);
    }
    expect(new Set(SITE_TEMPLATES.map((x) => x.id)).size).toBe(SITE_TEMPLATES.length);
    expect(siteTemplatesFor(null)).toEqual([]);
  });

  for (const vertical of VERTICALS)
    it(`${vertical}: каждый шаблон даёт валидный сайт сегмента в теме, порядке и вариантах шаблона`, () => {
      for (const tpl of siteTemplatesFor(vertical)) {
        const spec = templateSiteSpec(facts(vertical), tpl.id) as Record<string, any>;
        const checked = validateSiteSpec(spec);
        expect(checked.ok ? [] : checked.errors, tpl.id).toEqual([]);
        expect(spec['site'].vertical).toBe(vertical);
        expect(spec['theme']).toMatchObject(tpl.direction.theme);
        const sections = home(spec);
        expect(sections[0]!.type).toBe('hero');
        // порядок блоков шаблона: блоки сайта идут в том порядке, в каком их перечисляет шаблон
        const ranks = sections.map((s) => tpl.direction.sectionOrder.indexOf(s.type)).filter((r) => r >= 0);
        expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
        for (const s of sections) if (tpl.variants[s.type]) expect(s.variant, `${tpl.id}/${s.type}`).toBe(tpl.variants[s.type]);
      }
    });

  it('три шаблона сегмента дают три заметно разных сайта: тема и раскладка различаются', () => {
    for (const vertical of VERTICALS) {
      const specs = siteTemplatesFor(vertical).map((x) => templateSiteSpec(facts(vertical), x.id) as Record<string, any>);
      expect(new Set(specs.map((x) => JSON.stringify(x['theme']))).size).toBe(3);
      expect(new Set(specs.map((x) => home(x).map((s) => `${s.type}:${s.variant}`).join(','))).size).toBe(3);
      const id = siteTemplatesFor(vertical)[0]!.id;
      expect(templateSiteSpec(facts(vertical), id)).toEqual(templateSiteSpec(facts(vertical), id));
    }
  });

  it('данные только из филиала: блюда и цены как в фактах', () => {
    const spec = templateSiteSpec(facts('FOOD_SERVICE'), 'food-cafe') as Record<string, any>;
    const text = JSON.stringify(spec);
    expect(text).toContain('Бешбармак');
    expect(text).toContain('"minor":"450000"');
  });

  it('чужой сегмент и неизвестный шаблон: null', () => {
    expect(templateSiteSpec(facts('BEAUTY'), 'food-cafe')).toBeNull();
    expect(templateSiteSpec(facts('BEAUTY'), 'no-such')).toBeNull();
    expect(siteTemplateById(42)).toBeNull();
  });
});

describe('смена шаблона у готового сайта (простой редактор)', () => {
  it('тексты, цены и блоки остаются; меняются тема, порядок и варианты; документ валиден', () => {
    for (const vertical of VERTICALS) {
      const [first, second] = siteTemplatesFor(vertical);
      const site = templateSiteSpec(facts(vertical), first!.id) as Record<string, any>;
      // человек поправил заголовок первого экрана
      site['pages'][0].sections[0].heading = { ru: 'Мой заголовок' };
      const next = applySiteTemplate(site, second!.id) as Record<string, any>;
      const checked = validateSiteSpec(next);
      expect(checked.ok ? [] : checked.errors, vertical).toEqual([]);
      expect(next['pages'][0].sections[0].heading).toEqual({ ru: 'Мой заголовок' });
      expect(next['theme']).toMatchObject(second!.direction.theme);
      expect(new Set(home(next).map((s) => s.type))).toEqual(new Set(home(site).map((s) => s.type)));
      expect(currentSiteTemplate(next, vertical)?.id).toBe(second!.id);
    }
  });

  it('первый экран с фото фото сохраняет', () => {
    const site = templateSiteSpec(facts('HOSPITALITY'), 'hotel-classic') as Record<string, any>;
    site['pages'][0].sections[0] = { ...site['pages'][0].sections[0], variant: 'IMAGE_FULL', image: { assetId: '00000001-0000-4000-8000-000000000001', alt: { ru: 'Фасад' } } };
    const next = applySiteTemplate(site, 'hotel-boutique') as Record<string, any>;
    expect(next['pages'][0].sections[0]).toMatchObject({ variant: 'IMAGE_FULL', image: { assetId: '00000001-0000-4000-8000-000000000001' } });
  });

  it('неизвестный шаблон: null; сайт, который правили в теме, без текущего шаблона', () => {
    expect(applySiteTemplate({}, 'no-such')).toBeNull();
    const site = templateSiteSpec(facts('BEAUTY'), 'beauty-studio') as Record<string, any>;
    site['theme'] = { ...site['theme'], accent: 'GOLD' };
    expect(currentSiteTemplate(site, 'BEAUTY')).toBeNull();
  });
});
