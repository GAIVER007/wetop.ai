'use client';
import { useActionState, useState, useTransition } from 'react';
import type { ChannexPhotoChoice, SiteAssetLibrary, SiteAssetView } from '../../../../lib/api';
import { Alert, Badge, Button, Field, Grid, Input, Notice, Panel, PanelTitle, Select, Stack } from '../../../../components/ui';
import { useConfirm } from '../../../../components/use-confirm';
import {
  channexPhotosAction,
  deleteAssetAction,
  importChannexAction,
  updateAltAction,
  uploadAssetAction,
  type AssetResult,
} from './actions';

const KIND: Record<SiteAssetView['kind'], string> = { IMAGE: 'Фото', LOGO: 'Логотип', FAVICON: 'Значок сайта' };
const SOURCE: Record<SiteAssetView['source'], string> = { UPLOAD: 'Загружено', CHANNEX_IMPORT: 'Из менеджера каналов' };
const CHANNEX_STATE: Record<string, string> = {
  NO_KEY: 'Менеджер каналов не подключён',
  NO_MAPPING: 'Гостиница не сопоставлена с менеджером каналов',
  DENIED: 'Нет доступа к объекту в менеджере каналов',
  NOT_FOUND: 'Объект не найден в менеджере каналов',
  RATE_LIMITED: 'Лимит запросов менеджера каналов, повторите через минуту',
  UNREACHABLE: 'Менеджер каналов не отвечает',
};

const size = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} МБ` : `${Math.max(1, Math.round(bytes / 1024))} КБ`;

/**
 * Библиотека изображений сайта (MKT8). Загрузка уходит в API (браузер ключей хранилища не видит), картинки показываются
 * по подписанным адресам на срок. Удаление честно говорит, удержана ли картинка ради опубликованных версий и отката.
 * Выбора картинки для секции здесь нет (MKT9).
 */
export function AssetLibrary({ library, readOnly }: { library: SiteAssetLibrary; readOnly: boolean }) {
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
          Хранилище изображений не настроено: загрузка и импорт пока недоступны.
        </Notice>
      )}
      {tooBig && <Alert boxed data-testid="site-assets-error">Файл больше 10 МиБ</Alert>}
      {!tooBig && shown?.error && <Alert boxed data-testid="site-assets-error">{shown.error}</Alert>}
      {!tooBig && shown?.message && <Notice data-testid="site-assets-message">{shown.message}</Notice>}

      {!readOnly && (
        <Panel aria-labelledby="site-assets-upload-title" data-testid="site-assets-upload">
          <PanelTitle>
            <span id="site-assets-upload-title">Загрузить изображение</span>
          </PanelTitle>
          <form
            className="asset-upload"
            action={(form) => {
              setResult(null);
              upload(form);
            }}
          >
            <Field label="Назначение" controlId="site-asset-kind">
              <Select name="kind" defaultValue="IMAGE" disabled={disabled}>
                <option value="IMAGE">Фото</option>
                <option value="LOGO">Логотип</option>
                <option value="FAVICON">Значок сайта</option>
              </Select>
            </Field>
            <Field
              label="Файл"
              controlId="site-asset-file"
              hint="JPEG, PNG или WebP до 10 МиБ; можно перетащить файл сюда. Геометка и данные камеры удаляются."
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
              {uploading ? 'Загружаем…' : 'Загрузить'}
            </Button>
          </form>
        </Panel>
      )}

      <Panel aria-labelledby="site-assets-library-title" data-testid="site-assets-library">
        <PanelTitle>
          <span id="site-assets-library-title">Библиотека</span>
        </PanelTitle>
        {library.assets.length === 0 ? (
          <p className="muted" data-testid="site-assets-empty">
            Изображений пока нет. Загрузите фото или импортируйте их из менеджера каналов.
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
                    title: 'Удалить изображение из библиотеки?',
                    body: 'Если оно уже было на опубликованном сайте, файл сохранится для этой версии и отката.',
                    confirmLabel: 'Удалить',
                    tone: 'danger',
                  });
                  if (ok) run(() => deleteAssetAction(asset.id));
                }}
              />
            ))}
          </Grid>
        )}
      </Panel>

      {!readOnly && (
        <Panel aria-labelledby="site-assets-channex-title" data-testid="site-assets-channex">
          <PanelTitle>
            <span id="site-assets-channex-title">Импорт из менеджера каналов</span>
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
                Показать фото гостиницы
              </Button>
            </div>
          ) : photos.state !== 'READY' ? (
            <p className="muted" data-testid="site-assets-channex-state">
              {CHANNEX_STATE[photos.state] ?? 'Фото менеджера каналов сейчас недоступны'}
            </p>
          ) : photos.photos.length === 0 ? (
            <p className="muted">В менеджере каналов нет фото этой гостиницы.</p>
          ) : (
            <Stack gap="sm">
              <ul className="asset-import" aria-label="Фото гостиницы в менеджере каналов">
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
                        {p.description ?? `Фото ${p.position + 1}`}
                        {p.forRoomType && <span className="muted"> (номер)</span>}
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
                  Импортировать выбранные{chosen.size ? ` (${chosen.size})` : ''}
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
  const [alt, setAlt] = useState(asset.defaultAlt?.ru ?? '');
  const altId = `asset-alt-${asset.id}`;
  return (
    <Panel className="asset-card" data-testid="site-asset">
      <div className="asset-card__image">
        {asset.previewUrl ? (
          // подписанный адрес на срок: обычный <img>, оптимизатор Next не нужен и не должен его кэшировать
          <img src={asset.previewUrl} alt={asset.defaultAlt?.ru ?? 'Изображение без подписи'} loading="lazy" decoding="async" />
        ) : (
          <span className="muted">Нет предпросмотра</span>
        )}
      </div>
      <div className="asset-card__facts">
        <Badge tone={asset.kind === 'IMAGE' ? 'neutral' : 'info'}>{KIND[asset.kind]}</Badge>
        <span className="muted">
          {asset.width}×{asset.height}, {size(asset.byteSize)}
        </span>
        <span className="muted">{SOURCE[asset.source]}</span>
      </div>
      <form
        className="asset-card__alt"
        onSubmit={(e) => {
          e.preventDefault();
          onSaveAlt(alt);
        }}
      >
        <Field label="Подпись для незрячих (ALT)" controlId={altId}>
          <Input value={alt} maxLength={150} onChange={(e) => setAlt(e.currentTarget.value)} disabled={disabled} />
        </Field>
        <div className="asset-card__actions">
          <Button type="submit" tone="secondary" size="sm" disabled={disabled || alt === (asset.defaultAlt?.ru ?? '')}>
            Сохранить
          </Button>
          <Button type="button" tone="danger" size="sm" disabled={disabled} onClick={onDelete} data-testid="site-asset-delete">
            Удалить
          </Button>
        </div>
      </form>
    </Panel>
  );
}
