'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  PATCH_INSTRUCTION_MAX,
  SITE_EDITOR_SECTIONS,
  SITE_SPEC_MAX_BYTES,
  applySiteTemplate,
  canonicalByteLength,
  canonicalJson,
  currentSiteTemplate,
  localizedText,
  setInlineText,
  siteTemplatesFor,
  validateSiteSpec,
} from '@pms/domain';
import { Chip, ChipGroup } from '../../../../components/chip';
import { Alert, Button, cx } from '../../../../components/ui';
import { useConfirm } from '../../../../components/use-confirm';
import type { EditorReply, GenerationRunView, SiteAssetView } from '../../../../lib/api';
import { appendDictated, useDictation } from '../../../../lib/use-dictation';
import { verticalCopy } from '../../../../lib/vertical-copy';
import type { WebVertical } from '../../../../lib/vertical-landing';
import { patchAction, restoreAction, saveDraftAction, sectionAction, versionAction } from './actions';
import { BuildProgress, errorText } from './ai-chat';
import type { Spec } from './fields';
import { SitePreview } from './preview';
import { useGenerationRun } from './run';

/**
 * Простой редактор сайта (SITE-1, поручение владельца 15.10.2026: «сложно там всё редактировать»). Одна страница без
 * вкладок: слева живой сайт, справа одна панель. Щелчок по тексту на сайте правит его прямо на месте, щелчок по блоку
 * делает его целью ИИ. Справа «Изменить с ИИ» (поле, подсказки-чипы, диктовка) и «Шаблон» (три шаблона сегмента
 * одним касанием, тексты и фото не теряются). Сохранение само, через секунду после правки; одна главная кнопка
 * «Опубликовать». Страницы, блоки, языки, SEO и история версий в «Расширенном режиме» (прежний редактор MKT9).
 */
interface Base {
  id: string;
  revision: number;
  spec: Spec;
}
type Rec = Record<string, unknown>;
type SaveState = { kind: 'saved' } | { kind: 'saving' } | { kind: 'pending' } | { kind: 'error'; text: string } | { kind: 'conflict' };

const AUTOSAVE_MS = 1000;
const HISTORY_LIMIT = 50;
const pagesOf = (spec: Spec) => (spec['pages'] as Rec[] | undefined) ?? [];
const sectionsOf = (page: Rec | undefined) => (page?.['sections'] as Rec[] | undefined) ?? [];
const homeId = (spec: Spec) => {
  const pages = pagesOf(spec);
  return String((pages.find((p) => p['isHome'] === true) ?? pages[0])?.['id'] ?? '') || null;
};

