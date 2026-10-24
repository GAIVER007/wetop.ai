'use client';
import { useRef, useState, useTransition, useId } from 'react';
import { useRouter } from 'next/navigation';
import { archiveBranch, restoreBranch } from './actions';
import { Button } from '../../components/ui';
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
      <Button
        type="button"
        tone="secondary"
        size="sm"
        className={restore ? 'org-restore' : 'org-archive is-danger'}
        onClick={() => {
          setError('');
          dialog.current?.showModal();
        }}
      >
        {restore ? 'Восстановить' : 'Удалить филиал'}
      </Button>
      <dialog
        ref={dialog}
        className={restore ? 'org-archive-dialog' : 'org-archive-dialog org-archive-dialog--delete'}
        aria-labelledby={title}
        onCancel={(e) => {
          e.stopPropagation();
          if (pending) e.preventDefault();
        }}
      >
        <h2 id={title}>{restore ? 'Восстановить объект?' : 'Удалить филиал?'}</h2>
        <strong>{name}</strong>
        <p>
          {restore
            ? 'Объект вернётся в активный список с прежними настройками и данными.'
            : 'Филиал переместится в архив и исчезнет из активного списка. Бронирования, платежи и настройки сохранятся. Вы сможете восстановить его в разделе «Архив».'}
        </p>
        {error && <p role="alert">{error}</p>}
        <footer>
          <Button type="button" tone="secondary" disabled={pending} onClick={() => dialog.current?.close()}>
            Отмена
          </Button>
          <Button type="button" tone={restore ? 'primary' : 'danger'} disabled={pending} onClick={submit}>
            {pending ? 'Сохраняем…' : restore ? 'Восстановить' : 'Удалить филиал'}
          </Button>
        </footer>
      </dialog>
    </>
  );
}
