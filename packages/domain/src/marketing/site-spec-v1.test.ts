/* eslint-disable @typescript-eslint/no-explicit-any -- тест портит документ по путям */
import { describe, expect, it } from 'vitest';
import {
  SITE_EDITOR_SECTIONS,
  SITE_SPEC_SECTIONS_BY_VERTICAL,
  bindCatalogFacts,
  buildSiteFacts,
  checkEditedSpec,
  checkGeneratedSpec,
  diffSiteSpecs,
  inlineTextTargets,
  newSection,
  siteSpecAssetRefs,
  starterSpecFromFacts,
  validateSiteSpec,
  type SiteBriefInput,
} from './index';

/**
 * SITE-2: секции салона и ресторана (`services`, `staff`, `menu`, `hours`, `leadForm`) и закреплённая кнопка на
 * телефоне проходят все валидаторы: схема, генерация, правка ИИ, разница версий, ссылки на картинки, правка на сайте.
 */
const M1 = '0b0e6a1c-0000-4000-8000-0000000000a1';
const IMG = '0b0e6a1c-0000-4000-8000-0000000000f1';

function salon(): Record<string, any> {
  return starterSpecFromFacts(
    buildSiteFacts({
      vertical: 'BEAUTY',
      location: { id: M1, name: 'Салон', address: 'Алматы, ул. Тестовая, 1', phone: '+77000000001', whatsapp: '+77000000002', city: null },
      catalog: { kind: 'services', items: [{ code: 'svc-1', name: 'Маникюр', price: { minor: '800000', currency: 'KZT' }, durationMin: 60 }] },
      staff: [{ id: M1, name: 'Мастер А', specialization: null }],
      hours: { days: [{ weekday: 1, open: '10:00', close: '20:00' }], checkInTime: null, checkOutTime: null },
      photosCount: 0,
      reviews: null,
    }),
  ) as Record<string, any>;
}
function cafe(): Record<string, any> {
  return starterSpecFromFacts(
    buildSiteFacts({
      vertical: 'FOOD_SERVICE',
      location: { id: M1, name: 'Кафе', address: null, phone: '+77000000001', whatsapp: null, city: null },
      catalog: { kind: 'menu', items: [{ code: 'dish-1', name: 'Борщ', price: { minor: '250000', currency: 'KZT' }, category: 'Супы', weightGrams: 300 }] },
      staff: [],
      hours: { days: [{ weekday: 5, open: '12:00', close: '23:00' }], checkInTime: null, checkOutTime: null },
      photosCount: 0,
      reviews: null,
    }),
  ) as Record<string, any>;
}
const sec = (s: Record<string, any>, type: string) => s['pages'][0].sections.find((x: any) => x.type === type);
const errors = (s: unknown) => {
  const r = validateSiteSpec(s);
  return r.ok ? [] : r.errors;
};
const has = (s: unknown, path: string | RegExp, code: string) =>
  expect(errors(s).some((e) => (typeof path === 'string' ? e.path === path : path.test(e.path)) && e.code === code), JSON.stringify(errors(s))).toBe(true);

