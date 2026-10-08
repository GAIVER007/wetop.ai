'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  applyDesignDirection,
  setInlineText,
  SITE_EDITOR_SECTIONS,
  SITE_SPEC_LOCALES,
  SITE_SPEC_MAX_BYTES,
  canonicalByteLength,
  canonicalJson,
  diffSiteSpecs,
  errorLocation,
  localizedText,
  validateSiteSpec,
} from '@pms/domain';
import type {
  DesignDirectionView,
  EditorReply,
  GenerationRunView,
  SiteAssetView,
  SiteBuilderState,
  SiteChangeView,
  SiteConversationItem,
  SiteSpecErrorView,
  SiteVersionMeta,
} from '../../../../lib/api';
import { Alert, Button, Notice, Panel, Stack, cx } from '../../../../components/ui';
import { useConfirm } from '../../../../components/use-confirm';
import {
  approvePlanAction,
  assistantAction,
  bookmarkAction,
  conversationAction,
  diffAction,
  editorPreviewAction,
  patchAction,
  restoreAction,
  saveDraftAction,
  sectionAction,
  versionAction,
  versionsAction,
} from './actions';
import { AiChat, type AiMode } from './ai-chat';
import { ProjectKnowledge } from './knowledge';
import { EditorProvider, type AssetKind, type EditorContextValue, type Spec } from './fields';
import { PageForm, SectionForm, SiteForm } from './forms';
import { AssetPicker, DiffOverlay, HistoryOverlay } from './overlays';
import { pathString, setAt, type Path } from './paths';
import { SitePreview, type PreviewMode } from './preview';
import { useAssistantRun, useGenerationRun } from './run';
import { Structure, type Selection } from './structure';

/**
 * Редактор управляемого сайта (MKT9, `docs/marketing/site-editor-v0.md`; MKT9.1 раскладка как у конструктора, план
 * `plans/mkt9-1-editor-live-preview-2026-10-07.md`). Справа живой сайт по документу на экране, слева вкладки «ИИ»,
 * «Блоки», «Сайт»; щелчок по блоку на сайте открывает его форму и делает его целью ИИ.
 *
 * Одно состояние: документ SiteSpec целиком; «изменено» значит, что его каноническая запись отличается от загруженной
 * версии. Сохранение только кнопкой и только новой версией с `baseRevision` открытой; 409 и любая ошибка ввод не
 * стирают. ИИ правит сохранённую голову: несохранённые правки сначала сохраняются («Сохранить и отправить»); если
 * человек правит руками, пока ИИ работает, результат ИИ не применяется.
 */
interface Base {
  id: string;
  revision: number;
  spec: Spec;
}
type Tab = 'ai' | 'blocks' | 'site' | 'preview';
type Message = { tone: 'ok' | 'error'; text: string };
type Rec = Record<string, unknown>;
type AiTarget = { pageId: string; sectionId: string };

const ASSET_PROBLEM = 'Изображения нет в библиотеке филиала или оно другого назначения: выберите другое';
const DESKTOP = '(min-width: 961px)';

const pagesOf = (spec: Spec) => (spec['pages'] as Rec[] | undefined) ?? [];
const sectionsOf = (page: Rec | undefined) => (page?.['sections'] as Rec[] | undefined) ?? [];
const homeId = (spec: Spec) => {
  const pages = pagesOf(spec);
  const home = pages.find((p) => p['isHome'] === true) ?? pages[0];
  return home ? String(home['id']) : null;
};

function valid(spec: Spec, s: Selection): Selection {
  if (s.kind === 'site') return s;
  const page = pagesOf(spec)[s.page];
  if (!page) return { kind: 'site' };
  if (s.kind === 'page') return s;
  return sectionsOf(page)[s.section] ? s : { kind: 'page', page: s.page };
}

/** Подпись блока словами: вид и заголовок («О гостинице: О нас») */
function sectionLabel(section: Rec | undefined, locale: string): string {
  if (!section) return 'Блок';
  const type = SITE_EDITOR_SECTIONS[String(section['type'])]?.label ?? 'Блок';
  const heading = localizedText(section['heading'], locale);
  return heading ? `${type}: ${heading}` : type;
}

