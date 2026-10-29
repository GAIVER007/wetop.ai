/* eslint-disable @typescript-eslint/no-explicit-any -- тест читает документ по путям */
import { describe, expect, it } from 'vitest';
import {
  STARTER_DESIGNS,
  buildSiteFacts,
  siteFactsFromBrief,
  starterPhone,
  starterSpecFromFacts,
  starterText,
  validateSiteSpec,
  type SiteFacts,
  type SiteFactsSnapshot,
} from './index';

/** SITE-2: заготовка сайта для заявок из фактов филиала проходит валидатор у каждого направления и ничего не выдумывает */
const LOC = '0b0e6a1c-0000-4000-8000-000000000001';
const M1 = '0b0e6a1c-0000-4000-8000-0000000000a1';
const M2 = '0b0e6a1c-0000-4000-8000-0000000000a2';

function snapshot(patch: Partial<SiteFactsSnapshot> = {}): SiteFactsSnapshot {
  return {
    vertical: 'BEAUTY',
    location: { id: LOC, name: 'Салон «Вымышленный»', address: 'Алматы, ул. Тестовая, 1', phone: '+7 700 000 00 01', whatsapp: null, city: null },
    catalog: { kind: 'services', items: [] },
    staff: [],
    hours: { days: [], checkInTime: null, checkOutTime: null },
    photosCount: 0,
    reviews: null,
    ...patch,
  };
}

const beauty = (): SiteFacts =>
  buildSiteFacts(
    snapshot({
      location: { id: LOC, name: 'Салон «Вымышленный»', address: 'Алматы, ул. Тестовая, 1', phone: '+7 700 000 00 01', whatsapp: '+77000000002', city: null },
      catalog: {
        kind: 'services',
        items: [
          { code: 'svc-1', name: 'Маникюр', price: { minor: '800000', currency: 'KZT' }, durationMin: 60, category: 'Ногти' },
          { code: 'svc-2', name: 'Стрижка', price: { minor: '500000', currency: 'KZT' }, durationMin: 45 },
        ],
      },
      staff: [
        { id: M2, name: 'Мастер Б', specialization: 'Стрижка' },
        { id: M1, name: 'Мастер А', specialization: 'Маникюр' },
      ],
      hours: { days: [{ weekday: 1, open: '10:00', close: '20:00' }, { weekday: 2, open: '10:00', close: '20:00' }], checkInTime: null, checkOutTime: null },
    }),
  );

const food = (): SiteFacts =>
  buildSiteFacts(
    snapshot({
      vertical: 'FOOD_SERVICE',
      location: { id: LOC, name: 'Кафе «Пример»', address: null, phone: null, whatsapp: null, city: null },
      catalog: {
        kind: 'menu',
        items: [
          { code: 'dish-1', name: 'Борщ', price: { minor: '250000', currency: 'KZT' }, category: 'Супы', weightGrams: 300, hasPhoto: true },
          { code: 'dish-2', name: 'Плов', price: { minor: '350000', currency: 'KZT' }, category: 'Горячее' },
        ],
      },
      hours: { days: [{ weekday: 5, open: '12:00', close: '02:00' }], checkInTime: null, checkOutTime: null },
      reviews: { avg: 4.666, count: 3 },
    }),
  );

const hotel = (): SiteFacts =>
  buildSiteFacts(
    snapshot({
      vertical: 'HOSPITALITY',
      location: { id: LOC, name: 'Гостиница «Тест»', address: 'Астана, ул. Вымышленная, 5', phone: '+77000000003', whatsapp: null, city: 'Астана' },
      catalog: { kind: 'rooms', items: [{ code: 'std', name: 'Стандарт', capacityAdults: 2 }] },
      hours: { days: [], checkInTime: '14:00', checkOutTime: '12:00' },
      photosCount: 5,
    }),
  );

const valid = (spec: unknown) => {
  const r = validateSiteSpec(spec);
  expect(r.ok ? [] : r.errors).toEqual([]);
};
const home = (spec: Record<string, any>) => spec['pages'][0];
const types = (spec: Record<string, any>) => home(spec).sections.map((s: any) => s.type);

