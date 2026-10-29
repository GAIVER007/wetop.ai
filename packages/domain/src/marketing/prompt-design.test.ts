import { describe, expect, it } from 'vitest';
import {
  buildSiteFacts,
  promptMoods,
  promptSiteSpec,
  sitePromptDesign,
  validateSiteSpec,
  type SiteFactsSnapshot,
  type SiteFactsVertical,
} from './index';

/**
 * Владелец 29.10.2026: «сто клиентов, а всего три шаблона: у всех клиентов одинаковые сайты. Переверни логику
 * генерации сайтов полностью по промту: человек пишет промт, на его основе создаётся сайт, сразу с SEO и GEO».
 */
type Rec = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const loc = (n: number) => `0b0e6a1c-0000-4000-8000-${String(n).padStart(12, '0')}`;
const facts = (vertical: SiteFactsVertical, n = 1) =>
  buildSiteFacts({
    vertical,
    location: { id: loc(n), name: `Филиал ${n}`, address: 'Доха, West Bay, 1', phone: '+974 5000 0001', whatsapp: null, city: 'Доха' },
    catalog:
      vertical === 'BEAUTY'
        ? { kind: 'services', items: [{ code: 'svc-1', name: 'Маникюр', price: { minor: '15000', currency: 'QAR' }, durationMin: 60 }, { code: 'svc-2', name: 'Брови', price: { minor: '8000', currency: 'QAR' }, durationMin: 30 }] }
        : vertical === 'FOOD_SERVICE'
          ? { kind: 'menu', items: [{ code: 'dish-1', name: 'Плов', price: { minor: '4500', currency: 'QAR' }, category: 'Горячее' }] }
          : { kind: 'rooms', items: [{ code: 'std', name: 'Стандарт', capacityAdults: 2 }] },
    staff: vertical === 'BEAUTY' ? [{ id: loc(900 + n), name: 'Мастер А', specialization: 'Маникюр' }] : [],
    hours: { days: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, open: '10:00', close: '21:00' })), checkInTime: vertical === 'HOSPITALITY' ? '14:00' : null, checkOutTime: vertical === 'HOSPITALITY' ? '12:00' : null },
    photosCount: 0,
    reviews: null,
  } as SiteFactsSnapshot);
const look = (s: Rec) => JSON.stringify([s['theme'], s['pages'][0].sections.map((x: Rec) => `${x.type}:${x.variant}`)]);
const PROMPTS = [
  'Тёмный премиальный салон, золото, акцент на мастеров',
  'Яркий молодёжный сайт, розовый, быстрая онлайн запись',
  'Спокойный уютный сайт в эко стиле, натуральные материалы',
  'Строгий минимализм, современно',
  'Семейное место у моря, тёплое и солнечное',
  'Classic elegant boutique',
  '',
];

describe('сайт по промту: свой дизайн у каждого', () => {
  for (const vertical of ['BEAUTY', 'HOSPITALITY', 'FOOD_SERVICE'] as const) {
    it(`${vertical}: каждый промт даёт сайт, который проходит проверку SiteSpec`, () => {
      for (const prompt of PROMPTS)
        for (const n of [1, 2, 3]) {
          const checked = validateSiteSpec(promptSiteSpec(facts(vertical, n), prompt));
          expect(checked.ok, `${prompt} #${n}: ${checked.ok ? '' : checked.errors.join('; ')}`).toBe(true);
        }
    });
  }

  it('сто салонов с одним и тем же коротким промтом: не меньше 30 разных сайтов (шаблонов было три)', () => {
    const looks = new Set(Array.from({ length: 100 }, (_, i) => look(promptSiteSpec(facts('BEAUTY', i + 1), 'Красивый сайт для салона'))));
    expect(looks.size).toBeGreaterThanOrEqual(30);
  });

  it('у одного филиала разные промты дают разные сайты', () => {
    const looks = new Set(PROMPTS.map((p) => look(promptSiteSpec(facts('BEAUTY'), p))));
    expect(looks.size).toBe(PROMPTS.length);
  });

  it('тот же промт у того же филиала: тот же сайт (превью равно сохранённому)', () => {
    expect(look(promptSiteSpec(facts('BEAUTY'), PROMPTS[0]!))).toBe(look(promptSiteSpec(facts('BEAUTY'), PROMPTS[0]!)));
  });

  it('промт решает характер: тёмный премиум, яркий поп, эко, минимал', () => {
    const t = (p: string) => sitePromptDesign(p, 'BEAUTY', loc(1)).direction.theme;
    expect(t('Тёмный премиальный салон, золото')).toMatchObject({ preset: 'NOIR', colorScheme: 'DARK', accent: 'CHAMPAGNE' });
    expect(t('Яркий молодёжный, розовый')).toMatchObject({ preset: 'PEACH', accent: 'FUCHSIA', typography: 'BOLD', colorScheme: 'LIGHT' });
    expect(t('Натуральный эко стиль')).toMatchObject({ colorScheme: 'LIGHT' });
    expect(['SAGE', 'CALM']).toContain(t('Натуральный эко стиль').preset);
    expect(t('Строгий минимализм')).toMatchObject({ typography: 'CLEAN', radius: 'SHARP', accent: 'GRAPHITE' });
    expect(t('Dark luxury salon')).toMatchObject({ colorScheme: 'DARK' });
    expect(t('Жарқын жастар салоны')).toMatchObject({ typography: 'BOLD' });
  });

  it('«быстрая запись» ставит форму записи сразу под первым экраном; «мастера» ставят команду первой', () => {
    const order = (p: string) => sitePromptDesign(p, 'BEAUTY', loc(1)).direction.sectionOrder;
    expect(order('Быстрая онлайн запись').slice(0, 2)).toEqual(['hero', 'leadForm']);
    expect(order('Покажите наших мастеров').slice(0, 2)).toEqual(['hero', 'staff']);
  });

  it('данные филиала не выдумываются: услуги и цены ровно из фактов, SEO и FAQ на месте', () => {
    const s = promptSiteSpec(facts('BEAUTY'), 'Тёмный премиальный салон') as Rec;
    const home = s['pages'][0];
    const services = home.sections.find((x: Rec) => x.type === 'services');
    expect(services.items.map((i: Rec) => i.serviceCode)).toEqual(['svc-1', 'svc-2']);
    expect(home.seo.title.ru).toContain('Филиал 1');
    expect(home.sections.some((x: Rec) => x.type === 'faq')).toBe(true);
  });

  it('настроения промта читаются на трёх языках', () => {
    expect(promptMoods('Тёмный и премиальный')).toEqual(expect.arrayContaining(['dark', 'luxury']));
    expect(promptMoods('bright young pop')).toEqual(expect.arrayContaining(['bright']));
    expect(promptMoods('табиғи жайлы')).toEqual(expect.arrayContaining(['natural', 'calm']));
  });
});
