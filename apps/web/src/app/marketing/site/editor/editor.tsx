'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  PATCH_INSTRUCTION_MAX,
  SECTION_INSTRUCTION_MAX,
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
import type { EditorReply, GenerationRunView, SiteAssetView, SiteChangeView, SiteSpecErrorView, SiteVersionMeta } from '../../../../lib/api';
import { Alert, Button, Notice, Panel, Stack, cx } from '../../../../components/ui';
import { useConfirm } from '../../../../components/use-confirm';
import {
  diffAction,
  editorPreviewAction,
  patchAction,
  restoreAction,
  saveDraftAction,
  sectionAction,
  versionAction,
  versionsAction,
} from './actions';
import { EditorProvider, type AssetKind, type EditorContextValue, type Spec } from './fields';
import { AiCommand, PageForm, SectionForm, SiteForm } from './forms';
import { AssetPicker, DiffOverlay, HistoryOverlay } from './overlays';
import { pathString, setAt, type Path } from './paths';
import { RUN_STATE, runErrorText, useGenerationRun } from './run';
import { Structure, type Selection } from './structure';

/**
 * Редактор управляемого сайта (MKT9, `docs/marketing/site-editor-v0.md`). Одно состояние: документ SiteSpec целиком;
 * «изменено» значит, что его каноническая запись отличается от загруженной версии (порядок ключей не в счёт).
 * Сохранение только кнопкой и только новой версией с `baseRevision` открытой; 409 и любая ошибка ввод не стирают.
 * ИИ правит сохранённую голову; пока он работает, ручная правка разрешена, и тогда результат ИИ не применяется.
 */
interface Base {
  id: string;
  revision: number;
  spec: Spec;
}
type Tab = 'structure' | 'editor' | 'settings';
type Message = { tone: 'ok' | 'error'; text: string };

const ASSET_PROBLEM = 'Изображения нет в библиотеке филиала или оно другого назначения: выберите другое';

function firstSelection(spec: Spec): Selection {
  const pages = (spec['pages'] as Array<Record<string, unknown>> | undefined) ?? [];
  return pages[0] && ((pages[0]['sections'] as unknown[]) ?? []).length ? { kind: 'section', page: 0, section: 0 } : { kind: 'site' };
}

function valid(spec: Spec, s: Selection): Selection {
  const pages = (spec['pages'] as Array<Record<string, unknown>> | undefined) ?? [];
  if (s.kind === 'site') return s;
  const page = pages[s.page];
  if (!page) return { kind: 'site' };
  if (s.kind === 'page') return s;
  return ((page['sections'] as unknown[]) ?? [])[s.section] ? s : { kind: 'page', page: s.page };
}

/** Где ошибка, словами: страница и секция по документу, иначе «Настройки сайта» */
function whereOf(spec: Spec, path: string, locale: string): string {
  const at = errorLocation(path);
  if (at.area === 'site') return path.startsWith('navigation') ? 'Навигация' : 'Настройки сайта';
  const page = ((spec['pages'] as Array<Record<string, unknown>> | undefined) ?? [])[at.pageIndex];
  const title = localizedText(page?.['title'], locale) || `Страница ${at.pageIndex + 1}`;
  if (at.sectionIndex === null) return `Страница «${title}»`;
  const section = ((page?.['sections'] as Array<Record<string, unknown>> | undefined) ?? [])[at.sectionIndex];
  const label = SITE_EDITOR_SECTIONS[String(section?.['type'])]?.label ?? 'Секция';
  return `Страница «${title}», ${label.toLowerCase()}`;
}