function findSection(spec: Spec, target: AiTarget | null) {
  if (!target) return null;
  const pages = pagesOf(spec);
  const page = pages.findIndex((p) => String(p['id']) === target.pageId);
  if (page < 0) return null;
  const section = sectionsOf(pages[page]).findIndex((x) => String(x['id']) === target.sectionId);
  return section < 0 ? null : { page, section };
}

/** Где ошибка, словами: страница и секция по документу, иначе «Настройки сайта» */
function whereOf(spec: Spec, path: string, locale: string): string {
  const at = errorLocation(path);
  if (at.area === 'site') return path.startsWith('navigation') ? 'Навигация' : 'Настройки сайта';
  const page = pagesOf(spec)[at.pageIndex];
  const title = localizedText(page?.['title'], locale) || `Страница ${at.pageIndex + 1}`;
  if (at.sectionIndex === null) return `Страница «${title}»`;
  const label = SITE_EDITOR_SECTIONS[String(sectionsOf(page)[at.sectionIndex]?.['type'])]?.label ?? 'Секция';
  return `Страница «${title}», ${label.toLowerCase()}`;
}

/** MKT9.2: полоса проекта: лицензия словами */
const LICENSE_TEXT: Record<SiteBuilderState['access'], string> = {
  active: 'Лицензия активна',
  expired: 'Срок лицензии вышел',
  off: 'Конструктор не подключён',
};

