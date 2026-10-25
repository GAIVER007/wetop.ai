'use client';
import { useActionState, useState, useTransition } from 'react';
import type { ChannexPhotoChoice, SiteAssetLibrary, SiteAssetView } from '../../../../lib/api';
import { Alert, Badge, Button, EmptyState, Field, Grid, Input, Notice, Panel, PanelTitle, Select, Stack } from '../../../../components/ui';
import { useConfirm } from '../../../../components/use-confirm';
import { msg, type Translate } from '../../../../i18n';
import { useT } from '../../../../i18n/locale-provider';
import {
  channexPhotosAction,
  deleteAssetAction,
  importChannexAction,
  updateAltAction,
  uploadAssetAction,
  type AssetResult,
} from './actions';

const KIND: Record<SiteAssetView['kind'], string> = { IMAGE: msg('Фото'), LOGO: msg('Логотип'), FAVICON: msg('Значок сайта') };
const SOURCE: Record<SiteAssetView['source'], string> = { UPLOAD: msg('Загружено'), CHANNEX_IMPORT: msg('Из менеджера каналов') };
const CHANNEX_STATE: Record<string, string> = {
  NO_KEY: msg('Менеджер каналов не подключён'),
  NO_MAPPING: msg('Гостиница не сопоставлена с менеджером каналов'),
  DENIED: msg('Нет доступа к объекту в менеджере каналов'),
  NOT_FOUND: msg('Объект не найден в менеджере каналов'),
  RATE_LIMITED: msg('Лимит запросов менеджера каналов, повторите через минуту'),
  UNREACHABLE: msg('Менеджер каналов не отвечает'),
};

const size = (bytes: number, t: Translate) =>
  bytes >= 1024 * 1024
    ? t('{n} МБ', { n: (bytes / 1024 / 1024).toFixed(1).replace('.', ',') })
    : t('{n} КБ', { n: Math.max(1, Math.round(bytes / 1024)) });

/**
 * Библиотека изображений сайта (MKT8). Загрузка уходит в API (браузер ключей хранилища не видит), картинки показываются
 * по подписанным адресам на срок. Удаление честно говорит, удержана ли картинка ради опубликованных версий и отката.
 * Выбора картинки для секции здесь нет (MKT9).
 */
