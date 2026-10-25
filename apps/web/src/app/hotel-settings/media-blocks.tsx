'use client';
import { useRef, useState, useTransition } from 'react';
import { Alert, Button } from '../../components/ui';
import { Icon } from '../../components/icon';
import type { PropertyMediaItem, PropertyMediaList } from '../../lib/api';
import { removeMediaAction, uploadMediaAction } from './actions';
import type { Translate } from '../../i18n';
import { useT } from '../../i18n/locale-provider';

/**
 * Фото и договор объекта на экране «Настройки объекта» (ADR-158, DATA_MODEL §32.3). Загрузка и удаление сохраняются
 * сразу, отдельно от кнопки «Сохранить изменения»: файл не часть формы сведений. Файловое поле без `name`, поэтому в
 * форму сведений не попадает. Без права правки блоки только показывают.
 */
function useMedia() {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (job: () => Promise<{ error: string | null }>) =>
    start(async () => {
      setError(null);
      const r = await job();
      setError(r.error);
    });
  return { error, pending, run };
}

const size = (bytes: number, t: Translate) =>
  bytes >= 1024 * 1024
    ? t('{n} МБ', { n: (bytes / 1024 / 1024).toFixed(1) })
    : t('{n} КБ', { n: Math.max(1, Math.round(bytes / 1024)) });

export function PhotosBlock({
  media,
  editable,
}: {
  media: PropertyMediaList | null;
  editable: boolean;
}) {
  const t = useT();
  const { error, pending, run } = useMedia();
  const input = useRef<HTMLInputElement>(null);
  if (!media) return null;
  const full = media.photos.length >= media.limits.maxPhotos;
  return (
    <div className="obj-media" data-testid="photos-block">
      <span className="obj-media__title">{t('Фото объекта')}</span>
      <span className="obj-card__sub">{t('Добавьте фото, которые будут отображаться на сайтах и в поиске.')}</span>
      <div className="obj-photos">
        {editable && media.storage === 'READY' && !full && (
          <button
            type="button"
            className="obj-photo obj-photo--add"
            disabled={pending}
            onClick={() => input.current?.click()}
          >
            <Icon name="plus" width={20} height={20} />
            <span>{t('Добавить фото')}</span>
            <small>{t('JPG, PNG (до 10 МБ)')}</small>
          </button>
        )}
        {media.photos.map((p: PropertyMediaItem) => (
          <figure key={p.id} className="obj-photo">
            {p.url && (
              <img src={p.url} alt={p.alt ?? t('Фото объекта')} width={p.width ?? undefined} height={p.height ?? undefined} />
            )}
            {editable && (
              <button
                type="button"
                className="obj-photo__remove"
                aria-label={t('Удалить фото')}
                disabled={pending}
                onClick={() => run(() => removeMediaAction('photo', p.id))}
              >
                <Icon name="close" width={14} height={14} />
              </button>
            )}
          </figure>
        ))}
      </div>
      {editable && (
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          tabIndex={-1}
          aria-label={t('Файл фото')}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            if (!file) return;
            const form = new FormData();
            form.set('file', file);
            run(() => uploadMediaAction('photos', form));
          }}
        />
      )}
      {media.storage === 'OFF' && editable && (
        <p className="obj-card__note">{t('Хранилище файлов не включено: загрузка появится после включения.')}</p>
      )}
      {full && <p className="obj-card__note">{t('Загружено максимум фото: {n}.', { n: media.limits.maxPhotos })}</p>}
      {error && <Alert>{error}</Alert>}
    </div>
  );
}

export function ContractBlock({
  media,
  editable,
}: {
  media: PropertyMediaList | null;
  editable: boolean;
}) {
  const t = useT();
  const { error, pending, run } = useMedia();
  const input = useRef<HTMLInputElement>(null);
  if (!media) return null;
  const contract = media.contract;
  return (
    <div className="obj-media" data-testid="contract-block">
      <span className="obj-media__title">{t('Договор / реквизиты')}</span>
      {contract ? (
        <div className="obj-file">
          <Icon name="file" width={18} height={18} />
          {contract.url ? (
            <a href={contract.url} target="_blank" rel="noopener noreferrer" className="obj-file__name">
              {contract.fileName}
            </a>
          ) : (
            <span className="obj-file__name">{contract.fileName}</span>
          )}
          <span className="obj-file__size">{size(contract.byteSize, t)}</span>
          {editable && (
            <button
              type="button"
              className="obj-photo__remove obj-photo__remove--inline"
              aria-label={t('Удалить договор')}
              disabled={pending}
              onClick={() => run(() => removeMediaAction('contract'))}
            >
              <Icon name="close" width={14} height={14} />
            </button>
          )}
        </div>
      ) : (
        <p className="obj-card__note">{t('Файл договора не загружен.')}</p>
      )}
      {editable && media.storage === 'READY' && (
        <>
          <Button type="button" tone="secondary" size="sm" disabled={pending} onClick={() => input.current?.click()}>
            <Icon name="upload" width={16} height={16} />
            {contract ? t('Заменить договор') : t('Загрузить договор')}
          </Button>
          <input
            ref={input}
            type="file"
            accept="application/pdf"
            className="sr-only"
            tabIndex={-1}
            aria-label={t('Файл договора')}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              if (!file) return;
              const form = new FormData();
              form.set('file', file);
              run(() => uploadMediaAction('contract', form));
            }}
          />
        </>
      )}
      {media.storage === 'OFF' && editable && (
        <p className="obj-card__note">{t('Хранилище файлов не включено: загрузка появится после включения.')}</p>
      )}
      {error && <Alert>{error}</Alert>}
    </div>
  );
}
