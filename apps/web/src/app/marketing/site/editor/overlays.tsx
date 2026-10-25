'use client';
import { useState } from 'react';
import { SITE_EDITOR_SECTIONS } from '@pms/domain';
import type { SiteAssetView, SiteChangeView, SiteVersionMeta } from '../../../../lib/api';
import { Overlay } from '../../../../components/overlay';
import { Badge, Button, Grid, Input } from '../../../../components/ui';
import type { AssetKind } from './fields';
import { msg, intlLocale, type Translate } from '../../../../i18n';
import { dateFormat } from '../../../../i18n/dates';
import { useLocale, useT } from '../../../../i18n/locale-provider';

/**
 * Окна редактора (MKT9): выбор картинки из библиотеки MKT8 (только готовые этого филиала и нужного вида, адрес руками
 * не вводится), история версий (предпросмотр, сравнение, восстановление как нового черновика) и разница версий словами.
 */
const PICK_TITLE: Record<AssetKind, string> = { IMAGE: msg('Выбрать фото'), LOGO: msg('Выбрать логотип'), FAVICON: msg('Выбрать значок сайта') };

export function AssetPicker({
  kind,
  assets,
  onPick,
  onClose,
}: {
  kind: AssetKind | null;
  assets: SiteAssetView[];
  onPick: (asset: SiteAssetView) => void;
  onClose: () => void;
}) {
  const t = useT();
  const fit = assets.filter((a) => a.status === 'READY' && a.kind === kind);
  return (
    <Overlay open={kind !== null} onClose={onClose} title={t(kind ? PICK_TITLE[kind] : msg('Выбрать изображение'))} trapFocus>
      <div className="ed-picker" data-testid="ed-asset-picker">
        {fit.length === 0 ? (
          <p className="muted">
            {t('В библиотеке нет изображений этого назначения.')}{' '}
            <a href="/marketing/site/assets">{t('Открыть библиотеку изображений')}</a>
          </p>
        ) : (
          <Grid min={160}>
            {fit.map((asset) => (
              <button key={asset.id} type="button" className="ed-picker__item" data-testid="ed-asset-option" onClick={() => onPick(asset)}>
                {asset.previewUrl ? (
                  // подписанный адрес на срок: обычный <img>
                  <img src={asset.previewUrl} alt={asset.defaultAlt?.ru ?? t('Изображение без подписи')} />
                ) : (
                  <span className="muted">{t('Нет предпросмотра')}</span>
                )}
                <span>
                  {asset.width}×{asset.height}
                </span>
              </button>
            ))}
          </Grid>
        )}
      </div>
    </Overlay>
  );
}

const SITE_FIELD: Record<string, string> = {
  displayName: msg('Название сайта'),
  tagline: msg('Слоган'),
  locales: msg('Языки сайта'),
  contacts: msg('Контакты'),
  legal: msg('Юридические данные'),
  seo: msg('SEO сайта'),
  theme: msg('Оформление'),
  integrations: msg('Бронирование и аналитика'),
  navigation: msg('Навигация'),
};
const PAGE_FIELD: Record<string, string> = {
  title: msg('название'),
  slug: msg('адрес'),
  seo: msg('SEO'),
  settings: msg('главная страница'),
};

function slotLabel(slot: string): string {
  if (slot === 'logo') return msg('Логотип');
  if (slot === 'favicon') return msg('Значок сайта');
  if (slot.endsWith(':og')) return msg('Картинка для соцсетей');
  if (slot.endsWith(':images')) return msg('Фото галереи');
  if (slot.endsWith(':items')) return msg('Фото категорий');
  return msg('Фото секции');
}

const variantLabel = (type: string | undefined, value: string | undefined, t: Translate) => {
  const label = SITE_EDITOR_SECTIONS[type ?? '']?.variants.find((v) => v.value === value)?.label;
  return label ? t(label) : (value ?? '');
};

