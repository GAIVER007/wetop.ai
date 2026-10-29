import { describe, expect, it } from 'vitest';
import { buildSiteFacts, liveSiteSpec, starterSpecFromFacts, templateSiteSpec, siteTemplatesFor, validateSiteSpec, type SiteFactsSnapshot } from './index';

/**
 * SEO и GEO сразу при создании сайта (поручение владельца 28.10.2026, аудит «Сайт и SEO» S7): из данных WETOP
 * без ручной работы собираются заголовок с видом бизнеса и городом, описание с услугами или меню, и блок «Вопросы и
 * ответы» с разметкой FAQ для Google и ИИ-поисковиков. Только факты филиала, ничего не выдумывается.
 */
type Rec = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const LOC = '0b0e6a1c-0000-4000-8000-000000000001';
const M1 = '0b0e6a1c-0000-4000-8000-0000000000a1';
const base = (patch: Partial<SiteFactsSnapshot>): SiteFactsSnapshot => ({
  vertical: 'BEAUTY',
  location: { id: LOC, name: 'Студия Тест', address: 'Доха, West Bay, 1', phone: '+974 5000 0001', whatsapp: null, city: null },
  catalog: { kind: 'services', items: [] },
  staff: [],
  hours: { days: [], checkInTime: null, checkOutTime: null },
  photosCount: 0,
  reviews: null,
  ...patch,
});
const beauty = () =>
  buildSiteFacts(
    base({
      catalog: {
        kind: 'services',
        items: [
          { code: 'svc-1', name: 'Маникюр', price: { minor: '15000', currency: 'QAR' }, durationMin: 60 },
          { code: 'svc-2', name: 'Брови', price: { minor: '8000', currency: 'QAR' }, durationMin: 30 },
        ],
      },
      staff: [{ id: M1, name: 'Мастер А', specialization: 'Маникюр' }],
      hours: { days: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, open: '10:00', close: '21:00' })), checkInTime: null, checkOutTime: null },
    }),
  );
const food = () =>
  buildSiteFacts(
    base({
      vertical: 'FOOD_SERVICE',
      location: { id: LOC, name: 'Кафе Пример', address: null, phone: null, whatsapp: null, city: null },
      catalog: { kind: 'menu', items: [{ code: 'dish-1', name: 'Плов', price: { minor: '4500', currency: 'QAR' }, category: 'Горячее' }] },
      hours: { days: [{ weekday: 5, open: '12:00', close: '23:00' }], checkInTime: null, checkOutTime: null },
    }),
  );
const hotel = () =>
  buildSiteFacts(
    base({
      vertical: 'HOSPITALITY',
      location: { id: LOC, name: 'Отель Тест', address: 'Доха, Corniche, 5', phone: '+974 5000 0003', whatsapp: null, city: 'Доха' },
      catalog: { kind: 'rooms', items: [{ code: 'std', name: 'Стандарт', capacityAdults: 2 }] },
      hours: { days: [], checkInTime: '14:00', checkOutTime: '12:00' },
    }),
  );
const home = (s: Rec) => s['pages'][0];
const faq = (s: Rec) => home(s).sections.find((x: Rec) => x.type === 'faq');

