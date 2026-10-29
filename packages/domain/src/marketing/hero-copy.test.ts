import { describe, expect, it } from 'vitest';
import { buildSiteFacts, type SiteFactsSnapshot } from './site-facts';
import { HERO_COPY_COUNT, heroCopy, heroTone } from './hero-copy';
import { siteCopySuggestion } from './site-copy';
import { templateSiteSpec } from './site-templates';
import { validateSiteSpec } from './site-spec';

/**
 * Первый экран сайта (владелец 28.10.2026): вместо названия филиала крупная продающая фраза под стиль шаблона и то,
 * чем занимается бизнес, подзаголовок из фактов (услуги, город, запись). Ничего не выдумываем: ни стажа, ни скидок,
 * ни отзывов, ни «лучших цен», ни скорости подтверждения.
 */
type Rec = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const snap = (over: Partial<SiteFactsSnapshot> = {}): SiteFactsSnapshot => ({
  vertical: 'BEAUTY',
  location: { id: '0b0e6a1c-0000-4000-8000-000000000001', name: 'Lashes Studio', address: 'West Bay, 1', phone: '+97450000001', whatsapp: null, city: 'Доха' },
  catalog: {
    kind: 'services',
    items: [
      { code: 's1', name: 'Наращивание ресниц', price: { minor: '25000', currency: 'QAR' }, durationMin: 120, category: 'Ресницы' },
      { code: 's2', name: 'Коррекция бровей', price: { minor: '8000', currency: 'QAR' }, durationMin: 40, category: 'Брови' },
    ],
  },
  staff: [],
  hours: { days: [], checkInTime: null, checkOutTime: null },
  photosCount: 0,
  reviews: null,
  ...over,
});
const hotel = () =>
  snap({ vertical: 'HOSPITALITY', location: { ...snap().location, name: 'Pearl Bay Hotel' }, catalog: { kind: 'rooms', items: [{ code: 'STD', name: 'Стандарт', capacityAdults: 2 }, { code: 'DLX', name: 'Делюкс', capacityAdults: 2 }] } });
const food = () =>
  snap({
    vertical: 'FOOD_SERVICE',
    location: { ...snap().location, name: 'Saffron House' },
    catalog: { kind: 'menu', items: [
      { code: 'm1', name: 'Хумус', price: { minor: '3200', currency: 'QAR' }, category: 'Закуски' },
      { code: 'm2', name: 'Ягнёнок', price: { minor: '9500', currency: 'QAR' }, category: 'Горячее' },
      { code: 'm3', name: 'Кунафа', price: { minor: '2800', currency: 'QAR' }, category: 'Десерты' } ] },
  });
const hero = (s: Rec) => s['pages'][0]['sections'].find((x: Rec) => x['type'] === 'hero');
const INVENTED = /опыт|лет\b|скидк|%|лучш|гарант|мгновенн|отзыв|рейтинг|№\s?1|самы[йе]/i;

describe('фраза первого экрана', () => {
  it('ресницы и брови в тёмной роскоши: про взгляд; подзаголовок: название, услуги и город (название в первом экране нужно SEO и GEO)', () => {
    const c = heroCopy(buildSiteFacts(snap()), 'LUXE', 0, 'ru');
    expect(c.heading).toBe('Взгляд, который запоминают');
    expect(c.subheading).toBe('Lashes Studio, Доха: ресницы и брови от 80\u00a0QAR, от 40 минут. Запись онлайн за минуту, без звонков.');
  });
  it('три тона дают разные фразы, варианты идут по кругу', () => {
    const f = buildSiteFacts(food());
    const h = (['LUXE', 'BOLD', 'CLEAN'] as const).map((t) => heroCopy(f, t, 0, 'ru').heading);
    expect(new Set(h).size).toBe(3);
    expect(heroCopy(f, 'BOLD', HERO_COPY_COUNT, 'ru')).toEqual(heroCopy(f, 'BOLD', 0, 'ru'));
  });
  it('ресторан и гостиница: разделы меню и типы номеров в подзаголовке', () => {
    expect(heroCopy(buildSiteFacts(food()), 'CLEAN', 0, 'ru').subheading).toContain('Saffron House, Доха: закуски, горячее и десерты');
    expect(heroCopy(buildSiteFacts(hotel()), 'CLEAN', 0, 'ru').subheading).toContain('Pearl Bay Hotel, Доха: Стандарт и Делюкс');
  });
  it('без города и без каталога подзаголовок всё равно осмысленный', () => {
    const f = buildSiteFacts(snap({ location: { ...snap().location, city: null }, catalog: { kind: 'services', items: [] } }));
    expect(heroCopy(f, 'BOLD', 0, 'ru').subheading).toBe('Lashes Studio. Запись онлайн за минуту, без звонков.');
  });
  it('ни одной выдумки и в пределах полей, на всех языках и тонах', () => {
    for (const s of [snap(), hotel(), food()])
      for (const tone of ['LUXE', 'BOLD', 'CLEAN'] as const)
        for (const l of ['ru', 'kk', 'en'] as const)
          for (let i = 0; i < HERO_COPY_COUNT; i += 1) {
            const c = heroCopy(buildSiteFacts(s), tone, i, l);
            expect(c.heading).not.toMatch(INVENTED);
            expect(c.subheading).not.toMatch(INVENTED);
            expect(c.heading.length).toBeLessThanOrEqual(60);
            expect(c.subheading.length).toBeLessThanOrEqual(200);
            expect(c.heading + c.subheading).not.toContain('\u2014');
          }
  });
  it('тон по шрифту темы', () => {
    expect(heroTone('LUXE')).toBe('LUXE');
    expect(heroTone('BOLD')).toBe('BOLD');
    expect(heroTone('MODERN')).toBe('CLEAN');
  });
});