describe('схема: новые секции', () => {
  it('салон и ресторан из заготовки валидны', () => {
    expect(errors(salon())).toEqual([]);
    expect(errors(cafe())).toEqual([]);
  });

  it('цена только целыми minor units строкой и кодом валюты', () => {
    const s = salon();
    sec(s, 'services').items[0].price = { minor: 8000.5, currency: 'KZT' };
    has(s, /services|sections\[\d\]\.items\[0\]\.price\.minor/, 'invalid_money');
    const t = salon();
    sec(t, 'services').items[0].price = { minor: '100', currency: 'тенге' };
    has(t, /items\[0\]\.price\.currency$/, 'invalid_currency');
  });

  it('повтор услуги, блюда, мастера и дня недели запрещён', () => {
    const s = salon();
    sec(s, 'services').items.push(structuredClone(sec(s, 'services').items[0]));
    has(s, /items\[1\]\.serviceCode$/, 'duplicate_service');
    const st = salon();
    sec(st, 'staff').items.push({ employeeId: M1.toUpperCase(), name: { ru: 'Б' } });
    sec(st, 'staff').items.push({ employeeId: M1, name: { ru: 'В' } });
    has(st, /items\[2\]\.employeeId$/, 'duplicate_employee');
    const c = cafe();
    sec(c, 'menu').categories.push({ title: { ru: 'Ещё' }, items: [structuredClone(sec(c, 'menu').categories[0].items[0])] });
    has(c, /categories\[1\]\.items\[0\]\.itemCode$/, 'duplicate_menu_item');
    const h = cafe();
    sec(h, 'hours').days.push({ weekday: 5, open: '09:00', close: '10:00' });
    has(h, /days\[1\]\.weekday$/, 'duplicate_weekday');
  });

  it('часы: ЧЧ:ММ, день 0–6, открытие не равно закрытию', () => {
    const s = cafe();
    sec(s, 'hours').days[0] = { weekday: 7, open: '25:00', close: '25:00' };
    has(s, /days\[0\]\.weekday$/, 'invalid_number');
    has(s, /days\[0\]\.open$/, 'invalid_time');
    const t = cafe();
    sec(t, 'hours').days[0].close = '12:00';
    has(t, /days\[0\]\.close$/, 'invalid_time');
  });

  it('форма заявки: режим по направлению; запись к мастеру без услуг не проходит', () => {
    const s = salon();
    sec(s, 'leadForm').mode = 'TABLE_RESERVATION';
    has(s, /sections\[\d\]\.mode$/, 'enum');
    const t = salon();
    t['pages'][0].sections = t['pages'][0].sections.filter((x: any) => x.type !== 'services');
    has(t, /sections\[\d\]\.mode$/, 'appointment_without_services');
    const u = salon();
    u['pages'][0].sections.push({ ...structuredClone(sec(u, 'leadForm')), id: 'sec-form-2' });
    has(u, /sections\[\d+\]$/, 'duplicate_booking');
  });

  it('секции чужого направления: номера у салона, меню у гостиницы', () => {
    const s = salon();
    s['pages'][0].sections.push({ id: 'x-rooms', type: 'accommodations', variant: 'CARDS', heading: { ru: 'Номера' }, items: [{ categoryCode: 'a', title: { ru: 'A' }, description: { ru: 'B' } }] });
    has(s, /sections\[\d+\]\.type$/, 'section_not_for_vertical');
    expect(SITE_SPEC_SECTIONS_BY_VERTICAL.HOSPITALITY).not.toContain('menu');
  });

  it('тип schema.org по направлению: ресторан не может назваться отелем', () => {
    const s = cafe();
    s['site'].seo.structuredData.type = 'HOTEL';
    has(s, 'site.seo.structuredData.type', 'enum');
    s['site'].seo.structuredData.type = 'CAFE';
    expect(errors(s)).toEqual([]);
  });

  it('закреплённая кнопка WhatsApp требует номер в контактах', () => {
    const s = cafe();
    s['navigation'].mobileBar = { book: true, whatsapp: true };
    has(s, 'navigation.mobileBar.whatsapp', 'missing_contact');
  });

  it('разметка в названии услуги отклоняется, как любой текст SiteSpec', () => {
    const s = salon();
    sec(s, 'services').items[0].title = { ru: '<b>Маникюр</b>' };
    has(s, /items\[0\]\.title\.ru$/, 'markup');
  });

  it('старые гостиничные документы без новых полей валидны как прежде (обратная совместимость проверяют site-spec.test.ts)', () => {
    expect(Object.keys(SITE_EDITOR_SECTIONS)).toEqual(expect.arrayContaining(['services', 'staff', 'menu', 'hours', 'leadForm']));
  });
});

describe('редактор: новая секция SITE-2', () => {
  it('часы и форма заявки сразу валидны в документе салона; услуги и мастера пустыми подсвечиваются', () => {
    for (const type of ['hours', 'leadForm']) {
      const s = salon();
      s['pages'][0].sections.splice(1, 0, newSection(type, { locale: 'ru', taken: new Set(['sec-hours', 'sec-form']), categories: [], cardCodes: [] }));
      if (type === 'leadForm') s['pages'][0].sections = s['pages'][0].sections.filter((x: any) => x.id !== 'sec-form');
      expect(errors(s), type).toEqual([]);
    }
    const s = salon();
    s['pages'][0].sections.push(newSection('staff', { locale: 'ru', taken: new Set(), categories: [], cardCodes: [] }));
    expect(errors(s).some((e) => e.code === 'count')).toBe(true);
  });

  it('правка прямо на сайте: тексты услуг доступны, код услуги и цена нет', () => {
    const paths = inlineTextTargets(salon(), 'ru').map((t) => t.path);
    expect(paths.some((p) => /items\[0\]\.title$/.test(p))).toBe(true);
    expect(paths.some((p) => /serviceCode|price|durationMin|employeeId/.test(p))).toBe(false);
  });
});

describe('картинки и разница версий', () => {
  it('фото мастера и блюда считаются ссылками на ассеты', () => {
    const s = salon();
    sec(s, 'staff').items[0].image = { assetId: IMG, alt: { ru: 'Мастер' } };
    const c = cafe();
    sec(c, 'menu').categories[0].items[0].image = { assetId: IMG, alt: { ru: 'Борщ' } };
    expect(errors(s)).toEqual([]);
    expect(errors(c)).toEqual([]);
    expect(siteSpecAssetRefs(s).map((r) => r.path)).toContain('pages[0].sections[3].items[0].image.assetId');
    expect(siteSpecAssetRefs(c).map((r) => r.path)).toContain(`pages[0].sections[${c['pages'][0].sections.indexOf(sec(c, 'menu'))}].categories[0].items[0].image.assetId`);
    const changes = diffSiteSpecs(cafe(), c);
    expect(changes).toContainEqual({ area: 'asset', kind: 'added', slot: 'section:sec-menu:categories', to: IMG });
  });
});

