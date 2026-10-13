'use client';
import { useEffect, useRef, useState, useTransition, type FormEvent } from 'react';
import { Icon } from '../../components/icon';
import { saveBusinessCard } from './actions';
import type { BusinessCardView } from './reference-board';
export function BusinessCardEditor({
  business,
  onClose,
}: {
  business: BusinessCardView;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<string | null>(business.coverUrl);
  const [removeCover, setRemoveCover] = useState(false);
  const localUrl = useRef<string | null>(null);
  useEffect(() => {
    const target = dialog.current;
    target?.showModal();
    return () => {
      target?.close();
      if (localUrl.current) URL.revokeObjectURL(localUrl.current);
    };
  }, []);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError('');
    form.set('businessId', business.id);
    form.set('expectedUpdatedAt', business.updatedAt);
    form.set('removeCover', removeCover ? '1' : '0');
    startTransition(async () => {
      const result = await saveBusinessCard(form);
      if (result.error) setError(result.error);
      else onClose();
    });
  };
  return (
    <dialog
      ref={dialog}
      className="org-editor"
      aria-labelledby="org-editor-title"
      onCancel={(e) => {
        if (pending) e.preventDefault();
        else onClose();
      }}
    >
      <form onSubmit={submit}>
        <header>
          <div>
            <h2 id="org-editor-title">Редактировать карточку</h2>
            <p>{business.name}</p>
          </div>
          <button type="button" aria-label="Закрыть редактор" disabled={pending} onClick={onClose}>
            <Icon name="close" />
          </button>
        </header>
        <label>
          Название бизнеса
          <input
            name="name"
            required
            maxLength={200}
            defaultValue={business.name}
            disabled={pending}
          />
        </label>
        <label>
          Описание
          <textarea
            name="description"
            maxLength={1000}
            rows={4}
            defaultValue={business.description ?? ''}
            disabled={pending}
          />
          <small>До 1000 символов</small>
        </label>
        <div className="org-editor-photo">
          {preview ? (
            <img src={preview} alt="Предпросмотр обложки" />
          ) : (
            <div>
              <Icon name="image" />
              <span>Обложка не выбрана</span>
            </div>
          )}
        </div>
        <label>
          Изменить фото
          <input
            type="file"
            name="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={pending || !business.canUpload}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 5 * 1024 * 1024) {
                setError('Фото должно быть не больше 5 МБ.');
                e.target.value = '';
                return;
              }
              if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
                setError('Выберите JPEG, PNG или WebP.');
                e.target.value = '';
                return;
              }
              if (localUrl.current) URL.revokeObjectURL(localUrl.current);
              localUrl.current = URL.createObjectURL(file);
              setPreview(localUrl.current);
              setRemoveCover(false);
              setError('');
            }}
          />
          <small>
            {business.canUpload
              ? 'JPEG, PNG или WebP, до 5 МБ'
              : 'Хранилище фото не подключено. Название и описание можно изменить.'}
          </small>
        </label>
        {(preview || business.hasCover) && !removeCover && (
          <button
            type="button"
            className="org-remove-photo"
            disabled={pending}
            onClick={() => {
              setRemoveCover(true);
              setPreview(null);
              const input = dialog.current?.querySelector<HTMLInputElement>('input[type=file]');
              if (input) input.value = '';
            }}
          >
            Убрать обложку
          </button>
        )}
        {error && (
          <p role="alert" className="org-editor-error">
            {error}
          </p>
        )}
        <footer>
          <button type="button" onClick={onClose} disabled={pending}>
            Отмена
          </button>
          <button type="submit" disabled={pending}>
            {pending ? 'Сохраняем…' : 'Сохранить изменения'}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
