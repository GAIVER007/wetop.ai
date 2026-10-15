import { describe, expect, it, vi } from 'vitest';
import { formatMoney } from './money';
import { catalogPrice, loadSiteFacts, loadSiteLocations, weekHours, type SiteFactsSource } from './site-facts';
import { verticalCopy } from './vertical-copy';

/**
 * SITE-1: факты филиала без ИИ. Эндпоинт соседнего среза API главный; пока его нет (404), карточка собирается из
 * существующих запросов стойки по направлению. Данные вымышленные (ADR-010).
 */
const notFound = () => Object.assign(new Error('Not Found'), { status: 404 });
const LOC = 'lc000001-0000-4000-8000-000000000001';

function source(patch: Partial<SiteFactsSource> = {}): SiteFactsSource {
  return {
    facts: vi.fn(async () => {
      throw notFound();
    }),
    locations: vi.fn(async () => {
      throw notFound();
    }),
    hospitality: {
      brief: async () => ({
        input: {
          identity: { displayNameCandidate: 'Luxx Aparts', address: 'ул. Вымышленная, 1', phone: '+77000000000', city: 'Алматы' },
          stay: { checkInTime: '14:00', checkOutTime: '12:00' },
          accommodations: [
            { categoryCode: 'std', name: 'Стандарт' },
            { categoryCode: 'bed', name: 'Койка в общем номере' },
          ],
        },
      }),
      prices: async () => [
        { code: 'std', priceMinor: '1850000' },
        { code: 'bed', priceMinor: null },
      ],
      photos: async () => 0,
    },
    beauty: {
      services: async () => ({
        items: [
          { name: 'Маникюр', category: 'Ногти', durationMinutes: 60, priceMinor: '800000', active: true, effective: { sellable: true, priceMinor: '900000', durationMinutes: 75 } },
          { name: 'Педикюр', category: null, durationMinutes: 90, priceMinor: '1200000', active: true, effective: { sellable: false } },
        ],
      }),
      employees: async () => ({
        locationId: LOC,
        items: [
          { name: 'Айгерим', active: true, locationIds: [LOC] },
          { name: 'Другой филиал', active: true, locationIds: ['x'] },
          { name: 'Уволена', active: false, locationIds: [LOC] },
        ],
      }),
      hours: async () => [
        { weekday: 1, intervals: [{ timeFrom: '10:00', timeTo: '20:00' }] },
        { weekday: 0, intervals: [{ timeFrom: '11:00', timeTo: '18:00' }] },
      ],
    },
    food: {
      categories: async () => [{ id: 'c1', name: 'Горячее', active: true }],
      items: async () => [
        { name: 'Бешбармак', categoryId: 'c1', priceMinor: '450000', active: true, photoUrl: null },
        { name: 'Снято с меню', categoryId: 'c1', priceMinor: '100', active: false },
      ],
      periods: async () => [{ name: 'Обед', weekday: 2, timeFrom: '12:00', timeTo: '16:00', active: true }],
    },
    branch: async () => ({ name: 'Салон на Абая', address: null }),
    ...patch,
  };
}

describe('loadSiteFacts: эндпоинт и сборка без него', () => {
  it('эндпоинт отвечает: факты как есть, источник api', async () => {
    const facts = { vertical: 'BEAUTY', location: { id: LOC } };
    const r = await loadSiteFacts(LOC, 'BEAUTY', source({ facts: async () => facts }));
    expect(r).toEqual({ ok: true, data: facts, source: 'api' });
  });

  it('эндпоинт отказал не 404: отказ словами, сборки нет', async () => {
    const brief = vi.fn();
    const src = source({ facts: async () => Promise.reject(Object.assign(new Error('Выберите филиал'), { status: 409 })) });
    src.hospitality.brief = brief;
    expect(await loadSiteFacts(LOC, 'HOSPITALITY', src)).toEqual({ ok: false, status: 409, message: 'Выберите филиал' });
    expect(brief).not.toHaveBeenCalled();
  });

  it('гостиница без эндпоинта: бриф, цены «от» и пробелы (фото, цены у части категорий нет)', async () => {
    const r = await loadSiteFacts(LOC, 'HOSPITALITY', source());
    if (!r.ok) throw new Error(r.message);
    expect(r.source).toBe('fallback');
    expect(r.data).toMatchObject({
      vertical: 'HOSPITALITY',
      location: { id: LOC, name: 'Luxx Aparts', address: 'ул. Вымышленная, 1', phone: '+77000000000', city: 'Алматы' },
      catalog: { kind: 'rooms', items: [{ name: 'Стандарт', priceFrom: '1850000' }, { name: 'Койка в общем номере' }] },
      hours: 'Заезд с 14:00, выезд до 12:00',
      photosCount: 0,
    });
    expect(r.data.gaps.map((g) => g.key)).toEqual(['photos']);
    expect(r.data.gaps[0]!.href).toBe('/marketing/site/assets');
  });

  it('гостиница: сбой цен и фото не роняет карточку; сбой брифа: отказ', async () => {
    const src = source();
    src.hospitality.prices = async () => Promise.reject(new Error('403'));
    const r = await loadSiteFacts(LOC, 'HOSPITALITY', src);
    expect(r.ok && r.data.gaps.map((g) => g.key)).toEqual(['catalog', 'photos']);
    src.hospitality.brief = async () => Promise.reject(Object.assign(new Error('Нет связи'), { status: 503 }));
    expect(await loadSiteFacts(LOC, 'HOSPITALITY', src)).toEqual({ ok: false, status: 503, message: 'Нет связи' });
  });

  it('салон без эндпоинта: цена и длительность филиала, только продаваемые; мастера этого филиала; неделя', async () => {
    const r = await loadSiteFacts(LOC, 'BEAUTY', source());
    if (!r.ok) throw new Error(r.message);
    expect(r.data.catalog).toEqual({ kind: 'services', items: [{ name: 'Маникюр', price: '900000', durationMin: 75, category: 'Ногти' }] });
    expect(r.data.staff).toEqual([{ name: 'Айгерим' }]);
    expect(r.data.hours).toEqual(['Пн 10:00–20:00', 'Вс 11:00–18:00']);
    expect(r.data.location).toMatchObject({ name: 'Салон на Абая', address: null });
    expect(r.data.gaps.map((g) => g.key)).toEqual(['address', 'phone', 'photos']);
  });

  it('ресторан без эндпоинта: активные блюда с категорией, сервис-периоды как часы', async () => {
    const r = await loadSiteFacts(LOC, 'FOOD_SERVICE', source({ branch: async () => ({ name: 'Ресторан Дастархан', address: 'пр. Абая, 10' }) }));
    if (!r.ok) throw new Error(r.message);
    expect(r.data.catalog).toEqual({ kind: 'menu', items: [{ name: 'Бешбармак', price: '450000', category: 'Горячее' }] });
    expect(r.data.hours).toEqual(['Вт 12:00–16:00']);
    expect(r.data.gaps.map((g) => g.key)).toEqual(['phone', 'photos']);
  });
});

