/* eslint-disable @typescript-eslint/no-explicit-any -- тест правит пример документа по путям */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { diffSiteSpecs } from './index';

/** MKT9 §50–§55, §125: смысловая разница версий по id, перестановка это moved, порядок детерминирован */
const EXAMPLE = JSON.parse(readFileSync(resolve(__dirname, '../../../../docs/marketing/sitespec-v0.example.json'), 'utf8')) as Record<string, any>;
const spec = (): Record<string, any> => structuredClone(EXAMPLE);
const ASSET = '11111111-2222-4333-8444-555555555555';

describe('diffSiteSpecs', () => {
  it('одинаковые версии: пусто; порядок ключей не важен', () => {
    const a = spec();
    const b = JSON.parse(JSON.stringify(a, Object.keys(a).reverse()));
    expect(diffSiteSpecs(a, spec())).toEqual([]);
    expect(diffSiteSpecs(a, { ...b, ...a })).toEqual([]);
  });

  it('поля сайта', () => {
    const b = spec();
    b.site.displayName.ru = 'Другое имя';
    b.theme.accent = 'GOLD';
    b.site.contacts.phone = '+77019999999';
    expect(diffSiteSpecs(spec(), b)).toEqual([
      { area: 'site', kind: 'changed', field: 'displayName' },
      { area: 'site', kind: 'changed', field: 'contacts' },
      { area: 'site', kind: 'changed', field: 'theme' },
    ]);
  });

  it('страница добавлена и удалена', () => {
    const b = spec();
    b.pages.push({ ...structuredClone(b.pages[1]), id: 'page-new', slug: 'new', sections: [{ ...b.pages[1].sections[0], id: 'sec-new' }] });
    const added = diffSiteSpecs(spec(), b).filter((c) => c.area === 'page');
    expect(added).toEqual([{ area: 'page', kind: 'added', pageId: 'page-new', label: expect.any(String) }]);
    const removed = diffSiteSpecs(b, spec()).filter((c) => c.area === 'page');
    expect(removed).toEqual([{ area: 'page', kind: 'removed', pageId: 'page-new', label: expect.any(String) }]);
  });

  it('страница переставлена: moved, а не удаление и добавление', () => {
    const b = spec();
    b.pages.reverse();
    const pages = diffSiteSpecs(spec(), b).filter((c) => c.area === 'page');
    expect(pages).toHaveLength(1);
    expect(pages[0]!.kind).toBe('moved');
  });

  it('секция добавлена, удалена и переставлена', () => {
    const b = spec();
    const [hero, about, ...rest] = b.pages[0].sections;
    b.pages[0].sections = [hero, ...rest.filter((s: any) => s.id !== 'sec-cta'), about];
    const changes = diffSiteSpecs(spec(), b).filter((c) => c.area === 'section');
    expect(changes).toEqual([
      { area: 'section', kind: 'moved', pageId: 'page-home', sectionId: 'sec-about', sectionType: 'about', label: expect.any(String) },
      { area: 'section', kind: 'removed', pageId: 'page-home', sectionId: 'sec-cta', sectionType: 'cta', label: expect.any(String) },
    ]);
    const back = diffSiteSpecs(b, spec()).filter((c) => c.kind === 'added');
    expect(back.map((c) => c.sectionId)).toEqual(['sec-cta']);
  });

  it('вариант и содержимое секции', () => {
    const b = spec();
    b.pages[0].sections[2].variant = 'LIST';
    b.pages[0].sections[2].heading.ru = 'Почему мы';
    const changes = diffSiteSpecs(spec(), b);
    expect(changes).toEqual([
      { area: 'section', kind: 'variant', pageId: 'page-home', sectionId: 'sec-features', sectionType: 'features', label: 'Почему мы', from: 'GRID', to: 'LIST' },
      { area: 'section', kind: 'changed', pageId: 'page-home', sectionId: 'sec-features', sectionType: 'features', label: 'Почему мы' },
    ]);
  });

  it('замена картинки героя: одно событие replaced, без «изменилось содержимое»', () => {
    const a = spec();
    const b = spec();
    b.pages[0].sections[0].image.assetId = ASSET;
    expect(diffSiteSpecs(a, b)).toEqual([{ area: 'asset', kind: 'replaced', slot: 'section:sec-hero:image', from: a.pages[0].sections[0].image.assetId, to: ASSET }]);
  });

  it('картинка галереи добавлена и убрана', () => {
    const a = spec();
    const b = spec();
    const gallery = b.pages[0].sections.find((s: any) => s.type === 'gallery');
    const old = gallery.images[0].assetId;
    gallery.images[0] = { ...gallery.images[0], assetId: ASSET };
    expect(diffSiteSpecs(a, b).filter((c) => c.area === 'asset')).toEqual([
      { area: 'asset', kind: 'added', slot: 'section:sec-gallery:images', to: ASSET },
      { area: 'asset', kind: 'removed', slot: 'section:sec-gallery:images', from: old },
    ]);
  });

  it('детерминирован: тот же вход, тот же вывод', () => {
    const b = spec();
    b.pages.reverse();
    b.theme.preset = 'WARM';
    expect(JSON.stringify(diffSiteSpecs(spec(), b))).toBe(JSON.stringify(diffSiteSpecs(spec(), structuredClone(b))));
  });
});