/** Одно изменение словами: без JSON, id и путей */
export function describeChange(c: SiteChangeView, t: Translate = (text) => text): string {
  const name = c.label ? `«${c.label}»` : '';
  switch (c.area) {
    case 'site':
      return t('{field}: изменено', { field: t(SITE_FIELD[c.field ?? ''] ?? msg('Настройки сайта')) });
    case 'page':
      if (c.kind === 'added') return t('Добавлена страница {name}', { name });
      if (c.kind === 'removed') return t('Удалена страница {name}', { name });
      if (c.kind === 'moved') return t('Страница {name} перемещена', { name });
      return t('Страница {name}: изменено {field}', { name, field: t(PAGE_FIELD[c.field ?? ''] ?? msg('содержимое')) });
    case 'section': {
      const type = t(SITE_EDITOR_SECTIONS[c.sectionType ?? '']?.label ?? msg('Секция'));
      if (c.kind === 'added') return t('Добавлена секция {name} ({type})', { name, type });
      if (c.kind === 'removed') return t('Удалена секция {name} ({type})', { name, type });
      if (c.kind === 'moved')
        return c.field === 'page' ? t('Секция {name} перенесена на другую страницу', { name }) : t('Секция {name} перемещена', { name });
      if (c.kind === 'variant')
        return t('Секция {name}: вид «{from}» стал «{to}»', {
          name,
          from: variantLabel(c.sectionType, c.from, t),
          to: variantLabel(c.sectionType, c.to, t),
        });
      return t('Секция {name}: изменено содержимое', { name });
    }
    case 'asset':
      if (c.kind === 'added') return t('{slot}: добавлено изображение', { slot: t(slotLabel(c.slot ?? '')) });
      if (c.kind === 'removed') return t('{slot}: убрано изображение', { slot: t(slotLabel(c.slot ?? '')) });
      return t('{slot}: изображение заменено', { slot: t(slotLabel(c.slot ?? '')) });
  }
}

export function ChangeList({ changes }: { changes: SiteChangeView[] }) {
  const t = useT();
  if (changes.length === 0) return <p className="muted">{t('Отличий нет.')}</p>;
  return (
    <ul className="ed-changes" data-testid="ed-changes">
      {changes.map((c, i) => (
        <li key={i}>{describeChange(c, t)}</li>
      ))}
    </ul>
  );
}

export function DiffOverlay({
  title,
  changes,
  onClose,
}: {
  title: string | null;
  changes: SiteChangeView[];
  onClose: () => void;
}) {
  const t = useT();
  return (
    <Overlay open={title !== null} onClose={onClose} title={title ?? t('Изменения')} trapFocus>
      <div className="ed-diff" data-testid="ed-diff">
        <ChangeList changes={changes} />
      </div>
    </Overlay>
  );
}

const SOURCE: Record<SiteVersionMeta['source'], string> = { MANUAL: msg('Вручную'), AI: msg('ИИ'), IMPORT: msg('Импорт') };
const WHEN: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' };

/** MKT9.2: закладка версии: звёздочка открывает подпись; поставленная закладка снимается тем же местом */
function BookmarkControl({
  version,
  disabled,
  onBookmark,
}: {
  version: SiteVersionMeta;
  disabled: boolean;
  onBookmark: (v: SiteVersionMeta, label: string | null) => Promise<boolean>;
}) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(version.bookmark ?? '');
  if (version.bookmark && !editing)
    return (
      <Button type="button" tone="ghost" size="sm" disabled={disabled} onClick={() => void onBookmark(version, null)} data-testid="ed-bookmark-remove">
        <span aria-hidden="true">★ </span>
        {t('Снять закладку')}
      </Button>
    );
  if (!editing)
    return (
      <Button type="button" tone="ghost" size="sm" disabled={disabled} onClick={() => setEditing(true)} data-testid="ed-bookmark-add">
        <span aria-hidden="true">☆ </span>
        {t('В закладки')}
      </Button>
    );
  return (
    <form
      className="ed-row"
      onSubmit={async (e) => {
        e.preventDefault();
        if (label.trim() && (await onBookmark(version, label.trim()))) setEditing(false);
      }}
    >
      <label className="sr-only" htmlFor={`bm-${version.id}`}>
        {t('Подпись закладки версии {n}', { n: version.revision })}
      </label>
      <Input
        id={`bm-${version.id}`}
        maxLength={120}
        value={label}
        placeholder={t('Например: перед акцией')}
        onChange={(e) => setLabel(e.currentTarget.value)}
      />
      <Button type="submit" size="sm" disabled={disabled || !label.trim()} data-testid="ed-bookmark-save">
        {t('Сохранить')}
      </Button>
      <Button type="button" tone="ghost" size="sm" onClick={() => setEditing(false)}>
        {t('Отмена')}
      </Button>
    </form>
  );
}