describe('SEO при создании сайта: заголовок и описание из данных', () => {
  it('салон: в заголовке вид бизнеса, в описании услуги, адрес и запись онлайн', () => {
    const s = starterSpecFromFacts(beauty()) as Rec;
    expect(home(s).seo.title.ru).toBe('Студия Тест: салон красоты');
    const d: string = home(s).seo.description.ru;
    expect(d).toContain('Маникюр');
    expect(d).toContain('Брови');
    expect(d).toContain('West Bay');
    expect(d).toMatch(/онлайн/);
    expect([...d].length).toBeLessThanOrEqual(160);
  });
  it('гостиница: город в заголовке, заезд и выезд в описании', () => {
    const s = starterSpecFromFacts(hotel()) as Rec;
    expect(home(s).seo.title.ru).toBe('Отель Тест: гостиница, Доха');
    expect(home(s).seo.description.ru).toContain('14:00');
  });
  it('ресторан без адреса: описание без пустых мест, с меню и бронью стола', () => {
    const d: string = home(starterSpecFromFacts(food()) as Rec).seo.description.ru;
    expect(d).toContain('Плов');
    expect(d).not.toMatch(/ ,|null|undefined|\.\./);
  });
  it('длинное имя: заголовок не длиннее 60 знаков', () => {
    const f = beauty();
    f.location.name = 'Очень длинное название салона красоты для проверки лимита заголовка';
    expect([...(home(starterSpecFromFacts(f) as Rec).seo.title.ru as string)].length).toBeLessThanOrEqual(60);
  });
});

describe('GEO: «Вопросы и ответы» из фактов с разметкой FAQ', () => {
  it('салон: как записаться, цены, часы, где находимся; разметка FAQ включена', () => {
    const s = starterSpecFromFacts(beauty()) as Rec;
    const f = faq(s);
    expect(f.emitStructuredData).toBe(true);
    const qa = f.items.map((i: Rec) => `${i.question.ru} ${i.answer.ru}`).join('\n');
    expect(qa).toMatch(/записаться/i);
    expect(qa).toContain('150 QAR');
    expect(qa).toContain('10:00');
    expect(qa).toContain('West Bay');
  });
  it('гостиница: заезд и выезд в ответах', () => {
    const qa = faq(starterSpecFromFacts(hotel()) as Rec).items.map((i: Rec) => i.answer.ru).join('\n');
    expect(qa).toContain('14:00');
    expect(qa).toContain('12:00');
  });
  it('без адреса нет вопроса «где вы находитесь»', () => {
    const qs = faq(starterSpecFromFacts(food()) as Rec).items.map((i: Rec) => i.question.ru).join('\n');
    expect(qs).not.toMatch(/находит/i);
  });
  it('все шаблоны всех направлений с вопросами проходят валидатор, блок вопросов перед контактами или в конце', () => {
    for (const [facts, v] of [[beauty(), 'BEAUTY'], [food(), 'FOOD_SERVICE'], [hotel(), 'HOSPITALITY']] as const)
      for (const tpl of siteTemplatesFor(v)) {
        const s = templateSiteSpec(facts, tpl.id) as Rec;
        const r = validateSiteSpec(s);
        expect(r.ok ? [] : r.errors).toEqual([]);
        const types: string[] = home(s).sections.map((x: Rec) => x.type);
        expect(types).toContain('faq');
        expect(types.indexOf('faq')).toBeLessThan(types.indexOf('cta'));
      }
  });
});

describe('вопросы и ответы следуют за WETOP', () => {
  it('цена поменялась в WETOP: ответ о ценах на сайте новый без публикации', () => {
    const s = starterSpecFromFacts(beauty()) as Rec;
    const f = beauty();
    f.catalog.items[0]!.price = { minor: '18000', currency: 'QAR' };
    const live = liveSiteSpec(s, f) as Rec;
    const qa = faq(live).items.map((i: Rec) => i.answer.ru).join('\n');
    expect(qa).toContain('180 QAR');
    expect(qa).not.toContain('150 QAR');
  });
  it('владелец переписал вопрос: блок владельца не трогаем', () => {
    const s = starterSpecFromFacts(beauty()) as Rec;
    faq(s).items[0].question.ru = 'Свой вопрос владельца';
    const f = beauty();
    f.catalog.items[0]!.price = { minor: '18000', currency: 'QAR' };
    expect(faq(liveSiteSpec(s, f) as Rec).items[0].question.ru).toBe('Свой вопрос владельца');
    expect(faq(liveSiteSpec(s, f) as Rec).items.map((i: Rec) => i.answer.ru).join('\n')).toContain('150 QAR');
  });
});
