import { describe, expect, it } from 'vitest';
import { siteTemplatesFor, validateSiteSpec, type SiteFacts } from '@pms/domain';
import { renderDraftPreview } from '../../../sites/src/draft-preview';
import { inertPreviewHtml, previewSpec } from './site-preview-spec';

/** SITE-1: мини-превью шаблона это ровно сайт, который создаст сервер, тем же рендером, что у сайта, без ИИ */
const kzt = (minor: string) => ({ minor, currency: 'KZT' });
const facts = (patch: Partial<SiteFacts> = {}): SiteFacts => ({
  vertical: 'BEAUTY',
  location: { id: 'l', name: 'Студия Айна', address: 'пр. Абая, 1', phone: '+77010000000', whatsapp: null, city: 'Алматы' },
  catalog: {
    kind: 'services',
    items: [
      { code: 's1', name: 'Маникюр', price: kzt('900000'), durationMin: 75 },
      { code: 's2', name: 'Педикюр', price: kzt('1200000'), durationMin: 90 },
    ],
  },
  staff: [{ id: '0b0e6a1c-0000-4000-8000-0000000000a1', name: 'Айгерим', specialization: null }],
  hours: { days: [{ weekday: 1, open: '10:00', close: '20:00' }], checkInTime: null, checkOutTime: null },
  photosCount: 0,
  reviews: null,
  gaps: [],
  ...patch,
});
const food = () =>
  facts({
    vertical: 'FOOD_SERVICE',
    catalog: { kind: 'menu', items: [{ code: 'd1', name: 'Бешбармак', price: kzt('450000'), category: 'Горячее' }] },
    staff: [],
  });
const hotel = () =>
  facts({
    vertical: 'HOSPITALITY',
    catalog: { kind: 'rooms', items: [{ code: 'std', name: 'Стандарт', priceFrom: kzt('1850000'), capacityAdults: 2 }] },
    staff: [],
    hours: { days: [], checkInTime: '14:00', checkOutTime: '12:00' },
  });

const render = (spec: Record<string, unknown>) => {
  const r = renderDraftPreview({ spec, pageId: null, locale: 'ru', assets: {} });
  if (!r.ok) throw new Error('рендер');
  return r.html;
};

describe('previewSpec: превью шаблона сегмента', () => {
  it('каждый шаблон каждого сегмента даёт валидный документ без индексации', () => {
    for (const [v, f] of [['BEAUTY', facts()], ['FOOD_SERVICE', food()], ['HOSPITALITY', hotel()]] as const)
      for (const tpl of siteTemplatesFor(v)) {
        const spec = previewSpec(f, tpl.id)!;
        const checked = validateSiteSpec(spec);
        expect(checked.ok ? [] : checked.errors, tpl.id).toEqual([]);
        expect((spec['site'] as { seo: { robots: string } }).seo.robots).toBe('NOINDEX');
      }
  });

  it('рендер салона: название, услуги с ценой в тенге, мастер, кнопка записи', () => {
    const html = render(previewSpec(facts(), 'beauty-studio')!);
    expect(html).toContain('Студия Айна');
    expect(html).toContain('Маникюр');
    expect(html).toMatch(/9[\s\u00a0\u202f]000/);
    expect(html).toContain('Айгерим');
    expect(html).toContain('Записаться');
  });

  it('ресторан и гостиница: блюдо и номер из данных', () => {
    expect(render(previewSpec(food(), 'food-cafe')!)).toContain('Бешбармак');
    expect(render(previewSpec(hotel(), 'hotel-classic')!)).toContain('Стандарт');
  });

  it('шаблон чужого сегмента: превью нет', () => {
    expect(previewSpec(facts(), 'food-cafe')).toBeNull();
  });

  it('inertPreviewHtml: ни ссылок, ни скриптов, ни полей формы; класс кнопки сохранён', () => {
    const html = inertPreviewHtml(render(previewSpec(facts(), 'beauty-express')!));
    expect(html).not.toMatch(/<a\b/);
    expect(html).not.toMatch(/<script\b/);
    expect(html).not.toMatch(/<(input|select|textarea|button)\b/);
    expect(html).toContain('class="btn');
  });
});