export function HistoryOverlay({
  open,
  versions,
  bookmarks,
  readOnly,
  busy,
  error,
  onClose,
  onPreview,
  onCompare,
  onRestore,
  onBookmark,
}: {
  open: boolean;
  versions: SiteVersionMeta[];
  bookmarks: SiteVersionMeta[];
  readOnly: boolean;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onPreview: (v: SiteVersionMeta) => void;
  onCompare: (v: SiteVersionMeta) => void;
  onRestore: (v: SiteVersionMeta) => void;
  onBookmark: (v: SiteVersionMeta, label: string | null) => Promise<boolean>;
}) {
  const t = useT();
  const format = dateFormat(intlLocale(useLocale()), WHEN);
  const when = (iso: string) => format.format(new Date(iso));
  return (
    <Overlay open={open} onClose={onClose} title={t('История версий')} drawer trapFocus>
      <div className="ed-history" data-testid="ed-history">
        {error && (
          <p role="alert" className="ed-error">
            {error}
          </p>
        )}
        {bookmarks.length > 0 && (
          <section className="ed-history__pinned" aria-labelledby="ed-bookmarks-title" data-testid="ed-bookmarks">
            <h3 id="ed-bookmarks-title" className="ed-history__title">
              {t('Закладки')}
            </h3>
            <ul className="ed-history__list">
              {bookmarks.map((v) => (
                <li key={v.id} className="ed-history__row" data-testid="ed-bookmark-row">
                  <div className="ed-history__facts">
                    <b>
                      <span aria-hidden="true">★ </span>
                      {v.bookmark}
                    </b>
                    <span className="muted">
                      {t('Версия {n}, {when}', { n: v.revision, when: when(v.createdAt) })}
                    </span>
                  </div>
                  <div className="ed-history__actions">
                    <Button type="button" tone="secondary" size="sm" disabled={busy} onClick={() => onPreview(v)}>
                      {t('Предпросмотр')}
                    </Button>
                    {!v.isLatest && (
                      <Button type="button" tone="secondary" size="sm" disabled={busy || readOnly} onClick={() => onRestore(v)}>
                        {t('Восстановить как черновик')}
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
        <h3 className="ed-history__title">{t('Все версии')}</h3>
        <ol className="ed-history__list">
          {versions.map((v) => (
            <li key={v.id} className="ed-history__row" data-testid="ed-history-row">
              <div className="ed-history__facts">
                <b>
                  {t('Версия {n}', { n: v.revision })}
                  {v.bookmark ? `: ${v.bookmark}` : ''}
                </b>
                <span className="muted">
                  {t(SOURCE[v.source])}, {when(v.createdAt)}
                </span>
                <span className="ed-history__badges">
                  {v.isLatest && <Badge tone="info">{t('Черновик')}</Badge>}
                  {v.isPublished && <Badge tone="ok">{t('Опубликована')}</Badge>}
                </span>
              </div>
              <div className="ed-history__actions">
                <Button type="button" tone="secondary" size="sm" disabled={busy} onClick={() => onPreview(v)}>
                  {t('Предпросмотр')}
                </Button>
                {!v.isLatest && (
                  <Button type="button" tone="secondary" size="sm" disabled={busy} onClick={() => onCompare(v)}>
                    {t('Сравнить с черновиком')}
                  </Button>
                )}
                {!v.isLatest && (
                  <Button type="button" tone="secondary" size="sm" disabled={busy || readOnly} onClick={() => onRestore(v)} data-testid="ed-restore">
                    {t('Восстановить как черновик')}
                  </Button>
                )}
                <BookmarkControl key={`${v.id}-${v.bookmark ?? ''}`} version={v} disabled={busy || readOnly} onBookmark={onBookmark} />
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Overlay>
  );
}
