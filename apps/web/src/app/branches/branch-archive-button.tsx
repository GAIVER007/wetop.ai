'use client';
import { useRef, useState, useTransition, useId } from 'react';
import { useRouter } from 'next/navigation';
import { archiveBranch, restoreBranch } from './actions';
export function BranchArchiveButton({
  id,
  name,
  restore = false,
}: {
  id: string;
  name: string;
  restore?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    title = useId();
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const submit = () => {
    setError('');
    const form = new FormData();
    form.set('locationId', id);
    startTransition(async () => {
      const result = await (restore ? restoreBranch : archiveBranch)(form);
      if (result.error) setError(result.error);
      else {
        dialog.current?.close();
        router.refresh();
      }
    });
  };
  return (
    <>
      <button
        type="button"
        className={restore ? 'org-restore' : 'org-archive'}
        onClick={() => {
          setError('');
          dialog.current?.showModal();
        }}
      >
        {restore ? 'Восстановить' : 'Архивировать'}
      </button>
      <dialog
        ref={dialog}
        className="org-archive-dialog"
        aria-labelledby={title}
        onCancel={(e) => {
          e.stopPropagation();
          if (pending) e.preventDefault();
        }}
      >
        <h2 id={title}>{restore ? 'Восстановить объект?' : 'Архивировать объект?'}</h2>
        <strong>{name}</strong>
        <p>
          {restore
            ? 'Объект вернётся в активный список с прежними настройками и данными.'
            : 'Объект будет скрыт из активного списка. Бронирования, платежи и настройки сохранятся. Его можно восстановить из архива.'}
        </p>
        {error && <p role="alert">{error}</p>}
        <footer>
          <button type="button" disabled={pending} onClick={() => dialog.current?.close()}>
            Отмена
          </button>
          <button type="button" disabled={pending} onClick={submit}>
            {pending ? 'Сохраняем…' : restore ? 'Восстановить' : 'Архивировать'}
          </button>
        </footer>
      </dialog>
    </>
  );
}
