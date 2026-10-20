/* eslint-disable @typescript-eslint/no-explicit-any -- тест читает документ по путям */
import { describe, expect, it } from 'vitest';
import { liveSiteSpec } from './live-sync';
import { buildSiteFacts, type SiteFacts, type SiteFactsSnapshot } from './site-facts';
import { siteTemplatesFor, templateSiteSpec } from './site-templates';
import { validateSiteSpec } from './site-spec';

/**
 * Живые данные (SITE-1): опубликованный сайт показывает текущие услуги, цены, мастеров, меню, часы и контакты из
 * WETOP, а правки владельца на сайте (описания, фото, специализация, заголовки, оформление) остаются
 */
const LOC = '0b0e6a1c-0000-4000-8000-000000000001';
const A = '0b0e6a1c-0000-4000-8000-0000000000a1';
const B = '0b0e6a1c-0000-4000-8000-0000000000b2';

function snap(over: Partial<SiteFactsSnapshot>): SiteFacts {
  return buildSiteFacts({
    vertical: 'BEAUTY',
    location: { id: LOC, name: 'Студия', address: 'Алматы, ул. Тестовая, 1', phone: '+7 700 000 00 01', whatsapp: null, city: null },
    catalog: {
      kind: 'services',
      items: [
        { code: 'svc-1', name: 'Маникюр', price: { minor: '800000', currency: 'KZT' }, durationMin: 60 },
        { code: 'svc-2', name: 'Стрижка', price: { minor: '500000', currency: 'KZT' }, durationMin: 45 },
      ],
    },
    staff: [{ id: A, name: 'Айгерим', specialization: 'Маникюр' }],
    hours: { days: [{ weekday: 1, open: '10:00', close: '20:00' }], checkInTime: null, checkOutTime: null },
    photosCount: 0,
    reviews: null,
    ...over,
  });
}
const tplOf = (f: SiteFacts) => templateSiteSpec(f, siteTemplatesFor(f.vertical)[0]!.id) as Record<string, any>;
const sec = (spec: Record<string, any>, type: string) => spec['pages'][0].sections.find((s: any) => s.type === type);

describe('живые данные WETOP на опубликованном сайте', () => {
  it('нет изменений в WETOP: тот же объект', () => {
    const f = snap({});
    const spec = tplOf(f);
    expect(liveSiteSpec(spec, f)).toBe(spec);
  });

  it('новая цена, новая услуга и снятая услуга видны сразу; описание услуги владельца остаётся', () => {
    const spec = tplOf(snap({}));
    sec(spec, 'services').items[0].description = { ru: 'Аппаратный, с покрытием' };
    const now = snap({
      catalog: {
        kind: 'services',
        items: [
          { code: 'svc-1', name: 'Маникюр', price: { minor: '900000', currency: 'KZT' }, durationMin: 75 },
          { code: 'svc-3', name: 'Окрашивание', price: { minor: '2000000', currency: 'KZT' }, durationMin: 120 },
        ],
      },
    });
    const next = liveSiteSpec(spec, now) as Record<string, any>;
    const items = sec(next, 'services').items;
    expect(items.map((i: any) => i.serviceCode)).toEqual(['svc-1', 'svc-3']);
    expect(items[0].price).toEqual({ minor: '900000', currency: 'KZT' });
    expect(items[0].durationMin).toBe(75);
    expect(items[0].description).toEqual({ ru: 'Аппаратный, с покрытием' });
    expect(validateSiteSpec(next).ok).toBe(true);
    // входной документ не меняется
    expect(sec(spec, 'services').items[0].price.minor).toBe('800000');
  });

  it('мастера из WETOP; фото и своя специализация у мастера остаются', () => {
    const spec = tplOf(snap({}));
    const staff = sec(spec, 'staff');
    staff.items[0].specialization = { ru: 'Топ-мастер, 10 лет опыта' };
    const next = liveSiteSpec(spec, snap({ staff: [{ id: A, name: 'Айгерим К.', specialization: 'Маникюр' }, { id: B, name: 'Дана', specialization: 'Брови' }] })) as Record<string, any>;
    const items = sec(next, 'staff').items;
    expect(items.map((i: any) => i.name.ru)).toEqual(['Айгерим К.', 'Дана']);
    expect(items[0].specialization).toEqual({ ru: 'Топ-мастер, 10 лет опыта' });
    expect(items[1].specialization).toEqual({ ru: 'Брови' });
  });

  it('часы работы и телефон из WETOP', () => {
    const spec = tplOf(snap({}));
    const next = liveSiteSpec(
      spec,
      snap({
        location: { id: LOC, name: 'Студия', address: 'Алматы, пр. Абая, 10', phone: '+7 700 000 00 99', whatsapp: null, city: null },
        hours: { days: [{ weekday: 1, open: '09:00', close: '21:00' }, { weekday: 2, open: '09:00', close: '21:00' }], checkInTime: null, checkOutTime: null },
      }),
    ) as Record<string, any>;
    expect(sec(next, 'hours').days).toHaveLength(2);
    expect(next['site'].contacts.phone).toBe('+77000000099');
    expect(next['site'].contacts.address.ru).toBe('Алматы, пр. Абая, 10');
  });

  it('в WETOP всё убрали: блок остаётся как был, сайт не ломается', () => {
    const spec = tplOf(snap({}));
    const next = liveSiteSpec(spec, snap({ catalog: { kind: 'services', items: [] }, staff: [] })) as Record<string, any>;
    expect(sec(next, 'services').items).toHaveLength(2);
    expect(sec(next, 'staff').items).toHaveLength(1);
  });

  it('меню ресторана: новое блюдо и цена; фото блюда остаётся', () => {
    const food = (items: SiteFactsSnapshot['catalog']['items']) =>
      buildSiteFacts({
        vertical: 'FOOD_SERVICE',
        location: { id: LOC, name: 'Кафе', address: null, phone: null, whatsapp: null, city: null },
        catalog: { kind: 'menu', items },
        staff: [],
        hours: { days: [], checkInTime: null, checkOutTime: null },
        photosCount: 0,
        reviews: null,
      });
    const f0 = food([{ code: 'd1', name: 'Бешбармак', price: { minor: '450000', currency: 'KZT' }, category: 'Горячее' }]);
    const spec = tplOf(f0);
    const photo = { assetId: '0b0e6a1c-0000-4000-8000-0000000000f1', alt: { ru: 'Бешбармак' } };
    sec(spec, 'menu').categories[0].items[0].image = photo;
    const next = liveSiteSpec(
      spec,
      food([
        { code: 'd1', name: 'Бешбармак', price: { minor: '480000', currency: 'KZT' }, category: 'Горячее' },
        { code: 'd2', name: 'Баурсаки', price: { minor: '90000', currency: 'KZT' }, category: 'Выпечка' },
      ]),
    ) as Record<string, any>;
    const cats = sec(next, 'menu').categories;
    expect(cats.map((c: any) => c.title.ru)).toEqual(['Горячее', 'Выпечка']);
    expect(cats[0].items[0].price.minor).toBe('480000');
    expect(cats[0].items[0].image).toEqual(photo);
    expect(validateSiteSpec(next).ok).toBe(true);
  });
});