// с 28.10.2026 (S7) у каждого сайта блок «Вопросы и ответы» из фактов перед контактами: GEO и разметка FAQ
describe('starterSpecFromFacts: сайт для заявок по направлению проходит валидатор', () => {
  it('салон: первый экран, почему мы, услуги, мастера, запись, часы, контакты, призыв', () => {
    const spec = starterSpecFromFacts(beauty()) as Record<string, any>;
    valid(spec);
    expect(types(spec)).toEqual(['hero', 'features', 'services', 'staff', 'leadForm', 'hours', 'faq', 'contacts', 'cta']);
    expect(spec['site'].vertical).toBe('BEAUTY');
    expect(spec['site'].seo.structuredData.type).toBe('BEAUTY_SALON');
    expect(spec['integrations'].booking.mode).toBe('NONE');
    expect(spec['navigation'].mobileBar).toEqual({ book: true, whatsapp: true });
    const form = home(spec).sections.find((s: any) => s.type === 'leadForm');
    expect(form.mode).toBe('BEAUTY_APPOINTMENT');
    const services = home(spec).sections.find((s: any) => s.type === 'services');
    // цена и длительность ровно из данных, minor units строкой
    expect(services.items[0]).toMatchObject({ serviceCode: 'svc-1', price: { minor: '800000', currency: 'KZT' }, durationMin: 60 });
    // мастера в порядке имени, id из данных
    expect(home(spec).sections.find((s: any) => s.type === 'staff').items.map((i: any) => i.employeeId)).toEqual([M1, M2]);
    // телефон приведён к E.164
    expect(spec['site'].contacts.phone).toBe('+77000000001');
  });

  it('ресторан: меню по разделам, бронь стола, часы после полуночи, оценка из данных', () => {
    const spec = starterSpecFromFacts(food()) as Record<string, any>;
    valid(spec);
    expect(types(spec)).toEqual(['hero', 'features', 'menu', 'leadForm', 'hours', 'faq', 'cta']);
    expect(spec['site'].seo.structuredData).toEqual({ type: 'RESTAURANT', includeAddress: false, includeGeo: false });
    const menu = home(spec).sections.find((s: any) => s.type === 'menu');
    expect(menu.categories.map((c: any) => c.title.ru)).toEqual(['Супы', 'Горячее']);
    expect(menu.categories[0].items[0]).toMatchObject({ itemCode: 'dish-1', weightGrams: 300, price: { minor: '250000', currency: 'KZT' } });
    expect(home(spec).sections.find((s: any) => s.type === 'leadForm').mode).toBe('TABLE_RESERVATION');
    expect(home(spec).sections.find((s: any) => s.type === 'features').items[0].title.ru).toBe('Оценка 4,7 из 5');
    // без телефона и адреса нет ни секции контактов, ни кнопки «Позвонить», ни WhatsApp внизу
    expect(spec['navigation'].mobileBar).toEqual({ book: true, whatsapp: false });
    expect(home(spec).sections[0].secondaryAction).toBeUndefined();
  });

  it('гостиница: номера, цены «от» живые, виджет брони, без часов работы', () => {
    const spec = starterSpecFromFacts(hotel()) as Record<string, any>;
    valid(spec);
    expect(types(spec)).toEqual(['hero', 'accommodations', 'pricing', 'booking', 'faq', 'contacts', 'cta']);
    expect(spec['integrations'].booking.mode).toBe('WETOP_WIDGET');
    expect(JSON.stringify(spec)).not.toMatch(/minor/);
  });

  it('салон без услуг: форма «перезвоните мне», документ всё равно валиден', () => {
    const facts = buildSiteFacts(snapshot());
    const spec = starterSpecFromFacts(facts) as Record<string, any>;
    valid(spec);
    expect(home(spec).sections.find((s: any) => s.type === 'leadForm').mode).toBe('CALLBACK');
    expect(types(spec)).not.toContain('services');
  });

  it('три дизайна дают три валидных документа с разной темой и тем же содержимым', () => {
    const base = starterSpecFromFacts(beauty()) as Record<string, any>;
    const specs = STARTER_DESIGNS.map((d) => starterSpecFromFacts(beauty(), d) as Record<string, any>);
    specs.forEach(valid);
    expect(new Set(specs.map((s) => JSON.stringify(s['theme']))).size).toBe(3);
    for (const s of specs) expect(s['pages']).toEqual(base['pages']);
  });

  it('детерминированно: те же факты, тот же документ', () => {
    expect(JSON.stringify(starterSpecFromFacts(food(), STARTER_DESIGNS[2]))).toBe(JSON.stringify(starterSpecFromFacts(food(), STARTER_DESIGNS[2])));
  });

  it('разметка и шаблоны из данных филиала не ломают документ и не попадают как разметка', () => {
    const facts = beauty();
    facts.location.name = '<script>alert(1)</script> {{x}}';
    facts.catalog.items[0]!.name = '<img src=x onerror=alert(1)>';
    const spec = starterSpecFromFacts(facts);
    valid(spec);
    expect(JSON.stringify(spec)).not.toMatch(/<script|<img|\{\{/);
  });

  it('kk и en: подписи на языке сайта', () => {
    const spec = starterSpecFromFacts(food(), null, { locale: 'kk' }) as Record<string, any>;
    valid(spec);
    expect(spec['site'].locales).toEqual(['kk']);
    expect(home(spec).sections.find((s: any) => s.type === 'menu').heading).toEqual({ kk: 'Мәзір' });
    valid(starterSpecFromFacts(beauty(), null, { locale: 'en' }));
  });
});

describe('buildSiteFacts: подсказки «Дополнить» только по пробелам данных', () => {
  it('салон без всего: адрес не трогаем, если он есть; нет WhatsApp, услуг, мастеров, графика, фото', () => {
    const facts = buildSiteFacts(snapshot());
    expect(facts.gaps.map((g) => g.key)).toEqual(['whatsapp', 'catalog', 'staff', 'hours', 'photos']);
    expect(facts.gaps.find((g) => g.key === 'staff')?.href).toBe('/beauty/masters');
  });

  it('гостиница: часы это заезд и выезд; мастера не просим', () => {
    const facts = hotel();
    expect(facts.gaps.map((g) => g.key)).toEqual(['whatsapp']);
  });

  it('оценка округляется до десятых; ноль оценок это null', () => {
    expect(food().reviews).toEqual({ avg: 4.7, count: 3 });
    expect(buildSiteFacts(snapshot({ reviews: { avg: 0, count: 0 } })).reviews).toBeNull();
  });
});

describe('вспомогательные', () => {
  it('starterPhone: только однозначный E.164', () => {
    expect(starterPhone('+7 (700) 000-00-01')).toBe('+77000000001');
    expect(starterPhone('8 700 000 00 01')).toBeNull();
    expect(starterPhone(null)).toBeNull();
  });
  it('starterText: обрезка с многоточием, пустое null', () => {
    expect(starterText('  ', 10)).toBeNull();
    expect(starterText('абвгдежзийк', 5)).toBe('абвг…');
  });
  it('siteFactsFromBrief: тот же каталог из брифа генерации', () => {
    const facts = siteFactsFromBrief({
      identity: { displayNameCandidate: 'Кафе', displayNameSource: 'PLATFORM', locationName: 'Кафе', propertyName: null, address: null, addressSource: null, city: null, countryCode: null, propertyType: null, timezone: 'Asia/Almaty', currency: 'KZT', phone: null, phoneSource: null, email: null, emailSource: null },
      stay: { checkInTime: null, checkOutTime: null },
      accommodations: [],
      capabilities: { booking: false, fromPrice: false },
      sellerContent: null,
      channelContent: null,
      vertical: 'FOOD_SERVICE',
      menu: [{ title: 'Супы', items: [{ code: 'd1', name: 'Борщ', weightGrams: null, priceMinor: '100', currency: 'KZT', hasPhoto: false }] }],
      hours: [],
    });
    expect(facts.catalog).toEqual({ kind: 'menu', items: [{ code: 'd1', name: 'Борщ', price: { minor: '100', currency: 'KZT' }, category: 'Супы', hasPhoto: false }] });
    valid(starterSpecFromFacts(facts));
  });
});
