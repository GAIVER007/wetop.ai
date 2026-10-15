import { describe, expect, it } from 'vitest';
import { EDITOR_PREVIEW_CSS, renderDraftPreview } from './draft-preview';
import { CSS_PATH, PRICES_PATH } from './assets';
import { SITE_CSS } from './render/theme';
import { inlineTextTargets } from '@pms/domain';
import { exampleSpec } from './test/fixtures';

describe('живой просмотр черновика в редакторе (MKT9.1)', () => {
  it('рисует главную тем же рендером: стили внутри страницы, без внешнего CSS и без скриптов WETOP', () => {
    const r = renderDraftPreview({ spec: exampleSpec(), pageId: null, locale: 'ru', assets: {} });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.html).toContain(`<style>${SITE_CSS}${EDITOR_PREVIEW_CSS}</style>`);
    expect(r.html).not.toContain(CSS_PATH);
    expect(r.html).not.toContain(PRICES_PATH);
    expect(r.html).not.toContain('widget.js');
    expect(r.html).not.toContain('pms.js');
    expect(r.html).toContain('<meta name="robots" content="noindex');
    expect(r.html).not.toContain('rel="canonical"');
    expect(r.pageId).toBe(exampleSpec().pages.find((p) => p.isHome)!.id);
  });

  it('у каждой секции свой id: по нему стойка понимает, какой блок щёлкнули', () => {
    const spec = exampleSpec();
    const home = spec.pages.find((p) => p.isHome)!;
    const r = renderDraftPreview({ spec, pageId: home.id, locale: 'ru', assets: {} });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.html).toContain('<section id="sec-booking"');
  });

  it('рисует выбранную страницу; неизвестная страница даёт главную', () => {
    const spec = exampleSpec();
    const other = spec.pages.find((p) => !p.isHome)!;
    const r = renderDraftPreview({ spec, pageId: other.id, locale: 'ru', assets: {} });
    expect(r.ok && r.pageId).toBe(other.id);
    const unknown = renderDraftPreview({ spec, pageId: 'nope', locale: 'ru', assets: {} });
    expect(unknown.ok && unknown.pageId).toBe(spec.pages.find((p) => p.isHome)!.id);
  });

  it('несохранённая правка видна сразу: заголовок первой секции из документа на экране', () => {
    const spec = exampleSpec();
    const home = spec.pages.find((p) => p.isHome)!;
    home.sections[0]!.heading = { ru: 'Новый заголовок черновика' };
    const r = renderDraftPreview({ spec, pageId: null, locale: 'ru', assets: {} });
    expect(r.ok && r.html).toContain('Новый заголовок черновика');
  });

  it('картинки по карте адресов библиотеки; без адреса картинки нет', () => {
    const spec = exampleSpec();
    const r = renderDraftPreview({ spec, pageId: null, locale: 'ru', assets: {} });
    expect(r.ok && r.html).not.toContain('<img class="brand__logo"');
  });

  it('сломанный документ на экране не роняет редактор: ok false', () => {
    const r = renderDraftPreview({ spec: { pages: 'не массив' }, pageId: null, locale: 'ru', assets: {} });
    expect(r.ok).toBe(false);
    const empty = renderDraftPreview({ spec: { ...exampleSpec(), pages: [] }, pageId: null, locale: 'ru', assets: {} });
    expect(empty.ok).toBe(false);
  });
});

describe('правка текста прямо на сайте (MKT9.2): метки только в черновике редактора', () => {
  it('с целями правки разрешённые тексты получают data-editor-path; цены, контакты и ссылки нет', () => {
    const spec = exampleSpec();
    const editorPaths = inlineTextTargets(spec, 'ru').map((t) => t.path);
    const r = renderDraftPreview({ spec, pageId: null, locale: 'ru', assets: {}, editorPaths });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const paths = [...r.html.matchAll(/data-editor-path="([^"]+)"/g)].map((m) => m[1]!);
    expect(paths).toContain('pages[0].sections[0].heading');
    expect(paths.some((p) => p.startsWith('navigation.header['))).toBe(true);
    for (const p of paths) expect(p).not.toMatch(/phone|email|address|url|categoryCode|assetId|price|slug/);
    // спрятанный в атрибуты и заголовок вкладки текст остаётся чистым: служебных знаков и разметки там нет
    expect(r.html).not.toMatch(/[-]/);
    const head = r.html.slice(0, r.html.indexOf('<body'));
    expect(head).not.toContain('data-editor-path="');
    expect(r.html).not.toMatch(/="[^"]*data-editor-path/);
  });

  it('без целей правки меток нет', () => {
    const spec = exampleSpec();
    const r = renderDraftPreview({ spec, pageId: null, locale: 'ru', assets: {} });
    expect(r.ok && r.html).not.toContain('data-editor-path="');
  });
});
