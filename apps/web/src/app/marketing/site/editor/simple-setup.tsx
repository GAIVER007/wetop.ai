'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  SIMPLE_BLOCKS,
  SITE_COPY_COUNT,
  applySiteTemplate,
  canonicalJson,
  SEO_DESCRIPTION_MAX,
  SEO_TITLE_MAX,
  currentSiteTemplate,
  heroTone,
  searchPreview,
  setAboutText,
  setGalleryPhotos,
  setHeroPhoto,
  setHeroText,
  setHomeSeo,
  setSiteIndexing,
  simpleSiteSeo,
  simpleSiteState,
  siteCopySuggestion,
  siteTemplatesFor,
  templateSiteSpec,
  toggleSiteBlock,
  type SimpleImage,
  type SiteFacts,
} from '@pms/domain';
import { Alert, Button, Input, Textarea, cx } from '../../../../components/ui';
import { useConfirm } from '../../../../components/use-confirm';
import type { SiteAssetView } from '../../../../lib/api';
import type { WebVertical } from '../../../../lib/vertical-landing';
import { publishSimpleAction, saveDraftAction, uploadSitePhotoAction } from './actions';
import type { Spec } from './fields';
import { SitePreview } from './preview';
import { TemplateGallery } from './template-gallery';
import { useT } from '../../../../i18n/locale-provider';

/**
 * Простой экран сайта (SITE-1, решение владельца 15.10.2026): сайт это зеркало данных WETOP (услуги, цены, мастера,
 * меню, часы, контакты меняются сами), а клиент делает пять вещей на одном экране: 1) шаблон, 2) фото, 3) тексты
 * с кнопкой «Предложить текст», 4) какие блоки показывать, 5) «Опубликовать». Слева шаги, справа живой сайт.
 * Сохранение само через секунду после правки. Чат с ИИ, страницы, SEO и история версий в «Расширенном режиме».
 */
interface Base {
  id: string;
  revision: number;
  spec: Spec;
}
type SaveState = 'saved' | 'pending' | 'saving' | 'error' | 'conflict';
const AUTOSAVE_MS = 1000;
const asImage = (a: SiteAssetView): SimpleImage => ({ assetId: a.id, alt: { ru: a.defaultAlt?.ru?.trim() || 'Фото' } }); // kk-allow: подпись ru-версии самого сайта, не текст стойки

