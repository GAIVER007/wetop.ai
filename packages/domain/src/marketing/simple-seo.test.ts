import { describe, expect, it } from 'vitest';
import { buildSiteFacts, starterSpecFromFacts, type SiteFactsSnapshot } from './index';
import { searchPreview, setHomeSeo, setSiteIndexing, simpleSiteSeo } from './simple-edit';
import { validateSiteSpec } from './site-spec';

/**
 * SEO в простом экране сайта (аудит «Сайт и SEO» 28.10.2026, S5): заголовок и описание главной для Google, показ в
 * поиске одним переключателем и вид в выдаче. Документ после правки проходит валидатор, лишний текст обрезается.
 */
type Rec = Record<string, unknown>;
const LOC = '0b0e6a1c-0000-4000-8000-000000000001';
const snapshot = (vertical: 'HOSPITALITY' | 'BEAUTY' | 'FOOD_SERVICE'): SiteFactsSnapshot => ({
  vertical,
  location: { id: LOC, name: 'Студия «Вымышленная»', address: 'Доха, West Bay, 1', phone: '+974 0000 0001', whatsapp: null, city: null },
  catalog:
    vertical === 'HOSPITALITY'
      ? { kind: 'rooms', items: [{ code: 'std', name: 'Стандарт', capacityAdults: 2 }] }
      : vertical === 'BEAUTY'
        ? { kind: 'services', items: [] }
        : { kind: 'menu', items: [] },
  staff: [],
  hours: { days: [], checkInTime: null, checkOutTime: null },
  photosCount: 0,
  reviews: null,
});
const spec = (v: 'HOSPITALITY' | 'BEAUTY' | 'FOOD_SERVICE') => starterSpecFromFacts(buildSiteFacts(snapshot(v))) as Rec;

describe('SEO главной в простом экране', () => {
  for (const v of ['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE'] as const)
    it(`${v}: заголовок и описание пишутся в SEO главной и проходят валидатор`, () => {
      let doc = setHomeSeo(spec(v), 'title', 'ru', '  Студия Тест  в Дохе ');
      doc = setHomeSeo(doc, 'description', 'ru', 'Маникюр и брови рядом с метро. Запись онлайн за минуту.');
      expect(simpleSiteSeo(doc)).toMatchObject({
        title: 'Студия Тест в Дохе',
        description: 'Маникюр и брови рядом с метро. Запись онлайн за минуту.',
        indexed: true,
      });
      expect(validateSiteSpec(doc).ok).toBe(true);
    });

  it('длинный текст обрезается до лимита поисковиков, пустой убирает поле', () => {
    let doc = setHomeSeo(spec('BEAUTY'), 'title', 'ru', 'а'.repeat(90));
    expect(simpleSiteSeo(doc).title).toHaveLength(60);
    doc = setHomeSeo(doc, 'description', 'ru', 'б'.repeat(200));
    expect(simpleSiteSeo(doc).description).toHaveLength(160);
    doc = setHomeSeo(doc, 'title', 'ru', '   ');
    expect(simpleSiteSeo(doc).title).toBe('');
    expect(validateSiteSpec(doc).ok).toBe(true);
  });

  it('скрыть из поиска: сайт NOINDEX, главная без индекса и вне карты сайта; вернуть обратно', () => {
    let doc = setSiteIndexing(spec('FOOD_SERVICE'), false);
    expect(simpleSiteSeo(doc).indexed).toBe(false);
    expect(validateSiteSpec(doc).ok).toBe(true);
    doc = setSiteIndexing(doc, true);
    expect(simpleSiteSeo(doc).indexed).toBe(true);
    expect(validateSiteSpec(doc).ok).toBe(true);
  });

  it('вид в Google: без своего заголовка берётся заголовок первого экрана, адрес без https', () => {
    const p = searchPreview(spec('BEAUTY'), 'https://studio-test.sites.wetop.ai', 'Студия Тест');
    expect(p.url).toBe('studio-test.sites.wetop.ai');
    expect(p.title.length).toBeGreaterThan(0);
    const own = searchPreview(setHomeSeo(spec('BEAUTY'), 'title', 'ru', 'Свой заголовок'), null, 'Студия Тест');
    expect(own.title).toBe('Свой заголовок');
    expect(own.url).toBe('');
  });
});
