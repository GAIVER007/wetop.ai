import { describe, expect, it } from 'vitest';
import { buildSiteFacts, liveSiteSpec, starterSpecFromFacts, upgradeSiteSeo, validateSiteSpec, type SiteFactsSnapshot } from './index';

/**
 * SEO и GEO у уже готовых сайтов (владелец 28.10.2026: «да, чтобы и у готовых всё обновилось само»). Сайт из шаблона
 * до S7 узнаётся по старым автоматическим заголовку и описанию («Имя» и «Имя.» или «Имя, Город.»): им ставятся новые
 * из данных и добавляется блок «Вопросы и ответы». Что владелец писал сам, не трогается: свой заголовок, своё
 * описание, свой блок вопросов. Документ после правки проходит валидатор.
 */
type Rec = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const LOC = '0b0e6a1c-0000-4000-8000-000000000001';
const snap: SiteFactsSnapshot = {
  vertical: 'BEAUTY',
  location: { id: LOC, name: 'Студия Тест', address: 'Доха, West Bay, 1', phone: '+974 5000 0001', whatsapp: null, city: null },
  catalog: { kind: 'services', items: [{ code: 'svc-1', name: 'Маникюр', price: { minor: '15000', currency: 'QAR' }, durationMin: 60 }] },
  staff: [],
  hours: { days: [{ weekday: 1, open: '10:00', close: '21:00' }], checkInTime: null, checkOutTime: null },
  photosCount: 0,
  reviews: null,
};
const facts = () => buildSiteFacts(structuredClone(snap));
const home = (s: Rec) => s['pages'].find((p: Rec) => p.isHome);
const types = (s: Rec): string[] => home(s).sections.map((x: Rec) => x.type);

/** Сайт, собранный шаблоном до 28.10.2026: заголовок это имя, описание «Имя.», блока вопросов нет */
function legacy(): Rec {
  const s = starterSpecFromFacts(facts()) as Rec;
  home(s).sections = home(s).sections.filter((x: Rec) => x.type !== 'faq');
  home(s).seo.title = { ru: 'Студия Тест' };
  home(s).seo.description = { ru: 'Студия Тест.' };
  return s;
}

describe('готовые сайты получают SEO и GEO сами', () => {
  it('старый сайт из шаблона: новые заголовок и описание, блок вопросов перед контактами', () => {
    const s = upgradeSiteSeo(legacy(), facts()) as Rec;
    expect(home(s).seo.title.ru).toBe('Студия Тест: салон красоты');
    expect(home(s).seo.description.ru).toContain('Маникюр');
    expect(types(s)).toContain('faq');
    expect(types(s).indexOf('faq')).toBe(types(s).indexOf('contacts') - 1);
    const r = validateSiteSpec(s);
    expect(r.ok ? [] : r.errors).toEqual([]);
  });

  it('то же делает живой слой опубликованного сайта, без публикации', () => {
    const s = liveSiteSpec(legacy(), facts()) as Rec;
    expect(types(s)).toContain('faq');
    expect(home(s).seo.title.ru).toBe('Студия Тест: салон красоты');
  });

  it('свой заголовок и описание владельца остаются; свой блок вопросов тоже', () => {
    const own = legacy();
    home(own).seo.title = { ru: 'Лучший маникюр в Дохе' };
    home(own).seo.description = { ru: 'Своё описание владельца.' };
    const s = upgradeSiteSeo(own, facts()) as Rec;
    expect(home(s).seo.title.ru).toBe('Лучший маникюр в Дохе');
    expect(home(s).seo.description.ru).toBe('Своё описание владельца.');
    // описание своё: значит сайт уже правили, блок вопросов сам не добавляем
    expect(types(s)).not.toContain('faq');
  });

  it('новый сайт (уже с вопросами) и повторный вызов ничего не меняют', () => {
    const fresh = starterSpecFromFacts(facts()) as Rec;
    expect(upgradeSiteSeo(fresh, facts())).toBe(fresh);
    const once = upgradeSiteSeo(legacy(), facts());
    expect(upgradeSiteSeo(once, facts())).toBe(once);
  });

  it('владелец выключил вопросы на обновлённом сайте: они не возвращаются', () => {
    const once = upgradeSiteSeo(legacy(), facts()) as Rec;
    home(once).sections = home(once).sections.filter((x: Rec) => x.type !== 'faq');
    expect(types(upgradeSiteSeo(once, facts()) as Rec)).not.toContain('faq');
  });

  it('чужое направление в фактах: документ без изменений', () => {
    const f = facts();
    f.vertical = 'FOOD_SERVICE';
    const s = legacy();
    expect(upgradeSiteSeo(s, f)).toBe(s);
  });
});