export function SimpleSiteSetup({
  vertical,
  base: initialBase,
  published,
  siteUrl,
  locationName,
  facts,
  assets: initialAssets,
  readOnly,
  publish: publishTo = { href: '/marketing/site' },
}: {
  vertical: WebVertical;
  base: Base;
  published: { id: string; revision: number } | null;
  siteUrl: string | null;
  locationName: string;
  facts: SiteFacts | null;
  assets: SiteAssetView[];
  readOnly: boolean;
  /** Можно ли публиковать (аудит 17.10.2026, Д10, `publishTarget`): у салона и ресторана пока причина */
  publish?: { href: string } | { reason: string };
}) {
  const t = useT();
  const templates = useMemo(() => siteTemplatesFor(vertical), [vertical]);
  const [base, setBase] = useState<Base>(initialBase);
  const [spec, setSpec] = useState<Spec>(initialBase.spec);
  const [assets, setAssets] = useState<SiteAssetView[]>(initialAssets);
  const [state, setState] = useState<SaveState>('saved');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copyIndex, setCopyIndex] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(siteUrl);
  const [publishedId, setPublishedId] = useState<string | null>(published?.id ?? null);
  const specRef = useRef(spec);
  specRef.current = spec;
  const baseRef = useRef(base);
  baseRef.current = base;
  const { ask, dialog } = useConfirm();

  const st = simpleSiteState(spec);
  const seo = simpleSiteSeo(spec);
  const google = searchPreview(spec, url, locationName);
  const current = currentSiteTemplate(spec, vertical);
  const locale = String((spec['site'] as Record<string, unknown> | undefined)?.['defaultLocale'] ?? 'ru');
  const assetUrls = useMemo(() => Object.fromEntries(assets.filter((a) => a.previewUrl).map((a) => [a.id, a.previewUrl as string])), [assets]);
  const dirty = canonicalJson(spec) !== canonicalJson(base.spec);
  /** Шаблон по свежим данным: из него возвращаются выключенные блоки */
  const template = useMemo(() => {
    if (!facts) return null;
    return templateSiteSpec(facts, current?.id ?? templates[0]?.id) as Spec | null;
  }, [facts, current?.id, templates]);

  const apply = useCallback((next: Spec) => {
    if (next === specRef.current) return;
    specRef.current = next;
    setSpec(next);
    setError(null);
  }, []);

  const save = useCallback(async () => {
    const doc = specRef.current;
    const head = baseRef.current;
    if (canonicalJson(doc) === canonicalJson(head.spec)) return head;
    setState('saving');
    const reply = await saveDraftAction(head.revision, doc);
    if (!reply.ok) {
      setState(reply.status === 409 && reply.code === 'VERSION_CONFLICT' ? 'conflict' : 'error');
      setError(reply.message);
      return null;
    }
    const next = { id: reply.data.version.id, revision: reply.data.version.revision, spec: doc };
    baseRef.current = next;
    setBase(next);
    setState(canonicalJson(specRef.current) === canonicalJson(doc) ? 'saved' : 'pending');
    return next;
  }, []);

  useEffect(() => {
    if (!dirty || readOnly || state === 'conflict' || state === 'saving') return;
    setState('pending');
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

  const upload = async (files: FileList | null): Promise<SiteAssetView[]> => {
    if (!files?.length) return [];
    setBusy('upload');
    setError(null);
    const done: SiteAssetView[] = [];
    for (const file of Array.from(files).slice(0, 12)) {
      const form = new FormData();
      form.append('file', file);
      const r = await uploadSitePhotoAction(form);
      if (r.ok) done.push(r.asset);
      else setError(r.message);
    }
    setAssets((list) => [...done.filter((a) => !list.some((x) => x.id === a.id)), ...list]);
    setBusy(null);
    return done;
  };

  const suggest = () => {
    // с фактами филиала фраза первого экрана под стиль сайта (тон по шрифту темы), без выдумок
    const typography = ((specRef.current as Record<string, unknown>)['theme'] as Record<string, unknown> | undefined)?.['typography'];
    const lang = locale === 'kk' || locale === 'en' ? locale : 'ru';
    const c = siteCopySuggestion(vertical, copyIndex, locationName, facts, heroTone(typography), lang);
    let next = setHeroText(specRef.current, 'heading', locale, c.heading);
    next = setHeroText(next, 'subheading', locale, c.subheading);
    next = setAboutText(next, locale, c.about);
    apply(next as Spec);
    setCopyIndex((i) => (i + 1) % SITE_COPY_COUNT(vertical));
    setNotice(t('Текст подставлен. Поправьте под себя: цифры, гарантии и акции должны быть правдой.'));
  };

  const publish = async () => {
    const ok = await ask({
      title: publishedId ? t('Обновить сайт?') : t('Опубликовать сайт?'),
      body: t('Посетители увидят сайт таким, как справа. Цены, услуги и часы и дальше будут обновляться сами из WETOP.'),
      confirmLabel: t('Опубликовать'),
    });
    if (!ok) return;
    setBusy('publish');
    setError(null);
    const head = await save();
    if (!head) return setBusy(null);
    const r = await publishSimpleAction(head.id);
    setBusy(null);
    if (!r.ok) {
      setError(r.needsSetup ? t('{message}. Откройте «Публикация», чтобы закончить настройку.', { message: r.message }) : r.message);
      return;
    }
    setPublishedId(head.id);
    if (r.url) setUrl(r.url);
    setNotice(t('Сайт опубликован.'));
  };

  const statusText =
    state === 'saving' || state === 'pending'
      ? t('Сохраняем…')
      : state === 'conflict'
        ? t('Сайт изменили в другой вкладке: обновите страницу')
        : state === 'error'
          ? t('Не сохранено')
          : publishedId && publishedId === base.id
            ? t('Сохранено и опубликовано')
            : publishedId
              ? t('Сохранено, есть неопубликованные изменения')
              : t('Сохранено, ещё не опубликован');
  const live = !!publishedId && publishedId === base.id;
  const photos = assets.filter((a) => a.kind === 'IMAGE' && a.previewUrl);

  return (
    <div className="setup" data-testid="site-setup">
      {dialog}
      <section className="setup__steps" aria-label={t('Настройка сайта')}>
        <header className="setup__head">
          <div>
            <h2 className="setup__title">{locationName}</h2>
            <p className={cx('setup__status', (state === 'error' || state === 'conflict') && 'is-error')} role="status" data-testid="setup-status">
              {statusText}
            </p>
          </div>
        </header>
        <p className="setup__mirror" data-testid="setup-mirror">
          {t('Услуги, цены, мастера, часы и контакты сайт берёт из WETOP сам. Поменяли в WETOP, сайт обновится без публикации.')}
        </p>
        {error && (
          <Alert boxed tone="warning" role="alert" data-testid="setup-error">
            {error}
          </Alert>
        )}
        {notice && !error && (
          <p className="setup__notice" role="status" data-testid="setup-notice">
            {notice}
          </p>
        )}

        <fieldset className="setup__step" disabled={readOnly || !!busy} data-testid="setup-template">
          <legend>
            <span className="setup__n">1</span>
            {t('Шаблон')}
          </legend>
          {facts ? (
            <TemplateGallery
              facts={facts}
              templates={templates}
              chosen={current?.id ?? null}
              onChoose={(id) => {
                const next = applySiteTemplate(specRef.current, id);
                if (next) apply(next as Spec);
              }}
              disabled={readOnly || !!busy}
              compact
            />
          ) : (
            <div className="setup__tpls" role="radiogroup" aria-label={t('Шаблон сайта')}>
              {templates.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  role="radio"
                  aria-checked={current?.id === tpl.id}
                  className={cx('setup__tpl', current?.id === tpl.id && 'is-on')}
                  onClick={() => {
                    const next = applySiteTemplate(specRef.current, tpl.id);
                    if (next) apply(next as Spec);
                  }}
                  data-testid="setup-template-option"
                >
                  <span className={cx('ed-design__swatch', `is-${tpl.direction.theme.preset.toLowerCase()}`)} aria-hidden="true" />
                  <b>{t(tpl.name)}</b>
                  <span className="muted">{t(tpl.description)}</span>
                </button>
              ))}
            </div>
          )}
        </fieldset>

        <fieldset className="setup__step" disabled={readOnly || !!busy} data-testid="setup-photos">
          <legend>
            <span className="setup__n">2</span>
            {t('Фото')}
          </legend>
          <div className="setup__photo-row">
            <div className="setup__cover">
              {st.heroPhoto && assetUrls[st.heroPhoto.assetId] ? (
                <img src={assetUrls[st.heroPhoto.assetId]} alt={st.heroPhoto.alt[locale] ?? t('Обложка')} />
              ) : (
                <span className="muted">{t('Нет обложки')}</span>
              )}
            </div>
            <div className="setup__photo-actions">
              <b>{t('Обложка сайта')}</b>
              <span className="muted">{t('Большое фото на первом экране')}</span>
              <label className="btn btn--secondary btn--sm setup__file">
                {st.heroPhoto ? t('Заменить обложку') : t('Загрузить обложку')}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  data-testid="setup-cover-file"
                  onChange={async (e) => {
                    const [a] = await upload(e.currentTarget.files);
                    e.currentTarget.value = '';
                    if (a) apply(setHeroPhoto(specRef.current, asImage(a)) as Spec);
                  }}
                />
              </label>
              {st.heroPhoto && (
                <Button type="button" tone="ghost" size="sm" onClick={() => apply(setHeroPhoto(specRef.current, null) as Spec)}>
                  {t('Убрать обложку')}
                </Button>
              )}
            </div>
          </div>
          <div className="setup__gallery-head">
            <b>{t('Галерея работ')}</b>
            <span className="muted">
              {st.gallery.length >= 3 ? t('{n} фото на сайте', { n: st.gallery.length }) : t('Появится на сайте от 3 фото')}
            </span>
          </div>
          <div className="setup__thumbs" data-testid="setup-gallery">
            {st.gallery.map((img, i) => (
              <div key={`${img.assetId}-${i}`} className="setup__thumb">
                {assetUrls[img.assetId] ? (
                  <img src={assetUrls[img.assetId]} alt={img.alt[locale] ?? t('Фото')} />
                ) : (
                  <span className="muted">{t('Фото')}</span>
                )}
                <button
                  type="button"
                  className="setup__thumb-x"
                  aria-label={t('Убрать фото из галереи')}
                  onClick={() => apply(setGalleryPhotos(specRef.current, st.gallery.filter((_, j) => j !== i)) as Spec)}
                >
                  ×
                </button>
              </div>
            ))}
            <label className="setup__thumb setup__thumb--add">
              <span>{busy === 'upload' ? t('Загружаем…') : t('+ Добавить фото')}</span>
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                data-testid="setup-gallery-file"
                onChange={async (e) => {
                  const added = await upload(e.currentTarget.files);
                  e.currentTarget.value = '';
                  if (added.length) apply(setGalleryPhotos(specRef.current, [...simpleSiteState(specRef.current).gallery, ...added.map(asImage)]) as Spec);
                }}
              />
            </label>
          </div>
          {photos.length > 0 && (
            <details className="setup__library">
              <summary>{t('Выбрать из загруженных ({n})', { n: photos.length })}</summary>
              <div className="setup__thumbs">
                {photos.map((a) => {
                  const inGallery = st.gallery.some((g) => g.assetId === a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      className={cx('setup__thumb', inGallery && 'is-on')}
                      aria-pressed={inGallery}
                      aria-label={inGallery ? t('Убрать из галереи') : t('Добавить в галерею')}
                      onClick={() =>
                        apply(
                          setGalleryPhotos(
                            specRef.current,
                            inGallery ? st.gallery.filter((g) => g.assetId !== a.id) : [...st.gallery, asImage(a)],
                          ) as Spec,
                        )
                      }
                    >
                      <img src={a.previewUrl!} alt="" />
                    </button>
                  );
                })}
              </div>
            </details>
          )}
        </fieldset>

        <fieldset className="setup__step" disabled={readOnly || !!busy} data-testid="setup-texts">
          <legend>
            <span className="setup__n">3</span>
            {t('Тексты')}
          </legend>
          <Button type="button" tone="secondary" size="sm" onClick={suggest} data-testid="setup-suggest">
            {t('✦ Предложить текст')}
          </Button>
          <TextBox
            id="setup-heading"
            label={t('Заголовок')}
            value={st.heroHeading}
            max={80}
            onCommit={(v) => apply(setHeroText(specRef.current, 'heading', locale, v) as Spec)}
          />
          <TextBox
            id="setup-sub"
            label={t('Подзаголовок: главная выгода')}
            value={st.heroSubheading}
            max={200}
            rows={2}
            onCommit={(v) => apply(setHeroText(specRef.current, 'subheading', locale, v) as Spec)}
          />
          <TextBox
            id="setup-about"
            label={t('О нас')}
            hint={t('Абзацы через пустую строку. Пусто, блока нет.')}
            value={st.about}
            max={1800}
            rows={5}
            onCommit={(v) => apply(setAboutText(specRef.current, locale, v) as Spec)}
          />
        </fieldset>

        <fieldset className="setup__step" disabled={readOnly || !!busy} data-testid="setup-blocks">
          <legend>
            <span className="setup__n">4</span>
            {t('Блоки на сайте')}
          </legend>
          {SIMPLE_BLOCKS.map((b) => {
            const on = st.blocks[b.type] === true;
            const possible = on || (!!template && simpleSiteState(template).blocks[b.type] === true);
            return (
              <label key={b.type} className={cx('setup__toggle', !possible && 'is-off')}>
                <input
                  type="checkbox"
                  role="switch"
                  checked={on}
                  disabled={!possible}
                  onChange={(e) => template && apply(toggleSiteBlock(specRef.current, b.type, e.currentTarget.checked, template) as Spec)}
                  data-testid={`setup-block-${b.type}`}
                />
                <span>
                  <b>{t(b.label)}</b>
                  <span className="muted">{possible ? t(b.hint) : t('Нет данных в WETOP')}</span>
                </span>
              </label>
            );
          })}
        </fieldset>

        <fieldset className="setup__step" disabled={readOnly || !!busy} data-testid="setup-seo">
          <legend>
            <span className="setup__n">5</span>
            {t('Поиск Google')}
          </legend>
          <div className="setup__google" aria-label={t('Так сайт увидят в Google')} data-testid="setup-google">
            <span className="setup__google-url">{google.url || t('адрес сайта после публикации')}</span>
            <span className="setup__google-title">{google.title}</span>
            <span className="setup__google-text">{google.description || t('Описание появится здесь')}</span>
          </div>
          <TextBox
            id="setup-seo-title"
            label={t('Заголовок в Google')}
            hint={t('До {n} знаков. Пусто: возьмём заголовок сайта.', { n: SEO_TITLE_MAX })}
            value={seo.title}
            max={SEO_TITLE_MAX}
            onCommit={(v) => apply(setHomeSeo(specRef.current, 'title', locale, v) as Spec)}
          />
          <TextBox
            id="setup-seo-description"
            label={t('Описание в Google')}
            hint={t('До {n} знаков: чем вы лучше и как записаться.', { n: SEO_DESCRIPTION_MAX })}
            value={seo.description}
            max={SEO_DESCRIPTION_MAX}
            rows={2}
            onCommit={(v) => apply(setHomeSeo(specRef.current, 'description', locale, v) as Spec)}
          />
          <label className="setup__toggle">
            <input
              type="checkbox"
              role="switch"
              checked={seo.indexed}
              onChange={(e) => apply(setSiteIndexing(specRef.current, e.currentTarget.checked) as Spec)}
              data-testid="setup-seo-index"
            />
            <span>
              <b>{t('Показывать сайт в поиске')}</b>
              <span className="muted">{t('Выключите, пока сайт не готов: Google его не покажет.')}</span>
            </span>
          </label>
        </fieldset>

        <div className="setup__step setup__publish" data-testid="setup-publish">
          <div className="setup__publish-head">
            <span className="setup__n">6</span>
            <b>{t('Публикация')}</b>
          </div>
          {url && (
            <p className="setup__url">
              {t('Адрес:')}{' '}
              <a href={url} target="_blank" rel="noreferrer" data-testid="setup-url">
                {url.replace(/^https?:\/\//, '')}
              </a>
            </p>
          )}
          <Button
            type="button"
            disabled={readOnly || !!busy || live || 'reason' in publishTo}
            aria-describedby={'reason' in publishTo ? 'setup-publish-reason' : undefined}
            onClick={() => void publish()}
            data-testid="setup-publish-btn"
          >
            {busy === 'publish' ? t('Публикуем…') : live ? t('Опубликовано') : publishedId ? t('Обновить сайт') : t('Опубликовать сайт')}
          </Button>
          {'reason' in publishTo && (
            <p className="muted" id="setup-publish-reason" data-testid="setup-publish-reason">
              {publishTo.reason}
            </p>
          )}
          <ul className="setup__more">
            <li>
              <Link href="/marketing/site">{t('Публикация и домен')}</Link>
            </li>
            <li>
              <Link href="/marketing/site/leads" data-testid="setup-leads-link">
                {t('Заявки с сайта')}
              </Link>
            </li>
            <li>
              <Link href="/marketing/site/editor?full=1">{t('Расширенный режим')}</Link>
            </li>
          </ul>
        </div>
      </section>

      <section className="setup__site" aria-label={t('Сайт')}>
        <SitePreview
          spec={spec}
          pageId={null}
          onPage={() => undefined}
          locales={[locale]}
          defaultLocale={locale}
          assets={assetUrls}
          selectedSectionId={null}
          onPickSection={() => undefined}
          onOpenSeparately={() => undefined}
          mode="select"
          setMode={() => undefined}
          onInlineEdit={() => undefined}
          readOnly
          simple
        />
      </section>
    </div>
  );
}

/** Поле текста: правка уходит в сайт по выходу из поля (а не на каждую букву), Enter в однострочном применяет */
function TextBox({
  id,
  label,
  hint,
  value,
  max,
  rows = 1,
  onCommit,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  max: number;
  rows?: number;
  onCommit: (v: string) => void;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const commit = () => {
    if (text !== value) onCommit(text);
  };
  return (
    <div className="setup__field">
      <label htmlFor={id}>{label}</label>
      {hint && <span className="muted setup__hint">{hint}</span>}
      {rows === 1 ? (
        <Input
          id={id}
          value={text}
          maxLength={max}
          onChange={(e) => setText(e.currentTarget.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
          data-testid={id}
        />
      ) : (
        <Textarea id={id} rows={rows} value={text} maxLength={max} onChange={(e) => setText(e.currentTarget.value)} onBlur={commit} data-testid={id} />
      )}
    </div>
  );
}
