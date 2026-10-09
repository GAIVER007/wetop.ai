'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { inlineTextTargets, localizedText } from '@pms/domain';
import { Button, Field, Select, cx } from '../../../../components/ui';
import type { Spec } from './fields';

/**
 * Живой сайт справа (MKT9.1, `plans/mkt9-1-editor-live-preview-2026-10-07.md`): документ на экране рисуется тем же
 * рендером, что Worker, сразу после правки, без сохранения. Рамка `srcdoc` без `allow-scripts`: скрипты сайта не
 * выполняются, стойка сама слушает щелчки в документе рамки. Щелчок в блоке выбирает его; ссылка меню или подвала на
 * страницу сайта переключает страницу просмотра; наружу ничего не открывается.
 *
 * MKT9.2: «Выбор» (`S`) выбирает блок, «Текст» (`T`) правит разрешённый текст прямо на сайте: щелчок делает текст
 * редактируемым, Enter применяет, Escape отменяет, щелчок мимо применяет. Это правка документа на экране, ИИ не зовётся;
 * метки целей ставит только рендер черновика по правилу `inlineTextTargets`.
 */
export type PreviewMode = 'select' | 'text';
type Renderer = typeof import('../../../../../../sites/src/draft-preview');
let renderer: Promise<Renderer> | null = null;
const loadRenderer = () => (renderer ??= import('../../../../../../sites/src/draft-preview'));

type Rec = Record<string, unknown>;
const LOCALE_NAME: Record<string, string> = { ru: 'Русский', kk: 'Қазақша', en: 'English' };