export function SimpleSiteEditor({
  vertical,
  base: initialBase,
  published,
  locationName,
  assets,
  readOnly,
}: {
  vertical: WebVertical;
  base: Base;
  published: { id: string; revision: number } | null;
  locationName: string;
  assets: SiteAssetView[];
  readOnly: boolean;
}) {
  const copy = verticalCopy(vertical);
  const templates = useMemo(() => siteTemplatesFor(vertical), [vertical]);
  const [base, setBase] = useState<Base>(initialBase);
  const [spec, setSpec] = useState<Spec>(initialBase.spec);
  const specRef = useRef(spec);
  specRef.current = spec;
  const baseRef = useRef(base);
  baseRef.current = base;
  const [past, setPast] = useState<Spec[]>([]);
  const lastKey = useRef<string | null>(null);
  const [state, setState] = useState<SaveState>({ kind: 'saved' });
  const [previewPage, setPreviewPage] = useState<string | null>(() => homeId(initialBase.spec));
  const [target, setTarget] = useState<{ pageId: string; sectionId: string } | null>(null);
  const [text, setText] = useState('');
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiDone, setAiDone] = useState<{ before: string; beforeRevision: number } | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const { ask, dialog } = useConfirm();

  const dirty = useMemo(() => canonicalJson(spec) !== canonicalJson(base.spec), [spec, base]);
  const assetUrls = useMemo(() => Object.fromEntries(assets.filter((a) => a.previewUrl).map((a) => [a.id, a.previewUrl as string])), [assets]);
  const current = currentSiteTemplate(spec, vertical);
  const site = (spec['site'] as Rec | undefined) ?? {};
  const locale = typeof site['defaultLocale'] === 'string' ? site['defaultLocale'] : 'ru';
  const locales = (site['locales'] as string[] | undefined) ?? ['ru'];

  const edit = useCallback((next: Spec, key: string | null) => {
    const prev = specRef.current;
    if (canonicalJson(next) === canonicalJson(prev)) return;
    if (key === null || key !== lastKey.current) setPast((p) => [...p.slice(-(HISTORY_LIMIT - 1)), prev]);
    lastKey.current = key;
    specRef.current = next;
    setSpec(next);
  }, []);
  const undo = () => {
    const prev = past[past.length - 1];
    if (!prev) return;
    setPast((p) => p.slice(0, -1));
    lastKey.current = null;
    specRef.current = prev;
    setSpec(prev);
  };

  /** Сохранение версией поверх головы; вызывается само после паузы в правках и перед просьбой к ИИ */
  const save = useCallback(async (): Promise<Base | null> => {
    const doc = specRef.current;
    const head = baseRef.current;
    if (canonicalJson(doc) === canonicalJson(head.spec)) return head;
    if (canonicalByteLength(doc) > SITE_SPEC_MAX_BYTES) {
      setState({ kind: 'error', text: 'Сайт слишком большой: уберите часть текста' });
      return null;
    }
    const local = validateSiteSpec(doc);
    if (!local.ok) {
      setState({ kind: 'error', text: `Не сохранено: ${local.errors[0]?.message ?? 'проверьте последнюю правку'}` });
      return null;
    }
    setState({ kind: 'saving' });
    const reply = await saveDraftAction(head.revision, doc);
    if (!reply.ok) {
      setState(reply.status === 409 && reply.code === 'VERSION_CONFLICT' ? { kind: 'conflict' } : { kind: 'error', text: `Не сохранено: ${reply.message}` });
      return null;
    }
    const next = { id: reply.data.version.id, revision: reply.data.version.revision, spec: doc };
    baseRef.current = next;
    setBase(next);
    setState(canonicalJson(specRef.current) === canonicalJson(doc) ? { kind: 'saved' } : { kind: 'pending' });
    return next;
  }, []);

  // автосохранение: через секунду после последней правки
  useEffect(() => {
    if (!dirty || readOnly || state.kind === 'conflict' || state.kind === 'saving') return;
    setState((s) => (s.kind === 'error' ? s : { kind: 'pending' }));
    const timer = setTimeout(() => void save(), AUTOSAVE_MS);
    return () => clearTimeout(timer);
    // state намеренно не в зависимостях: таймер перезапускает только правка
  }, [spec, dirty, readOnly, save]);

  // уход со страницы, пока правка не сохранена: вопрос браузера
  useEffect(() => {
    if (!dirty) return;
    const onUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [dirty]);

  const loadVersion = async (id: string) => {
    const r = await versionAction(id);
    if (!r.ok) return setAiError(r.message);
    const next = { id: r.data.version.id, revision: r.data.version.revision, spec: r.data.version.spec as Spec };
    baseRef.current = next;
    setBase(next);
    specRef.current = next.spec;
    setSpec(next.spec);
    setPast([]);
    lastKey.current = null;
    setState({ kind: 'saved' });
  };

  const job = useGenerationRun(async (run) => {
    if (run.status === 'SUCCEEDED' && run.outputVersionId) await loadVersion(run.outputVersionId);
    else setAiError(errorText(run.errorCode));
  });

  const dictation = useDictation({
    onText: (phrase) => setText((prev) => appendDictated(prev, phrase, PATCH_INSTRUCTION_MAX)),
    onError: setAiError,
  });

  const where = (() => {
    if (!target) return null;
    const page = pagesOf(spec).find((p) => String(p['id']) === target.pageId);
    const section = sectionsOf(page).find((s) => String(s['id']) === target.sectionId);
    if (!section) return null;
    const type = SITE_EDITOR_SECTIONS[String(section['type'])]?.label ?? 'Блок';
    const heading = localizedText(section['heading'], locale);
    return heading ? `${type}: ${heading}` : type;
  })();

  const sendAi = async () => {
    if (readOnly || job.active) return;
    const ask = text.trim();
    if (!ask && !target) return;
    dictation.stop();
    setAiError(null);
    setAiDone(null);
    const head = await save();
    if (!head) return;
    const reply: EditorReply<{ run: GenerationRunView }> =
      target && where ? await sectionAction(head.id, target.pageId, target.sectionId, ask) : await patchAction(head.id, ask);
    if (!reply.ok) return setAiError(reply.message);
    setStartedAt(Date.now());
    setAiDone({ before: head.id, beforeRevision: head.revision });
    setText('');
    job.start(reply.data.run);
  };

  /** «Вернуть как было»: версия до просьбы к ИИ становится новой головой; опубликованный сайт не меняется */
  const revertAi = async () => {
    if (!aiDone) return;
    const ok = await ask({ title: 'Вернуть сайт как было до ИИ?', body: 'Правки ИИ уйдут из черновика. Опубликованный сайт не изменится.', confirmLabel: 'Вернуть' });
    if (!ok) return;
    const r = await restoreAction(aiDone.before, baseRef.current.revision);
    if (!r.ok) return setAiError(r.message);
    await loadVersion(r.data.version.id);
    setAiDone(null);
  };

  const pickTemplate = (id: string) => {
    if (readOnly) return;
    const next = applySiteTemplate(specRef.current, id);
    if (next) edit(next as Spec, null);
  };

  const inlineEdit = (path: string, loc: string, value: string) => {
    const r = setInlineText(specRef.current, path, loc, value);
    if (!r.ok) return setState({ kind: 'error', text: r.message });
    edit(r.spec as Spec, `inline:${path}:${loc}`);
  };

  const status =
    state.kind === 'saving' || state.kind === 'pending'
      ? 'Сохраняем…'
      : state.kind === 'error'
        ? state.text
        : state.kind === 'conflict'
          ? 'Сайт изменили в другой вкладке'
          : published && published.id === base.id
            ? 'Сохранено, опубликовано'
            : published
              ? 'Сохранено, есть неопубликованные изменения'
              : 'Сохранено, ещё не опубликован';
  const busy = job.active;
  const chips = copy.siteEditChips;

  return (
    <div className="simple-ed" data-testid="site-editor">
      {dialog}
      <div className="simple-ed__bar" data-testid="ed-bar">
        <p className="simple-ed__name" data-testid="ed-project">
          <b>{locationName}</b>
          <span className={cx('simple-ed__status', (state.kind === 'error' || state.kind === 'conflict') && 'is-error')} role="status" data-testid="ed-dirty">
            {status}
          </span>
        </p>
        <div className="simple-ed__actions">
          <Button type="button" tone="ghost" disabled={readOnly || past.length === 0} onClick={undo} data-testid="ed-undo">
            Отменить
          </Button>
          <Link className="btn btn--secondary" href="/marketing/site/editor?full=1" data-testid="ed-advanced">
            Расширенный режим
          </Link>
          <Link className="btn" href="/marketing/site" data-testid="editor-publication-link">
            Опубликовать
          </Link>
        </div>
      </div>

      {state.kind === 'conflict' && (
        <Alert boxed data-testid="ed-conflict">
          Сайт уже изменили в другой вкладке или ИИ. Обновите страницу, чтобы продолжить с последней версией.{' '}
          <Button type="button" size="sm" tone="secondary" onClick={() => window.location.reload()}>
            Обновить
          </Button>
        </Alert>
      )}

      <div className="simple-ed__grid">
        <div className="simple-ed__site">
          <SitePreview
            spec={spec}
            pageId={previewPage}
            onPage={setPreviewPage}
            locales={locales}
            defaultLocale={locale}
            assets={assetUrls}
            selectedSectionId={target?.sectionId ?? null}
            onPickSection={(pageId, sectionId) => setTarget({ pageId, sectionId })}
            onOpenSeparately={() => undefined}
            mode="simple"
            setMode={() => undefined}
            onInlineEdit={inlineEdit}
            readOnly={readOnly}
            simple
          />
        </div>

        <aside className="simple-ed__panel" aria-label="Изменить сайт">
          <form
            className="simple-ed__card"
            aria-labelledby="simple-ai-title"
            data-testid="ed-ai"
            onSubmit={(e) => {
              e.preventDefault();
              void sendAi();
            }}
          >
            <h2 id="simple-ai-title" className="simple-ed__title">
              Изменить с ИИ
            </h2>
            {target && where ? (
              <p className="simple-ed__target" data-testid="ed-ai-target">
                <span>
                  Блок «{where}»
                </span>
                <Button type="button" tone="ghost" size="sm" onClick={() => setTarget(null)} aria-label="Убрать блок: изменить весь сайт">
                  Весь сайт
                </Button>
              </p>
            ) : (
              <p className="muted simple-ed__hint">Опишите словами, что поменять. Чтобы изменить один блок, щёлкните его на сайте.</p>
            )}
            <label htmlFor="simple-ai-text" className="sr-only">
              Что изменить на сайте?
            </label>
            <textarea
              id="simple-ai-text"
              className="simple-ed__text"
              rows={4}
              maxLength={PATCH_INSTRUCTION_MAX}
              placeholder={target ? 'Например: короче и теплее' : 'Например: сделай тексты проще и добавь про парковку'}
              value={text}
              disabled={readOnly || busy}
              onChange={(e) => setText(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  void sendAi();
                }
              }}
            />
            <ChipGroup label="Частые просьбы" className="simple-ed__chips">
              {chips.map((chip) => (
                <Chip key={chip} selected={text === chip} disabled={readOnly || busy} onClick={() => setText(chip)} data-testid="ed-chip">
                  {chip}
                </Chip>
              ))}
            </ChipGroup>
            <div className="simple-ed__row">
              {dictation.supported && (
                <Button type="button" tone="secondary" aria-pressed={dictation.listening} disabled={readOnly || busy} onClick={() => dictation.toggle()} data-testid="ed-mic">
                  {dictation.listening ? 'Остановить' : 'Надиктовать'}
                </Button>
              )}
              <Button type="submit" disabled={readOnly || busy || (!text.trim() && !target)} data-testid="ed-ai-send">
                {busy ? 'ИИ меняет сайт…' : 'Изменить'}
              </Button>
            </div>
            {busy && (
              <div role="status" data-testid="ed-ai-state">
                <BuildProgress startedAt={startedAt} />
              </div>
            )}
            {aiError && (
              <p className="ed-error" role="alert" data-testid="ed-ai-error">
                {aiError}
              </p>
            )}
            {!busy && aiDone && !aiError && (
              <div className="simple-ed__done" data-testid="ed-ai-done">
                <p>Готово: сайт слева уже с правками.</p>
                <Button type="button" tone="ghost" size="sm" disabled={readOnly} onClick={() => void revertAi()} data-testid="ed-ai-revert">
                  Вернуть как было
                </Button>
              </div>
            )}
          </form>

          <section className="simple-ed__card" aria-labelledby="simple-tpl-title" data-testid="ed-templates">
            <h2 id="simple-tpl-title" className="simple-ed__title">
              Шаблон
            </h2>
            <p className="muted simple-ed__hint">Тексты, фото и цены останутся, поменяется оформление.</p>
            <div className="simple-ed__tpls" role="radiogroup" aria-labelledby="simple-tpl-title">
              {templates.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  role="radio"
                  aria-checked={current?.id === tpl.id}
                  disabled={readOnly || busy}
                  className={cx('simple-ed__tpl', current?.id === tpl.id && 'is-on')}
                  onClick={() => pickTemplate(tpl.id)}
                  data-testid="ed-template"
                  data-template={tpl.id}
                >
                  <span className={cx('ed-design__swatch', `is-${tpl.direction.theme.preset.toLowerCase()}`)} aria-hidden="true" />
                  <b>{tpl.name}</b>
                  <span className="muted">{tpl.description}</span>
                </button>
              ))}
            </div>
          </section>

          <nav className="simple-ed__card simple-ed__more" aria-label="Ещё">
            <h2 className="simple-ed__title">Ещё</h2>
            <Link href="/marketing/site/assets" className="simple-ed__link" data-testid="editor-assets-link">
              Фото и логотип
            </Link>
            <Link href="/marketing/site/editor?full=1" className="simple-ed__link">
              Страницы, блоки, SEO и история версий
            </Link>
          </nav>
        </aside>
      </div>
    </div>
  );
}
