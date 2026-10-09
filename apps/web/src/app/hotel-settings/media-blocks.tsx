'use client';
import { useRef, useState, useTransition } from 'react';
import { Alert, Button } from '../../components/ui';
import { Icon } from '../../components/icon';
import type { PropertyMediaItem, PropertyMediaList } from '../../lib/api';
import { removeMediaAction, uploadMediaAction } from './actions';

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

const size = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} МБ` : `${Math.max(1, Math.round(bytes / 1024))} КБ`;

export function PhotosBlock({
  media,
  editable,
}: {
  media: PropertyMediaList | null;
  editable: boolean;
}) {
  const { error, pending, run } = useMedia();
  const input = useRef<HTMLInputElement>(null);
  if (!media) return null;
  const full = media.photos.length >= media.limits.maxPhotos;
  return (
    <div className="obj-media" data-testid="photos-block">
      <span className="obj-media__title">Фото объекта</span>
      <span className="obj-card__sub">Добавьте фото, которые будут отображаться на сайтах и в поиске.</span>
      <div className="obj-photos">
        {editable && media.storage === 'READY' && !full && (
          <button
            type="button"
            className="obj-photo obj-photo--add"
            disabled={pending}
            onClick={() => input.current?.click()}
          >
            <Icon name="plus" width={20} height={20} />
            <span>Добавить фото</span>
            <small>JPG, PNG (до 10 МБ)</small>
          </button>
        )}
        {media.photos.map((p: PropertyMediaItem) => (
          <figure key={p.id} className="obj-photo">
            {p.url && (
              <img src={p.url} alt={p.alt ?? 'Фото объекта'} width={p.width ?? undefined} height={p.height ?? undefined} />
            )}
            {editable && (
              <button
                type="button"
                className="obj-photo__remove"
                aria-label="Удалить фото"
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
          aria-label="Файл фото"
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
        <p className="obj-card__note">Хранилище файлов не включено: загрузка появится после включения.</p>
      )}
      {full && <p className="obj-card__note">Загружено максимум фото: {media.limits.maxPhotos}.</p>}
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
  const { error, pending, run } = useMedia();
  const input = useRef<HTMLInputElement>(null);
  if (!media) return null;
  const contract = media.contract;
  return (
    <div className="obj-media" data-testid="contract-block">
      <span className="obj-media__title">Договор / реквизиты</span>
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
          <span className="obj-file__size">{size(contract.byteSize)}</span>
          {editable && (
            <button
              type="button"
              className="obj-photo__remove obj-photo__remove--inline"
              aria-label="Удалить договор"
              disabled={pending}
              onClick={() => run(() => removeMediaAction('contract'))}
            >
              <Icon name="close" width={14} height={14} />
            </button>
          )}
        </div>
      ) : (
        <p className="obj-card__note">Файл договора не загружен.</p>
      )}
      {editable && media.storage === 'READY' && (
        <>
          <Button type="button" tone="secondary" size="sm" disabled={pending} onClick={() => input.current?.click()}>
            <Icon name="upload" width={16} height={16} />
            {contract ? 'Заменить договор' : 'Загрузить договор'}
          </Button>
          <input
            ref={input}
            type="file"
            accept="application/pdf"
            className="sr-only"
            tabIndex={-1}
            aria-label="Файл договора"
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
        <p className="obj-card__note">Хранилище файлов не включено: загрузка появится после включения.</p>
      )}
      {error && <Alert>{error}</Alert>}
    </div>
  );
}
