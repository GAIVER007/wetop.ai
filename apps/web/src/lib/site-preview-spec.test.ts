import { describe, expect, it } from 'vitest';
import { DESIGN_PRESETS, designPresetDirection, validateSiteSpec } from '@pms/domain';
import { renderDraftPreview } from '../../../sites/src/draft-preview';
import type { SiteFacts } from './site-facts';
import { inertPreviewHtml, previewSpec } from './site-preview-spec';

/** SITE-1: мини-превью дизайна это настоящий документ SiteSpec, тот же рендер, что у сайта, без ИИ */
const facts = (patch: Partial<SiteFacts> = {}): SiteFacts => ({
  vertical: 'BEAUTY',
  location: { id: 'l', name: 'Студия Айна', address: 'пр. Абая, 1', phone: null, whatsapp: null, city: 'Алматы' },
  catalog: {
    kind: 'services',
    items: [
      { name: 'Маникюр', price: '900000', durationMin: 75 },
      { name: 'Педикюр', price: '1200000' },
      { name: 'Брови', durationMin: 30 },
      { name: 'Четвёртая', price: '100' },
    ],
  },
  staff: [],
  hours: null,
  photosCount: 0,
  reviews: null,
  gaps: [],
  ...patch,
});

describe('previewSpec', () => {
  it('каждое направление даёт валидный документ с темой направления', () => {
    for (const p of DESIGN_PRESETS) {
      const spec = previewSpec(facts(), designPresetDirection(p));
      const checked = validateSiteSpec(spec);
      expect(checked.ok, `${p.id}: ${JSON.stringify(!checked.ok && checked.errors)}`).toBe(true);
      expect(spec['theme']).toEqual(p.theme);
    }
  });

  it('рендер: название, город, кнопка направления и три первые позиции с ценой в тенге', () => {
    const r = renderDraftPreview({ spec: previewSpec(facts(), designPresetDirection(DESIGN_PRESETS[0]!)), pageId: null, locale: 'ru', assets: {} });
    if (!r.ok) throw new Error('рендер');
    expect(r.html).toContain('Студия Айна');
    expect(r.html).toContain('Алматы');
    expect(r.html).toContain('Записаться');
    expect(r.html).toContain('9 000 ₸');
    expect(r.html).toContain('30 мин');
    expect(r.html).not.toContain('Четвёртая');
  });

  it('пустой каталог и одна позиция тоже валидны; гостиница с ценой «от»', () => {
    const d = designPresetDirection(DESIGN_PRESETS[3]!);
    expect(validateSiteSpec(previewSpec(facts({ catalog: { kind: 'services', items: [] } }), d)).ok).toBe(true);
    expect(validateSiteSpec(previewSpec(facts({ catalog: { kind: 'menu', items: [{ name: 'Плов', price: 300000 }] }, vertical: 'FOOD_SERVICE' }), d)).ok).toBe(true);
    const hotel = previewSpec(facts({ vertical: 'HOSPITALITY', catalog: { kind: 'rooms', items: [{ name: 'Стандарт', priceFrom: '1850000' }, { name: 'Койка' }] } }), d);
    const r = renderDraftPreview({ spec: hotel, pageId: null, locale: 'ru', assets: {} });
    expect(r.ok && r.html).toContain('от 18 500 ₸');
    expect(r.ok && r.html).toContain('Забронировать');
  });

  it('inertPreviewHtml: ни одной ссылки, класс кнопки сохранён', () => {
    const r = renderDraftPreview({ spec: previewSpec(facts(), designPresetDirection(DESIGN_PRESETS[0]!)), pageId: null, locale: 'ru', assets: {} });
    if (!r.ok) throw new Error('рендер');
    const html = inertPreviewHtml(r.html);
    expect(html).not.toMatch(/<a[\s>]/);
    expect(html).toContain('<span class="btn"');
    // в превью нет строки «бронирование недоступно»: её прячет стиль карточки
    expect(html).toContain('#sec-booking p,#sec-booking .btn{display:none}');
  });
});
