'use client';
import { SITE_EDITOR_SECTIONS } from '@pms/domain';
import type { SiteAssetView, SiteChangeView, SiteVersionMeta } from '../../../../lib/api';
import { Overlay } from '../../../../components/overlay';
import { Badge, Button, Grid } from '../../../../components/ui';
import type { AssetKind } from './fields';

/**
 * Окна редактора (MKT9): выбор картинки из библиотеки MKT8 (только готовые этого филиала и нужного вида, адрес руками
 * не вводится), история версий (предпросмотр, сравнение, восстановление как нового черновика) и разница версий словами.
 */
const KIND_LABEL: Record<AssetKind, string> = { IMAGE: 'фото', LOGO: 'логотип', FAVICON: 'значок сайта' };

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
  const fit = assets.filter((a) => a.status === 'READY' && a.kind === kind);
  return (
    <Overlay open={kind !== null} onClose={onClose} title={`Выбрать ${kind ? KIND_LABEL[kind] : 'изображение'}`} trapFocus>
      <div className="ed-picker" data-testid="ed-asset-picker">
        {fit.length === 0 ? (
          <p className="muted">
            В библиотеке нет изображений этого назначения. <a href="/marketing/site/assets">Открыть библиотеку изображений</a>
          </p>
        ) : (
          <Grid min={160}>
            {fit.map((asset) => (
              <button key={asset.id} type="button" className="ed-picker__item" data-testid="ed-asset-option" onClick={() => onPick(asset)}>
                {asset.previewUrl ? (
                  // подписанный адрес на срок: обычный <img>
                  <img src={asset.previewUrl} alt={asset.defaultAlt?.ru ?? 'Изображение без подписи'} />
                ) : (
                  <span className="muted">Нет предпросмотра</span>
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
  displayName: 'Название сайта',
  tagline: 'Слоган',
  locales: 'Языки сайта',
  contacts: 'Контакты',
  legal: 'Юридические данные',
  seo: 'SEO сайта',
  theme: 'Оформление',
  integrations: 'Бронирование и аналитика',
  navigation: 'Навигация',
};
const PAGE_FIELD: Record<string, string> = { title: 'название', slug: 'адрес', seo: 'SEO', settings: 'главная страница' };

function slotLabel(slot: string): string {
  if (slot === 'logo') return 'Логотип';
  if (slot === 'favicon') return 'Значок сайта';
  if (slot.endsWith(':og')) return 'Картинка для соцсетей';
  if (slot.endsWith(':images')) return 'Фото галереи';
  if (slot.endsWith(':items')) return 'Фото категорий';
  return 'Фото секции';
}

const variantLabel = (type: string | undefined, value: string | undefined) =>
  SITE_EDITOR_SECTIONS[type ?? '']?.variants.find((v) => v.value === value)?.label ?? value ?? '';

/** Одно изменение словами: без JSON, id и путей */
export function describeChange(c: SiteChangeView): string {
  const name = c.label ? `«${c.label}»` : '';
  switch (c.area) {
    case 'site':
      return `${SITE_FIELD[c.field ?? ''] ?? 'Настройки сайта'}: изменено`;
    case 'page':
      if (c.kind === 'added') return `Добавлена страница ${name}`;
      if (c.kind === 'removed') return `Удалена страница ${name}`;
      if (c.kind === 'moved') return `Страница ${name} перемещена`;
      return `Страница ${name}: изменено ${PAGE_FIELD[c.field ?? ''] ?? 'содержимое'}`;
    case 'section': {
      const type = SITE_EDITOR_SECTIONS[c.sectionType ?? '']?.label ?? 'Секция';
      if (c.kind === 'added') return `Добавлена секция ${name} (${type})`;
      if (c.kind === 'removed') return `Удалена секция ${name} (${type})`;
      if (c.kind === 'moved') return c.field === 'page' ? `Секция ${name} перенесена на другую страницу` : `Секция ${name} перемещена`;
      if (c.kind === 'variant') return `Секция ${name}: вид «${variantLabel(c.sectionType, c.from)}» стал «${variantLabel(c.sectionType, c.to)}»`;
      return `Секция ${name}: изменено содержимое`;
    }
    case 'asset':
      if (c.kind === 'added') return `${slotLabel(c.slot ?? '')}: добавлено изображение`;
      if (c.kind === 'removed') return `${slotLabel(c.slot ?? '')}: убрано изображение`;
      return `${slotLabel(c.slot ?? '')}: изображение заменено`;
  }
}

export function ChangeList({ changes }: { changes: SiteChangeView[] }) {
  if (changes.length === 0) return <p className="muted">Отличий нет.</p>;
  return (
    <ul className="ed-changes" data-testid="ed-changes">
      {changes.map((c, i) => (
        <li key={i}>{describeChange(c)}</li>
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
  return (
    <Overlay open={title !== null} onClose={onClose} title={title ?? 'Изменения'} trapFocus>
      <div className="ed-diff" data-testid="ed-diff">
        <ChangeList changes={changes} />
      </div>
    </Overlay>
  );
}

const SOURCE: Record<SiteVersionMeta['source'], string> = { MANUAL: 'Вручную', AI: 'ИИ', IMPORT: 'Импорт' };
const when = (iso: string) =>
  new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

export function HistoryOverlay({
  open,
  versions,
  readOnly,
  busy,
  error,
  onClose,
  onPreview,
  onCompare,
  onRestore,
}: {
  open: boolean;
  versions: SiteVersionMeta[];
  readOnly: boolean;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onPreview: (v: SiteVersionMeta) => void;
  onCompare: (v: SiteVersionMeta) => void;
  onRestore: (v: SiteVersionMeta) => void;
}) {
  return (
    <Overlay open={open} onClose={onClose} title="История версий" drawer trapFocus>
      <div className="ed-history" data-testid="ed-history">
        {error && (
          <p role="alert" className="ed-error">
            {error}
          </p>
        )}
        <ol className="ed-history__list">
          {versions.map((v) => (
            <li key={v.id} className="ed-history__row" data-testid="ed-history-row">
              <div className="ed-history__facts">
                <b>Версия {v.revision}</b>
                <span className="muted">
                  {SOURCE[v.source]}, {when(v.createdAt)}
                </span>
                <span className="ed-history__badges">
                  {v.isLatest && <Badge tone="info">Черновик</Badge>}
                  {v.isPublished && <Badge tone="ok">Опубликована</Badge>}
                </span>
              </div>
              <div className="ed-history__actions">
                <Button type="button" tone="secondary" size="sm" disabled={busy} onClick={() => onPreview(v)}>
                  Предпросмотр
                </Button>
                {!v.isLatest && (
                  <Button type="button" tone="secondary" size="sm" disabled={busy} onClick={() => onCompare(v)}>
                    Сравнить с черновиком
                  </Button>
                )}
                {!v.isLatest && (
                  <Button type="button" tone="secondary" size="sm" disabled={busy || readOnly} onClick={() => onRestore(v)} data-testid="ed-restore">
                    Восстановить как черновик
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Overlay>
  );
}
