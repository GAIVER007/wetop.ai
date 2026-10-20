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
import { Chip } from '../../../../components/chip';
import { Alert, Button, cx } from '../../../../components/ui';
import { useConfirm } from '../../../../components/use-confirm';
import type { EditorReply, GenerationRunView, SiteAssetView, SiteConversationItem } from '../../../../lib/api';
import { appendDictated, useDictation } from '../../../../lib/use-dictation';
import { verticalCopy } from '../../../../lib/vertical-copy';
import type { WebVertical } from '../../../../lib/vertical-landing';
import { conversationAction, patchAction, restoreAction, saveDraftAction, sectionAction, versionAction } from './actions';
import { BuildProgress, errorText } from './ai-chat';
import type { Spec } from './fields';
import { SitePreview } from './preview';
import { useGenerationRun } from './run';

/**
 * Простой редактор сайта как у Lovable (SITE-1, поручение владельца 15.10.2026): слева чат с ИИ (лента разговора,
 * итоги правок с «Вернуть как было», подсказки-чипы, поле с микрофоном и отправкой), справа сам сайт во всю высоту.
 * Сверху тонкая полоса: страница, ширина, шаблон, «Опубликовать». Щелчок по тексту на сайте правит его на месте,
 * щелчок по блоку делает его целью ИИ. Сохранение само через секунду. Страницы, блоки, SEO и история версий в
 * «Расширенном режиме» (прежний редактор MKT9, `?full=1`).
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
const running = (i: SiteConversationItem) => i.status === 'QUEUED' || i.status === 'RUNNING';

export function SimpleSiteEditor({
  vertical,
  base: initialBase,
  published,
  locationName,
  assets,
  conversation,
  readOnly,
}: {
  vertical: WebVertical;
  base: Base;
  published: { id: string; revision: number } | null;
  locationName: string;
  assets: SiteAssetView[];
  conversation: SiteConversationItem[];
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
  const [items, setItems] = useState<SiteConversationItem[]>(conversation.filter((i) => i.kind === 'BUILD'));
  const [startedAt, setStartedAt] = useState(0);
  const [tplOpen, setTplOpen] = useState(false);
  const [reverted, setReverted] = useState<string[]>([]);
  const feed = useRef<HTMLOListElement>(null);
  const { ask, dialog } = useConfirm();

  const dirty = useMemo(() => canonicalJson(spec) !== canonicalJson(base.spec), [spec, base]);
  const assetUrls = useMemo(() => Object.fromEntries(assets.filter((a) => a.previewUrl).map((a) => [a.id, a.previewUrl as string])), [assets]);
  const current = currentSiteTemplate(spec, vertical);
  const site = (spec['site'] as Rec | undefined) ?? {};
  const locale = typeof site['defaultLocale'] === 'string' ? site['defaultLocale'] : 'ru';
  const locales = (site['locales'] as string[] | undefined) ?? ['ru'];

  useEffect(() => {
    feed.current?.lastElementChild?.scrollIntoView?.({ block: 'nearest' });
  }, [items.length]);

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

  /** Сохранение версией поверх головы; само после паузы в правках и перед просьбой к ИИ */
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

  useEffect(() => {
    if (!dirty || readOnly || state.kind === 'conflict' || state.kind === 'saving') return;
    setState((s) => (s.kind === 'error' ? s : { kind: 'pending' }));
    const timer = setTimeout(() => void save(), AUTOSAVE_MS);
    return () => clearTimeout(timer);
    // таймер перезапускает только правка
  }, [spec, dirty, readOnly, save]);

  useEffect(() => {
    if (!dirty) return;
    const onUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [dirty]);

  const refreshFeed = async () => {
    const r = await conversationAction();
    if (r.ok) setItems(r.data.items.filter((i) => i.kind === 'BUILD'));
  };
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
    void refreshFeed();
  });
  // задача, начатая до обновления страницы, продолжает опрашиваться
  useEffect(() => {
    const live = conversation.find((i) => i.kind === 'BUILD' && running(i));
    if (live) job.start({ id: live.id, type: live.mode as GenerationRunView['type'], status: live.status, baseVersionId: live.baseVersionId, outputVersionId: null, errorCode: null });
    // только при открытии
  }, []);

  const dictation = useDictation({
    onText: (phrase) => setText((prev) => appendDictated(prev, phrase, PATCH_INSTRUCTION_MAX)),
    onError: setAiError,
  });

  const labelOf = (t: { pageId: string; sectionId: string } | null, doc: Spec = spec) => {
    if (!t) return null;
    const page = pagesOf(doc).find((p) => String(p['id']) === t.pageId);
    const section = sectionsOf(page).find((s) => String(s['id']) === t.sectionId);
    if (!section) return null;
    const type = SITE_EDITOR_SECTIONS[String(section['type'])]?.label ?? 'Блок';
    const heading = localizedText(section['heading'], locale);
    return heading ? `${type}: ${heading}` : type;
  };
  const where = labelOf(target);
  const busy = job.active;

  const sendAi = async () => {
    if (readOnly || busy) return;
    const say = text.trim();
    if (!say && !where) return;
    dictation.stop();
    setAiError(null);
    const head = await save();
    if (!head) return;
    const reply: EditorReply<{ run: GenerationRunView }> =
      target && where ? await sectionAction(head.id, target.pageId, target.sectionId, say) : await patchAction(head.id, say);
    if (!reply.ok) return setAiError(reply.message);
    setStartedAt(Date.now());
    setText('');
    job.start(reply.data.run);
    void refreshFeed();
  };

  /** «Вернуть как было»: версия до этой правки ИИ становится новой головой; опубликованный сайт не меняется */
  const revert = async (item: SiteConversationItem) => {
    if (!item.baseVersionId) return;
    const ok = await ask({ title: 'Вернуть сайт как было до этой правки?', body: 'Изменения ИИ уйдут из черновика. Опубликованный сайт не изменится.', confirmLabel: 'Вернуть' });
    if (!ok) return;
    const r = await restoreAction(item.baseVersionId, baseRef.current.revision);
    if (!r.ok) return setAiError(r.message);
    await loadVersion(r.data.version.id);
    setReverted((ids) => [...ids, item.id]);
    void refreshFeed();
  };

  const pickTemplate = (id: string) => {
    if (readOnly) return;
    const next = applySiteTemplate(specRef.current, id);
    if (next) edit(next as Spec, null);
    setTplOpen(false);
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
  const lastDone = [...items].reverse().find((i) => i.status === 'SUCCEEDED' && i.outputVersionId);

  return (
    <div className="lov-ed" data-testid="site-editor">
      {dialog}
      <section className="lov-ed__chat" aria-labelledby="lov-chat-title" data-testid="ed-ai">
        <header className="lov-ed__chat-head">
          <h2 id="lov-chat-title" className="lov-ed__project" data-testid="ed-project">
            {locationName}
          </h2>
          <p className={cx('lov-ed__status', (state.kind === 'error' || state.kind === 'conflict') && 'is-error')} role="status" data-testid="ed-dirty">
            {status}
          </p>
        </header>

        <div className="lov-ed__feed-wrap">
          {items.length === 0 ? (
            <div className="lov-ed__empty">
              <p>
                <b>Напишите, что поменять на сайте.</b>
              </p>
              <p className="muted">Например: «сделай тексты короче» или «добавь про парковку». Чтобы изменить один блок, щёлкните его на сайте справа. Текст на сайте можно исправить прямо там.</p>
            </div>
          ) : (
            <ol className="lov-ed__feed" ref={feed} aria-label="Разговор с ИИ" data-testid="ed-feed">
              {items.map((item) => (
                <li key={item.id} className="lov-ed__turn" data-testid="ed-feed-item">
                  <p className="lov-ed__ask">{item.userText || (item.target ? `Обновить блок «${labelOf(item.target) ?? 'блок'}»` : 'Обновить сайт')}</p>
                  {running(item) && (
                    <div className="lov-ed__reply" role="status" data-testid="ed-ai-state">
                      <BuildProgress startedAt={startedAt || Date.parse(item.createdAt)} />
                    </div>
                  )}
                  {item.status === 'FAILED' && (
                    <div className="lov-ed__reply is-error" role="alert" data-testid="ed-ai-error">
                      <p>{errorText(item.errorCode)}</p>
                      {item.userText && (
                        <Button type="button" tone="ghost" size="sm" onClick={() => setText(item.userText ?? '')}>
                          Повторить
                        </Button>
                      )}
                    </div>
                  )}
                  {item.status === 'SUCCEEDED' && (
                    <div className="lov-ed__result" data-testid="ed-ai-done">
                      <p>
                        <b>Готово.</b> Сайт справа уже с правками.
                      </p>
                      {reverted.includes(item.id) && (
                        <p className="muted" data-testid="ed-ai-reverted">
                          Возвращено как было.
                        </p>
                      )}
                      {item.id === lastDone?.id && item.baseVersionId && !reverted.includes(item.id) && (
                        <Button type="button" tone="secondary" size="sm" disabled={readOnly || busy} onClick={() => void revert(item)} data-testid="ed-ai-revert">
                          Вернуть как было
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
          {aiError && (
            <p className="ed-error" role="alert" data-testid="ed-ai-send-error">
              {aiError}
            </p>
          )}
        </div>

        <div className="lov-ed__chips" role="group" aria-label="Частые просьбы">
          {copy.siteEditChips.map((chip) => (
            <Chip key={chip} size="sm" selected={text === chip} disabled={readOnly || busy} onClick={() => setText(chip)} data-testid="ed-chip">
              {chip}
            </Chip>
          ))}
        </div>

        <form
          className="lov-ed__composer"
          onSubmit={(e) => {
            e.preventDefault();
            void sendAi();
          }}
        >
          {where && (
            <p className="lov-ed__target" data-testid="ed-ai-target">
              <span>Блок «{where}»</span>
              <Button type="button" tone="ghost" size="sm" onClick={() => setTarget(null)} aria-label="Убрать блок: изменить весь сайт">
                Весь сайт
              </Button>
            </p>
          )}
          <label htmlFor="lov-ai-text" className="sr-only">
            Что изменить на сайте?
          </label>
          <textarea
            id="lov-ai-text"
            className="lov-ed__input"
            rows={3}
            maxLength={PATCH_INSTRUCTION_MAX}
            placeholder={where ? 'Что изменить в этом блоке?' : 'Что изменить на сайте?'}
            value={text}
            disabled={readOnly || busy}
            onChange={(e) => setText(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void sendAi();
              }
            }}
          />
          <div className="lov-ed__tools">
            <Button type="button" tone="ghost" size="sm" disabled={readOnly || past.length === 0} onClick={undo} data-testid="ed-undo">
              Отменить правку
            </Button>
            <span className="lov-ed__grow" />
            {dictation.supported && (
              <Button
                type="button"
                tone="secondary"
                size="sm"
                aria-pressed={dictation.listening}
                aria-label={dictation.listening ? 'Остановить диктовку' : 'Надиктовать'}
                disabled={readOnly || busy}
                onClick={() => dictation.toggle()}
                data-testid="ed-mic"
              >
                {dictation.listening ? 'Стоп' : 'Голос'}
              </Button>
            )}
            <Button type="submit" size="sm" disabled={readOnly || busy || (!text.trim() && !where)} data-testid="ed-ai-send">
              {busy ? 'ИИ работает…' : 'Отправить'}
            </Button>
          </div>
        </form>
      </section>

      <section className="lov-ed__stage" aria-label="Сайт">
        <div className="lov-ed__bar" data-testid="ed-bar">
          <div className="lov-ed__tpl">
            <Button type="button" tone="secondary" aria-expanded={tplOpen} aria-controls="lov-tpl-list" onClick={() => setTplOpen((o) => !o)} data-testid="ed-template-open">
              Шаблон: {current?.name ?? 'свой'}
            </Button>
            {tplOpen && (
              <div id="lov-tpl-list" className="lov-ed__tpl-list" role="radiogroup" aria-label="Шаблон сайта" data-testid="ed-templates">
                <p className="muted">Тексты, фото и цены останутся, поменяется оформление.</p>
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
            )}
          </div>
          <span className="lov-ed__grow" />
          <Link className="btn btn--ghost" href="/marketing/site/assets" data-testid="editor-assets-link">
            Фото
          </Link>
          <Link className="btn btn--ghost" href="/marketing/site/editor?full=1" data-testid="ed-advanced">
            Расширенный режим
          </Link>
          <Link className="btn" href="/marketing/site" data-testid="editor-publication-link">
            Опубликовать
          </Link>
        </div>
        {state.kind === 'conflict' && (
          <Alert boxed data-testid="ed-conflict">
            Сайт уже изменили в другой вкладке или ИИ.{' '}
            <Button type="button" size="sm" tone="secondary" onClick={() => window.location.reload()}>
              Обновить
            </Button>
          </Alert>
        )}
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
      </section>
    </div>
  );
}