export function AssetLibrary({
  library,
  readOnly,
  channex = true,
}: {
  library: SiteAssetLibrary;
  readOnly: boolean;
  /** Импорт фото менеджера каналов: только у гостиницы (Д10) */
  channex?: boolean;
}) {
  const t = useT();
  const [uploaded, upload, uploading] = useActionState(uploadAssetAction, null);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<AssetResult | null>(null);
  const [tooBig, setTooBig] = useState(false);
  const [photos, setPhotos] = useState<{ state: string; photos: ChannexPhotoChoice[] } | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const { ask, dialog } = useConfirm();
  const off = library.storage === 'OFF';
  const disabled = readOnly || off;
  const run = (fn: () => Promise<AssetResult>) =>
    start(async () => {
      setResult(await fn());
    });
  const shown = result ?? uploaded;

  return (
    <Stack>
      {dialog}
      {off && (
        <Notice tone="muted" data-testid="site-assets-off">
          {t('Хранилище изображений не настроено: загрузка и импорт пока недоступны.')}
        </Notice>
      )}
      {tooBig && <Alert boxed data-testid="site-assets-error">{t('Файл больше 10 МиБ')}</Alert>}
      {!tooBig && shown?.error && <Alert boxed data-testid="site-assets-error">{shown.error}</Alert>}
      {!tooBig && shown?.message && <Notice data-testid="site-assets-message">{shown.message}</Notice>}

      {!readOnly && (
        <Panel aria-labelledby="site-assets-upload-title" data-testid="site-assets-upload">
          <PanelTitle>
            <span id="site-assets-upload-title">{t('Загрузить изображение')}</span>
          </PanelTitle>
          <form
            className="asset-upload"
            action={(form) => {
              setResult(null);
              upload(form);
            }}
          >
            <Field label={t('Назначение@@изображение')} controlId="site-asset-kind">
              <Select name="kind" defaultValue="IMAGE" disabled={disabled}>
                <option value="IMAGE">{t('Фото')}</option>
                <option value="LOGO">{t('Логотип')}</option>
                <option value="FAVICON">{t('Значок сайта')}</option>
              </Select>
            </Field>
            <Field
              label={t('Файл')}
              controlId="site-asset-file"
              hint={t('JPEG, PNG или WebP до 10 МиБ; можно перетащить файл сюда. Геометка и данные камеры удаляются.')}
            >
              <Input
                type="file"
                name="file"
                accept="image/jpeg,image/png,image/webp"
                required
                disabled={disabled}
                className="asset-upload__file"
                onChange={(e) => {
                  const file = e.currentTarget.files?.[0];
                  const big = !!file && file.size > library.limits.maxUploadBytes;
                  setTooBig(big);
                  if (big) e.currentTarget.value = '';
                }}
              />
            </Field>
            <Button type="submit" disabled={disabled || uploading} data-testid="site-assets-submit">
              {uploading ? t('Загружаем…') : t('Загрузить')}
            </Button>
          </form>
        </Panel>
      )}

      <Panel aria-labelledby="site-assets-library-title" data-testid="site-assets-library">
        <PanelTitle>
          <span id="site-assets-library-title">{t('Библиотека')}</span>
        </PanelTitle>
        {library.assets.length === 0 ? (
          <p className="muted" data-testid="site-assets-empty">
            {t('Изображений пока нет. Загрузите фото или импортируйте их из менеджера каналов.')}
          </p>
        ) : (
          <Grid min={220} className="asset-grid">
            {library.assets.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                disabled={readOnly || pending}
                onSaveAlt={(ru) => run(() => updateAltAction(asset.id, ru))}
                onDelete={async () => {
                  const ok = await ask({
                    title: t('Удалить изображение из библиотеки?'),
                    body: t('Если оно уже было на опубликованном сайте, файл сохранится для этой версии и отката.'),
                    confirmLabel: t('Удалить'),
                    tone: 'danger',
                  });
                  if (ok) run(() => deleteAssetAction(asset.id));
                }}
              />
            ))}
          </Grid>
        )}
      </Panel>

      {!readOnly && channex && (
        <Panel aria-labelledby="site-assets-channex-title" data-testid="site-assets-channex">
          <PanelTitle>
            <span id="site-assets-channex-title">{t('Импорт из менеджера каналов')}</span>
          </PanelTitle>
          {!photos ? (
            <div className="publication-actions">
              <Button
                tone="secondary"
                disabled={disabled || pending}
                data-testid="site-assets-channex-load"
                onClick={() =>
                  start(async () => {
                    const r = await channexPhotosAction();
                    if (r.error) setResult(r);
                    else setPhotos({ state: r.state ?? 'READY', photos: r.photos ?? [] });
                  })
                }
              >
                {t('Показать фото гостиницы')}
              </Button>
            </div>
          ) : photos.state !== 'READY' ? (
            <p className="muted" data-testid="site-assets-channex-state">
              {t(CHANNEX_STATE[photos.state] ?? msg('Фото менеджера каналов сейчас недоступны'))}
            </p>
          ) : photos.photos.length === 0 ? (
            <EmptyState title={t('В менеджере каналов нет фото этой гостиницы')} />
          ) : (
            <Stack gap="sm">
              <ul className="asset-import" aria-label={t('Фото гостиницы в менеджере каналов')}>
                {photos.photos.map((p) => (
                  <li key={p.photoId}>
                    <label className="asset-import__item">
                      <input
                        type="checkbox"
                        checked={chosen.has(p.photoId)}
                        disabled={disabled}
                        onChange={(e) => {
                          const next = new Set(chosen);
                          if (e.currentTarget.checked) next.add(p.photoId);
                          else next.delete(p.photoId);
                          setChosen(next);
                        }}
                      />
                      <span>
                        {p.description ?? t('Фото {n}', { n: p.position + 1 })}
                        {p.forRoomType && <span className="muted">{t(' (номер)')}</span>}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <div className="publication-actions">
                <Button
                  disabled={disabled || pending || chosen.size === 0}
                  data-testid="site-assets-channex-import"
                  onClick={() =>
                    run(async () => {
                      const r = await importChannexAction([...chosen].slice(0, 20));
                      setChosen(new Set());
                      return r;
                    })
                  }
                >
                  {t('Импортировать выбранные')}
                  {chosen.size ? ` (${chosen.size})` : ''}
                </Button>
              </div>
            </Stack>
          )}
        </Panel>
      )}
    </Stack>
  );
}

function AssetCard({
  asset,
  disabled,
  onSaveAlt,
  onDelete,
}: {
  asset: SiteAssetView;
  disabled: boolean;
  onSaveAlt: (ru: string) => void;
  onDelete: () => void;
}) {
  const t = useT();
  const [alt, setAlt] = useState(asset.defaultAlt?.ru ?? '');
  const altId = `asset-alt-${asset.id}`;
  return (
    <Panel className="asset-card" data-testid="site-asset">
      <div className="asset-card__image">
        {asset.previewUrl ? (
          // подписанный адрес на срок: обычный <img>, оптимизатор Next не нужен и не должен его кэшировать
          <img src={asset.previewUrl} alt={asset.defaultAlt?.ru ?? t('Изображение без подписи')} loading="lazy" decoding="async" />
        ) : (
          <span className="muted">{t('Нет предпросмотра')}</span>
        )}
      </div>
      <div className="asset-card__facts">
        <Badge tone={asset.kind === 'IMAGE' ? 'neutral' : 'info'}>{t(KIND[asset.kind])}</Badge>
        <span className="muted">
          {asset.width}×{asset.height}, {size(asset.byteSize, t)}
        </span>
        <span className="muted">{t(SOURCE[asset.source])}</span>
      </div>
      <form
        className="asset-card__alt"
        onSubmit={(e) => {
          e.preventDefault();
          onSaveAlt(alt);
        }}
      >
        <Field label={t('Подпись для незрячих (ALT)')} controlId={altId}>
          <Input value={alt} maxLength={150} onChange={(e) => setAlt(e.currentTarget.value)} disabled={disabled} />
        </Field>
        <div className="asset-card__actions">
          <Button type="submit" tone="secondary" size="sm" disabled={disabled || alt === (asset.defaultAlt?.ru ?? '')}>
            {t('Сохранить')}
          </Button>
          <Button type="button" tone="danger" size="sm" disabled={disabled} onClick={onDelete} data-testid="site-asset-delete">
            {t('Удалить')}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
