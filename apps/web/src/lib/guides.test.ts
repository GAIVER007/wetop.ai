import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GUIDES, guideBySlug, guideLang, guidePages } from './guides';
import { menuSectionsFor, pageOpen, routeRule, type NavigationAccess } from './navigation';

/**
 * «Обучение» (владелец 30.10.2026, вариант B): у каждого клиента WETOP, при любой роли и должности, всегда; у
 * каждой инструкции название и краткое описание, по нажатию открывается вся инструкция. RU и EN отдельно.
 */
const PUBLIC = join(__dirname, '../../public');
const base = { platform: false, unknown: false, restricted: false } as const;
const roles = ['OWNER', 'MANAGER', 'STAFF', 'EMPLOYEE'] as const;

describe('Обучение: инструкции', () => {
  it('инструкции, у каждой название, описание и обе версии', () => {
    expect(GUIDES.map((g) => g.slug).slice(0, 4)).toEqual(['admin', 'cash-payroll', 'master-cabinet', 'staff-access']);
    expect(new Set(GUIDES.map((g) => g.slug)).size).toBe(GUIDES.length);
    for (const g of GUIDES) {
      expect(g.title.length, g.slug).toBeGreaterThan(5);
      expect(g.description.length, g.slug).toBeGreaterThan(40);
      for (const lang of ['ru', 'en'] as const) {
        expect(existsSync(join(PUBLIC, g.files[lang].pdf)), `${g.slug} ${lang} pdf`).toBe(true);
        expect(g.files[lang].pages, `${g.slug} ${lang}`).toBeGreaterThan(3);
        for (const page of guidePages(g, lang)) expect(existsSync(join(PUBLIC, page)), page).toBe(true);
      }
    }
  });

  it('каждый PDF в public/guides есть в «Обучении»: новая инструкция не теряется', () => {
    for (const lang of ['ru', 'en'] as const) {
      const pdfs = readdirSync(join(PUBLIC, 'guides', lang)).filter((f) => f.endsWith('.pdf')).map((f) => f.slice(0, -4));
      expect(pdfs.sort(), lang).toEqual(GUIDES.map((g) => g.slug).sort());
      for (const g of GUIDES)
        expect(readdirSync(join(PUBLIC, 'guides', lang, g.slug)).filter((f) => f.endsWith('.jpg')).length, `${g.slug} ${lang}`).toBe(g.files[lang].pages);
    }
  });

  it('язык инструкции по языку интерфейса: казахский читает русскую', () => {
    expect(guideLang('en')).toBe('en');
    expect(guideLang('ru')).toBe('ru');
    expect(guideLang('kk')).toBe('ru');
    expect(guideBySlug('nope')).toBeUndefined();
  });

  it('раздел есть в меню у всех ролей, в том числе «Личный кабинет», у всех направлений', () => {
    for (const vertical of ['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE'] as const)
      for (const role of roles) {
        const access = { ...base, role } as unknown as NavigationAccess;
        const learn = menuSectionsFor(access, vertical).find((s) => s.id === 'learn');
        expect(learn?.items.map((i) => i.href), `${vertical} ${role}`).toEqual(['/learn']);
      }
    expect(routeRule('/learn/admin')?.requires).toBe('self');
  });

  it('салон с должностями: страницу не закрывает ни одна должность', () => {
    const access = {
      ...base,
      role: 'STAFF',
      beautyAccess: { mode: 'CUSTOM', assigned: true, permissions: [] },
    } as unknown as NavigationAccess;
    expect(pageOpen(access, 'self', '/learn')).toBe(true);
    expect(pageOpen(access, 'self', '/learn/cash-payroll')).toBe(true);
  });
});