describe('loadSiteLocations', () => {
  it('без эндпоинта: филиалы стойки, статус сайта только у выбранного', async () => {
    const r = await loadSiteLocations(
      source(),
      async () => [
        { locationId: LOC, name: 'Luxx Aparts', vertical: 'HOSPITALITY' },
        { locationId: 'b', name: 'Салон', vertical: 'BEAUTY' },
      ],
      { locationId: LOC, siteStatus: 'NONE' },
    );
    expect(r).toEqual({
      ok: true,
      source: 'fallback',
      data: [
        { id: LOC, name: 'Luxx Aparts', vertical: 'HOSPITALITY', siteStatus: 'NONE' },
        { id: 'b', name: 'Салон', vertical: 'BEAUTY', siteStatus: null },
      ],
    });
  });

  it('эндпоинт есть: его ответ; отказ не 404: словами', async () => {
    const list = [{ id: LOC, name: 'Luxx', vertical: 'HOSPITALITY', siteStatus: 'PUBLISHED' }];
    expect(await loadSiteLocations(source({ locations: async () => list }), async () => [], { locationId: null, siteStatus: null })).toEqual({ ok: true, data: list, source: 'api' });
    const denied = source({ locations: async () => Promise.reject(Object.assign(new Error('Нет доступа'), { status: 403 })) });
    expect(await loadSiteLocations(denied, async () => [], { locationId: null, siteStatus: null })).toEqual({ ok: false, status: 403, message: 'Нет доступа' });
  });
});

describe('цены и часы для карточки', () => {
  it('тенге через formatMoney, «от» у цены категории, мусор не печатается', () => {
    expect(catalogPrice({ name: 'a', price: '900000' }, formatMoney)).toBe('9 000 ₸');
    expect(catalogPrice({ name: 'a', priceFrom: 1850000 }, formatMoney)).toBe('от 18 500 ₸');
    expect(catalogPrice({ name: 'a' }, formatMoney)).toBeNull();
    expect(catalogPrice({ name: 'a', price: '12.5' }, formatMoney)).toBeNull();
  });
  it('неделя с понедельника, интервалы дня по порядку', () => {
    expect(
      weekHours([
        { weekday: 0, from: '10:00', to: '12:00' },
        { weekday: 3, from: '18:00', to: '23:00' },
        { weekday: 3, from: '12:00', to: '15:00' },
      ]),
    ).toEqual(['Ср 12:00–15:00, 18:00–23:00', 'Вс 10:00–12:00']);
  });
});

describe('подсказки-чипы чата по направлению', () => {
  it('у каждого направления свои три подсказки из плана', () => {
    expect(verticalCopy('HOSPITALITY').siteChips).toEqual(['Сайт с онлайн-бронированием', 'Акцент на семейном отдыхе', 'Покажи трансфер']);
    expect(verticalCopy('BEAUTY').siteChips).toEqual(['Сайт для записи на услуги', 'Акцент на мастерах', 'Акция на первое посещение']);
    expect(verticalCopy('FOOD_SERVICE').siteChips).toEqual(['Сайт с меню и бронью столов', 'Акцент на банкетах', 'Покажи бизнес-ланч']);
  });
  it('кнопка сайта и заголовок каталога по направлению', () => {
    expect([verticalCopy('HOSPITALITY').bookAction, verticalCopy('BEAUTY').bookAction, verticalCopy('FOOD_SERVICE').bookAction]).toEqual([
      'Забронировать',
      'Записаться',
      'Забронировать стол',
    ]);
    expect(verticalCopy('BEAUTY').catalogTitle).toBe('Услуги и цены');
  });
});