export function SiteEditor({
  siteId,
  base: initialBase,
  published,
  versions: initialVersions,
  bookmarks: initialBookmarks,
  conversation,
  project,
  categories,
  assets,
  readOnly,
}: {
  siteId: string;
  base: Base;
  published: { id: string; revision: number } | null;
  versions: SiteVersionMeta[];
  bookmarks: SiteVersionMeta[];
  conversation: SiteConversationItem[];
  project: { locationName: string; builder: SiteBuilderState; instructions: string | null };
  categories: Array<{ code: string; name: string }>;
  assets: SiteAssetView[];
  readOnly: boolean;
}) {
  const [base, setBase] = useState<Base>(initialBase);
  const [spec, setSpec] = useState<Spec>(initialBase.spec);
  const baseCanon = useMemo(() => canonicalJson(base.spec), [base]);
  const dirty = useMemo(() => canonicalJson(spec) !== baseCanon, [spec, baseCanon]);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const [selection, setSelection] = useState<Selection>({ kind: 'site' });
  const [tab, setTab] = useState<Tab>('ai');
  const [previewPage, setPreviewPage] = useState<string | null>(() => homeId(initialBase.spec));
  const [aiTarget, setAiTarget] = useState<AiTarget | null>(null);
  const [aiText, setAiTextState] = useState('');
  const draftKey = `wetop.siteEditor.draft.${siteId}`;
  // недописанный текст живёт в браузере вкладки; сам разговор хранится на сервере
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(draftKey);
      if (saved) setAiTextState(saved);
    } catch {
      // приватное окно: черновик запроса просто не переживёт обновление
    }
  }, [draftKey]);
  const setAiText = (text: string) => {
    setAiTextState(text);
    try {
      if (text) sessionStorage.setItem(draftKey, text);
      else sessionStorage.removeItem(draftKey);
    } catch {
      // хранилище закрыто: текст остаётся на экране
    }
  };
  const [items, setItems] = useState<SiteConversationItem[]>(conversation);
  const [mode, setMode] = useState<AiMode>('BUILD');
  const [previewMode, setPreviewMode] = useState<PreviewMode>('select');
  const [aiError, setAiError] = useState<string | null>(null);
  const [bookmarks, setBookmarks] = useState(initialBookmarks);
  const [errors, setErrors] = useState<SiteSpecErrorView[]>([]);
  const [message, setMessage] = useState<Message | null>(null);
  const [conflict, setConflict] = useState(false);
  const [saving, setSaving] = useState(false);
  const [versions, setVersions] = useState(initialVersions);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [diff, setDiff] = useState<{ title: string; changes: SiteChangeView[] } | null>(null);
  const [picker, setPicker] = useState<{ kind: AssetKind; onPick: (a: SiteAssetView) => void } | null>(null);
  const { ask, dialog } = useConfirm();
  const leaving = useRef(false);

  const site = (spec['site'] as Rec | undefined) ?? {};
  const locales = ((site['locales'] as string[] | undefined) ?? ['ru']).filter((l) => SITE_SPEC_LOCALES.includes(l as never));
  const defaultLocale = typeof site['defaultLocale'] === 'string' ? site['defaultLocale'] : 'ru';
  const current = valid(spec, selection);
  const pages = pagesOf(spec);
  const shownPageIndex = Math.max(
    0,
    pages.findIndex((p) => String(p['id']) === previewPage),
  );
  const target = findSection(spec, aiTarget);
  const targetLabel = target ? sectionLabel(sectionsOf(pages[target.page])[target.section], defaultLocale) : null;
  const selectedSectionId = current.kind === 'section' ? String(sectionsOf(pages[current.page])[current.section]?.['id'] ?? '') : null;
  const assetUrls = useMemo(
    () => Object.fromEntries(assets.filter((a) => a.previewUrl).map((a) => [a.id, a.previewUrl as string])),
    [assets],
  );

  // «Просмотр» отдельной вкладкой только на узком экране: на компьютере сайт всегда справа
  useEffect(() => {
    const media = window.matchMedia(DESKTOP);
    const fix = () => media.matches && setTab((t) => (t === 'preview' ? 'ai' : t));
    fix();
    media.addEventListener('change', fix);
    return () => media.removeEventListener('change', fix);
  }, []);

  const set = useCallback((path: Path, value: unknown) => {
    setSpec((prev) => (path.length === 0 ? (value as Spec) : setAt(prev, path, value)));
  }, []);
  const errorAt = useCallback(
    (path: Path) => {
      const p = pathString(path);
      const hit = errors.find((e) => e.path === p || (e.path.startsWith(`${p}.`) && SITE_SPEC_LOCALES.includes(e.path.slice(p.length + 1) as never)));
      return hit?.message ?? null;
    },
    [errors],
  );
  /** Выбор страницы или блока: его форма во вкладке «Блоки», страница в просмотре, блок становится целью ИИ */
  const select = (next: Selection) => {
    setSelection(next);
    setTab('blocks');
    if (next.kind === 'site') return;
    const page = pagesOf(spec)[next.page];
    if (page) setPreviewPage(String(page['id']));
    if (next.kind === 'section') {
      const section = sectionsOf(page)[next.section];
      if (page && section) setAiTarget({ pageId: String(page['id']), sectionId: String(section['id']) });
    }
  };
  const pickFromPreview = (pageId: string, sectionId: string) => {
    const at = findSection(spec, { pageId, sectionId });
    if (at) select({ kind: 'section', ...at });
  };
  const confirm = (title: string, body: string) => ask({ title, body, confirmLabel: 'Удалить', tone: 'danger' });

  const refreshVersions = async () => {
    const r = await versionsAction();
    if (r.ok) {
      setVersions(r.versions);
      setBookmarks(r.bookmarks);
    }
    return r.ok ? r.versions : versions;
  };
  const refreshConversation = async () => {
    const r = await conversationAction();
    if (r.ok) setItems(r.data.items);
  };
  const openPreview = async (versionId: string) => {
    const r = await editorPreviewAction(versionId);
    if (r.url) window.open(r.url, '_blank', 'noopener');
    else setMessage({ tone: 'error', text: r.error ?? 'Предпросмотр недоступен' });
  };
  const loadAsBase = async (versionId: string, replaceSpec: boolean): Promise<Base | null> => {
    const r = await versionAction(versionId);
    if (!r.ok) {
      setMessage({ tone: 'error', text: r.message });
      return null;
    }
    const next = { id: r.data.version.id, revision: r.data.version.revision, spec: r.data.version.spec };
    setBase(next);
    if (replaceSpec) {
      setSpec(next.spec);
      setSelection((s) => valid(next.spec, s));
    }
    return next;
  };
  /** Отказ API: ввод остаётся, ошибки встают у полей, конфликт версии отдельно */
  const failed = (reply: Extract<EditorReply<unknown>, { ok: false }>, what: string) => {
    if (reply.status === 409 && reply.code === 'VERSION_CONFLICT') {
      setConflict(true);
      setMessage(null);
      return;
    }
    if (reply.code === 'ASSET_UNAVAILABLE') setErrors(reply.paths.map((p) => ({ path: p.path, code: p.code, message: ASSET_PROBLEM })));
    else if (reply.errors.length) setErrors(reply.errors);
    setMessage({ tone: 'error', text: `${what}: ${reply.message}` });
  };

  const save = async (): Promise<Base | null> => {
    setMessage(null);
    if (canonicalByteLength(spec) > SITE_SPEC_MAX_BYTES) {
      setMessage({ tone: 'error', text: 'Черновик слишком большой: уберите часть страниц, секций или текста' });
      return null;
    }
    // подсказка до отправки тем же валидатором, что у сервера; судья всё равно сервер
    const local = validateSiteSpec(spec);
    if (!local.ok) {
      setErrors(local.errors);
      setMessage({ tone: 'error', text: 'Черновик не сохранён: исправьте отмеченные поля' });
      return null;
    }
    setSaving(true);
    const reply = await saveDraftAction(base.revision, spec);
    setSaving(false);
    if (!reply.ok) {
      failed(reply, 'Черновик не сохранён');
      return null;
    }
    const next = { id: reply.data.version.id, revision: reply.data.version.revision, spec };
    setBase(next);
    setErrors([]);
    setConflict(false);
    setMessage({ tone: 'ok', text: `Черновик сохранён: версия ${next.revision}` });
    void refreshVersions();
    return next;
  };

  const job = useGenerationRun(async (run) => {
    void refreshVersions();
    if (run.status === 'SUCCEEDED' && run.outputVersionId) {
      const next = await loadAsBase(run.outputVersionId, !dirtyRef.current);
      if (next && dirtyRef.current) setConflict(true);
    }
    void refreshConversation();
  });
  const talk = useAssistantRun(() => void refreshConversation());
  // задача, начатая до обновления страницы, продолжает опрашиваться
  useEffect(() => {
    const running = conversation.find((i) => i.status === 'QUEUED' || i.status === 'RUNNING');
    if (!running) return;
    if (running.kind === 'BUILD') job.start({ id: running.id, type: running.mode as GenerationRunView['type'], status: running.status, baseVersionId: running.baseVersionId, outputVersionId: null, errorCode: null });
    else talk.start({ id: running.id, mode: running.mode as 'CHAT', status: running.status === 'CANCELLED' ? 'FAILED' : running.status, baseVersionId: running.baseVersionId, userText: running.userText ?? '', assistantText: null, payload: null, errorCode: null });
    // только при открытии страницы
  }, []);
  const aiBusy = job.active || talk.active;

  /**
   * Запрос к ИИ по режиму. «Сборка»: несохранённое сначала сохраняется, метка блока даёт правку одной секции. «Чат» и
   * «План»: разговорная задача, сайт не меняется
   */
  const sendAi = async (text: string) => {
    setAiError(null);
    if (mode !== 'BUILD') {
      const reply = await assistantAction({ mode, text });
      if (!reply.ok) return setAiError(reply.message);
      setAiText('');
      talk.start(reply.data.run);
      return void refreshConversation();
    }
    let head = base;
    if (dirty) {
      const saved = await save();
      if (!saved) return;
      head = saved;
    }
    const where = findSection(head.spec, aiTarget);
    const page = where ? pagesOf(head.spec)[where.page] : undefined;
    const section = where ? sectionsOf(page)[where.section] : undefined;
    const request = (): Promise<EditorReply<{ run: GenerationRunView }>> =>
      page && section ? sectionAction(head.id, String(page['id']), String(section['id']), text) : patchAction(head.id, text);
    const reply = await request();
    if (!reply.ok) return setAiError(reply.message);
    setAiText('');
    job.start(reply.data.run);
    void refreshConversation();
  };
  const answerPlan = async (runId: string, answers: Array<{ questionId: string; answer: string }>) => {
    setAiError(null);
    const reply = await assistantAction({ mode: 'PLAN', text: '', reply: { runId, answers } });
    if (!reply.ok) return setAiError(reply.message);
    talk.start(reply.data.run);
    void refreshConversation();
  };
  const approvePlan = async (planId: string, instruction: string) => {
    setAiError(null);
    if (dirty) {
      setAiError('Сначала сохраните черновик: план составлен по сохранённой версии');
      return;
    }
    const reply = await approvePlanAction(planId, instruction);
    if (!reply.ok) return setAiError(reply.message);
    job.start(reply.data.run);
    void refreshConversation();
  };
  /** Оформление без ИИ: тема, первый экран и порядок блоков главной в документ на экране; сохраняет человек */
  const applyDesign = (direction: DesignDirectionView) => {
    setSpec((prev) => applyDesignDirection(prev, direction) as Spec);
    setMessage({ tone: 'ok', text: `Оформление «${direction.name}» применено к черновику: сохраните, чтобы оставить его` });
  };
  /** Правка текста прямо на сайте: только разрешённые поля, предел поля; ИИ не зовётся */
  const inlineEdit = (path: string, locale: string, text: string) => {
    const r = setInlineText(spec, path, locale, text);
    if (!r.ok) return setMessage({ tone: 'error', text: r.message });
    setSpec(r.spec as Spec);
  };
  const toggleBookmark = async (v: SiteVersionMeta, label: string | null) => {
    setHistoryError(null);
    const r = await bookmarkAction(v.id, label);
    if (!r.ok) {
      setHistoryError(r.message);
      return false;
    }
    await refreshVersions();
    return true;
  };

  const showChanges = async (item: SiteConversationItem) => {
    if (!item.outputVersionId || !item.baseVersionId) return;
    const r = await diffAction(item.outputVersionId, item.baseVersionId);
    const revision = versions.find((v) => v.id === item.outputVersionId)?.revision;
    if (r.ok) setDiff({ title: `Что изменил ИИ в версии ${revision ?? ''}`, changes: r.data.changes });
    else setMessage({ tone: 'error', text: r.message });
  };
  /** Восстановление версии новой головой; `conflict`: голова уже ушла вперёд, ввод на месте */
  const restore = async (versionId: string, revision: number, onError: (text: string) => void): Promise<'ok' | 'conflict' | 'error'> => {
    setBusy(true);
    const r = await restoreAction(versionId, base.revision);
    setBusy(false);
    if (!r.ok) {
      if (r.code === 'VERSION_CONFLICT') {
        setConflict(true);
        return 'conflict';
      }
      onError(
        r.code === 'ASSET_UNAVAILABLE'
          ? 'В этой версии есть изображения, которых больше нет в библиотеке: восстановить её нельзя. Загрузите изображения заново или замените их в текущем черновике.'
          : r.message,
      );
      return 'error';
    }
    await loadAsBase(r.data.version.id, true);
    setErrors([]);
    setMessage({ tone: 'ok', text: `Версия ${revision} восстановлена как черновик: версия ${r.data.version.revision}` });
    void refreshVersions();
    return 'ok';
  };
  const undo = async (item: SiteConversationItem) => {
    if (!item.baseVersionId) return;
    const before = versions.find((v) => v.id === item.baseVersionId)?.revision ?? 1;
    const ok = await ask({
      title: 'Вернуть сайт как было до этого запроса?',
      body: dirty
        ? `Появится новая версия черновика с содержимым версии ${before}. Ваши несохранённые изменения пропадут. Опубликованный сайт не изменится.`
        : `Появится новая версия черновика с содержимым версии ${before}. Опубликованный сайт не изменится.`,
      confirmLabel: 'Вернуть',
    });
    if (ok) await restore(item.baseVersionId, before, (text) => setMessage({ tone: 'error', text }));
  };

  // уход со страницы с несохранёнными правками: вопрос браузера и свой вопрос для ссылок внутри стойки
  useEffect(() => {
    if (!dirty) return;
    const onUnload = (e: BeforeUnloadEvent) => {
      if (leaving.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.('a[href]');
      if (!link || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || link.getAttribute('target') === '_blank') return;
      const href = link.getAttribute('href') ?? '';
      if (!href || href.startsWith('#')) return;
      e.preventDefault();
      e.stopPropagation();
      void ask({ title: 'Уйти без сохранения?', body: 'Несохранённые изменения черновика пропадут.', confirmLabel: 'Уйти', cancelLabel: 'Остаться', tone: 'danger' }).then((ok) => {
        if (!ok) return;
        leaving.current = true;
        window.location.assign(href);
      });
    };
    window.addEventListener('beforeunload', onUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [dirty, ask]);

  const goToError = (path: string) => {
    const at = errorLocation(path);
    if (at.area === 'site') setTab('site');
    else select(at.sectionIndex === null ? { kind: 'page', page: at.pageIndex } : { kind: 'section', page: at.pageIndex, section: at.sectionIndex });
    setTimeout(() => {
      const parts = path.split('.');
      for (let n = parts.length; n > 0; n -= 1) {
        const el = document.querySelector<HTMLElement>(`[data-path="${parts.slice(0, n).join('.')}"]`);
        if (el) {
          el.scrollIntoView({ block: 'center' });
          el.querySelector<HTMLElement>('input, select, textarea, button')?.focus();
          return;
        }
      }
    }, 50);
  };

  const context: EditorContextValue = {
    spec,
    set,
    locales,
    defaultLocale,
    errorAt,
    readOnly,
    categories,
    assets,
    pickAsset: (kind, onPick) => setPicker({ kind, onPick }),
  };

  const askAiAboutSection =
    current.kind === 'section' ? (
      <Button
        type="button"
        tone="secondary"
        size="sm"
        data-testid="ed-ai-section"
        onClick={() => {
          const page = pages[current.page];
          const section = sectionsOf(page)[current.section];
          if (page && section) setAiTarget({ pageId: String(page['id']), sectionId: String(section['id']) });
          setTab('ai');
        }}
      >
        Изменить этот блок с ИИ
      </Button>
    ) : null;

  const tabs: Array<[Tab, string]> = [
    ['ai', 'ИИ'],
    ['blocks', 'Блоки'],
    ['site', 'Сайт'],
    ['preview', 'Просмотр'],
  ];

  return (
    <EditorProvider value={context}>
      {dialog}
      <Stack>
        <div className="ed-top" data-testid="ed-bar">
          <div className="ed-top__project">
            <p className="ed-top__name" data-testid="ed-project">
              <b>{project.locationName}</b>
              <span className="muted"> / Сайт филиала</span>
            </p>
            <p className={cx('ed-license', `is-${project.builder.access}`)} data-testid="ed-license">
              <span className="ed-license__dot" aria-hidden="true" />
              {LICENSE_TEXT[project.builder.access]}
            </p>
          </div>
          <dl className="ed-top__facts">
            <div>
              <dt>Черновик</dt>
              <dd data-testid="ed-revision">версия {base.revision}</dd>
            </div>
            <div>
              <dt>На сайте</dt>
              <dd>{published ? `версия ${published.revision}` : 'ещё не опубликован'}</dd>
            </div>
          </dl>
          <p className={cx('ed-dirty', dirty && 'is-dirty')} role="status" data-testid="ed-dirty">
            {dirty ? 'Есть несохранённые изменения' : 'Все изменения сохранены'}
          </p>
          <div className="ed-top__actions">
            <Button
              type="button"
              tone="secondary"
              data-testid="ed-history-open"
              onClick={() => {
                setHistoryError(null);
                setHistoryOpen(true);
                void refreshVersions();
              }}
            >
              История
            </Button>
            <Link className="btn btn--secondary" href="/marketing/site/assets" data-testid="editor-assets-link">
              Изображения
            </Link>
            <Link className="btn btn--secondary" href="/marketing/site" data-testid="editor-publication-link">
              Публикация
            </Link>
            <Button type="button" disabled={readOnly || !dirty || saving} onClick={() => void save()} data-testid="ed-save">
              {saving ? 'Сохраняем…' : 'Сохранить черновик'}
            </Button>
          </div>
        </div>
        {project.builder.access !== 'active' && (
          <Alert boxed data-testid="ed-license-off">
            <b>Конструктор сайта не активен для этого филиала.</b>{' '}
            {project.builder.access === 'expired' ? 'Срок лицензии вышел. ' : ''}Сайт и история видны, но менять сайт, просить ИИ и публиковать
            нельзя. Опубликованный сайт продолжает работать. Подключить конструктор может главный администратор WETOP.
          </Alert>
        )}

        {message &&
          (message.tone === 'ok' ? (
            <Notice data-testid="ed-message">{message.text}</Notice>
          ) : (
            <Alert boxed data-testid="ed-message">
              {message.text}
            </Alert>
          ))}
        {conflict && (
          <Alert boxed data-testid="ed-conflict">
            <p>Сайт уже изменён в другой вкладке или ИИ. Ваши изменения остались на экране.</p>
            <div className="ed-row">
              <Button
                type="button"
                tone="secondary"
                size="sm"
                onClick={async () => {
                  await refreshVersions();
                  setHistoryOpen(true);
                }}
              >
                Посмотреть новую версию
              </Button>
              <Button
                type="button"
                tone="secondary"
                size="sm"
                data-testid="ed-conflict-compare"
                onClick={async () => {
                  const latest = (await refreshVersions()).find((v) => v.isLatest);
                  if (!latest) return;
                  const r = await versionAction(latest.id);
                  if (r.ok) setDiff({ title: `Чем ваши правки отличаются от версии ${latest.revision}`, changes: diffSiteSpecs(r.data.version.spec, spec) });
                }}
              >
                Сравнить
              </Button>
              <Button
                type="button"
                size="sm"
                data-testid="ed-conflict-continue"
                onClick={async () => {
                  const latest = (await refreshVersions()).find((v) => v.isLatest);
                  if (!latest) return;
                  const next = await loadAsBase(latest.id, false);
                  if (!next) return;
                  setConflict(false);
                  setMessage({ tone: 'ok', text: `Ваши правки будут сохранены поверх версии ${next.revision}` });
                }}
              >
                Продолжить с моими изменениями
              </Button>
            </div>
          </Alert>
        )}
        {errors.length > 0 && (
          <Alert boxed data-testid="ed-errors">
            <b>Что исправить</b>
            <ul className="ed-error-list">
              {errors.slice(0, 20).map((e, i) => (
                <li key={`${e.path}-${i}`}>
                  <button type="button" className="ed-link" onClick={() => goToError(e.path)}>
                    {whereOf(spec, e.path, defaultLocale)}: {e.message}
                  </button>
                </li>
              ))}
            </ul>
          </Alert>
        )}
        {(job.lost || talk.lost) && <Alert boxed>{job.lost ?? talk.lost}</Alert>}

        <div className="site-editor" data-testid="site-editor">
          <div className="ed-left">
            <div className="ed-tabs" role="tablist" aria-label="Части редактора">
              {tabs.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  id={`ed-tab-${key}`}
                  aria-selected={tab === key}
                  aria-controls={`ed-pane-${key}`}
                  className={cx('ed-tab', key === 'preview' && 'ed-tab--narrow', tab === key && 'is-on')}
                  onClick={() => setTab(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div id="ed-pane-ai" role="tabpanel" aria-labelledby="ed-tab-ai" className={cx('site-editor__pane', tab === 'ai' && 'is-active')}>
              <Panel>
                <AiChat
                  items={items}
                  revisionOf={(id) => versions.find((v) => v.id === id)?.revision ?? null}
                  mode={mode}
                  setMode={setMode}
                  target={targetLabel}
                  onClearTarget={() => setAiTarget(null)}
                  dirty={dirty}
                  readOnly={readOnly}
                  busy={aiBusy || saving}
                  onSend={(text) => void sendAi(text)}
                  onAnswer={(runId, answers) => void answerPlan(runId, answers)}
                  onApprove={(planId, instruction) => void approvePlan(planId, instruction)}
                  onApplyDesign={applyDesign}
                  onShowChanges={(item) => void showChanges(item)}
                  onUndo={(item) => void undo(item)}
                  text={aiText}
                  setText={setAiText}
                  error={aiError}
                />
              </Panel>
            </div>
            <div id="ed-pane-blocks" role="tabpanel" aria-labelledby="ed-tab-blocks" className={cx('site-editor__pane', tab === 'blocks' && 'is-active')}>
              <Panel>
                {current.kind === 'site' ? (
                  <Structure selection={current} select={select} ask={confirm} shownPage={shownPageIndex} />
                ) : (
                  <Stack>
                    <Button type="button" tone="ghost" size="sm" className="ed-back" data-testid="ed-back" onClick={() => setSelection({ kind: 'site' })}>
                      Все страницы и блоки
                    </Button>
                    {current.kind === 'page' && <PageForm pageIndex={current.page} />}
                    {current.kind === 'section' && (
                      <SectionForm key={`${current.page}-${current.section}`} pageIndex={current.page} sectionIndex={current.section} ai={askAiAboutSection} />
                    )}
                  </Stack>
                )}
              </Panel>
            </div>
            <div id="ed-pane-site" role="tabpanel" aria-labelledby="ed-tab-site" className={cx('site-editor__pane', tab === 'site' && 'is-active')}>
              {/* форма сайта в разметке только на своей вкладке: иначе её поля (логотип, ALT) двоились бы с формой блока */}
              {tab === 'site' && (
                <Stack>
                  <Panel>
                    <ProjectKnowledge initial={project.instructions} readOnly={readOnly} />
                  </Panel>
                  <Panel>
                    <SiteForm />
                  </Panel>
                </Stack>
              )}
            </div>
          </div>
          <div id="ed-pane-preview" role="tabpanel" aria-labelledby="ed-tab-preview" className={cx('ed-right', tab === 'preview' && 'is-active')}>
            <SitePreview
              spec={spec}
              pageId={previewPage}
              onPage={(id) => {
                setPreviewPage(id);
                if (selection.kind !== 'site' && String(pages[selection.page]?.['id']) !== id) setSelection({ kind: 'site' });
              }}
              locales={locales}
              defaultLocale={defaultLocale}
              assets={assetUrls}
              selectedSectionId={selectedSectionId}
              onPickSection={pickFromPreview}
              onOpenSeparately={() => (dirty ? setMessage({ tone: 'error', text: 'Сначала сохраните черновик.' }) : void openPreview(base.id))}
              mode={previewMode}
              setMode={setPreviewMode}
              onInlineEdit={inlineEdit}
              readOnly={readOnly}
            />
          </div>
        </div>
      </Stack>

      <AssetPicker
        kind={picker?.kind ?? null}
        assets={assets}
        onClose={() => setPicker(null)}
        onPick={(asset) => {
          picker?.onPick(asset);
          setPicker(null);
        }}
      />
      <DiffOverlay title={diff?.title ?? null} changes={diff?.changes ?? []} onClose={() => setDiff(null)} />
      <HistoryOverlay
        open={historyOpen}
        versions={versions}
        bookmarks={bookmarks}
        onBookmark={toggleBookmark}
        readOnly={readOnly}
        busy={busy}
        error={historyError}
        onClose={() => setHistoryOpen(false)}
        onPreview={(v) => void openPreview(v.id)}
        onCompare={async (v) => {
          setBusy(true);
          const r = await diffAction(base.id, v.id);
          setBusy(false);
          if (r.ok) setDiff({ title: `Версия ${v.revision} и черновик ${base.revision}`, changes: r.data.changes });
          else setHistoryError(r.message);
        }}
        onRestore={async (v) => {
          const ok = await ask({
            title: `Восстановить версию ${v.revision} как новый черновик?`,
            body: dirty
              ? 'Появится новая версия черновика с содержимым этой версии. Ваши несохранённые изменения пропадут. Опубликованный сайт не изменится.'
              : 'Появится новая версия черновика с содержимым этой версии. Опубликованный сайт не изменится.',
            confirmLabel: 'Восстановить',
          });
          if (!ok) return;
          setHistoryError(null);
          if ((await restore(v.id, v.revision, setHistoryError)) !== 'error') setHistoryOpen(false);
        }}
      />
    </EditorProvider>
  );
}
