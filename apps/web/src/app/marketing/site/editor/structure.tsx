'use client';
import { useState } from 'react';
import {
  SITE_EDITOR_SECTIONS,
  SITE_EDITOR_SECTION_TYPES,
  accommodationCardCodes,
  duplicateSection,
  localizedText,
  moveItem,
  newPage,
  newSection,
  pageReferences,
  sectionReferences,
  specIds,
  type SpecReference,
} from '@pms/domain';
import { Alert, Button, Field, Select, cx } from '../../../../components/ui';
import { useEditor } from './fields';

/**
 * Структура сайта (MKT9 §12, §19–§27): страницы и секции выбранной страницы, добавление, перестановка кнопками
 * (путь с клавиатуры, без перетаскивания), копия и удаление. Страницу или секцию, на которую ссылаются навигация,
 * кнопки или политика, удалить нельзя: показывается, где она используется; ссылки сами не удаляются.
 */
export type Selection = { kind: 'site' } | { kind: 'page'; page: number } | { kind: 'section'; page: number; section: number };
type Rec = Record<string, unknown>;

export function Structure({
  selection,
  select,
  ask,
}: {
  selection: Selection;
  select: (next: Selection) => void;
  ask: (title: string, body: string) => Promise<boolean>;
}) {
  const c = useEditor();
  const [blocked, setBlocked] = useState<{ title: string; refs: SpecReference[] } | null>(null);
  const [addType, setAddType] = useState('about');
  const pages = (c.spec['pages'] as Rec[] | undefined) ?? [];
  const openPage = selection.kind === 'site' ? -1 : selection.page;
  const sectionsOf = (i: number) => (pages[i]?.['sections'] as Rec[] | undefined) ?? [];
  const setPages = (next: Rec[]) => c.set(['pages'], next);
  const setSections = (i: number, next: Rec[]) => c.set(['pages', i, 'sections'], next);

  const removePage = async (i: number) => {
    const page = pages[i]!;
    const refs = pageReferences(c.spec, String(page['id']), c.defaultLocale);
    if (refs.length) return setBlocked({ title: `Страницу «${localizedText(page['title'], c.defaultLocale)}» нельзя удалить: на неё ссылаются`, refs });
    if (!(await ask('Удалить страницу?', 'Страница и её секции уйдут из черновика. Опубликованный сайт не изменится до публикации.'))) return;
    setBlocked(null);
    setPages(pages.filter((_, j) => j !== i));
    select({ kind: 'site' });
  };
  const removeSection = async (i: number, j: number) => {
    const section = sectionsOf(i)[j]!;
    const refs = sectionReferences(c.spec, String(pages[i]!['id']), String(section['id']), c.defaultLocale);
    if (refs.length)
      return setBlocked({ title: `Секцию «${localizedText(section['heading'], c.defaultLocale)}» нельзя удалить: на неё ссылаются`, refs });
    if (!(await ask('Удалить секцию?', 'Секция уйдёт из черновика. Опубликованный сайт не изменится до публикации.'))) return;
    setBlocked(null);
    setSections(i, sectionsOf(i).filter((_, k) => k !== j));
    select({ kind: 'page', page: i });
  };
  const addSection = (i: number) => {
    const section = newSection(addType, {
      locale: c.defaultLocale,
      taken: specIds(c.spec),
      categories: c.categories.map((cat) => cat.code),
      cardCodes: accommodationCardCodes(c.spec),
    });
    const list = sectionsOf(i);
    // секция героя по схеме первая на странице, остальные встают в конец
    const at = addType === 'hero' ? 0 : list.length;
    setSections(i, [...list.slice(0, at), section, ...list.slice(at)]);
    select({ kind: 'section', page: i, section: at });
  };

  return (
    <nav className="ed-structure" aria-label="Структура сайта" data-testid="ed-structure">
      {blocked && (
        <Alert boxed data-testid="ed-blocked">
          <b>{blocked.title}</b>
          <ul>
            {blocked.refs.map((r) => (
              <li key={r.path}>{r.where}</li>
            ))}
          </ul>
          <Button type="button" tone="ghost" size="sm" onClick={() => setBlocked(null)}>
            Понятно
          </Button>
        </Alert>
      )}
      <button
        type="button"
        className={cx('ed-node', selection.kind === 'site' && 'is-on')}
        aria-current={selection.kind === 'site' ? 'true' : undefined}
        onClick={() => select({ kind: 'site' })}
      >
        Настройки сайта
      </button>
      <h3 className="ed-structure__title">Страницы</h3>
      <ol className="ed-tree">
        {pages.map((page, i) => {
          const home = page['isHome'] === true;
          const title = localizedText(page['title'], c.defaultLocale) || 'Без названия';
          const pageOn = selection.kind === 'page' && selection.page === i;
          return (
            <li key={String(page['id'])} data-testid="ed-page">
              <div className="ed-node-row">
                <button
                  type="button"
                  className={cx('ed-node', pageOn && 'is-on')}
                  aria-current={pageOn ? 'true' : undefined}
                  onClick={() => select({ kind: 'page', page: i })}
                >
                  {title}
                  {home ? ' (главная)' : ''}
                </button>
                <span className="ed-item-controls">
                  <Button type="button" tone="ghost" size="sm" aria-label={`Страница «${title}»: выше`} disabled={c.readOnly || i === 0} onClick={() => setPages(moveItem(pages, i, i - 1))}>
                    ↑
                  </Button>
                  <Button type="button" tone="ghost" size="sm" aria-label={`Страница «${title}»: ниже`} disabled={c.readOnly || i === pages.length - 1} onClick={() => setPages(moveItem(pages, i, i + 1))}>
                    ↓
                  </Button>
                  <Button type="button" tone="ghost" size="sm" aria-label={`Страница «${title}»: удалить`} disabled={c.readOnly || home} onClick={() => void removePage(i)}>
                    Удалить
                  </Button>
                </span>
              </div>
              {openPage === i && (
                <ol className="ed-tree ed-tree--sections">
                  {sectionsOf(i).map((section, j) => {
                    const on = selection.kind === 'section' && selection.page === i && selection.section === j;
                    const type = SITE_EDITOR_SECTIONS[String(section['type'])]?.label ?? String(section['type']);
                    const heading = localizedText(section['heading'], c.defaultLocale);
                    const name = heading ? `${type}: ${heading}` : type;
                    const list = sectionsOf(i);
                    return (
                      <li key={String(section['id'])} data-testid="ed-section">
                        <div className="ed-node-row">
                          <button
                            type="button"
                            className={cx('ed-node', on && 'is-on')}
                            aria-current={on ? 'true' : undefined}
                            onClick={() => select({ kind: 'section', page: i, section: j })}
                          >
                            {name}
                          </button>
                          <span className="ed-item-controls">
                            <Button type="button" tone="ghost" size="sm" aria-label={`${name}: выше`} disabled={c.readOnly || j === 0} onClick={() => { setSections(i, moveItem(list, j, j - 1)); select({ kind: 'section', page: i, section: j - 1 }); }}>
                              ↑
                            </Button>
                            <Button type="button" tone="ghost" size="sm" aria-label={`${name}: ниже`} disabled={c.readOnly || j === list.length - 1} onClick={() => { setSections(i, moveItem(list, j, j + 1)); select({ kind: 'section', page: i, section: j + 1 }); }}>
                              ↓
                            </Button>
                            <Button
                              type="button"
                              tone="ghost"
                              size="sm"
                              aria-label={`${name}: копия`}
                              disabled={c.readOnly || list.length >= 30 || section['type'] === 'hero' || section['type'] === 'booking'}
                              onClick={() => {
                                setSections(i, [...list.slice(0, j + 1), duplicateSection(section, specIds(c.spec)), ...list.slice(j + 1)]);
                                select({ kind: 'section', page: i, section: j + 1 });
                              }}
                            >
                              Копия
                            </Button>
                            <Button type="button" tone="ghost" size="sm" aria-label={`${name}: удалить`} disabled={c.readOnly || list.length <= 1} onClick={() => void removeSection(i, j)}>
                              Удалить
                            </Button>
                          </span>
                        </div>
                      </li>
                    );
                  })}
                  <li className="ed-add">
                    <Field label="Новая секция" controlId={`ed-add-type-${i}`}>
                      <Select value={addType} disabled={c.readOnly} onChange={(e) => setAddType(e.currentTarget.value)}>
                        {SITE_EDITOR_SECTION_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {SITE_EDITOR_SECTIONS[t]!.label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Button type="button" tone="secondary" size="sm" disabled={c.readOnly || sectionsOf(i).length >= 30} onClick={() => addSection(i)} data-testid="ed-add-section">
                      Добавить секцию
                    </Button>
                  </li>
                </ol>
              )}
            </li>
          );
        })}
      </ol>
      <Button
        type="button"
        tone="secondary"
        size="sm"
        disabled={c.readOnly || pages.length >= 20}
        data-testid="ed-add-page"
        onClick={() => {
          const page = newPage({
            locale: c.defaultLocale,
            taken: specIds(c.spec),
            slugs: new Set(pages.map((p) => String(p['slug']))),
          });
          setPages([...pages, page]);
          select({ kind: 'page', page: pages.length });
        }}
      >
        Добавить страницу
      </Button>
    </nav>
  );
}
