/* eslint-disable @typescript-eslint/no-explicit-any -- тест читает документ по путям */
import { describe, expect, it } from 'vitest';
import { buildSiteFacts, type SiteFacts } from './site-facts';
import { siteTemplatesFor, templateSiteSpec } from './site-templates';
import { validateSiteSpec } from './site-spec';
import {
  SIMPLE_BLOCKS,
  setAboutText,
  setGalleryPhotos,
  setHeroPhoto,
  setHeroText,
  simpleSiteState,
  toggleSiteBlock,
} from './simple-edit';

/**
 * Простой экран сайта (SITE-1, решение владельца 15.10.2026): клиент делает пять вещей: шаблон, фото, 2–3 текста,
 * включает и выключает блоки, публикует. Каждая правка даёт верный документ, лишнего не выдумывает
 */
const STAFF = '0b0e6a1c-0000-4000-8000-0000000000a1';
const PHOTO = (n: number) => ({ assetId: `0b0e6a1c-0000-4000-8000-00000000f00${n}`, alt: { ru: `Фото ${n}` } });
const facts: SiteFacts = buildSiteFacts({
  vertical: 'BEAUTY',
  location: { id: 'loc', name: 'Студия Айна', address: 'Алматы, Абая, 150', phone: '+7 700 000 00 01', whatsapp: null, city: null },
  catalog: { kind: 'services', items: [{ code: 'svc-1', name: 'Маникюр', price: { minor: '900000', currency: 'KZT' }, durationMin: 90 }] },
  staff: [{ id: STAFF, name: 'Айгерим', specialization: 'Маникюр' }],
  hours: { days: [{ weekday: 1, open: '10:00', close: '20:00' }], checkInTime: null, checkOutTime: null },
  photosCount: 0,
  reviews: null,
});
const base = () => templateSiteSpec(facts, siteTemplatesFor('BEAUTY')[0]!.id) as Record<string, any>;
const home = (s: Record<string, any>) => s['pages'][0].sections as Array<Record<string, any>>;
const ok = (s: unknown) => {
  const r = validateSiteSpec(s);
  if (!r.ok) throw new Error(JSON.stringify(r.errors.slice(0, 3)));
};

describe('простой экран сайта: пять действий клиента', () => {
  it('состояние: тексты первого экрана, «О нас», фото и блоки', () => {
    const st = simpleSiteState(base());
    // 28.10.2026: новый сайт сразу с фразой первого экрана, название в подзаголовке
    expect(st.heroHeading).toBe('Спокойный уход за собой');
    expect(st.heroSubheading).toContain('Студия Айна');
    expect(st.heroPhoto).toBeNull();
    expect(st.about).toBe('');
    expect(st.gallery).toEqual([]);
    expect(st.blocks['staff']).toBe(true);
    expect(st.blocks['hours']).toBe(true);
  });

  it('тексты первого экрана: заголовок и подзаголовок; пустой подзаголовок убирается', () => {
    let s = setHeroText(base(), 'heading', 'ru', 'Ногти, которые говорят за вас');
    s = setHeroText(s, 'subheading', 'ru', 'Покрытие держится 3 недели или переделаем бесплатно');
    ok(s);
    expect(home(s)[0]!['heading']).toEqual({ ru: 'Ногти, которые говорят за вас' });
    s = setHeroText(s, 'subheading', 'ru', '  ');
    expect(home(s)[0]!['subheading']).toBeUndefined();
    ok(s);
    // пустой заголовок не принимается: у первого экрана он обязателен
    expect(home(setHeroText(s, 'heading', 'ru', ''))[0]!['heading']).toEqual({ ru: 'Ногти, которые говорят за вас' });
  });

  it('фото первого экрана: с фото экран на всю ширину, без фото только текст', () => {
    let s = setHeroPhoto(base(), PHOTO(1));
    ok(s);
    expect(home(s)[0]).toMatchObject({ variant: 'IMAGE_FULL', image: PHOTO(1) });
    expect(simpleSiteState(s).heroPhoto).toEqual(PHOTO(1));
    s = setHeroPhoto(s, null);
    ok(s);
    expect(home(s)[0]!['variant']).toBe('TEXT_ONLY');
    expect(home(s)[0]!['image']).toBeUndefined();
  });

  it('«О нас»: текст создаёт блок после услуг, абзацы по пустой строке; пустой текст блок убирает', () => {
    let s = setAboutText(base(), 'ru', 'Мы открылись в 2016 году.\n\nКаждый гость уходит отдохнувшим.');
    ok(s);
    const types = home(s).map((x) => x['type']);
    expect(types.indexOf('about')).toBe(types.indexOf('services') + 1);
    expect(home(s).find((x) => x['type'] === 'about')!['paragraphs']).toEqual([
      { ru: 'Мы открылись в 2016 году.' },
      { ru: 'Каждый гость уходит отдохнувшим.' },
    ]);
    expect(simpleSiteState(s).about).toBe('Мы открылись в 2016 году.\n\nКаждый гость уходит отдохнувшим.');
    s = setAboutText(s, 'ru', '');
    ok(s);
    expect(home(s).some((x) => x['type'] === 'about')).toBe(false);
  });

  it('галерея: от трёх фото блок есть, меньше трёх блока нет', () => {
    let s = setGalleryPhotos(base(), [PHOTO(1), PHOTO(2)]);
    expect(home(s).some((x) => x['type'] === 'gallery')).toBe(false);
    s = setGalleryPhotos(s, [PHOTO(1), PHOTO(2), PHOTO(3)]);
    ok(s);
    expect(home(s).find((x) => x['type'] === 'gallery')!['images']).toHaveLength(3);
    expect(simpleSiteState(s).gallery).toHaveLength(3);
    s = setGalleryPhotos(s, []);
    ok(s);
    expect(home(s).some((x) => x['type'] === 'gallery')).toBe(false);
  });

  it('блоки: выключить мастеров убирает блок и пункт меню; включить возвращает из шаблона на своё место', () => {
    const tpl = base();
    let s = toggleSiteBlock(base(), 'staff', false, tpl);
    ok(s);
    expect(home(s).some((x) => x['type'] === 'staff')).toBe(false);
    expect(JSON.stringify(s['navigation'])).not.toContain('sec-staff');
    s = toggleSiteBlock(s, 'staff', true, tpl);
    ok(s);
    expect(home(s).map((x) => x['type'])).toEqual(home(tpl).map((x) => x['type']));
    expect(simpleSiteState(s).blocks['staff']).toBe(true);
  });

  it('блок, которого нет ни в сайте, ни в шаблоне (нет мастеров в WETOP), не включается', () => {
    const noStaff = { ...facts, staff: [] };
    const tpl = templateSiteSpec(noStaff, siteTemplatesFor('BEAUTY')[0]!.id) as Record<string, any>;
    const s = toggleSiteBlock(tpl, 'staff', true, tpl);
    expect(s).toBe(tpl);
    expect(simpleSiteState(s).blocks['staff']).toBe(false);
  });

  it('список блоков для экрана: только необязательные, с подписями', () => {
    expect(SIMPLE_BLOCKS.map((b) => b.type)).toEqual(['features', 'staff', 'hours', 'faq', 'cta']);
    expect(SIMPLE_BLOCKS.every((b) => b.label.length > 0)).toBe(true);
  });
});
