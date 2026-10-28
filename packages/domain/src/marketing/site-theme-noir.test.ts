import { describe, expect, it } from 'vitest';
import { buildSiteFacts, siteTemplateById, templateSiteSpec, validateSiteSpec, type SiteFactsSnapshot } from './index';

/**
 * Богатый набор оформления, пилот «А · Тёмная роскошь» (владелец 28.10.2026: «100 бизнесов, и у всех одинаковый
 * сайт»). Тёмная схема `DARK` с фоном `NOIR`, светлые акценты для тёмного фона и шрифтовая пара `LUXE`. Схема и
 * акцент согласованы валидатором: тёмный акцент на тёмном фоне нечитаем, светлый на светлом тоже.
 */
type Rec = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const snap: SiteFactsSnapshot = {
  vertical: 'BEAUTY',
  location: { id: '0b0e6a1c-0000-4000-8000-000000000001', name: 'Студия Тест', address: 'Доха, West Bay, 1', phone: '+974 5000 0001', whatsapp: null, city: null },
  catalog: { kind: 'services', items: [{ code: 'svc-1', name: 'Маникюр', price: { minor: '15000', currency: 'QAR' }, durationMin: 60 }] },
  staff: [],
  hours: { days: [], checkInTime: null, checkOutTime: null },
  photosCount: 0,
  reviews: null,
};
const base = () => templateSiteSpec(buildSiteFacts(structuredClone(snap)), 'beauty-studio') as Rec;
const errors = (s: unknown) => {
  const r = validateSiteSpec(s);
  return r.ok ? [] : r.errors.map((e) => `${e.path}:${e.code}`);
};
const noir = { preset: 'NOIR', accent: 'CHAMPAGNE', typography: 'LUXE', radius: 'SHARP', density: 'COMFORTABLE', colorScheme: 'DARK' };

describe('тёмная схема и светлые акценты', () => {
  it('NOIR + DARK + CHAMPAGNE + LUXE: документ валиден', () => {
    const s = base();
    s['theme'] = noir;
    expect(errors(s)).toEqual([]);
  });
  it('ROSE тоже светлый акцент тёмной схемы', () => {
    const s = base();
    s['theme'] = { ...noir, accent: 'ROSE' };
    expect(errors(s)).toEqual([]);
  });
  it('NOIR со светлой схемой: отказ', () => {
    const s = base();
    s['theme'] = { ...noir, colorScheme: 'LIGHT' };
    expect(errors(s)).toContain('theme.colorScheme:theme_scheme');
  });
  it('тёмный акцент на тёмном фоне и светлый на светлом: отказ', () => {
    const a = base();
    a['theme'] = { ...noir, accent: 'TEAL' };
    expect(errors(a)).toContain('theme.accent:theme_accent');
    const b = base();
    b['theme'] = { ...(b['theme'] as Rec), accent: 'CHAMPAGNE' };
    expect(errors(b)).toContain('theme.accent:theme_accent');
  });
  it('шрифт LUXE годится и светлой схеме', () => {
    const s = base();
    s['theme'] = { ...(s['theme'] as Rec), typography: 'LUXE' };
    expect(errors(s)).toEqual([]);
  });
});

describe('шаблон «Бьюти-бутик» теперь тёмная роскошь', () => {
  it('тема NOIR, первый экран на весь экран, документ валиден', () => {
    expect(siteTemplateById('beauty-boutique')!.direction.theme).toEqual(noir);
    const s = templateSiteSpec(buildSiteFacts(structuredClone(snap)), 'beauty-boutique') as Rec;
    expect(errors(s)).toEqual([]);
    expect(s['theme']).toEqual(noir);
  });
});