export function SitePreview({
  spec,
  pageId,
  onPage,
  locales,
  defaultLocale,
  assets,
  selectedSectionId,
  onPickSection,
  onOpenSeparately,
  mode,
  setMode,
  onInlineEdit,
  readOnly,
}: {
  spec: Spec;
  pageId: string | null;
  onPage: (pageId: string) => void;
  locales: string[];
  defaultLocale: string;
  assets: Record<string, string>;
  selectedSectionId: string | null;
  onPickSection: (pageId: string, sectionId: string) => void;
  onOpenSeparately: () => void;
  mode: PreviewMode;
  setMode: (mode: PreviewMode) => void;
  onInlineEdit: (path: string, locale: string, text: string) => void;
  readOnly: boolean;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [shownPage, setShownPage] = useState<string | null>(null);
  const [broken, setBroken] = useState(false);
  const [device, setDevice] = useState<'desktop' | 'phone'>('desktop');
  const [locale, setLocale] = useState(defaultLocale);
  const scroll = useRef(0);
  const handlers = useRef({ onPage, onPickSection, onInlineEdit });
  handlers.current = { onPage, onPickSection, onInlineEdit };
  const textMode = mode === 'text' && !readOnly;
  const modeRef = useRef(textMode);
  modeRef.current = textMode;
  const selected = useRef(selectedSectionId);
  selected.current = selectedSectionId;
  const pages = (spec['pages'] as Rec[] | undefined) ?? [];
  const shownLocale = locales.includes(locale) ? locale : defaultLocale;
  const localeRef = useRef(shownLocale);
  localeRef.current = shownLocale;
  // метки правки текста только в режиме «Текст»: в режиме «Выбор» разметка просмотра та же, что у сайта
  const editorPaths = useMemo(() => (textMode ? inlineTextTargets(spec, shownLocale).map((t) => t.path) : undefined), [textMode, spec, shownLocale]);

  // S и T переключают режим, если фокус не в поле ввода: и в стойке, и внутри рамки сайта (туда уходит фокус после щелчка)
  const hotkey = useRef<(e: KeyboardEvent) => void>(() => undefined);
  hotkey.current = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const el = e.target as HTMLElement | null;
    if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return;
    const key = e.key.toLowerCase();
    if (key === 's' || key === 'ы') setMode('select');
    else if ((key === 't' || key === 'е') && !readOnly) setMode('text');
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => hotkey.current(e);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // правка формы рисуется через короткую паузу, чтобы не перерисовывать рамку на каждую букву
  useEffect(() => {
    let off = false;
    const timer = setTimeout(
      async () => {
        const mod = await loadRenderer();
        if (off) return;
        const r = mod.renderDraftPreview({ spec, pageId, locale: shownLocale as never, assets, ...(editorPaths ? { editorPaths } : {}) });
        if (!r.ok) return setBroken(true);
        setBroken(false);
        const win = frame.current?.contentWindow;
        scroll.current = r.pageId === shownPage && win ? win.scrollY : 0;
        setShownPage(r.pageId);
        setHtml(r.html);
        if (r.pageId !== pageId) handlers.current.onPage(r.pageId);
      },
      html === null ? 0 : 250,
    );
    return () => {
      off = true;
      clearTimeout(timer);
    };
    // shownPage и html читаются как прошлый кадр, перерисовку запускает только документ, страница, язык и картинки
  }, [spec, pageId, shownLocale, assets, editorPaths]);

  const mark = (scrollTo: boolean) => {
    const doc = frame.current?.contentDocument;
    if (!doc) return;
    doc.querySelectorAll('[data-ed-selected]').forEach((el) => el.removeAttribute('data-ed-selected'));
    const id = selected.current;
    const el = id ? doc.getElementById(id) : null;
    if (!el || el.tagName !== 'SECTION') return;
    el.setAttribute('data-ed-selected', '');
    if (scrollTo) el.scrollIntoView({ block: 'nearest' });
  };
  useEffect(() => mark(true), [selectedSectionId]);

  /** Правка одного текста в рамке: Enter и щелчок мимо применяют, Escape отменяет; без перевода строк и разметки */
  const editText = (doc: Document, el: HTMLElement) => {
    if (el.isContentEditable) return;
    const before = el.textContent ?? '';
    const path = el.getAttribute('data-editor-path') ?? '';
    el.setAttribute('contenteditable', 'plaintext-only');
    if (!el.isContentEditable) el.setAttribute('contenteditable', 'true');
    el.setAttribute('role', 'textbox');
    el.setAttribute('aria-label', 'Текст на сайте');
    el.focus();
    const range = doc.createRange();
    range.selectNodeContents(el);
    doc.getSelection()?.removeAllRanges();
    doc.getSelection()?.addRange(range);
    let done = false;
    const finish = (apply: boolean) => {
      if (done) return;
      done = true;
      el.removeAttribute('contenteditable');
      el.removeAttribute('role');
      el.removeAttribute('aria-label');
      el.removeEventListener('keydown', onKey);
      el.removeEventListener('blur', onBlur);
      const after = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (!apply || after === before.trim()) {
        el.textContent = before;
        return;
      }
      handlers.current.onInlineEdit(path, localeRef.current, after);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        finish(true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        finish(false);
      }
    };
    const onBlur = () => finish(true);
    el.addEventListener('keydown', onKey);
    el.addEventListener('blur', onBlur);
  };

  const onLoad = () => {
    const doc = frame.current?.contentDocument;
    const win = frame.current?.contentWindow;
    if (!doc || !win) return;
    win.scrollTo(0, scroll.current);
    mark(false);
    if (modeRef.current) doc.documentElement.setAttribute('data-ed-mode', 'text');
    doc.addEventListener('keydown', (e) => hotkey.current(e));
    doc.addEventListener('click', (e) => {
      const target = e.target as Element | null;
      if (!target?.closest) return;
      e.preventDefault();
      // режим «Текст»: щелчок по разрешённому тексту делает его редактируемым; остальное ничего не делает
      if (modeRef.current) {
        const editable = target.closest('[data-editor-path]') as HTMLElement | null;
        if (editable) editText(doc, editable);
        return;
      }
      const section = target.closest('main section[id]');
      if (section && shownPage) return handlers.current.onPickSection(shownPage, section.id);
      const href = target.closest('a[href]')?.getAttribute('href') ?? '';
      if (href.startsWith('#')) return doc.getElementById(href.slice(1))?.scrollIntoView();
      if (!href.startsWith('/')) return;
      const path = href.split(/[?#]/)[0] ?? '/';
      const page = pages.find((p) => (p['isHome'] === true ? '/' : `/${String(p['slug'])}`) === path);
      if (page) handlers.current.onPage(String(page['id']));
    });
  };

  return (
    <section className="ed-preview" aria-label="Просмотр сайта" data-testid="ed-preview-pane">
      <div className="ed-preview__bar">
        <div className="ed-preview__tools" role="radiogroup" aria-label="Режим работы с сайтом" data-testid="ed-tools">
          {(
            [
              ['select', 'Выбор', 'S'],
              ['text', 'Текст', 'T'],
            ] as const
          ).map(([key, label, hotkey]) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={mode === key}
              aria-keyshortcuts={hotkey}
              disabled={key === 'text' && readOnly}
              className={cx('ed-preview__device-btn', mode === key && 'is-on')}
              onClick={() => setMode(key)}
              data-testid={`ed-tool-${key}`}
            >
              {label} <kbd>{hotkey}</kbd>
            </button>
          ))}
        </div>
        <Field label="Страница" controlId="ed-preview-page" className="ed-preview__field">
          <Select value={shownPage ?? pageId ?? ''} onChange={(e) => handlers.current.onPage(e.currentTarget.value)}>
            {pages.map((p) => (
              <option key={String(p['id'])} value={String(p['id'])}>
                {localizedText(p['title'], defaultLocale) || 'Без названия'}
              </option>
            ))}
          </Select>
        </Field>
        {locales.length > 1 && (
          <Field label="Язык" controlId="ed-preview-locale" className="ed-preview__field">
            <Select value={shownLocale} onChange={(e) => setLocale(e.currentTarget.value)}>
              {locales.map((l) => (
                <option key={l} value={l}>
                  {LOCALE_NAME[l] ?? l}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <div className="ed-preview__device" role="group" aria-label="Ширина просмотра">
          {(
            [
              ['desktop', 'Компьютер'],
              ['phone', 'Телефон'],
            ] as const
          ).map(([key, label]) => (
            <button key={key} type="button" className={cx('ed-preview__device-btn', device === key && 'is-on')} aria-pressed={device === key} onClick={() => setDevice(key)}>
              {label}
            </button>
          ))}
        </div>
        <Button type="button" tone="secondary" data-testid="ed-preview" onClick={onOpenSeparately}>
          Открыть в новой вкладке
        </Button>
      </div>
      <p className="muted ed-preview__hint" data-testid="ed-preview-hint">
        {textMode
          ? 'Щёлкните текст на сайте и исправьте его. Enter сохраняет в черновике, Escape отменяет. Цены, контакты и ссылки так не меняются.'
          : 'Щёлкните блок на сайте, чтобы изменить его. Бронирование и цены работают только на опубликованном сайте.'}
      </p>
      {broken && (
        <p className="ed-preview__broken" role="status" data-testid="ed-preview-broken">
          Сайт с этими правками пока не нарисовать: исправьте отмеченные поля. Показан последний удачный вид.
        </p>
      )}
      <div className={cx('ed-preview__stage', device === 'phone' && 'is-phone')}>
        {html !== null && (
          <iframe ref={frame} className="ed-preview__frame" title="Сайт гостиницы, живой просмотр" sandbox="allow-same-origin" srcDoc={html} onLoad={onLoad} data-testid="ed-frame" />
        )}
      </div>
    </section>
  );
}