describe('новый сайт по шаблону сразу с фразой', () => {
  it('«Бьюти-бутик»: заголовок фраза, а не название; документ валиден', () => {
    const s = templateSiteSpec(buildSiteFacts(snap()), 'beauty-boutique') as Rec;
    expect(hero(s)['heading']).toEqual({ ru: 'Взгляд, который запоминают' });
    expect(validateSiteSpec(s).ok).toBe(true);
  });
  it('гостиница и ресторан тоже', () => {
    expect(hero(templateSiteSpec(buildSiteFacts(hotel()), 'hotel-hostel') as Rec)['heading']['ru']).not.toBe('Pearl Bay Hotel');
    expect(hero(templateSiteSpec(buildSiteFacts(food()), 'food-restaurant') as Rec)['heading']['ru']).not.toBe('Saffron House');
  });
});

describe('«Предложить текст» без выдумок', () => {
  it('с фактами берёт фразу первого экрана; «О нас» без стажа, скидок и обещаний', () => {
    const f = buildSiteFacts(snap());
    const c = siteCopySuggestion('BEAUTY', 0, 'Lashes Studio', f, 'LUXE');
    expect(c.heading).toBe('Взгляд, который запоминают');
    for (const v of ['BEAUTY', 'HOSPITALITY', 'FOOD_SERVICE'] as const)
      for (let i = 0; i < 3; i += 1) {
        const x = siteCopySuggestion(v, i, 'Тест');
        expect(`${x.heading} ${x.subheading} ${x.about}`).not.toMatch(INVENTED);
        expect(x.about).not.toMatch(/стерил|косметик|чай|кофе|трансфер|круглосуточн|ранний заезд|свеж|заготов|минута в минуту|годами|неделями/i);
      }
  });
});

/**
 * Владелец 29.10.2026: «офферы в стиле Брансона или Хормози, цепляющие заголовки, на первом экране всё чётко». По
 * уравнению ценности Хормози: желанный результат в заголовке, под ним стопка конкретики из данных филиала (цена «от»,
 * сколько длится, сколько мастеров, номера и гости, разделы меню), лёгкость (запись онлайн без звонков) и
 * доказательство только из настоящей оценки. Ничего не выдумываем: ни стажа, ни скидок, ни гарантий.
 */
describe('оффер первого экрана: результат, конкретика из данных, лёгкость, доказательство', () => {
  it('салон: цена «от» и время из услуг, мастера, запись без звонков', () => {
    const f = buildSiteFacts(snap({ staff: [{ id: 'a', name: 'Alina', specialization: null }, { id: 'b', name: 'Aliia', specialization: null }] }));
    const c = heroCopy(f, 'LUXE', 0, 'ru');
    expect(c.heading).toBe('Взгляд, который запоминают');
    expect(c.subheading).toBe('Lashes Studio, Доха: ресницы и брови от 80\u00a0QAR, от 40 минут, 2 мастера. Запись онлайн за минуту, без звонков.');
  });
  it('настоящая оценка становится доказательством; без оценки слова «отзыв» нет', () => {
    const f = buildSiteFacts(snap({ reviews: { avg: 4.9, count: 127 } }));
    expect(heroCopy(f, 'BOLD', 0, 'ru').subheading).toContain('4,9 из 5 по 127 оценкам');
    expect(heroCopy(buildSiteFacts(snap()), 'BOLD', 0, 'ru').subheading).not.toMatch(/оценк|отзыв/);
  });
  it('ресторан: меню и цены блюд «от», бронь стола онлайн', () => {
    expect(heroCopy(buildSiteFacts(food()), 'CLEAN', 0, 'ru').subheading).toBe('Saffron House, Доха: закуски, горячее и десерты, блюда от 28\u00a0QAR. Стол онлайн за минуту, без звонков.');
  });
  it('гостиница: типы номеров и сколько гостей, бронь напрямую без комиссий площадок', () => {
    expect(heroCopy(buildSiteFacts(hotel()), 'CLEAN', 0, 'ru').subheading).toBe('Pearl Bay Hotel, Доха: Стандарт и Делюкс, до 2 гостей в номере. Бронь напрямую на сайте, без посредников.');
  });
  it('английский и казахский тоже конкретны', () => {
    const f = buildSiteFacts(snap());
    expect(heroCopy(f, 'CLEAN', 0, 'en').subheading).toBe('Lashes Studio, Доха: ресницы and брови from 80\u00a0QAR, from 40 min. Book online in a minute, no calls.');
    expect(heroCopy(f, 'CLEAN', 0, 'kk').subheading).toContain('80\u00a0QAR');
  });
  it('заголовки это результат для клиента, а не настроение: в каждом тоне и направлении', () => {
    for (const s of [snap(), hotel(), food()])
      for (const tone of ['LUXE', 'BOLD', 'CLEAN'] as const) {
        const h = heroCopy(buildSiteFacts(s), tone, 0, 'ru').heading;
        expect(h).not.toMatch(/^(Спокойный уход|Простая еда|Просто и уютно)/);
      }
  });
});