export function SiteEditor({
  base: initialBase,
  published,
  versions: initialVersions,
  categories,
  assets,
  readOnly,
}: {
  base: Base;
  published: { id: string; revision: number } | null;
  versions: SiteVersionMeta[];
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
  const [selection, setSelection] = useState<Selection>(() => firstSelection(initialBase.spec));
  const [tab, setTab] = useState<Tab>('editor');
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
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiDone, setAiDone] = useState<{ revision: number; from: string; to: string } | null>(null);
  const { ask, dialog } = useConfirm();
  const leaving = useRef(false);

  const site = (spec['site'] as Record<string, unknown> | undefined) ?? {};
  const locales = ((site['locales'] as string[] | undefined) ?? ['ru']).filter((l) => SITE_SPEC_LOCALES.includes(l as never));
  const defaultLocale = typeof site['defaultLocale'] === 'string' ? site['defaultLocale'] : 'ru';
  const current = valid(spec, selection);

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
  const select = (next: Selection) => {
    setSelection(next);
    setTab('editor');
  };
  const confirm = (title: string, body: string) => ask({ title, body, confirmLabel: 'Удалить', tone: 'danger' });

  const refreshVersions = async () => {
    const r = await versionsAction();
    if (r.ok) setVersions(r.versions);
    return r.ok ? r.versions : versions;
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

  const save = async () => {
    setMessage(null);
    setAiDone(null);
    if (canonicalByteLength(spec) > SITE_SPEC_MAX_BYTES) {
      setMessage({ tone: 'error', text: 'Черновик слишком большой: уберите часть страниц, секций или текста' });
      return;
    }
    // подсказка до отправки тем же валидатором, что у сервера; судья всё равно сервер
    const local = validateSiteSpec(spec);
    if (!local.ok) {
      setErrors(local.errors);
      setMessage({ tone: 'error', text: 'Черновик не сохранён: исправьте отмеченные поля' });
      return;
    }
    setSaving(true);
    const reply = await saveDraftAction(base.revision, spec);
    setSaving(false);
    if (!reply.ok) return failed(reply, 'Черновик не сохранён');
    setBase({ id: reply.data.version.id, revision: reply.data.version.revision, spec });
    setErrors([]);
    setConflict(false);
    setMessage({ tone: 'ok', text: `Черновик сохранён: версия ${reply.data.version.revision}` });
    void refreshVersions();
  };

  const job = useGenerationRun(async (run) => {
    void refreshVersions();
    if (run.status !== 'SUCCEEDED' || !run.outputVersionId) {
      setAiError(runErrorText(run));
      return;
    }
    const next = await loadAsBase(run.outputVersionId, !dirtyRef.current);
    if (!next) return;
    if (dirtyRef.current) setConflict(true);
    setAiDone({ revision: next.revision, from: run.baseVersionId ?? '', to: next.id });
  });
  const startAi = async (request: () => Promise<EditorReply<{ run: GenerationRunView }>>) => {
    setAiError(null);
    setAiDone(null);
    const reply = await request();
    if (reply.ok) job.start(reply.data.run);
    else setAiError(reply.message);
  };
  const aiBlocked = readOnly ? 'Только чтение' : dirty ? 'Сначала сохраните черновик' : null;

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
    select(at.area === 'site' ? { kind: 'site' } : at.sectionIndex === null ? { kind: 'page', page: at.pageIndex } : { kind: 'section', page: at.pageIndex, section: at.sectionIndex });
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

  const sectionAi =
    current.kind === 'section' ? (
      <details className="ed-ai-section">
        <summary>Изменить эту секцию с ИИ</summary>
        <AiCommand
          label="Что изменить в секции (необязательно)"
          button="Изменить секцию с ИИ"
          max={SECTION_INSTRUCTION_MAX}
          optional
          disabledReason={aiBlocked}
          busy={job.active}
          testId="ed-ai-section"
          onRun={(text) => {
            const page = ((spec['pages'] as Array<Record<string, unknown>>)[current.page])!;
            const section = ((page['sections'] as Array<Record<string, unknown>>)[current.section])!;
            void startAi(() => sectionAction(base.id, String(page['id']), String(section['id']), text));
          }}
        />
      </details>
    ) : null;

  const tabs: Array<[Tab, string]> = [
    ['structure', 'Структура'],
    ['editor', 'Редактор'],
    ['settings', 'Настройки'],
  ];

  return (
    <EditorProvider value={context}>
      {dialog}
      <Stack>
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
                  if (r.ok)
                    setDiff({ title: `Чем ваши правки отличаются от версии ${latest.revision}`, changes: diffSiteSpecs(r.data.version.spec, spec) });
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
        {job.run && job.active && (
          <Notice data-testid="ed-ai-state">
            {RUN_STATE[job.run.status]}. Если вы сохраните изменения сейчас, результат ИИ не будет применён.
          </Notice>
        )}
        {job.lost && <Alert boxed>{job.lost}</Alert>}
        {aiError && (
          <Alert boxed data-testid="ed-ai-error">
            {aiError}
          </Alert>
        )}
        {aiDone && (
          <Notice data-testid="ed-ai-done">
            <p>ИИ создал версию {aiDone.revision}</p>
            <div className="ed-row">
              <Button
                type="button"
                tone="secondary"
                size="sm"
                onClick={async () => {
                  const r = await diffAction(aiDone.to, aiDone.from);
                  if (r.ok) setDiff({ title: `Что изменил ИИ в версии ${aiDone.revision}`, changes: r.data.changes });
                  else setMessage({ tone: 'error', text: r.message });
                }}
              >
                Посмотреть изменения
              </Button>
              <Button type="button" tone="secondary" size="sm" onClick={() => void openPreview(aiDone.to)}>
                Предпросмотр
              </Button>
              <Button type="button" tone="ghost" size="sm" onClick={() => setAiDone(null)}>
                Продолжить редактирование
              </Button>
            </div>
          </Notice>
        )}

        <div className="ed-tabs" role="tablist" aria-label="Части редактора">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              id={`ed-tab-${key}`}
              aria-selected={tab === key}
              aria-controls={`ed-pane-${key}`}
              className={cx('ed-tab', tab === key && 'is-on')}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="ed-bar" data-testid="ed-bar">
          <span className="muted">{dirty ? 'Есть несохранённые изменения' : 'Все изменения сохранены'}</span>
          <Button type="button" size="sm" disabled={readOnly || !dirty || saving} onClick={() => void save()}>
            Сохранить черновик
          </Button>
        </div>

        <div className="site-editor" data-testid="site-editor">
          <div id="ed-pane-structure" role="tabpanel" aria-labelledby="ed-tab-structure" className={cx('site-editor__pane', tab === 'structure' && 'is-active')}>
            <Panel>
              <Structure selection={current} select={select} ask={confirm} />
            </Panel>
          </div>
          <div id="ed-pane-editor" role="tabpanel" aria-labelledby="ed-tab-editor" className={cx('site-editor__pane', tab === 'editor' && 'is-active')}>
            <Panel>
              {current.kind === 'site' && <SiteForm />}
              {current.kind === 'page' && <PageForm pageIndex={current.page} />}
              {current.kind === 'section' && <SectionForm key={`${current.page}-${current.section}`} pageIndex={current.page} sectionIndex={current.section} ai={sectionAi} />}
            </Panel>
          </div>
          <div id="ed-pane-settings" role="tabpanel" aria-labelledby="ed-tab-settings" className={cx('site-editor__pane', tab === 'settings' && 'is-active')}>
            <Stack>
              <Panel aria-label="Состояние черновика">
                <dl className="ed-status">
                  <div>
                    <dt>Черновик</dt>
                    <dd data-testid="ed-revision">версия {base.revision}</dd>
                  </div>
                  <div>
                    <dt>Опубликована</dt>
                    <dd>{published ? `версия ${published.revision}` : 'ещё нет'}</dd>
                  </div>
                </dl>
                <p className={cx('ed-dirty', dirty && 'is-dirty')} data-testid="ed-dirty">
                  {dirty ? 'Есть несохранённые изменения' : 'Все изменения сохранены'}
                </p>
                <div className="ed-side-actions">
                  <Button type="button" disabled={readOnly || !dirty || saving} onClick={() => void save()} data-testid="ed-save">
                    {saving ? 'Сохраняем…' : 'Сохранить черновик'}
                  </Button>
                  <Button
                    type="button"
                    tone="secondary"
                    data-testid="ed-preview"
                    onClick={() => (dirty ? setMessage({ tone: 'error', text: 'Сначала сохраните черновик.' }) : void openPreview(base.id))}
                  >
                    Предпросмотр
                  </Button>
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
                  <Link className="btn btn--secondary" href="/marketing/site">
                    Публикация
                  </Link>
                  <Link className="btn btn--secondary" href="/marketing/site/assets">
                    Изображения
                  </Link>
                </div>
              </Panel>
              <Panel aria-label="Изменить с помощью ИИ">
                <AiCommand
                  label="Что изменить с помощью ИИ?"
                  button="Изменить сайт"
                  max={PATCH_INSTRUCTION_MAX}
                  optional={false}
                  disabledReason={aiBlocked}
                  busy={job.active}
                  testId="ed-ai-patch"
                  onRun={(text) => void startAi(() => patchAction(base.id, text))}
                />
                <p className="muted">ИИ меняет тексты, оформление и секции. Название, контакты, языки, бронирование и SEO остаются как есть.</p>
              </Panel>
            </Stack>
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
          setBusy(true);
          setHistoryError(null);
          const r = await restoreAction(v.id, base.revision);
          setBusy(false);
          if (!r.ok) {
            if (r.code === 'VERSION_CONFLICT') {
              setHistoryOpen(false);
              setConflict(true);
            } else
              setHistoryError(
                r.code === 'ASSET_UNAVAILABLE'
                  ? 'В этой версии есть изображения, которых больше нет в библиотеке: восстановить её нельзя. Загрузите изображения заново или замените их в текущем черновике.'
                  : r.message,
              );
            return;
          }
          await loadAsBase(r.data.version.id, true);
          setErrors([]);
          setHistoryOpen(false);
          setMessage({ tone: 'ok', text: `Версия ${v.revision} восстановлена как черновик: версия ${r.data.version.revision}` });
          void refreshVersions();
        }}
      />
    </EditorProvider>
  );
}