function briefOf(spec: Record<string, any>, vertical: 'BEAUTY' | 'FOOD_SERVICE'): SiteBriefInput {
  return {
    identity: {
      displayNameCandidate: spec['site'].displayName.ru, displayNameSource: 'PLATFORM', locationName: spec['site'].displayName.ru, propertyName: null,
      address: spec['site'].contacts.address?.ru ?? null, addressSource: 'PLATFORM', city: null, countryCode: null, propertyType: null,
      timezone: 'Asia/Almaty', currency: 'KZT', phone: '+77000000001', phoneSource: 'PLATFORM', email: null, emailSource: null,
    },
    stay: { checkInTime: null, checkOutTime: null },
    accommodations: [],
    capabilities: { booking: false, fromPrice: false },
    sellerContent: null,
    channelContent: null,
    vertical,
    services: [{ code: 'svc-1', name: 'Маникюр', category: null, durationMin: 60, priceMinor: '800000', currency: 'KZT' }],
    staff: [{ id: M1, name: 'Мастер А', specialization: null }],
    menu: [{ title: 'Супы', items: [{ code: 'dish-1', name: 'Борщ', weightGrams: 300, priceMinor: '250000', currency: 'KZT', hasPhoto: false }] }],
    hours: vertical === 'BEAUTY' ? [{ weekday: 1, open: '10:00', close: '20:00' }] : [{ weekday: 5, open: '12:00', close: '23:00' }],
  };
}

describe('генерация и правка ИИ: цены, мастера и часы только из данных', () => {
  const strip = (s: Record<string, any>) => {
    // как ответ модели: без контактов, которых нет в брифе
    delete s['site'].contacts.whatsapp;
    s['navigation'].mobileBar.whatsapp = false;
    s['pages'][0].sections = s['pages'][0].sections.map((x: any) => (x.type === 'contacts' ? { ...x, showWhatsapp: false } : x));
    return s;
  };

  it('заготовка салона проходит проверку генерации', () => {
    const s = strip(salon());
    const r = checkGeneratedSpec(s, briefOf(s, 'BEAUTY'), ['ru']);
    expect(r.ok ? [] : r.errors).toEqual([]);
  });

  it('выдуманная цена, услуга, мастер и часы отклоняются; bindCatalogFacts ставит цену из данных', () => {
    const s = strip(salon());
    sec(s, 'services').items[0].price = { minor: '1', currency: 'KZT' };
    sec(s, 'services').items[0].durationMin = 5;
    sec(s, 'staff').items[0].employeeId = '0b0e6a1c-0000-4000-8000-0000000000ff';
    sec(s, 'hours').days[0].close = '23:00';
    const input = briefOf(s, 'BEAUTY');
    const codes = (r: ReturnType<typeof checkGeneratedSpec>) => (r.ok ? [] : r.errors.map((e) => e.code));
    expect(codes(checkGeneratedSpec(s, input, ['ru']))).toEqual(expect.arrayContaining(['invented_price', 'invented_fact', 'unknown_employee', 'invented_hours']));
    const bound = bindCatalogFacts(s, input) as Record<string, any>;
    expect(sec(bound, 'services').items[0]).toMatchObject({ price: { minor: '800000', currency: 'KZT' }, durationMin: 60 });
    expect(sec(bound, 'hours').days).toEqual([{ weekday: 1, open: '10:00', close: '20:00' }]);
    expect(codes(checkGeneratedSpec(bound, input, ['ru']))).toEqual(['unknown_employee']);
  });

  it('сайт салона с направлением гостиницы отклоняется', () => {
    const s = strip(salon());
    const { vertical: _v, ...input } = briefOf(s, 'BEAUTY');
    void _v;
    const r = checkGeneratedSpec(s, input, ['ru']);
    expect(r.ok ? [] : r.errors.map((e) => e.code)).toContain('vertical_mismatch');
  });

  it('правка ИИ меню: подмена цены блюда отклоняется в PATCH и в SECTION', () => {
    const base = cafe();
    const input = briefOf(base, 'FOOD_SERVICE');
    const next = structuredClone(base);
    sec(next, 'menu').categories[0].items[0].price = { minor: '1', currency: 'KZT' };
    const patch = checkEditedSpec(next, base, input, { mode: 'PATCH' });
    expect(patch.ok ? [] : patch.errors.map((e) => e.code)).toContain('invented_price');
    const section = checkEditedSpec(next, base, input, { mode: 'SECTION', target: { pageId: 'page-home', sectionId: 'sec-menu' } });
    expect(section.ok ? [] : section.errors.map((e) => e.path)).toContain(`pages[0].sections[${base['pages'][0].sections.indexOf(sec(base, 'menu'))}].categories[0].items[0].price`);
    const renamed = structuredClone(base);
    sec(renamed, 'menu').categories[0].items[0].title = { ru: 'Борщ домашний' };
    const ok = checkEditedSpec(renamed, base, input, { mode: 'SECTION', target: { pageId: 'page-home', sectionId: 'sec-menu' } });
    expect(ok.ok ? [] : ok.errors).toEqual([]);
  });
});
