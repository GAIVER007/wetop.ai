/* eslint-disable @typescript-eslint/no-explicit-any -- тест правит пример документа по путям */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  SITE_EDITOR_SECTIONS,
  SITE_SPEC_SECTIONS,
  accommodationCardCodes,
  applySectionVariant,
  duplicateSection,
  errorLocation,
  moveItem,
  newPage,
  newSection,
  newSpecId,
  normalizePageSlug,
  pageReferences,
  removeLocale,
  sectionReferences,
  siteSpecSectionFields,
  specIds,
  validateSiteSpec,
} from './index';

/** MKT9 §24, §20–§28: реестр редактора совпадает с валидатором, шаблоны, ссылки, снятие языка */
const EXAMPLE = JSON.parse(readFileSync(resolve(__dirname, '../../../../docs/marketing/sitespec-v0.example.json'), 'utf8')) as Record<string, any>;
const spec = (): Record<string, any> => structuredClone(EXAMPLE);

describe('реестр редактора и валидатор', () => {
  it('те же 11 типов секций и те же варианты, что у валидатора', () => {
    expect(Object.keys(SITE_EDITOR_SECTIONS).sort()).toEqual(Object.keys(SITE_SPEC_SECTIONS).sort());
    expect(Object.keys(SITE_EDITOR_SECTIONS)).toHaveLength(11);
    for (const [type, shape] of Object.entries(SITE_EDITOR_SECTIONS))
      expect(shape.variants.map((v) => v.value), type).toEqual([...SITE_SPEC_SECTIONS[type]!]);
  });

  it('у каждой секции ровно поля валидатора, обязательность совпадает', () => {
    for (const [type, shape] of Object.entries(SITE_EDITOR_SECTIONS)) {
      const known = siteSpecSectionFields(type)!;
      expect(shape.fields.map((f) => f.key).sort(), type).toEqual([...known.fields].sort());
      for (const key of known.required) expect(shape.fields.find((f) => f.key === key)?.required, `${type}.${key}`).toBe(true);
    }
  });
});

describe('шаблоны и идентификаторы', () => {
  it('новый id свободен и детерминирован', () => {
    expect(newSpecId('sec-hero', new Set(['sec-hero-1', 'sec-hero-2']))).toBe('sec-hero-3');
    expect(newSpecId('Page Новая', new Set())).toBe('page-1');
  });

  it('новая секция каждого типа получает свой id и проходит проверку в документе (галерее нужны фото)', () => {
    for (const type of Object.keys(SITE_EDITOR_SECTIONS)) {
      const s = spec();
      const taken = specIds(s);
      const section = newSection(type, { locale: 'ru', taken, categories: ['standard-double'], cardCodes: accommodationCardCodes(s) });
      expect(taken.has(String(section['id']))).toBe(false);
      const page = s.pages.find((p: any) => p.id === 'page-privacy');
      page.sections.push(section);
      if (type === 'hero') page.sections = [section, ...page.sections.slice(0, -1)];
      const result = validateSiteSpec(s);
      if (type === 'gallery') expect(result.ok).toBe(false);
      else expect(result.ok ? [] : result.errors, type).toEqual([]);
    }
  });

  it('копия секции получает новый id и то же содержимое', () => {
    const s = spec();
    const hero = s.pages[0].sections[0];
    const copy = duplicateSection(hero, specIds(s));
    expect(copy['id']).not.toBe(hero.id);
    expect({ ...copy, id: hero.id }).toEqual(hero);
  });

  it('новая страница: свободные id и адрес, не главная, проходит проверку', () => {
    const s = spec();
    const page = newPage({ locale: 'ru', taken: specIds(s), slugs: new Set(['privacy', 'page-1']) });
    expect(page['isHome']).toBe(false);
    expect(page['slug']).toBe('page-2');
    s.pages.push(page);
    const r = validateSiteSpec(s);
    expect(r.ok ? [] : r.errors).toEqual([]);
  });

  it('адрес страницы: только правила схемы', () => {
    expect(normalizePageSlug('Наши Номера 2026')).toBe('2026');
    expect(normalizePageSlug('Rooms & Suites')).toBe('rooms-suites');
  });

  it('смена варианта снимает поля, которых у варианта нет', () => {
    const hero = spec().pages[0].sections[0];
    expect(applySectionVariant(hero, 'TEXT_ONLY')['image']).toBeUndefined();
    expect(applySectionVariant(hero, 'IMAGE_SIDE')['image']).toEqual(hero.image);
  });

  it('перестановка', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveItem(['a', 'b'], 0, 5)).toEqual(['a', 'b']);
  });
});

describe('ссылки: удаление с зависимостями запрещено', () => {
  it('на страницу политики ссылаются подвал и юридический блок', () => {
    const refs = pageReferences(spec(), 'page-privacy', 'ru');
    expect(refs.map((r) => r.path).sort()).toEqual(['navigation.footer[1].target', 'site.legal.privacyPageId']);
    expect(refs.map((r) => r.where)).toContain('Политика конфиденциальности сайта');
  });

  it('на секцию номеров ссылается шапка; ссылки изнутри самой секции не в счёт', () => {
    const s = spec();
    expect(sectionReferences(s, 'page-home', 'sec-rooms', 'ru').map((r) => r.where)).toEqual(['Шапка: Номера']);
    expect(sectionReferences(s, 'page-home', 'sec-about', 'ru')).toEqual([]);
  });
});

describe('языки и пути ошибок', () => {
  it('снятый язык убирается из всех текстов, необязательный текст без языков удаляется', () => {
    const s = spec();
    s.site.locales = ['ru', 'en'];
    s.site.displayName.en = 'Steppe Wind';
    s.site.brand.tagline = { en: 'Only english' };
    const out = removeLocale(s, 'en');
    expect((out['site'] as any).locales).toEqual(['ru']);
    expect((out['site'] as any).displayName).toEqual({ ru: s.site.displayName.ru });
    expect((out['site'] as any).brand.tagline).toBeUndefined();
    expect(s.site.displayName.en).toBe('Steppe Wind');
  });

  it('путь ошибки ведёт к странице и секции', () => {
    expect(errorLocation('pages[0].sections[3].heading.ru')).toEqual({ area: 'page', pageIndex: 0, sectionIndex: 3, rest: 'heading.ru' });
    expect(errorLocation('pages[1].slug')).toEqual({ area: 'page', pageIndex: 1, sectionIndex: null, rest: 'slug' });
    expect(errorLocation('site.contacts.phone')).toEqual({ area: 'site', rest: 'site.contacts.phone' });
  });
});

describe('подсказка адреса сайта', () => {
  it('транслит, только допустимые знаки, служебные слова и короткие имена обходятся', async () => {
    const { suggestMarketingSlug, parseMarketingSlug } = await import('./index');
    expect(suggestMarketingSlug('Гостиница «Степной ветер»')).toBe('gostinitsa-stepnoy-veter');
    expect(suggestMarketingSlug('Luxx Aparts')).toBe('luxx-aparts');
    expect(suggestMarketingSlug('Қонақ үй Ақ')).toBe('konak-uy-ak');
    expect(suggestMarketingSlug('Я')).toBe('site-ya');
    expect(suggestMarketingSlug('App')).toBe('app-site');
    for (const name of ['', '!!!', 'x'.repeat(80), 'Отель №1 — центр'])
      expect(parseMarketingSlug(suggestMarketingSlug(name)).ok, name).toBe(true);
  });
});
